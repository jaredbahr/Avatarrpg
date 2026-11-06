import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CameraInfo } from '../src/app/App';
import type { Camera } from '../src/render/camera';
import type { MapView } from '../src/render/view';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

interface Point {
  x: number;
  y: number;
}
interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
interface SourceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface OpaquePixel extends Point {
  r: number;
  g: number;
  b: number;
}
interface ObservedSprite {
  visible: boolean;
  anchor: Point;
  worldTransform: { apply(point: Point): Point };
  texture: {
    frame: { x: number; y: number; width: number; height: number };
    source: { resource: CanvasImageSource };
  };
}
interface BackendObserver {
  ctx?: CanvasRenderingContext2D;
  unitSprites: Map<string, ObservedSprite>;
  pixelTalkSprites: ObservedSprite[];
  pixelTalkUsed: number;
  drawTalkPip(camera: Camera, anchor: Point, alpha: number, nudge: Point): void;
}
interface SceneObserver {
  needsSettle: boolean;
  renderer: {
    camera: Camera;
    backend: BackendObserver;
    draw(view: MapView): void;
  };
}
interface PipSample {
  walking: boolean;
  clip: string;
  cel: string;
  time: number;
  head: Bounds;
  pip: Bounds;
  body: Point;
  gap: number;
  fullyVisible: boolean;
}
interface PipReview {
  active: boolean;
  samples: PipSample[];
  overflow: boolean;
  observerErrors: string[];
  viewFrames: { walking: number; idle: number };
  stop(): void;
}
interface PipReport {
  samples: PipSample[];
  overflow: boolean;
  observerErrors: string[];
  viewFrames: PipReview['viewFrames'];
  state: string;
  backend: string | null;
  camera: CameraInfo | null;
  scale: number;
  viewport: { width: number; height: number; dpr: number };
}

declare global {
  interface Window {
    npcTalkPipReview?: PipReview;
  }
}

/** Observe the real draw calls; do not replay a view or substitute any renderer geometry. */
async function observePips(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app) throw new Error('Missing running game');
    const scene = (app as unknown as { scene: SceneObserver }).scene;
    const renderer = scene.renderer;
    const backend = renderer.backend;
    const review: PipReview = {
      active: false,
      samples: [],
      overflow: false,
      observerErrors: [],
      viewFrames: { walking: 0, idle: 0 },
      stop: () => undefined,
    };
    window.npcTalkPipReview = review;
    const cache = new WeakMap<object, Map<string, OpaquePixel[]>>();
    const sourceIds = new WeakMap<object, number>();
    let nextSourceId = 0;
    const sourceId = (source: CanvasImageSource): number => {
      let id = sourceIds.get(source);
      if (id === undefined) {
        id = nextSourceId++;
        sourceIds.set(source, id);
      }
      return id;
    };
    const pixels = (source: CanvasImageSource, rect: SourceRect): OpaquePixel[] => {
      let entries = cache.get(source);
      if (!entries) {
        entries = new Map();
        cache.set(source, entries);
      }
      const key = `${rect.x},${rect.y},${rect.w},${rect.h}`;
      const known = entries.get(key);
      if (known) return known;
      const canvas = document.createElement('canvas');
      canvas.width = rect.w;
      canvas.height = rect.h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('No alpha-mask context');
      ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      const data = ctx.getImageData(0, 0, rect.w, rect.h).data;
      const ink: OpaquePixel[] = [];
      for (let y = 0; y < rect.h; y++)
        for (let x = 0; x < rect.w; x++) {
          const offset = (y * rect.w + x) * 4;
          if ((data[offset + 3] ?? 0) <= 8) continue;
          ink.push({
            x,
            y,
            r: data[offset] ?? 0,
            g: data[offset + 1] ?? 0,
            b: data[offset + 2] ?? 0,
          });
        }
      entries.set(key, ink);
      return ink;
    };
    const bounds = (
      ink: readonly OpaquePixel[],
      transform: (x: number, y: number) => Point,
    ): Bounds => {
      if (!ink.length) throw new Error('Drawn sprite has no opaque alpha pixels');
      const result: Bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
      for (const pixel of ink)
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ] as const) {
          const point = transform(pixel.x + dx, pixel.y + dy);
          result.left = Math.min(result.left, point.x);
          result.right = Math.max(result.right, point.x);
          result.top = Math.min(result.top, point.y);
          result.bottom = Math.max(result.bottom, point.y);
        }
      return result;
    };
    const bodyPoint = (
      ink: readonly OpaquePixel[],
      transform: (x: number, y: number) => Point,
      box: Bounds,
    ): Point => {
      const centre = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
      let closest: Point | undefined;
      let distance = Infinity;
      for (const pixel of ink) {
        const point = transform(pixel.x + 0.5, pixel.y + 0.5);
        const gap = Math.hypot(point.x - centre.x, point.y - centre.y);
        if (gap < distance) {
          closest = point;
          distance = gap;
        }
      }
      if (!closest) throw new Error('No opaque body point');
      return closest;
    };
    const gold = (ink: readonly OpaquePixel[]) =>
      ink.some((p) => p.r > p.g && p.g > p.b && p.r > 150);
    let view: MapView | null = null;
    const record = (head: Bounds, pip: Bounds, body: Point, cel: string) => {
      const npc = view?.npcs.find((candidate) => candidate.id === 'lw.npc.dorin');
      if (!review.active || !npc || (npc.alpha ?? 1) < 0.99) return;
      if (review.samples.length >= 20_000) {
        review.overflow = true;
        return;
      }
      const { width, height } = renderer.camera.viewport;
      const fullyVisible = [head, pip].every(
        (b) => b.left >= 0 && b.top >= 0 && b.right <= width && b.bottom <= height,
      );
      review.samples.push({
        head,
        pip,
        body,
        cel,
        fullyVisible,
        walking: npc.walking === true,
        clip: npc.clip ?? 'rest',
        time: performance.now(),
        gap: (head.top - pip.bottom) / renderer.camera.scale,
      });
    };
    const observerError = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!review.observerErrors.includes(message)) review.observerErrors.push(message);
    };
    type DrawArgs =
      | [CanvasImageSource, number, number]
      | [CanvasImageSource, number, number, number, number]
      | [CanvasImageSource, number, number, number, number, number, number, number, number];
    let pending: { head: Bounds; body: Point; cel: string } | null = null;
    const ctx = backend.ctx;
    const originalImage = ctx?.drawImage;
    if (ctx && originalImage) {
      const forward = originalImage.bind(ctx);
      ctx.drawImage = (...args: DrawArgs) => {
        const matrix = ctx.getTransform();
        if (args.length === 3) forward(...args);
        else if (args.length === 5) forward(...args);
        else forward(...args);
        if (!review.active) return;
        try {
          const source = args[0];
          const url = 'src' in source && typeof source.src === 'string' ? source.src : '';
          const dpr = renderer.camera.viewport.dpr;
          if (url.includes('dorin') && args.length === 9) {
            const [, sx, sy, sw, sh, dx, dy, dw, dh] = args;
            const rect = { x: sx, y: sy, w: sw, h: sh };
            const ink = pixels(source, rect);
            const transform = (x: number, y: number) => {
              const point = matrix.transformPoint({ x: dx + (x * dw) / sw, y: dy + (y * dh) / sh });
              return { x: point.x / dpr, y: point.y / dpr };
            };
            const head = bounds(ink, transform);
            pending = {
              head,
              body: bodyPoint(ink, transform, head),
              cel: `${sourceId(source)}:${sx},${sy},${sw},${sh}`,
            };
          } else if (
            pending &&
            args.length === 5 &&
            'width' in source &&
            'height' in source &&
            source.width === 11 &&
            source.height === 11
          ) {
            const ink = pixels(source, { x: 0, y: 0, w: 11, h: 11 });
            if (!gold(ink)) {
              pending = null;
              return;
            }
            const [, dx, dy, dw, dh] = args;
            const pip = bounds(ink, (x, y) => {
              const point = matrix.transformPoint({ x: dx + (x * dw) / 11, y: dy + (y * dh) / 11 });
              return { x: point.x / dpr, y: point.y / dpr };
            });
            record(pending.head, pip, pending.body, pending.cel);
            pending = null;
          } else pending = null;
        } catch (error) {
          observerError(error);
        }
      };
    }
    let talkCall = 0;
    let dorinPip: ObservedSprite | null = null;
    const originalTalk = backend.drawTalkPip;
    if (!ctx) {
      if (!originalTalk) throw new Error('Missing actual WebGL talk draw');
      backend.drawTalkPip = (camera, anchor, alpha, nudge) => {
        const npc = view?.npcs.filter(
          (candidate) => !candidate.quiet && (candidate.alpha ?? 1) > 0,
        )[talkCall++];
        const emitted = backend.pixelTalkUsed;
        originalTalk.call(backend, camera, anchor, alpha, nudge);
        if (npc?.id === 'lw.npc.dorin' && backend.pixelTalkUsed > emitted)
          dorinPip = backend.pixelTalkSprites[emitted] ?? null;
      };
    }
    const originalDraw = renderer.draw;
    renderer.draw = (nextView) => {
      view = nextView;
      pending = null;
      talkCall = 0;
      dorinPip = null;
      const npc = view.npcs.find((candidate) => candidate.id === 'lw.npc.dorin');
      if (review.active && npc) review.viewFrames[npc.walking ? 'walking' : 'idle']++;
      originalDraw.call(renderer, nextView);
      if (!review.active || ctx || !npc || (npc.alpha ?? 1) < 0.99) return;
      try {
        const sprite = backend.unitSprites.get('npc:lw.npc.dorin');
        const pipSprite = dorinPip as ObservedSprite | null;
        if (!sprite?.visible || !pipSprite?.visible) return;
        const geometry = (drawn: ObservedSprite) => {
          const frame = drawn.texture.frame;
          const source = drawn.texture.source.resource;
          const ink = pixels(source, { x: frame.x, y: frame.y, w: frame.width, h: frame.height });
          const transform = (x: number, y: number) =>
            drawn.worldTransform.apply({
              x: x - drawn.anchor.x * frame.width,
              y: y - drawn.anchor.y * frame.height,
            });
          return {
            ink,
            transform,
            bounds: bounds(ink, transform),
            cel: `${sourceId(source)}:${frame.x},${frame.y},${frame.width},${frame.height}`,
          };
        };
        const art = geometry(sprite);
        const pip = geometry(pipSprite);
        if (
          pipSprite.texture.frame.width !== 11 ||
          pipSprite.texture.frame.height !== 11 ||
          !gold(pip.ink)
        )
          throw new Error('Dorin was not paired with the actual gold 11x11 talk raster');
        record(art.bounds, pip.bounds, bodyPoint(art.ink, art.transform, art.bounds), art.cel);
      } catch (error) {
        observerError(error);
      }
    };
    review.stop = () => {
      review.active = false;
      renderer.draw = originalDraw;
      if (ctx && originalImage) ctx.drawImage = originalImage;
      if (!ctx) backend.drawTalkPip = originalTalk;
    };
  });
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`the drawn Dorin talk raster clears walking and idle art (${renderer})`, async ({
    page,
  }, testInfo) => {
    allowSoftwareWebgl(test, renderer);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], 'talk-pip-native', { reduceMotion: false });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await observePips(page);
    await page.getByRole('button', { name: /^Look around/ }).click();
    await page.getByRole('button', { name: "Mira's table · Sit and wait", exact: true }).click();
    await waitForIdle(page);
    await page.waitForFunction(
      () => !(window.fnt?.app as unknown as { scene: SceneObserver }).scene.needsSettle,
      undefined,
      { timeout: 20_000 },
    );
    await page.locator('.action-button').filter({ hasText: "Mira's table" }).click();
    await page
      .getByRole('dialog', { name: 'Wait until…', exact: true })
      .locator('.choice-option')
      .filter({ hasText: 'Afternoon' })
      .click();
    const stateBefore = await page.evaluate(() => {
      const app = window.fnt?.app;
      const review = window.npcTalkPipReview;
      if (!app?.state || !review) throw new Error('Missing capture state');
      (app as unknown as { scene: SceneObserver }).scene.renderer.camera.centreOn({ x: 17, y: 6 });
      review.active = true;
      return JSON.stringify(app.state);
    });
    let report: PipReport | undefined;
    try {
      await page.waitForFunction(
        () => {
          const review = window.npcTalkPipReview;
          if (!review) return false;
          const visible = review.samples.filter((sample) => sample.fullyVisible);
          return (
            review.overflow ||
            review.observerErrors.length > 0 ||
            (visible.filter((sample) => sample.walking).length >= 4 &&
              visible.filter((sample) => !sample.walking).length >= 4 &&
              new Set(visible.filter((sample) => sample.walking).map((sample) => sample.cel))
                .size >= 2)
          );
        },
        undefined,
        { timeout: testInfo.timeout },
      );
    } finally {
      report = await page.evaluate(() => {
        const app = window.fnt?.app;
        const review = window.npcTalkPipReview;
        if (!app || !review) throw new Error('Missing pip capture');
        review.stop();
        const camera = (app as unknown as { scene: SceneObserver }).scene.renderer.camera;
        return {
          samples: review.samples,
          overflow: review.overflow,
          observerErrors: review.observerErrors,
          viewFrames: review.viewFrames,
          state: JSON.stringify(app.state),
          backend: app.rendererBackend(),
          camera: app.rendererCamera(),
          scale: camera.scale,
          viewport: camera.viewport,
        };
      });
      await testInfo.attach('dorin-talk-pip-metrics', {
        body: JSON.stringify({ ...report, errors }),
        contentType: 'application/json',
      });
      await testInfo.attach('dorin-talk-pip', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
    expect(report.overflow, 'the 20,000-frame observation cap must never truncate coverage').toBe(
      false,
    );
    expect(report.observerErrors, 'actual draw/texture observation failed').toEqual([]);
    expect(report.backend).toBe(renderer);
    expect(report.state, 'passive rendering must not change campaign state').toBe(stateBefore);
    const state = JSON.parse(report.state) as {
      world: { clock: { phase: string } };
      location: { pos: Point };
    };
    expect(state.world.clock.phase).toBe('afternoon');
    expect(state.location.pos).toEqual({ x: 10, y: 5 });
    const visible = report.samples.filter((sample) => sample.fullyVisible);
    const walking = visible.filter((sample) => sample.walking);
    const idle = visible.filter((sample) => !sample.walking);
    expect(walking.length).toBeGreaterThanOrEqual(4);
    expect(idle.length).toBeGreaterThanOrEqual(4);
    expect(new Set(walking.map((sample) => sample.cel)).size).toBeGreaterThanOrEqual(2);
    expect(report.camera?.tilePx).toBeCloseTo(64 * report.scale, 8);
    const body = idle.at(-1)?.body;
    const canvas = await page.locator('.map-canvas').boundingBox();
    if (!body || !canvas) throw new Error('No visible Dorin body to tap');
    await waitForIdle(page);
    await page.mouse.click(canvas.x + body.x, canvas.y + body.y);
    await waitForIdle(page);
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
      .toBe('dorin_directions');
    expect(await page.evaluate(() => window.fnt?.app.state?.world.talk?.npcId)).toBe('guard_dorin');
    expect(errors).toEqual([]);
    // Coverage is the fully visible walking/idle windows above, not an offscreen whole-route claim.
    expect(
      Math.min(...walking.map((sample) => sample.gap)),
      'walking opaque art overlaps the drawn talk raster',
    ).toBeGreaterThan(0);
    expect(
      Math.min(...idle.map((sample) => sample.gap)),
      'idle opaque art overlaps the drawn talk raster',
    ).toBeGreaterThan(0);
  });
}
