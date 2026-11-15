/**
 * The long-session probe (#525): counts everything on the page that has a lifetime.
 *
 * `installProbe` runs in the page before any of the game's code (Playwright `addInitScript`), so
 * none of it ships in the bundle. It wraps the platform's constructors and registration calls and
 * keeps weak references only: the probe never keeps a canvas, an image or a context alive, so what
 * it counts after a forced garbage collection is what the game itself still holds.
 *
 * What it counts, and why each matters on an iPad:
 * - canvases and their pixel area (iOS caps the total of every canvas backing store on the page,
 *   and a canvas dropped without being sized to 0x0 keeps its store until it is collected);
 * - WebGL contexts and the textures, framebuffers, renderbuffers, buffers, programs, shaders and
 *   vertex arrays alive in each, with the bytes of every level-0 texture upload;
 * - listeners on the page-lifetime targets (window, document, the visual viewport, media queries),
 *   by event type, since those never die with a scene's DOM;
 * - observers still observing, intervals, pending timeouts and animation frames;
 * - images, audio elements, audio contexts and decoded audio buffers.
 *
 * The probe must stay self-contained: Playwright serialises the function, so it can use nothing
 * from module scope.
 */

export interface ProbeCanvasRow {
  readonly width: number;
  readonly height: number;
  readonly connected: boolean;
  readonly context: string | null;
  readonly site: string | null;
}

export interface ProbeSample {
  /** Canvases not yet collected: every one of them, then those with a context (a backing store). */
  readonly canvases: number;
  readonly canvasArea: number;
  readonly canvasesWithContext: number;
  readonly canvasAreaWithContext: number;
  readonly canvasesConnected: number;
  /** The largest total area of canvases with a context seen since the last `resetPeak`. */
  readonly peakCanvasArea: number;
  readonly peakCanvases: number;
  /** What the peak was made of: `WIDTHxHEIGHT` to the number of canvases of that size. */
  readonly peakBySize: Readonly<Record<string, number>>;
  readonly glContexts: number;
  readonly glContextsLive: number;
  readonly glTextures: number;
  readonly glTextureBytes: number;
  /** The most textures, and texture bytes, alive at once since the last `resetPeak`. */
  readonly peakGlTextures: number;
  readonly peakGlTextureBytes: number;
  readonly glFramebuffers: number;
  readonly glRenderbuffers: number;
  readonly glBuffers: number;
  readonly glPrograms: number;
  readonly glShaders: number;
  readonly glVertexArrays: number;
  readonly globalListeners: number;
  readonly globalListenersByKey: Readonly<Record<string, number>>;
  readonly resizeObservers: number;
  readonly mutationObservers: number;
  readonly intersectionObservers: number;
  readonly intervals: number;
  readonly timeouts: number;
  readonly animationFrames: number;
  readonly images: number;
  readonly imageArea: number;
  readonly audioElements: number;
  readonly audioContexts: number;
  readonly audioBuffers: number;
  readonly audioBufferBytes: number;
  readonly domNodes: number;
  readonly largestCanvases: readonly ProbeCanvasRow[];
  /** Where the listeners on page-lifetime targets were added (only with `stacks`). */
  readonly listenerSites: Readonly<Record<string, number>>;
}

export interface SoakProbe {
  sample(): ProbeSample;
  resetPeak(): void;
}

declare global {
  interface Window {
    __soak?: SoakProbe;
  }
}

export function installProbe(options: { stacks: boolean }): void {
  if (window.__soak) return;
  const stacks = options.stacks;
  type Fn = (...args: unknown[]) => unknown;
  type Methods = Record<string, Fn | undefined>;
  type Ctor<T> = new (...args: never[]) => T;
  const put = (name: string, value: unknown): void => {
    Reflect.set(window, name, value);
  };

  /** The first stack frame outside the probe, for naming the owner of a leak on a dev build. */
  const site = (): string | null => {
    if (!stacks) return null;
    const lines = (new Error().stack ?? '').split('\n').slice(3, 9);
    return lines.map((line) => line.trim().replace(/^at /, '')).join(' < ');
  };

  /* ------------------------------------------------------------------ */
  /* Canvases                                                            */
  /* ------------------------------------------------------------------ */

  interface CanvasNote {
    context: string | null;
    site: string | null;
  }
  const canvases = new Set<WeakRef<HTMLCanvasElement | OffscreenCanvas>>();
  const canvasNotes = new WeakMap<object, CanvasNote>();
  const trackCanvas = (canvas: HTMLCanvasElement | OffscreenCanvas): void => {
    if (canvasNotes.has(canvas)) return;
    canvasNotes.set(canvas, { context: null, site: site() });
    canvases.add(new WeakRef(canvas));
  };

  const createElement = Document.prototype.createElement;
  Document.prototype.createElement = function (
    this: Document,
    tagName: string,
    creation?: ElementCreationOptions,
  ): HTMLElement {
    const element = createElement.call(this, tagName, creation);
    const tag = String(tagName).toLowerCase();
    if (tag === 'canvas') trackCanvas(element as HTMLCanvasElement);
    else if (tag === 'img') trackImage(element as HTMLImageElement);
    else if (tag === 'audio' || tag === 'video') trackMedia(element as HTMLMediaElement);
    return element;
  } as typeof Document.prototype.createElement;

  if (typeof OffscreenCanvas !== 'undefined') {
    const Native = OffscreenCanvas;
    const Wrapped = function (this: unknown, width: number, height: number): OffscreenCanvas {
      const canvas = new Native(width, height);
      trackCanvas(canvas);
      return canvas;
    } as unknown as typeof OffscreenCanvas;
    Wrapped.prototype = Native.prototype;
    put('OffscreenCanvas', Wrapped);
  }

  /* ------------------------------------------------------------------ */
  /* WebGL                                                               */
  /* ------------------------------------------------------------------ */

  interface GlCounts {
    textures: number;
    framebuffers: number;
    renderbuffers: number;
    buffers: number;
    programs: number;
    shaders: number;
    vertexArrays: number;
    textureBytes: number;
  }
  const contexts = new Set<WeakRef<WebGLRenderingContext | WebGL2RenderingContext>>();
  const glCounts = new WeakMap<object, GlCounts>();

  const instrumentGl = (gl: WebGLRenderingContext | WebGL2RenderingContext): void => {
    if (glCounts.has(gl)) return;
    const counts: GlCounts = {
      textures: 0,
      framebuffers: 0,
      renderbuffers: 0,
      buffers: 0,
      programs: 0,
      shaders: 0,
      vertexArrays: 0,
      textureBytes: 0,
    };
    glCounts.set(gl, counts);
    contexts.add(new WeakRef(gl));
    const anyGl = gl as unknown as Methods;
    const pair = (create: string, remove: string, key: keyof GlCounts): void => {
      const made = anyGl[create];
      const dropped = anyGl[remove];
      if (!made || !dropped) return;
      const alive = new WeakSet<object>();
      anyGl[create] = function (...args: unknown[]): unknown {
        const object = made.apply(gl, args) as object | null;
        if (object) {
          alive.add(object);
          counts[key] += 1;
        }
        return object;
      };
      anyGl[remove] = function (target: unknown, ...rest: unknown[]): unknown {
        const object = target as object | null;
        if (object && alive.has(object)) {
          alive.delete(object);
          counts[key] -= 1;
          if (key === 'textures') {
            counts.textureBytes -= textureBytes.get(object) ?? 0;
            textureBytes.delete(object);
          }
        }
        return dropped.call(gl, object, ...rest);
      };
    };
    const textureBytes = new WeakMap<object, number>();
    const bound = new Map<number, object | null>();
    pair('createTexture', 'deleteTexture', 'textures');
    pair('createFramebuffer', 'deleteFramebuffer', 'framebuffers');
    pair('createRenderbuffer', 'deleteRenderbuffer', 'renderbuffers');
    pair('createBuffer', 'deleteBuffer', 'buffers');
    pair('createProgram', 'deleteProgram', 'programs');
    pair('createShader', 'deleteShader', 'shaders');
    pair('createVertexArray', 'deleteVertexArray', 'vertexArrays');

    const bindTexture = anyGl.bindTexture as Fn;
    anyGl.bindTexture = function (target: unknown, texture: unknown): unknown {
      bound.set(target as number, texture as object | null);
      return bindTexture.call(gl, target, texture);
    };
    const note = (target: number, width: number, height: number): void => {
      const texture = bound.get(target);
      if (!texture || !Number.isFinite(width) || !Number.isFinite(height)) return;
      const bytes = Math.max(0, width) * Math.max(0, height) * 4;
      counts.textureBytes += bytes - (textureBytes.get(texture) ?? 0);
      textureBytes.set(texture, bytes);
    };
    interface Sized {
      naturalWidth?: number;
      naturalHeight?: number;
      videoWidth?: number;
      videoHeight?: number;
      width?: number;
      height?: number;
    }
    const texImage2D = anyGl.texImage2D as Fn;
    anyGl.texImage2D = function (...args: unknown[]): unknown {
      if (args[1] === 0) {
        if (args.length >= 9) note(args[0] as number, args[3] as number, args[4] as number);
        else {
          const source = args[5] as Sized | undefined;
          note(
            args[0] as number,
            source?.naturalWidth ?? source?.videoWidth ?? source?.width ?? 0,
            source?.naturalHeight ?? source?.videoHeight ?? source?.height ?? 0,
          );
        }
      }
      return texImage2D.apply(gl, args);
    };
    const texStorage2D = anyGl.texStorage2D;
    if (texStorage2D) {
      anyGl.texStorage2D = function (...args: unknown[]): unknown {
        note(args[0] as number, args[3] as number, args[4] as number);
        return texStorage2D.apply(gl, args);
      };
    }
  };

  const wrapGetContext = (proto: object): void => {
    const methods = proto as Methods;
    const getContext = methods.getContext as Fn;
    methods.getContext = function (this: HTMLCanvasElement, ...args: unknown[]): unknown {
      const kind = String(args[0]);
      const context = getContext.apply(this, args);
      if (context) {
        trackCanvas(this);
        const noted = canvasNotes.get(this);
        if (noted) noted.context = kind;
        if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') {
          instrumentGl(context as WebGLRenderingContext);
        }
      }
      return context;
    } as Fn;
  };
  wrapGetContext(HTMLCanvasElement.prototype);
  if (typeof OffscreenCanvas !== 'undefined') wrapGetContext(OffscreenCanvas.prototype);

  /* ------------------------------------------------------------------ */
  /* Listeners on page-lifetime targets                                  */
  /* ------------------------------------------------------------------ */

  const globalName = (target: unknown): string | null => {
    if (target === window) return 'window';
    if (target === document) return 'document';
    if (target === document.documentElement) return 'html';
    if (target === document.body) return 'body';
    if (window.visualViewport && target === window.visualViewport) return 'visualViewport';
    if (typeof MediaQueryList !== 'undefined' && target instanceof MediaQueryList) return 'media';
    if (typeof navigator !== 'undefined' && target === navigator.serviceWorker)
      return 'serviceWorker';
    return null;
  };
  interface Registration {
    readonly key: string;
    readonly capture: boolean;
    readonly site: string | null;
    undo: (() => void) | null;
  }
  const registrations = new Map<object, Map<string, Map<unknown, Registration[]>>>();
  const listenerTotals = new Map<string, number>();
  const listenerSites = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string, by: number): void => {
    const next = (map.get(key) ?? 0) + by;
    if (next === 0) map.delete(key);
    else map.set(key, next);
  };
  const captureOf = (opts: unknown): boolean =>
    typeof opts === 'boolean'
      ? opts
      : Boolean((opts as { capture?: boolean } | undefined)?.capture);

  const forget = (target: object, type: string, listener: unknown, capture: boolean): void => {
    const rows = registrations.get(target)?.get(type)?.get(listener);
    if (!rows) return;
    const index = rows.findIndex((row) => row.capture === capture);
    if (index < 0) return;
    const [row] = rows.splice(index, 1);
    if (!row) return;
    row.undo?.();
    bump(listenerTotals, row.key, -1);
    if (row.site) bump(listenerSites, `${row.key} @ ${row.site}`, -1);
    if (rows.length === 0) registrations.get(target)?.get(type)?.delete(listener);
  };

  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    opts?: boolean | AddEventListenerOptions,
  ): void {
    const name = listener ? globalName(this) : null;
    if (name) {
      const capture = captureOf(opts);
      const byType = registrations.get(this) ?? new Map<string, Map<unknown, Registration[]>>();
      registrations.set(this, byType);
      const byListener = byType.get(type) ?? new Map<unknown, Registration[]>();
      byType.set(type, byListener);
      const rows = byListener.get(listener) ?? [];
      byListener.set(listener, rows);
      // The platform ignores a second identical registration, and so does the count.
      if (!rows.some((row) => row.capture === capture)) {
        const key = `${name}:${type}`;
        const row: Registration = { key, capture, site: site(), undo: null };
        rows.push(row);
        bump(listenerTotals, key, 1);
        if (row.site) bump(listenerSites, `${key} @ ${row.site}`, 1);
        const target = this as object;
        const drop = (): void => forget(target, type, listener, capture);
        if (typeof opts === 'object' && opts) {
          if (opts.once) {
            // Fires after the listener itself, then retires the count as the platform retires it.
            const fired = (): void => drop();
            add.call(this, type, fired, { once: true, capture });
            row.undo = () => remove.call(this, type, fired, { capture });
          }
          const signal = opts.signal;
          if (signal) add.call(signal, 'abort', drop, { once: true });
        }
      }
    }
    add.call(this, type, listener, opts);
  };
  EventTarget.prototype.removeEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    opts?: boolean | EventListenerOptions,
  ): void {
    if (listener && globalName(this)) forget(this, type, listener, captureOf(opts));
    remove.call(this, type, listener, opts);
  };

  /* ------------------------------------------------------------------ */
  /* Observers                                                           */
  /* ------------------------------------------------------------------ */

  const observing = { resize: 0, mutation: 0, intersection: 0 };
  interface Observer {
    observe(...args: unknown[]): void;
    disconnect(): void;
  }
  const wrapObserver = (name: string, key: keyof typeof observing): void => {
    const Native = Reflect.get(window, name) as Ctor<Observer> | undefined;
    if (!Native) return;
    const active = new WeakSet<object>();
    const Wrapped = class extends Native {
      override observe(...args: unknown[]): void {
        if (!active.has(this)) {
          active.add(this);
          observing[key] += 1;
        }
        super.observe(...args);
      }
      override disconnect(): void {
        if (active.has(this)) {
          active.delete(this);
          observing[key] -= 1;
        }
        super.disconnect();
      }
    };
    put(name, Wrapped);
  };
  wrapObserver('ResizeObserver', 'resize');
  wrapObserver('MutationObserver', 'mutation');
  wrapObserver('IntersectionObserver', 'intersection');

  /* ------------------------------------------------------------------ */
  /* Timers and frames                                                   */
  /* ------------------------------------------------------------------ */

  const timeouts = new Set<number>();
  const intervals = new Set<number>();
  const frames = new Set<number>();
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCaf = window.cancelAnimationFrame.bind(window);
  put('setTimeout', (handler: TimerHandler, delay?: number, ...args: unknown[]): number => {
    if (typeof handler !== 'function') return nativeSetTimeout(handler, delay, ...args);
    const id = nativeSetTimeout(() => {
      timeouts.delete(id);
      (handler as Fn)(...args);
    }, delay);
    timeouts.add(id);
    return id;
  });
  put('clearTimeout', (id?: number): void => {
    if (id !== undefined) timeouts.delete(id);
    nativeClearTimeout(id);
  });
  put('setInterval', (handler: TimerHandler, delay?: number, ...args: unknown[]): number => {
    const id = nativeSetInterval(handler, delay, ...args);
    intervals.add(id);
    return id;
  });
  put('clearInterval', (id?: number): void => {
    if (id !== undefined) intervals.delete(id);
    nativeClearInterval(id);
  });
  put('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const id = nativeRaf((stamp) => {
      frames.delete(id);
      callback(stamp);
    });
    frames.add(id);
    return id;
  });
  put('cancelAnimationFrame', (id: number): void => {
    frames.delete(id);
    nativeCaf(id);
  });

  /* ------------------------------------------------------------------ */
  /* Images and audio                                                    */
  /* ------------------------------------------------------------------ */

  const images = new Set<WeakRef<HTMLImageElement>>();
  const seenImages = new WeakSet<object>();
  function trackImage(image: HTMLImageElement): void {
    if (seenImages.has(image)) return;
    seenImages.add(image);
    images.add(new WeakRef(image));
  }
  const NativeImage = window.Image;
  const WrappedImage = function (this: unknown, width?: number, height?: number): HTMLImageElement {
    const image = new NativeImage(width, height);
    trackImage(image);
    return image;
  } as unknown as typeof Image;
  WrappedImage.prototype = NativeImage.prototype;
  put('Image', WrappedImage);

  const media = new Set<WeakRef<HTMLMediaElement>>();
  const seenMedia = new WeakSet<object>();
  function trackMedia(element: HTMLMediaElement): void {
    if (seenMedia.has(element)) return;
    seenMedia.add(element);
    media.add(new WeakRef(element));
  }
  if (typeof Audio !== 'undefined') {
    const NativeAudio = window.Audio;
    const WrappedAudio = function (this: unknown, src?: string): HTMLAudioElement {
      const audio = new NativeAudio(src);
      trackMedia(audio);
      return audio;
    } as unknown as typeof Audio;
    WrappedAudio.prototype = NativeAudio.prototype;
    put('Audio', WrappedAudio);
  }

  const audioContexts = new Set<WeakRef<AudioContext>>();
  const audioBuffers = new Set<WeakRef<AudioBuffer>>();
  const seenBuffers = new WeakSet<object>();
  const trackBuffer = (buffer: AudioBuffer | null | undefined): void => {
    if (!buffer || seenBuffers.has(buffer)) return;
    seenBuffers.add(buffer);
    audioBuffers.add(new WeakRef(buffer));
  };
  interface AudioHost {
    createBuffer(...args: unknown[]): AudioBuffer;
    decodeAudioData(
      data: ArrayBuffer,
      ok?: (buffer: AudioBuffer) => void,
      fail?: (error: unknown) => void,
    ): Promise<AudioBuffer>;
  }
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Native = Reflect.get(window, name) as (new (...args: unknown[]) => AudioHost) | undefined;
    if (!Native) continue;
    const Wrapped = class extends Native {
      constructor(...args: unknown[]) {
        super(...args);
        audioContexts.add(new WeakRef(this as unknown as AudioContext));
      }
      override createBuffer(...args: unknown[]): AudioBuffer {
        const buffer = super.createBuffer(...args);
        trackBuffer(buffer);
        return buffer;
      }
      override decodeAudioData(
        data: ArrayBuffer,
        ok?: (buffer: AudioBuffer) => void,
        fail?: (error: unknown) => void,
      ): Promise<AudioBuffer> {
        const done = super.decodeAudioData(
          data,
          (buffer: AudioBuffer) => {
            trackBuffer(buffer);
            ok?.(buffer);
          },
          fail,
        );
        return done.then((buffer) => {
          trackBuffer(buffer);
          return buffer;
        });
      }
    };
    put(name, Wrapped);
  }

  /* ------------------------------------------------------------------ */
  /* Sampling                                                            */
  /* ------------------------------------------------------------------ */

  const eachLive = <T extends object>(set: Set<WeakRef<T>>, visit: (value: T) => void): void => {
    for (const ref of set) {
      const value = ref.deref();
      if (value) visit(value);
      else set.delete(ref);
    }
  };

  const canvasTotals = (): {
    count: number;
    area: number;
    withContext: number;
    areaCtx: number;
  } => {
    let count = 0;
    let area = 0;
    let withContext = 0;
    let areaCtx = 0;
    eachLive(canvases, (canvas) => {
      const pixels = canvas.width * canvas.height;
      count += 1;
      area += pixels;
      if (canvasNotes.get(canvas)?.context) {
        withContext += 1;
        areaCtx += pixels;
      }
    });
    return { count, area, withContext, areaCtx };
  };

  // The peak is what the page held at its worst, garbage not yet collected included: iOS counts
  // a dropped canvas until its store is actually released.
  let peakArea = 0;
  let peakCount = 0;
  let peakBySize: Record<string, number> = {};
  const bySize = (): Record<string, number> => {
    const sizes = new Map<string, number>();
    eachLive(canvases, (canvas) => {
      if (!canvasNotes.get(canvas)?.context || canvas.width * canvas.height === 0) return;
      const onPage = 'isConnected' in canvas && canvas.isConnected;
      const key = `${canvas.width}x${canvas.height}${onPage ? ' on the page' : ''}`;
      sizes.set(key, (sizes.get(key) ?? 0) + 1);
    });
    const area = ([key, count]: [string, number]): number => {
      const [width, height] = key.split(' ')[0]?.split('x').map(Number) ?? [];
      return (width ?? 0) * (height ?? 0) * count;
    };
    return Object.fromEntries([...sizes].sort((a, b) => area(b) - area(a)).slice(0, 16));
  };
  let peakTextures = 0;
  let peakTextureBytes = 0;
  const glTotals = (): { textures: number; bytes: number } => {
    let textures = 0;
    let bytes = 0;
    eachLive(contexts, (context) => {
      const counts = glCounts.get(context);
      if (!counts || context.isContextLost()) return;
      textures += counts.textures;
      bytes += counts.textureBytes;
    });
    return { textures, bytes };
  };
  nativeSetInterval(() => {
    const totals = canvasTotals();
    if (totals.areaCtx > peakArea) {
      peakArea = totals.areaCtx;
      peakBySize = bySize();
    }
    if (totals.withContext > peakCount) peakCount = totals.withContext;
    const gl = glTotals();
    if (gl.textures > peakTextures) peakTextures = gl.textures;
    if (gl.bytes > peakTextureBytes) peakTextureBytes = gl.bytes;
  }, 200);

  window.__soak = {
    resetPeak(): void {
      peakArea = 0;
      peakCount = 0;
      peakBySize = {};
      peakTextures = 0;
      peakTextureBytes = 0;
    },
    sample(): ProbeSample {
      const totals = canvasTotals();
      const rows: ProbeCanvasRow[] = [];
      let connected = 0;
      eachLive(canvases, (canvas) => {
        const isConnected = 'isConnected' in canvas ? canvas.isConnected : false;
        if (isConnected) connected += 1;
        const noted = canvasNotes.get(canvas);
        rows.push({
          width: canvas.width,
          height: canvas.height,
          connected: isConnected,
          context: noted?.context ?? null,
          site: noted?.site ?? null,
        });
      });
      rows.sort((a, b) => b.width * b.height - a.width * a.height);

      const gl: GlCounts = {
        textures: 0,
        framebuffers: 0,
        renderbuffers: 0,
        buffers: 0,
        programs: 0,
        shaders: 0,
        vertexArrays: 0,
        textureBytes: 0,
      };
      let glContexts = 0;
      let glContextsLive = 0;
      eachLive(contexts, (context) => {
        glContexts += 1;
        if (context.isContextLost()) return;
        glContextsLive += 1;
        const counts = glCounts.get(context);
        if (!counts) return;
        for (const key of Object.keys(gl) as (keyof GlCounts)[]) gl[key] += counts[key];
      });

      let imageCount = 0;
      let imageArea = 0;
      eachLive(images, (image) => {
        imageCount += 1;
        imageArea += image.naturalWidth * image.naturalHeight;
      });
      let mediaCount = 0;
      eachLive(media, () => {
        mediaCount += 1;
      });
      let contextCount = 0;
      eachLive(audioContexts, (context) => {
        if (context.state !== 'closed') contextCount += 1;
      });
      let bufferCount = 0;
      let bufferBytes = 0;
      eachLive(audioBuffers, (buffer) => {
        bufferCount += 1;
        bufferBytes += buffer.length * buffer.numberOfChannels * 4;
      });

      let listeners = 0;
      for (const value of listenerTotals.values()) listeners += value;

      return {
        canvases: totals.count,
        canvasArea: totals.area,
        canvasesWithContext: totals.withContext,
        canvasAreaWithContext: totals.areaCtx,
        canvasesConnected: connected,
        peakCanvasArea: Math.max(peakArea, totals.areaCtx),
        peakCanvases: Math.max(peakCount, totals.withContext),
        peakBySize,
        glContexts,
        glContextsLive,
        glTextures: gl.textures,
        glTextureBytes: gl.textureBytes,
        peakGlTextures: Math.max(peakTextures, gl.textures),
        peakGlTextureBytes: Math.max(peakTextureBytes, gl.textureBytes),
        glFramebuffers: gl.framebuffers,
        glRenderbuffers: gl.renderbuffers,
        glBuffers: gl.buffers,
        glPrograms: gl.programs,
        glShaders: gl.shaders,
        glVertexArrays: gl.vertexArrays,
        globalListeners: listeners,
        globalListenersByKey: Object.fromEntries([...listenerTotals].sort()),
        resizeObservers: observing.resize,
        mutationObservers: observing.mutation,
        intersectionObservers: observing.intersection,
        intervals: intervals.size,
        timeouts: timeouts.size,
        animationFrames: frames.size,
        images: imageCount,
        imageArea,
        audioElements: mediaCount,
        audioContexts: contextCount,
        audioBuffers: bufferCount,
        audioBufferBytes: bufferBytes,
        domNodes: document.getElementsByTagName('*').length,
        largestCanvases: rows.slice(0, 40),
        listenerSites: Object.fromEntries([...listenerSites].sort()),
      };
    },
  };
}
