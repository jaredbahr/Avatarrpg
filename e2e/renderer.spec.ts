import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { average, screenshotPixels } from './pixels';

type CameraSnapshot = {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
  tilePx: number;
};

const MAX_STABLE_PROBE_ATTEMPTS = 3;

function sameCamera(a: CameraSnapshot, b: CameraSnapshot): boolean {
  return (
    a.a === b.a &&
    a.b === b.b &&
    a.c === b.c &&
    a.d === b.d &&
    a.tx === b.tx &&
    a.ty === b.ty &&
    a.tilePx === b.tilePx
  );
}

async function stablePixelProbe<T>(
  page: Page,
  canvas: Locator,
  sample: () => Promise<{ camera: CameraSnapshot; probe: T } | null>,
  label: string,
): Promise<{ probe: T; pixels: Awaited<ReturnType<typeof screenshotPixels>> } | null> {
  let cameraMoved = false;
  for (let attempt = 0; attempt < MAX_STABLE_PROBE_ATTEMPTS; attempt++) {
    const candidate = await sample();
    if (!candidate) {
      if (cameraMoved) {
        throw new Error(
          `${label}: camera moved while sampling; no stable probe after ${MAX_STABLE_PROBE_ATTEMPTS} attempts`,
        );
      }
      return null;
    }
    const pixels = await screenshotPixels(canvas);
    const after = await page.evaluate(() => {
      const camera = window.fnt?.app.rendererCamera?.();
      if (!camera) return null;
      const m = camera.groundTransform;
      return { a: m.a, b: m.b, c: m.c, d: m.d, tx: m.tx, ty: m.ty, tilePx: camera.tilePx };
    });
    if (after && sameCamera(candidate.camera, after)) return { probe: candidate.probe, pixels };
    cameraMoved = true;
    test.info().annotations.push({
      type: 'camera-moved',
      description: `${label}: retry ${attempt + 1} of ${MAX_STABLE_PROBE_ATTEMPTS}`,
    });
  }
  if (cameraMoved) {
    throw new Error(
      `${label}: camera moved while sampling; no stable probe after ${MAX_STABLE_PROBE_ATTEMPTS} attempts`,
    );
  }
  return null;
}

/**
 * The renderer picks a backend at runtime, so both paths need covering.
 *
 * CI runners have no GPU, and against a software rasteriser WebGL runs about
 * ten times slower than Canvas 2D at this workload — which is why the auto
 * choice lands on Canvas 2D here and why the rest of the suite is quick. That
 * would leave the shader path shipped untested, so this spec forces it on with
 * `?renderer=webgl` and gives it the longer budget software GL needs.
 */
test.describe('renderer backends', () => {
  test('auto-selects Canvas 2D when WebGL is not accelerated', async ({ page }) => {
    await resetStorage(page);
    const backend = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      const name = info ? String(gl?.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
      return { name, software: /swiftshader|llvmpipe|softpipe|software/i.test(name) };
    });

    // Guard the premise: if a runner ever gets a real GPU this test is moot.
    test.skip(!backend.software, `this runner reports an accelerated GPU: ${backend.name}`);

    await startGame(page, ['Elias'], ['kaya'], 'renderer-spec');
    await enterNode(page, 'battle_forest_road');
    await waitForIdle(page);

    const chosen = await page.evaluate(() => window.fnt?.app.rendererBackend());
    expect(chosen, 'software WebGL should fall back to Canvas 2D').toBe('canvas');
  });

  test('renders the board through the WebGL backend when forced', async ({ page }) => {
    test.setTimeout(120_000);
    // This case forces the shader path on both engines, and both rasterise in
    // software on a runner with no GPU: SwiftShader in Chromium, Mesa in WebKit.
    allowSoftwareWebgl(test, 'webgl');

    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/?renderer=webgl');
    await page.waitForFunction(() => Boolean(window.fnt?.app));
    await startGame(page, ['Elias', 'Lorelai'], ['kaya', 'bo'], 'renderer-spec');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);

    expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe('webgl');

    // A failed shader link throws nothing in Pixi — it logs and draws nothing —
    // so assert on both the console and the pixels.
    expect(errors.filter((text) => /shader|webgl|glsl/i.test(text))).toEqual([]);

    const canvas = page.locator('.map-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Check the real authored scene, including its live water overlay. PNG
    // compression bytes are varied even when the canvas is completely blank.
    //
    // The water's ripple is animated, so one frame is not a fixed colour: six
    // samples on one host moved the blue-minus-red difference between 21.2 and
    // 23.2, and a runner whose screenshot lands on another phase measured 19.9
    // against the 20 this asserts (both heads, measured 20 September 2026).
    // A missing overlay never clears the bar on any frame, so read a few and
    // let the best one speak; the threshold is unchanged.
    const water = await tileCentre(page, { x: 5, y: 6 });
    let wet = { r: 0, g: 0, b: 0, bMinusR: -Infinity };
    for (let sample = 0; sample < 3 && wet.bMinusR <= 20; sample++) {
      if (sample) await page.waitForTimeout(400);
      const pixels = await screenshotPixels(canvas);
      const read = average(pixels, water.x, water.y, 3);
      wet = { ...read, bMinusR: read.b - read.r };
    }
    expect(wet.bMinusR, `authored scene water is absent: ${JSON.stringify(wet)}`).toBeGreaterThan(
      20,
    );
  });

  /*
   * The ground has to be painted where the tiles are, on both backends and at
   * every device pixel ratio. The WebGL ground is a full-screen filter whose
   * input texture Pixi pools at the next power of two, and a shader that took
   * its UVs to span the viewport drew the whole board wide and offset; nothing
   * else in the suite could see it, because every other spec maps a tile to a
   * pixel through the same camera the tap handler reads. This looks at the
   * pixels: a puddle must be blue where the camera says the puddle is, and
   * grass green where the grass is.
   */
  for (const renderer of ['canvas', 'webgl'] as const) {
    test(`paints the ground under the tiles on ${renderer}`, async ({ page }) => {
      test.setTimeout(120_000);
      allowSoftwareWebgl(test, renderer);

      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Elias'], ['kaya'], 'ground-spec');
      await enterNode(page, 'battle_forest_road');
      await takeTurn(page);
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);

      // This is the procedural ground's test: every unpainted map and the
      // fallback draw it, so take any painting the forest road may carry away.
      await page.evaluate(() => {
        const app = window.fnt?.app;
        const map = app?.content.maps.get('forest_road');
        // Layered scenes supersede legacy backdrops. Remove both paintings to
        // exercise procedural fallback, retaining its original color contract.
        if (map) Object.defineProperty(map, 'scene', { value: undefined, configurable: true });
        return app?.overrideBackdrop('forest_road', null);
      });
      // The forest road's puddle is authored at (5, 6); the top-left corner is grass.
      const canvas = page.locator('.map-canvas');
      let drawn:
        | {
            wet: ReturnType<typeof average>;
            green: ReturnType<typeof average>;
            water: { x: number; y: number };
            grass: { x: number; y: number };
          }
        | undefined;
      await expect
        .poll(
          async () => {
            const captured = await stablePixelProbe(
              page,
              canvas,
              () =>
                page.evaluate(() => {
                  const camera = window.fnt?.app.rendererCamera?.();
                  if (!camera) return null;
                  const m = camera.groundTransform;
                  const centre = (x: number, y: number) => ({
                    x: m.a * (x + 0.5) * 64 + m.c * (y + 0.5) * 64 + m.tx,
                    y: m.b * (x + 0.5) * 64 + m.d * (y + 0.5) * 64 + m.ty,
                  });
                  return {
                    camera: {
                      a: m.a,
                      b: m.b,
                      c: m.c,
                      d: m.d,
                      tx: m.tx,
                      ty: m.ty,
                      tilePx: camera.tilePx,
                    },
                    probe: { water: centre(5, 6), grass: centre(3, 1) },
                  };
                }),
              `procedural ground pixel probe (${renderer})`,
            );
            if (!captured) return false;
            const wet = average(captured.pixels, captured.probe.water.x, captured.probe.water.y, 3);
            const green = average(
              captured.pixels,
              captured.probe.grass.x,
              captured.probe.grass.y,
              3,
            );
            const ready = wet.b > wet.r + 20 && green.g > green.b + 10 && green.g > green.r;
            if (ready) drawn = { wet, green, ...captured.probe };
            return ready;
          },
          { timeout: renderer === 'webgl' ? 60_000 : 10_000 },
        )
        .toBe(true);
      if (!drawn) throw new Error(`procedural ground was not presented on ${renderer}`);
      const { wet, green, water, grass } = drawn;

      expect(
        wet.b,
        `puddle at ${water.x},${water.y} is not blue: ${JSON.stringify(wet)}`,
      ).toBeGreaterThan(wet.r + 20);
      expect(
        green.g,
        `grass at ${grass.x},${grass.y} is not green: ${JSON.stringify(green)}`,
      ).toBeGreaterThan(green.b + 10);
      expect(green.g).toBeGreaterThan(green.r);
    });
  }

  /**
   * Raised ground is board correctness (ADR 0065), so both backends draw the
   * same block. The Driller floor's front bench stands a quarter tile up, so
   * the far corner of its top is drawn over the dirt floor behind it: there
   * the pixel must be the bench's stone, as at the top's centre, not the dirt
   * that a flat board shows at that spot.
   */
  for (const renderer of ['canvas', 'webgl'] as const) {
    test(`lifts a raised bench over the floor behind it on ${renderer}`, async ({ page }) => {
      test.setTimeout(120_000);
      allowSoftwareWebgl(test, renderer);

      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Elias'], ['kaya'], 'lift-spec');
      await enterNode(page, 'battle_grumbler');
      await takeTurn(page);
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
      // The readable oblique fit pans; bring the front bench into view.
      await page.evaluate(() => {
        const scene = (
          window.fnt?.app as unknown as {
            scene: {
              manualCamera: boolean;
              renderer?: { camera: { centreOn(pos: { x: number; y: number }): void } };
            };
          }
        ).scene;
        // This is the existing scene flag used by a player's manual pan; it
        // keeps a ResizeObserver refit from undoing the test's centreOn().
        scene.manualCamera = true;
        scene.renderer?.camera.centreOn({ x: 9, y: 9 });
      });
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      );

      const canvas = page.locator('.map-canvas');
      const captured = await stablePixelProbe(
        page,
        canvas,
        () =>
          page.evaluate(() => {
            const app = window.fnt?.app;
            const camera = app?.rendererCamera();
            const battle = app?.state?.battle;
            const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
            if (!camera || !battle || !canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const m = camera.groundTransform;
            const cameraSnapshot = {
              a: m.a,
              b: m.b,
              c: m.c,
              d: m.d,
              tx: m.tx,
              ty: m.ty,
              tilePx: camera.tilePx,
            };
            const { grid } = battle;
            const tile = (x: number, y: number) => grid.tiles[y * grid.width + x];
            const near = (x: number, y: number) =>
              battle.units.some((u) => Math.abs(u.pos.x - x) <= 2 && Math.abs(u.pos.y - y) <= 2) ||
              battle.props.some((p) => Math.abs(p.pos.x - x) <= 2 && Math.abs(p.pos.y - y) <= 2);
            const screen = (gx: number, gy: number, up: number) => ({
              x: m.a * gx * 64 + m.c * gy * 64 + m.tx,
              y: m.b * gx * 64 + m.d * gy * 64 + m.ty - camera.tilePx * up,
            });
            const clear = (p: { x: number; y: number }) =>
              p.x > 8 &&
              p.y > 8 &&
              p.x < rect.width - 8 &&
              p.y < rect.height - 8 &&
              document.elementFromPoint(rect.left + p.x, rect.top + p.y) === canvas;
            for (const x of [5, 6, 10, 14, 15, 4, 9, 13]) {
              const bench = tile(x, 10);
              const behind = tile(x - 1, 9);
              if (!bench?.ramp || bench.surface || behind?.elevation !== 0 || behind.surface)
                continue;
              if (near(x, 10)) continue;
              // The top's far corner, a quarter tile up; its centre; the dirt it covers.
              const corner = screen(x + 0.12, 10.12, 0.25);
              const centre = screen(x + 0.5, 10.5, 0.25);
              const dirt = screen(x - 0.5, 9.4, 0);
              if (![corner, centre, dirt].every(clear)) continue;
              return { camera: cameraSnapshot, probe: { corner, centre, dirt } };
            }
            return null;
          }),
        'raised bench pixel probe',
      );
      expect(captured, 'no clear front bench on screen').not.toBeNull();
      if (!captured) return;

      const { probe, pixels } = captured;
      const corner = average(pixels, probe.corner.x, probe.corner.y, 2);
      const centre = average(pixels, probe.centre.x, probe.centre.y, 2);
      const dirt = average(pixels, probe.dirt.x, probe.dirt.y, 2);
      const gap = (a: typeof corner, b: typeof corner) =>
        Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
      const seen = JSON.stringify({ corner, centre, dirt });
      expect(gap(centre, dirt), `bench and floor differ: ${seen}`).toBeGreaterThan(60);
      expect(gap(corner, centre), `the lifted corner is stone: ${seen}`).toBeLessThan(
        gap(corner, dirt),
      );
    });
  }

  /**
   * A live mark on a raised tile sits on its lifted top, where the tap picks
   * it, however much of the lift the art already paints: the Forest Road's
   * shelf is painted at the whole lift, the Driller's benches at a little of
   * it. Hovering the tile must lighten the far corner of the lifted top and
   * leave the tile's own south face, which covers its flat footprint, alone.
   */
  for (const renderer of ['canvas', 'webgl'] as const) {
    for (const node of ['battle_forest_road', 'battle_grumbler'] as const) {
      test(`marks a raised tile's lifted top on ${node} on ${renderer}`, async ({ page }) => {
        test.setTimeout(120_000);
        allowSoftwareWebgl(test, renderer);

        await resetStorage(page, `?renderer=${renderer}`);
        await startGame(page, ['Elias'], ['kaya'], 'lift-marks');
        await enterNode(page, node);
        await takeTurn(page);
        await waitForIdle(page);
        await settleLayout(page);
        expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);

        // A raised tile with a lower walkable tile south of it (so it shows a
        // south face), no surface, and nobody near enough to stand over it.
        const find = () =>
          page.evaluate(() => {
            const app = window.fnt?.app;
            const camera = app?.rendererCamera();
            const battle = app?.state?.battle;
            const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
            if (!camera || !battle || !canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const m = camera.groundTransform;
            const cameraSnapshot = {
              a: m.a,
              b: m.b,
              c: m.c,
              d: m.d,
              tx: m.tx,
              ty: m.ty,
              tilePx: camera.tilePx,
            };
            const { grid } = battle;
            const tile = (x: number, y: number) =>
              x < 0 || y < 0 || x >= grid.width || y >= grid.height
                ? undefined
                : grid.tiles[y * grid.width + x];
            const near = (x: number, y: number) =>
              battle.units.some((u) => Math.abs(u.pos.x - x) <= 2 && Math.abs(u.pos.y - y) <= 2) ||
              battle.props.some((p) => Math.abs(p.pos.x - x) <= 2 && Math.abs(p.pos.y - y) <= 2);
            const screen = (gx: number, gy: number, up: number) => ({
              x: m.a * gx * 64 + m.c * gy * 64 + m.tx,
              y: m.b * gx * 64 + m.d * gy * 64 + m.ty - camera.tilePx * up,
            });
            const clear = (p: { x: number; y: number }) =>
              p.x > 8 &&
              p.y > 8 &&
              p.x < rect.width - 8 &&
              p.y < rect.height - 8 &&
              document.elementFromPoint(rect.left + p.x, rect.top + p.y) === canvas;
            const cells: { x: number; y: number }[] = [];
            for (let y = 0; y < grid.height; y++)
              for (let x = 0; x < grid.width; x++) {
                const here = tile(x, y);
                const south = tile(x, y + 1);
                if (!here || here.blocked || here.elevation < 1 || here.surface) continue;
                if (!south || south.blocked || south.elevation >= here.elevation) continue;
                if (south.surface || near(x, y)) continue;
                cells.push({ x, y });
              }
            for (const cell of cells) {
              const up = 0.25 * (tile(cell.x, cell.y)?.elevation ?? 0);
              // The lifted top's far corner, its centre, and the middle of
              // its south face (the flat footprint the top no longer covers).
              const corner = screen(cell.x + 0.2, cell.y + 0.2, up);
              const centre = screen(cell.x + 0.5, cell.y + 0.5, up);
              const face = screen(cell.x + 0.375, cell.y + 0.875, 0);
              if (![corner, centre, face].every(clear)) continue;
              return {
                camera: cameraSnapshot,
                cell,
                aim: { corner, centre, face, x: rect.left, y: rect.top },
              };
            }
            return { camera: cameraSnapshot, cell: cells[0] ?? null, aim: null };
          });
        let probe = await find();
        if (probe?.aim) {
          // Keep the already-clear tile under the camera chosen by this read;
          // a late canvas resize must not refit between the before/after probes.
          await page.evaluate(() => {
            const scene = (window.fnt?.app as unknown as { scene: { manualCamera: boolean } })
              .scene;
            scene.manualCamera = true;
          });
        }
        if (probe?.cell && !probe.aim) {
          // The readable oblique fit pans; bring the tile into view.
          await page.evaluate((cell) => {
            const scene = (
              window.fnt?.app as unknown as {
                scene: {
                  manualCamera: boolean;
                  renderer?: { camera: { centreOn(pos: { x: number; y: number }): void } };
                };
              }
            ).scene;
            scene.manualCamera = true;
            scene.renderer?.camera.centreOn(cell);
          }, probe.cell);
          await page.evaluate(
            () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
          );
          probe = await find();
        }
        expect(probe?.aim, `no clear raised tile: ${JSON.stringify(probe)}`).toBeTruthy();
        if (!probe?.aim || !probe.cell) return;
        const { cell } = probe;
        const { corner, ...rect } = probe.aim;

        const hover = () =>
          page.evaluate(
            () =>
              (window.fnt?.app as unknown as { scene: { hover: { x: number; y: number } | null } })
                .scene.hover,
          );
        const frame = () =>
          page.evaluate(
            () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
          );
        const read = async () => {
          const captured = await stablePixelProbe(
            page,
            page.locator('.map-canvas'),
            async () => {
              const next = await find();
              return next?.aim ? { camera: next.camera, probe: next } : null;
            },
            `raised tile mark pixel probe on ${node} (${renderer})`,
          );
          if (!captured) throw new Error(`no clear raised tile on ${node} (${renderer})`);
          expect(captured.probe.cell).toEqual(cell);
          const next = captured.probe.aim;
          if (!next) throw new Error(`no clear raised tile on ${node} (${renderer})`);
          const pixels = captured.pixels;
          return {
            corner: average(pixels, next.corner.x, next.corner.y, 2),
            face: average(pixels, next.face.x, next.face.y, 2),
            aim: next,
          };
        };

        // Away from the tile, then on its lifted top.
        await page.mouse.move(rect.x + 2, rect.y + 2);
        await page.mouse.move(rect.x + corner.x + 60, rect.y + corner.y - 200);
        await expect.poll(async () => JSON.stringify(await hover())).not.toBe(JSON.stringify(cell));
        await frame();
        const before = await read();
        await page.mouse.move(
          before.aim.x + before.aim.centre.x,
          before.aim.y + before.aim.centre.y,
        );
        await expect.poll(hover).toEqual(cell);

        const gap = (a: typeof before.face, b: typeof before.face) =>
          Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
        let after: Awaited<ReturnType<typeof read>> | undefined;
        await expect
          .poll(
            async () => {
              const captured = await read();
              if (gap(captured.corner, before.corner) > 24) after = captured;
              return gap(captured.corner, before.corner);
            },
            { timeout: renderer === 'webgl' ? 60_000 : 10_000 },
          )
          .toBeGreaterThan(24);
        if (!after) throw new Error(`raised tile mark was not presented on ${node} (${renderer})`);
        const seen = JSON.stringify({ cell, before, after });
        expect(
          gap(after.corner, before.corner),
          `the lifted top is marked: ${seen}`,
        ).toBeGreaterThan(24);
        expect(gap(after.face, before.face), `the flat footprint is not: ${seen}`).toBeLessThan(10);
      });
    }
  }

  /**
   * The lift pass's cost, read from its probe (`window.fnt.liftCost`). A
   * still raised board is drawn every frame, and each of those frames must
   * be the flat ground plus one copy of the cached raised blocks: no rebuild
   * of the blocks, and no render of the ground into a target, until the
   * camera or the ground moves. The layer holds less than the screen does.
   */
  for (const renderer of ['canvas', 'webgl'] as const) {
    test(`holds a still raised board without redrawing its blocks on ${renderer}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      allowSoftwareWebgl(test, renderer);

      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Elias'], ['kaya'], 'lift-cost');
      await enterNode(page, 'battle_grumbler');
      await takeTurn(page);
      await waitForIdle(page);
      await settleLayout(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
      // Out of the way of the board, so no hover changes under the pointer.
      await page.mouse.move(1, 1);

      const frames = (count: number) =>
        page.evaluate(
          (n) =>
            new Promise((done) => {
              let left = n;
              const tick = () => (--left > 0 ? requestAnimationFrame(tick) : done(null));
              requestAnimationFrame(tick);
            }),
          count,
        );
      const cost = () => page.evaluate(() => ({ ...window.fnt?.liftCost }));
      await frames(10);
      const before = await cost();
      await frames(40);
      const after = await cost();
      const d = (key: keyof typeof before) => (after[key] ?? 0) - (before[key] ?? 0);
      const seen = JSON.stringify({ before, after });
      const drawn = d('frames');
      const screen = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
        return (canvas?.width ?? 0) * (canvas?.height ?? 0);
      });

      expect(drawn, `raised frames were drawn: ${seen}`).toBeGreaterThan(10);
      expect(d('layerBuilds'), `no rebuild while still: ${seen}`).toBe(0);
      expect(after.heldPx, `the layer is cropped: ${seen}`).toBeGreaterThan(0);
      expect(after.heldPx ?? Infinity, `the layer is cropped: ${seen}`).toBeLessThan(screen);
      if (renderer === 'webgl') {
        // Anything still rendered into a target is a lifted mark that moves,
        // cropped to it: never the ground.
        expect(d('targetPx') / drawn, `no board-sized render: ${seen}`).toBeLessThan(screen / 8);
      } else {
        // One copy of the layer a frame, and the odd copy over a marked top.
        expect(d('copiedPx') / drawn, `no board-sized copy: ${seen}`).toBeLessThan(
          (after.heldPx ?? 0) * 1.25,
        );
      }

      // A pan is a new camera: the blocks are drawn again, once.
      await page.evaluate(() => {
        const scene = (
          window.fnt?.app as unknown as {
            scene: { renderer?: { camera: { centreOn(pos: { x: number; y: number }): void } } };
          }
        ).scene;
        scene.renderer?.camera.centreOn({ x: 9, y: 9 });
      });
      await frames(20);
      const panned = await cost();
      expect((panned.layerBuilds ?? 0) - (after.layerBuilds ?? 0)).toBe(1);
    });
  }
});

/** Screen point at a tile's centre, inside the canvas element, through the camera. */
async function tileCentre(
  page: Page,
  pos: { x: number; y: number },
): Promise<{ x: number; y: number }> {
  const point = await page.evaluate((p) => {
    const camera = window.fnt?.app.rendererCamera?.();
    if (!camera) return null;
    const m = camera.groundTransform;
    const x = (p.x + 0.5) * 64,
      y = (p.y + 0.5) * 64;
    return { x: m.a * x + m.c * y + m.tx, y: m.b * x + m.d * y + m.ty };
  }, pos);
  if (!point) throw new Error('no map camera');
  return point;
}
