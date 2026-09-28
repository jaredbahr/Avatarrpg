import { test, expect } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { resetStorage, startGame, enterNode, takeTurn, waitForIdle } from './helpers';
import { screenshotClipPixels, average, type Pixels } from './pixels';
import type { MapView } from '../src/render/view';

const ROI_CSS = 96;

/** The slice of the mounted scene this probe reaches for: the renderer it draws through. */
type PinnedScene = {
  renderer: { draw: (view: MapView) => void; lastView: { time: number } | null };
};

function changedPixels(before: Pixels, after: Pixels, cssSize: number): number {
  let changed = 0;
  for (let y = 0; y < cssSize; y++) {
    for (let x = 0; x < cssSize; x++) {
      const a = before.at(x, y);
      const b = after.at(x, y);
      if (a && b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 6) changed++;
    }
  }
  return changed;
}

for (const renderer of ['canvas', 'webgl'])
  test(`partial ground keeps rubble art and live overlays on ${renderer}`, async ({ page }) => {
    // On CI's software WebGL, a full-canvas readback took 15 seconds per capture
    // in run 35417898299. Keep the WebGL allowance even with the smaller probe.
    allowSoftwareWebgl(test, renderer);
    await page.setViewportSize({ width: 1672, height: 941 });
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], 'forest-rubble');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await page.waitForTimeout(1000);
    /*
     * Every capture below runs on one fixed frame time.
     *
     * `view.time` is the scene loop's `performance.now()` stamp and the WebGL
     * water film animates on it - `ripple = fbm(w * 4.0 + vec2(uTime * 0.25,
     * uTime * 0.17))` with `uTime = view.time / 1000` - so a capture taken
     * whenever the runner reaches it reads the ripple at an arbitrary phase.
     * That is what made this probe load-dependent: the same board read 8.8 on
     * a quiet host and 4.41, 3.82 and 4.63 on a busy WebKit runner.
     *
     * The phase is derived from the shader, not tuned to a host. The sample
     * sits at the centre of cell (7,3), world `w = (3.75, 1.75)`, where `fbm`
     * averages about 0.75 across the 7x7 patch at 640 s with every pixel in it
     * above 0.6 - inside the 0.62-0.92 band the film's own `smoothstep` gloss
     * adds to, so the water lays down the strongest blue the field reaches at
     * that tile. A pinned phase reads the same on every runner, every frame.
     *
     * This wraps the renderer rather than changing the game: the real `draw`
     * still runs on every frame with the view the scene built, only its `time`
     * is replaced, so nothing ships for it and no behaviour moves.
     */
    const PINNED_FRAME_TIME_MS = 640_000;
    await page.evaluate((time) => {
      const scene = (window.fnt!.app as unknown as { scene: PinnedScene }).scene;
      const draw = scene.renderer.draw.bind(scene.renderer);
      scene.renderer.draw = (view) => draw({ ...view, time });
    }, PINNED_FRAME_TIME_MS);
    /*
     * One round trip per probe: wait for two published frames and read the
     * camera in the same evaluate. While the software rasteriser is busy, a
     * call across the protocol costs seconds — run 35555673408 measured the
     * two frames alone at about five, and this spec's webgl half passed at
     * 297.2s of a 300s cap — so a second `page.evaluate` for the transform
     * charged eight more of those. The camera is settled before the second
     * frame is published, and the screenshot below still follows the wait, so
     * the probe reads the same pixels with one fewer crossing.
     */
    const sample = async (regionSize = 7) => {
      const probe = await page.evaluate(
        () =>
          new Promise<{
            point: { x: number; y: number };
            rect: { x: number; y: number; width: number; height: number };
          } | null>((resolve) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const m = window.fnt?.app.rendererCamera()?.groundTransform;
                const canvas = document.querySelector('.map-canvas');
                if (!m || !canvas) {
                  resolve(null);
                  return;
                }
                const bounds = canvas.getBoundingClientRect();
                resolve({
                  point: {
                    x: m.a * 7.5 * 64 + m.c * 3.5 * 64 + m.tx,
                    y: m.b * 7.5 * 64 + m.d * 3.5 * 64 + m.ty,
                  },
                  rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
                });
              }),
            );
          }),
      );
      expect(probe, 'the map canvas is mounted with a settled camera').not.toBeNull();
      if (!probe) throw new Error('Missing map canvas');
      const { point, rect } = probe;
      expect(point.x).toBeGreaterThan(3);
      expect(point.x).toBeLessThan(rect.width - 3);
      expect(point.y).toBeGreaterThan(3);
      expect(point.y).toBeLessThan(rect.height - 3);
      const half = Math.floor(regionSize / 2);
      const left = Math.round(point.x) - half;
      const top = Math.round(point.y) - half;
      const pixels = await screenshotClipPixels(page, {
        x: rect.x + left,
        y: rect.y + top,
        width: regionSize,
        height: regionSize,
      });
      return { ...average(pixels, point.x - left, point.y - top, 3), pixels };
    };
    const registered = await sample(ROI_CSS);
    // Forest Road is a partial scene. Its registered heap cells carry authored
    // art whose own ink outline marks the hazard, so the permanent rubble wash
    // and its bank stand down there; unregistered rubble draws them again. The
    // difference sits mostly on the bank round the tile edge, so it is counted
    // across the window rather than read from the centre average.
    await page.evaluate(() => {
      const scene = window.fnt!.app.content.maps.get('forest_road')!.scene!;
      Object.defineProperty(scene, 'paintedRubble', { value: [], configurable: true });
    });
    const unregistered = await sample(ROI_CSS);
    expect(
      changedPixels(registered.pixels, unregistered.pixels, ROI_CSS),
      'unregistered rubble wash changed pixels',
    ).toBeGreaterThan(200);

    /*
     * A live material must still tint the authored rubble image. The same
     * crossing also proves the pin above reached the renderer: the pin is a
     * wrapper, so a silent miss would leave this probe reading whatever phase
     * the runner reached, which is the flake being fixed here.
     */
    const frameTime = await page.evaluate(() => {
      const app = window.fnt!.app;
      const tile = app.state!.battle!.grid.tiles[3 * 20 + 7]!;
      Object.defineProperty(tile, 'surface', {
        value: { id: 'water', duration: -1, spread: 0 },
        configurable: true,
      });
      const scene = (app as unknown as { scene: PinnedScene }).scene;
      return scene.renderer.lastView?.time ?? null;
    });
    expect(frameTime, 'the water shader was handed the pinned frame time').toBe(
      PINNED_FRAME_TIME_MS,
    );
    // One capture answers both probes: the average reads the same 7x7 centre
    // whichever window it is taken from, and a software-WebGL screenshot is the
    // most expensive operation in this spec, so the wider window serves the
    // colour check and the change count together.
    const waterRegion = await sample(ROI_CSS);
    /*
     * The live water surface tints the authored rubble image: blue and green
     * rise together while red falls. How big each shift is depends on the
     * rasteriser's colour pipeline - run 35499544183's software WebGL
     * compressed every channel shift to roughly two thirds of this host's and
     * put the green shift at 4.96 where this host measures 7.2 - so the floor
     * is anchored on the channel the material raises most, with the others
     * required to follow it, instead of on a per-channel absolute value.
     */
    const blueShift = waterRegion.b - registered.b;
    /*
     * The isolated blue channel is the least stable of the three signals, and
     * it is the one the ripple moves: before the frame time above was pinned,
     * run 35874485983's WebKit (Mesa's software path, same as any GPU-less CI
     * runner) read 4.41, 3.82 and 4.63 where a quiet host reads about 8.8. The
     * pin holds the phase at the top of the ripple's range, so this reading no
     * longer swings with machine load, and the floor stays the 5 it already was
     * rather than coming down to meet the readings that failed. The red and
     * combined checks below are what actually carry the "this is a visible blue
     * tint" proof, exactly as the surrounding comment already says a
     * per-channel absolute should not be load-bearing alone: red falls by 52+
     * against its -10 floor and the combined blue-over-red delta lands at 61+
     * against its 25 floor, both with enormous margin.
     */
    expect(blueShift).toBeGreaterThan(5);
    expect(waterRegion.r - registered.r).toBeLessThan(-10);
    // Measured as a cool shift rather than an absolute green rise: the ground
    // contract's warm packed earth is already greener than the water fill, so
    // no film can raise green over light warm ground (see partial-ground.spec.ts).
    expect(waterRegion.b - waterRegion.r - (registered.b - registered.r)).toBeGreaterThan(25);

    // Hatch mode remains visible over the authored image for a live material.
    await page.evaluate(() => {
      const app = window.fnt!.app;
      Object.defineProperty(app.state!.battle!.grid.tiles[3 * 20 + 7]!, 'surface', {
        value: { id: 'water', duration: -1, spread: 0 },
        configurable: true,
      });
      app.updateSettings({ hatchSurfaces: true });
    });
    const hatchedWater = await sample(ROI_CSS);
    expect(
      changedPixels(waterRegion.pixels, hatchedWater.pixels, ROI_CSS),
      'hatch changed pixels',
    ).toBeGreaterThan(10);

    // High contrast restores procedural markers when authored pieces are unavailable.
    await page.evaluate(() => {
      const app = window.fnt!.app;
      Object.defineProperty(app.state!.battle!.grid.tiles[3 * 20 + 7]!, 'surface', {
        value: { id: 'rubble', duration: -1, spread: 0 },
        configurable: true,
      });
      app.updateSettings({ hatchSurfaces: false, highContrast: false });
    });
    const beforeContrast = await sample(ROI_CSS);
    await page.evaluate(() => {
      window.fnt!.app.updateSettings({ highContrast: true });
    });
    const accessible = await sample(ROI_CSS);
    expect(
      changedPixels(beforeContrast.pixels, accessible.pixels, ROI_CSS),
      'high-contrast changed pixels',
    ).toBeGreaterThan(10);
    await page.evaluate(() => {
      const app = window.fnt!.app;
      const scene = app.content.maps.get('forest_road')!.scene!;
      Object.defineProperty(scene, 'ground', {
        value: scene.ground.map((piece) => ({
          ...piece,
          url: 'art/maps/missing-rubble-test.webp',
        })),
        configurable: true,
      });
    });
    // Counted across the window, like the wash above, not read from the centre
    // average: at figure-weight ink the heap's middle is spoil-toned stone, the
    // same key as the procedural rubble, so a 7 px average no longer separates
    // the art from its fallback even though the whole heap has gone.
    const fallbackAccessible = await sample(ROI_CSS);
    expect(
      changedPixels(registered.pixels, fallbackAccessible.pixels, ROI_CSS),
      'high-contrast fallback changed pixels',
    ).toBeGreaterThan(200);
    await page.evaluate(() => window.fnt!.app.updateSettings({ highContrast: false }));
    const fallback = await sample(ROI_CSS);
    expect(
      changedPixels(registered.pixels, fallback.pixels, ROI_CSS),
      'fallback changed pixels',
    ).toBeGreaterThan(200);
  });

for (const renderer of ['canvas', 'webgl'])
  test(`ability rubble meets a forest heap alike on ${renderer}`, async ({ page }) => {
    allowSoftwareWebgl(test, renderer);
    await page.setViewportSize({ width: 1672, height: 941 });
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], 'forest-rubble');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await page.waitForTimeout(1000);

    type Cell = { x: number; y: number };
    type Surface = { id: string; duration: number; spread: number } | null;
    const HEAP = { x: 7, y: 3 };
    const WEST = { x: 6, y: 3 };
    const RUBBLE = { id: 'rubble', duration: -1, spread: 0 };
    const set = (cells: [Cell, Surface][]) =>
      page.evaluate((cells) => {
        const grid = window.fnt!.app.state!.battle!.grid;
        for (const [{ x, y }, surface] of cells)
          Object.defineProperty(grid.tiles[y * grid.width + x]!, 'surface', {
            value: surface,
            configurable: true,
          });
      }, cells);
    const register = (cells: Cell[]) =>
      page.evaluate((cells) => {
        const scene = window.fnt!.app.content.maps.get('forest_road')!.scene!;
        Object.defineProperty(scene, 'paintedRubble', { value: cells, configurable: true });
      }, cells);

    /*
     * One window round the heap tile, with each pixel mapped back to the
     * logical ground it shows: `edge` is the west neighbour's side of the
     * shared edge, above the heap image, and `heap` is the heap image itself.
     */
    const probe = async () => {
      const found = await page.evaluate(
        () =>
          new Promise<{
            m: { a: number; b: number; c: number; d: number; tx: number; ty: number };
            rect: { x: number; y: number };
          } | null>((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const m = window.fnt?.app.rendererCamera()?.groundTransform;
                const canvas = document.querySelector('.map-canvas');
                if (!m || !canvas) return resolve(null);
                const { a, b, c, d, tx, ty } = m;
                const bounds = canvas.getBoundingClientRect();
                resolve({ m: { a, b, c, d, tx, ty }, rect: { x: bounds.x, y: bounds.y } });
              }),
            ),
          ),
      );
      if (!found) throw new Error('Missing map canvas');
      const { m, rect } = found;
      const centre = {
        x: m.a * 7.5 * 64 + m.c * 3.5 * 64 + m.tx,
        y: m.b * 7.5 * 64 + m.d * 3.5 * 64 + m.ty,
      };
      const left = Math.round(centre.x) - ROI_CSS / 2;
      const top = Math.round(centre.y) - ROI_CSS / 2;
      const pixels = await screenshotClipPixels(page, {
        x: rect.x + left,
        y: rect.y + top,
        width: ROI_CSS,
        height: ROI_CSS,
      });
      const det = m.a * m.d - m.b * m.c;
      const ground = (x: number, y: number) => {
        const sx = left + x + 0.5 - m.tx;
        const sy = top + y + 0.5 - m.ty;
        return { x: (m.d * sx - m.c * sy) / det / 64, y: (m.a * sy - m.b * sx) / det / 64 };
      };
      return { pixels, ground };
    };
    type Probe = Awaited<ReturnType<typeof probe>>;
    const inside = (lo: Cell, hi: Cell) => (p: Cell) =>
      p.x > lo.x && p.x < hi.x && p.y > lo.y && p.y < hi.y;
    const edge = inside({ x: 6.85, y: 3.05 }, { x: 6.985, y: 3.45 });
    const heap = inside({ x: 7.25, y: 3.25 }, { x: 7.75, y: 3.75 });
    const everywhere = () => true;
    const changed = (before: Probe, after: Probe, region: (p: Cell) => boolean) => {
      let count = 0;
      let total = 0;
      for (let y = 0; y < ROI_CSS; y++)
        for (let x = 0; x < ROI_CSS; x++) {
          if (!region(before.ground(x, y))) continue;
          total++;
          const a = before.pixels.at(x, y);
          const b = after.pixels.at(x, y);
          if (a && b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 6)
            count++;
        }
      expect(total, 'probe region lies inside the window').toBeGreaterThan(40);
      return count;
    };

    // Ability rubble beside a live heap: its bank stops at the heap, whose own
    // ink outline is the edge there, exactly as against more ability rubble.
    await set([[WEST, RUBBLE]]);
    const beside = await probe();
    await register([]);
    const besideWash = await probe();
    expect(changed(beside, besideWash, edge), 'bank beside the heap').toBeLessThan(5);
    // Loaded art is what stands the heap's wash down.
    expect(changed(beside, besideWash, heap), 'heap wash once loaded').toBeGreaterThan(40);
    await register([HEAP, { x: 8, y: 9 }]);

    // Water turns the heap to mud. The neighbour banks against the mud. WebGL's
    // bank is the fainter of the two (this host counted 44 changed pixels to
    // Canvas's 314), so the floor sits well under it and well over the zero the
    // unbanked comparison above reads. The heap itself stays drawn under the
    // mud's wash: the heap art is registered to the cell, not to its cover.
    await set([[HEAP, { id: 'mud', duration: 3, spread: 0 }]]);
    const mud = await probe();
    expect(changed(beside, mud, edge), 'bank against the mud').toBeGreaterThan(15);
    expect(changed(beside, mud, heap), 'mud wash over the heap').toBeGreaterThan(40);
    // The mud expires. The heap stands exactly as the live heap does, wash and
    // all stood down.
    await set([
      [HEAP, null],
      [WEST, null],
    ]);
    const bare = await probe();
    await set([[HEAP, RUBBLE]]);
    const live = await probe();
    expect(changed(live, bare, heap), 'heap still drawn after the mud').toBeLessThan(5);
    // Rubble again beside it: back to the first frame.
    await set([[WEST, RUBBLE]]);
    expect(changed(beside, await probe(), everywhere), 're-rubbled heap').toBeLessThan(5);

    // A scene piece that fails to load keeps every procedural wash: the heap's
    // registration then changes nothing.
    await page.evaluate(() => {
      const scene = window.fnt!.app.content.maps.get('forest_road')!.scene!;
      Object.defineProperty(scene, 'ground', {
        value: scene.ground.map((piece) =>
          piece.url.endsWith('/pond-bank.webp')
            ? { ...piece, url: 'art/maps/missing-pond-bank-test.webp' }
            : piece,
        ),
        configurable: true,
      });
    });
    const failed = await probe();
    await register([]);
    expect(changed(failed, await probe(), heap), 'registration after a failed load').toBeLessThan(
      5,
    );
    expect(changed(beside, failed, heap), 'fallback after a failed load').toBeGreaterThan(40);
  });
