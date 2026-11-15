# ADR 0112: Resource lifetime, and what a long sitting may hold

**Status:** proposed, 2026-11-15 (#525). The release rule, the bounds and the soak are in the PR
that adds this ADR; the two follow-ups under "Not bounded yet" need an owner decision. Builds on
ADR 0002 (backend parity), ADR 0008 (the WebGL backend), ADR 0088 (integer zoom), ADR 0104
(top-down scenes) and ADR 0111 (regions).

## Context

The game is a forty-hour saga played in long sittings on one shared iPad. A page that keeps
growing is killed by the system, the family loses whatever was not autosaved, and nobody can
attach a debugger to a tablet at the kitchen table to find out why. So what the page holds has to
be measured and held by a test.

Three things were assumed and are corrected here.

**"iOS caps total canvas memory" is true only up to iPadOS 16.** WebKit's cap on the sum of every
canvas backing store (`maxActivePixelMemory`, a quarter of the memory the process may use:
224 MB on a 2 GB device, 384 MB reported on later ones) was removed in June 2023 (WebKit bug
195325, commit 265628@main) and Safari 17.0's notes list it as fixed. Exceeding it never killed
the tab: `getContext('2d')` returned null and the canvas drew nothing. From iPadOS 17 the limits
are:

| Limit                           | Value                                                                       | Source                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Total canvas memory, iPadOS ≤16 | a quarter of process memory: 224 to 384 MB, so 56 to 96 megapixels          | WebKit bugs 185903, 187279, 195325; `HTMLCanvasElement.cpp` before 265628@main                     |
| Total canvas memory, iPadOS ≥17 | none of its own; canvases count against the process like everything else    | WebKit commit 6bd11f37 (bug 195325); Safari 17.0 release notes                                     |
| One canvas's area               | 4096 x 4096 (16.7 MP) through iPadOS 17; 8192 x 8192 (67 MP) from iPadOS 18 | `CanvasBase.cpp` `maxCanvasArea()`; WebKit bug 271002                                              |
| Process memory (jetsam)         | undocumented; "1.5 GB on most iPhones, higher on iPad, differs by device"   | WebKit bug 268816, comments 10 and 14 (an Apple engineer; Apple publishes no figure)               |
| WebGL contexts per page         | 16; the oldest is lost beyond that and cannot be restored                   | `WebGLRenderingContextBase.cpp` `maxActiveContexts`                                                |
| A WebGL canvas's drawing buffer | a ring of three buffers of the canvas's size                                | WebKit bug 327571                                                                                  |
| Releasing a canvas              | any change of `width` or `height` drops the 2D buffer at once               | `CanvasRenderingContext2DBase.cpp` `didUpdateCanvasSizeProperties`; bug 195325 comments 11, 14, 15 |

These were read from WebKit's source and bug tracker on 2026-11-14; the per-device jetsam limit
is the one number that matters most and the one nobody publishes. Only a real iPad's log gives it.

**A canvas that is dropped is still held.** Its backing store lives until the garbage collector
reaches it. Measured in the soak below on an iPad-sized page, a whole session's _live_ canvases
were about 1.5 megapixels at the title and 4.5 in a mounted scene, while the page _held_ 23 to 40
megapixels at its worst: the map canvases of scenes already left, a new pair of shadow canvases
every time a pan crossed a world pixel, a portrait per dialogue line, a board-sized overlay per
tile the pointer crossed. That garbage is what the old cap counted, and it is process memory
today.

**The bounded caches were bounded by count, not by size, and some owners had no bound.** The
inventory below marks each.

## Decision

### 1. Whoever owns a canvas gives it back

`releaseCanvas` (`src/render/canvasRelease.ts`) sizes a canvas to 0 x 0, which frees its store at
once. Every owner calls it when it lets go:

- a cache on eviction and on `clear()` (the sprite cache, baked sheets, decor chunks, sized
  effect cels, tinted effect cells);
- a backend on `destroy()`: its scratch and pooled canvases, and the map canvas's own store;
- a one-picture layer when its picture is replaced (the wash, the prop shadows, the surfaces and
  their glow); the WebGL backend retires the replaced picture's texture after the same frame
  instead of leaving it in the texture map until 128 entries have piled up;
- a scratch canvas straight after its one read (a sheet page's pixels);
- a portrait, glyph or icon canvas once it has left the page (`src/app/ui/painterWatch.ts`: one
  `ResizeObserver` for all of them; a canvas put back is repainted).

A cache evicting in the middle of a frame uses `releaseCanvasSoon` (a microtask): a sprite handed
out earlier in the same frame may not have been blitted or uploaded yet, and both backends finish
a frame inside the task that started it.

Canvases that are only resized are resized in place, never replaced (the Canvas 2D shadow union's
two canvases). The hit flash draws its silhouette through one scratch canvas instead of keeping a
white copy of the whole atlas page per sheet (the Driller's page is 2048 x 1948, 16 MB).

### 2. Page-lifetime registrations are made once

`App.start()` is called by every way back to the title; the audio-unlock and visibility listeners
it added each time are now added once, in the constructor. The WebGL support probe
(`PixiBackend.isSupported`) made a context per scene mount; it is asked once a page and loses its
context.

A scene makes a WebGL renderer and a sitting makes hundreds, and Pixi 8.20 keeps part of each one
it destroys in module state. A heap snapshot per cycle (`FNT_SOAK_HEAP=1`) named it, one set per
scene mount: the filter system's bind group, which Pixi never destroys and which stays subscribed
to pooled and shared texture sources, with the filter uniforms and six `Float32Array`s it holds;
the back-buffer shader's bind group; three resource hashes. `releaseRenderer`
(`src/render/backends/pixi.ts`) destroys those, unloads the two textures every renderer shares
and releases Pixi's global pools. One renderer is alive at a time, so nothing is taken from
anybody.

### 3. The soak holds it

`npm run soak:browser` (`e2e/long-session.soak.ts`, `playwright.soak.config.ts`) plays whole
sittings in a loop on both backends from the production build, at an iPad's landscape size and
DPR 2. One cycle: title, new game, every map of the route, every fight (a few real turns with the
board hovered, a loss and "Try again" on the first, a save), the walk home, the ending card, back
to the title, the riverside preview, the saved fight loaded, played and quit.

The probe (`e2e/soak/probe.ts`) is installed by the test before the game's code, so nothing ships
for it. It wraps the platform (canvas creation, `getContext`, every WebGL create and delete call
and texture upload, `addEventListener` on the window, document, visual viewport and media
queries, the observers, timers and animation frames, images, audio contexts and buffers) and keeps
weak references only. After each cycle, and once mid-game, the collector is forced
(`HeapProfiler.collectGarbage`) and everything is counted. The only hook in the bundle is
`window.fnt.caches()`, three numbers.

**A leak is a positive slope per cycle, not a big number.** Each series is fitted with a
least-squares line over the cycles after a warm-up (`scripts/long-session/trend.ts`) and fails on
growth beyond its allowance; counts that must come back exactly (global listeners, observers,
intervals, WebGL contexts and objects, audio contexts) have none. The run also fails if the page
ever held more than 20 megapixels of canvas, garbage included.

The pull-request gate runs no browser specs, so each fix also has a unit test under a fake page
that counts held pixels (`src/render/canvasLifetime.test.ts`, `src/app/ui/painterWatch.test.ts`,
`src/app/App.start.test.ts`, the wash and toast tests).

### 4. Bounds

Every canvas owner now has a cap. `W x H` is the map's box in CSS px, `d` the device pixel ratio
(capped at 3), `B` the board in world pixels (grid cells x 40 squared).

| Owner                                                 | Bound                                                              | At 1194 x 834, d = 2 |
| ----------------------------------------------------- | ------------------------------------------------------------------ | -------------------: |
| The map canvas                                        | `W·d x H·d`                                                        |              3.98 MP |
| Canvas 2D shadow union (two canvases)                 | `2 · (W+1)(H+1)` at integer zoom (a world px is at least a CSS px) |              2.00 MP |
| Canvas 2D hit flash                                   | the largest frame flashed                                          |              0.07 MP |
| Sprite cache                                          | 128 entries and 32 MB                                              |              8.39 MP |
| Baked placeholder sheets                              | 48 MB (always one sheet, however large)                            |             12.58 MP |
| Pixel-mark drawables and rasters                      | 8 MB and 1 MB                                                      |              2.36 MP |
| Effects atlas, steam puff                             | fixed                                                              |              1.06 MP |
| Sized effect cels                                     | 64 entries                                                         |       2.4 MP at 192² |
| Canvas 2D tinted effect cells                         | 96 x 128²                                                          |              1.57 MP |
| Stroke rasters                                        | Canvas 2D 61 x 1024²; WebGL one per stroke emitter, each ≤ 1024²   |          see "Loose" |
| Occlusion reveal                                      | one figure box and the union of hidden figures                     |               < 1 MP |
| Wash, prop shadows, surfaces, glow                    | one board each: `4 · B`                                            |    4.95 MP on Ba Dan |
| Feathered scene pieces (Canvas 2D)                    | one per feathered piece of a loaded scene                          |     6.5 MP on Ba Dan |
| Figure shadow, sole, grounding and rising-prop caches | 17 + 66 small canvases; one per cel, per prop step                 |               < 1 MP |
| Decor chunks (riverside, WebGL)                       | 16 x 1024²                                                         |             16.78 MP |
| Riverside village layer                               | `W·min(d,2) x H·min(d,2)`                                          |              3.98 MP |
| Portraits and glyphs on the page                      | those on screen                                                    |               < 1 MP |

Two sums matter. **Measured** in Chromium, the worst moment of a whole sitting is 12.5 megapixels
of canvas (50 MB) on Canvas 2D and 13.9 (56 MB) on WebGL, garbage included, where it was 23 to 42
before; WebGL also holds at most 36 textures, 81 MB, where it held 90 and 135 MB. **Proved**, as
the sum of the caps above without the stroke rasters, a top-down scene on Canvas 2D holds at most
about 49 megapixels (196 MB) and the riverside on WebGL about 54 (214 MB): under the smallest
historic cap (224 MB) and far under any plausible process limit. The measured figure is a quarter
of the proved one because the top-down board draws from sheets and barely touches the sprite and
baked-sheet caches. WebGL's GPU side is on top of both: the drawing buffer (three of the map
canvas's size in WebKit) and the textures, whose largest are Pixi's filter passes at the next
power of two above the screen (4096 x 2048, 33.5 MB each, on an 11-inch iPad).

**Loose.** The stroke pools are capped per canvas, not in total (61 x 1024² is 64 megapixels on
Canvas 2D; WebGL has no slot cap). Play reaches a small fraction of that (see the measured peaks
with motion on in the PR), but it is a cap nobody could defend; a total budget for the pool is a
small follow-up.

### 5. Not bounded yet (owner decision)

1. **Decoded images grow with every character and map ever seen.** `SheetStore.loaded` and the
   sprite cache's image map never release anything, by design: an atlas is the same at any zoom.
   The demo region ends at 67 images, 26 megapixels, 104 MB decoded, flat from the second game
   on, so it is not a leak today. It is one region. At that rate ten regions are a gigabyte.
   ADR 0111 §2 says "loaded regions are never removed"; the natural owner of the release is the
   region store, when the party is two regions away. Until then this is the first thing a longer
   saga hits.
2. **Pixi keeps 13 KB of every WebGL renderer for good.** It gives each renderer's graphics and
   mesh programs a name with a running number (`graphics-vertex-19`) and keeps every program's
   whole source as a key in a module map (`createIdFromString`). Measured: 0.2 MB of JS heap a
   cycle on WebGL, steady over 12 cycles, about 13 KB a scene mount; Canvas 2D is flat. A
   three-hour sitting is a few megabytes, so it is no tab killer, but nothing in the game can
   release it. The fix is one WebGL renderer for the page instead of one a scene, which would
   also end the shader recompile on every scene change; it moves the map canvas's ownership from
   the scene to the renderer, so it is its own piece of work. The soak allows this rate and fails
   on a faster one.
3. **A nightly run.** `npm run soak:browser` takes about 10 minutes on Canvas 2D for 12 cycles
   and several times that on software WebGL. The workflow's cost rule is the owner's, so the soak
   is not added to `ci.yml` here; see the PR for a proposed job.

## Inventory

Who creates each thing with a lifetime, who releases it, and what bounds it. **Fixed** marks what
this ADR's PR changed; **open** marks what has no owner or no bound.

### Canvases and GPU

| Resource                                     | Created by                                                  | Released by                                              | Bound                                |
| -------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| Map canvas and backend                       | `ExploreScene` / `CombatScene` mount (`Renderer`)           | scene `unmount` → `Renderer.destroy` (**fixed**: store)  | one scene, plus a retained backdrop  |
| WebGL context, stage, filters, shadow target | `PixiBackend.init`                                          | `destroy()` (Pixi loses the context)                     | one per backend                      |
| WebGL support probe                          | `PixiBackend.isSupported`                                   | **fixed**: once a page, context lost                     | 1                                    |
| What Pixi keeps of a destroyed renderer      | Pixi's filter, back-buffer and resource-hash systems        | **fixed**: `releaseRenderer` on destroy                  | none left per mount                  |
| Program sources as map keys                  | Pixi `createIdFromString`, per renderer                     | never (**open**: one renderer a page)                    | 13 KB a scene mount                  |
| Pixi's own test context and pools            | Pixi, on first use                                          | never; pools emptied on destroy                          | 1 context a page                     |
| Texture map, frame views                     | `PixiBackend.texture` / `frameTexture`                      | `trimTextures` after each frame, `dropTextures`          | 128 and 512 idle                     |
| Replaced layer pictures in the texture map   | wash, prop shadows, surfaces, glow                          | **fixed**: retired the frame they are replaced           | 4 live                               |
| Shadow union canvases (Canvas 2D)            | `drawCastShadows`                                           | **fixed**: resized in place; released on destroy         | 2                                    |
| Hit-flash silhouettes (Canvas 2D)            | `flashMask`                                                 | **fixed**: one scratch, released on destroy              | 1                                    |
| Sprite cache                                 | `SpriteCache.get`                                           | LRU, `clear()` (**fixed**: released; bytes bounded)      | 128 entries, 32 MB                   |
| Baked sheets                                 | `SheetStore.bake`                                           | LRU by bytes, `clear()` (**fixed**: released)            | 48 MB                                |
| Sheet page read-back                         | `readPagePixels`                                            | **fixed**: released after the read                       | transient                            |
| Decor chunks                                 | `DecorSheets.get`                                           | LRU, `clear()`, board change (**fixed**: released)       | 16                                   |
| Effect cels, tinted cells                    | `celAtSize`, `CanvasFxLayer.cell`                           | LRU / FIFO (**fixed**: released)                         | 64, 96                               |
| Stroke rasters                               | `StrokeRasterer`                                            | **fixed**: released with the backend                     | per canvas only (**open**: no total) |
| Reveal layer                                 | `RevealLayer`                                               | **fixed**: released with the backend                     | 2                                    |
| Wash, prop-shadow, surface, glow pictures    | `washLayer`, `propShadows`, `surfaceCanvases`               | **fixed**: released when replaced                        | 1 each                               |
| Feathered scene pieces, flash-free masks     | `scene.ts`                                                  | collector, with the scene image                          | pieces of ≤ 40 scene images          |
| Figure shadows, soles, grounding, risen prop | `figureShadowArt.ts`, `drillerGrounding.ts`, `propLayer.ts` | cleared wholesale at 17 / 33 / 32; soles and risen never | small; soles one per cel (**open**)  |
| Portrait, glyph and icon canvases            | `painterCanvas`                                             | **fixed**: `painterWatch` once off the page              | those on the page                    |
| Riverside village layer                      | `VillageLife`                                               | scene `unmount` (removed; collector)                     | 2                                    |

### Images, audio, data

| Resource                          | Created by                              | Released by                                | Bound                                    |
| --------------------------------- | --------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| Sheet atlases, feet, clips        | `SheetStore.load`                       | never                                      | **open**: one per sheet ever drawn       |
| Portrait and prop images          | `SpriteCache.image`                     | never                                      | **open**: one per image key ever asked   |
| Map paintings, scene pages, props | `BackdropStore`                         | LRU                                        | 3, 40, 12                                |
| Effects sheets                    | `fx/atlas.ts`                           | dropped after the atlas is built           | transient                                |
| Region content and scenes         | `RegionStore`                           | never (ADR 0111 §2)                        | **open**: one per region visited         |
| Effects audio context, samples    | `AudioBus.unlock`, `load`               | `close()` on load, new game, preview, quit | 1 context, 48 samples                    |
| One-shot audio nodes              | `startBuffer`, `playVoice`, `playCrack` | the browser, when they finish              | by the browser                           |
| Courtyard soundscape              | `updateEnvironment` in Ba Dan           | `clearEnvironment`; rebuilt on each resume | 1 (churn: 10 MB and a main-thread build) |
| Music context, two `<audio>`      | `MusicPlayer`                           | `close()` at music volume 0                | 1 and 2                                  |
| Game log, toasts                  | reducer, `Toasts.show`                  | capped at 120 lines; 4 on screen           | (**fixed**: the dedupe map is pruned)    |

### Listeners, observers, timers, DOM

| Resource                                      | Created by                             | Released by                                         | Bound                         |
| --------------------------------------------- | -------------------------------------- | --------------------------------------------------- | ----------------------------- |
| Window resize, orientation, visual viewport   | `App` constructor                      | never                                               | one App a page                |
| Audio unlock, visibility                      | **fixed**: `App` constructor           | never                                               | one App a page                |
| Scene key and visibility listeners            | scene `mount`                          | scene `unmount`                                     | per mounted or retained scene |
| Pointer adapter (canvas and document capture) | `attachPointer`                        | the detach both map scenes call                     | per scene                     |
| Dialog key handler and `ResizeObserver`       | `Dialog.open`                          | `Dialog.close` (every close path)                   | per open dialog               |
| Renderer `ResizeObserver`                     | `Renderer`                             | `Renderer.destroy`                                  | per scene                     |
| Portrait fit observers                        | `fitAssetToBox`                        | **fixed**: one shared observer                      | 1                             |
| Scene frame loops                             | scene `mount`, `resume`                | `unmount`, `suspend`                                | 1 per live scene              |
| Combat AI, guidance, confirmation timers      | `CombatScene`                          | `unmount` (the two guidance timers outlive suspend) | 1 each                        |
| Title art, curtain, toast, route timers       | their owners                           | their owners' stop, cancel and remove               | 1 to 4                        |
| Scene DOM, dialogue layer, overlays           | `App.showScene`, dialogs, toasts       | `showScene`, `close`, `remove`                      | one scene and one backdrop    |
| Dialogs opened from a scene                   | `ExploreScene` (journal, map, save, …) | their own `close` only, not the scene's `unmount`   | user-bounded (**open**)       |

## Consequences

- A change that goes back to dropping canvases, or adds a listener per title visit, fails a unit
  test in the pull-request gate and the soak after it.
- The measured numbers are Chromium's. WebKit's collector, its GPU process and the jetsam limit of
  the family's iPad are not measured here; the PR lists what to read off the device.
- `docs/device-matrix.md` no longer says iOS caps total canvas memory as a present-tense fact.
