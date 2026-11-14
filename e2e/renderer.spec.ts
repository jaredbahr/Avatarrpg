import { expect, test } from '@playwright/test';
import type { Browser, Page, TestInfo } from '@playwright/test';
import type { EncounterDef, MapDef, Vec2 } from '../src/core/types';
import { allowSoftwareWebgl } from './budget';
import {
  enterNode,
  resetStorage,
  settleMapCanvas,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import { screenshotPixels } from './pixels';
import type { Pixels, Rgb } from './pixels';
import { paintedTileCentre } from './projection';

type Renderer = 'canvas' | 'webgl';

/** The staged plate board: a 20x12 top-down fight whose ground is one plate the spec paints itself. */
const PLATE = { width: 20, height: 12, tile: 40 } as const;

/**
 * Three flat colours laid so a tile's colour is `(x + 2y) mod 3`: a shift of one tile along either
 * axis, or a stretch that drifts by one somewhere across the board, changes the colour under a probe.
 */
const CHECKER: readonly Rgb[] = [
  { r: 224, g: 48, b: 48 },
  { r: 48, g: 192, b: 64 },
  { r: 48, g: 80, b: 224 },
];
const checkerIndex = (x: number, y: number) => (x + 2 * y) % 3;

/** One flat colour that no figure wears, so the feet blob's darkening of it can be told apart. */
const FLAT: Rgb = { r: 210, g: 70, b: 210 };

type Plate = 'checker' | 'flat';

/**
 * Swap the Forest Road ambush's map for a plain 20x12 top-down board whose single ground plate is
 * painted here (a data URL, so nothing loads from the network), and its roster for two thugs. The
 * story encounter still supplies the real combat scene; only its content entries change.
 */
async function stagePlateFight(page: Page, plate: Plate, characters: string[]): Promise<void> {
  await page.evaluate(
    ({ plate, board, checker, flat, characters }) => {
      const app = window.fnt?.app;
      const encounter = app?.content.encounters.get('enc_forest_road');
      if (!app || !encounter) throw new Error('Forest road encounter unavailable.');
      const paint = document.createElement('canvas');
      paint.width = board.width * board.tile;
      paint.height = board.height * board.tile;
      const context = paint.getContext('2d');
      if (!context) throw new Error('No 2D context to paint the plate.');
      for (let y = 0; y < board.height; y++)
        for (let x = 0; x < board.width; x++) {
          const c = plate === 'checker' ? checker[(x + 2 * y) % 3]! : flat;
          context.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
          context.fillRect(x * board.tile, y * board.tile, board.tile, board.tile);
        }
      const extent = { x: 0, y: 0, width: paint.width, height: paint.height };
      const map = {
        id: encounter.mapId,
        name: 'Plate board',
        kind: 'combat',
        projection: 'topdown',
        width: board.width,
        height: board.height,
        rows: Array.from({ length: board.height }, () => '.'.repeat(board.width)),
        legend: { '.': { terrain: 'grass' } },
        partySpawns: [
          { x: 3, y: 2 },
          { x: 3, y: 5 },
          { x: 6, y: 3 },
        ].slice(0, characters.length),
        npcs: [],
        props: [],
        ambience: 'forest',
        scene: {
          ground: [{ url: paint.toDataURL('image/png'), ...extent }],
          scenery: [],
          paintExtent: extent,
        },
      } as unknown as MapDef;
      (app.content.maps as Map<string, MapDef>).set(map.id, map);
      (app.content.encounters as Map<string, EncounterDef>).set(encounter.id, {
        ...encounter,
        enemies: [
          { enemyId: 'bandit_thug', pos: { x: 11, y: 2 } },
          { enemyId: 'bandit_thug', pos: { x: 13, y: 5 } },
        ],
        allies: [],
        conditionalEnemies: [],
        reinforcements: [],
        variants: [],
      });
    },
    { plate, board: PLATE, checker: CHECKER, flat: FLAT, characters },
  );
}

/** Open the staged plate fight on a party turn, with the board settled. */
async function openPlateFight(
  page: Page,
  renderer: Renderer,
  plate: Plate,
  characters: string[],
): Promise<void> {
  await resetStorage(page, `?renderer=${renderer}`);
  await startGame(
    page,
    characters.map((_, i) => `P${i + 1}`),
    characters,
    `plate-${plate}-${renderer}`,
  );
  await stagePlateFight(page, plate, characters);
  await enterNode(page, 'battle_forest_road');
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  await settleMapCanvas(page);
  expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
  expect(await page.evaluate(() => window.fnt?.app.rendererCamera()?.projection)).toBe('topdown');
}

/**
 * Runs `body` on a page at `dpr`. The Chromium touch project opens its own context at each ratio
 * (an iPad-sized viewport); another project runs only the case at its own ratio, on its own page.
 */
async function atDpr(
  browser: Browser,
  page: Page,
  testInfo: TestInfo,
  dpr: number,
  body: (page: Page) => Promise<void>,
): Promise<void> {
  if (testInfo.project.name !== 'surface-touch') {
    const own = testInfo.project.use.deviceScaleFactor ?? 1;
    test.skip(own !== dpr, `this project runs at dpr ${own}`);
    await body(page);
    return;
  }
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.FNT_E2E_PORT ?? '4173'}`,
    viewport: { width: 1194, height: 834 },
    deviceScaleFactor: dpr,
    hasTouch: true,
  });
  try {
    await body(await context.newPage());
  } finally {
    await context.close();
  }
}

interface CameraKey {
  readonly key: string;
}

/** Everything a probe position depends on: the camera and the canvas' box and backing store. */
async function cameraKey(page: Page): Promise<CameraKey | null> {
  return page.evaluate(() => {
    const camera = window.fnt?.app.rendererCamera();
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    if (!camera || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      key: JSON.stringify([
        camera.groundTransform,
        camera.tilePx,
        rect.width,
        rect.height,
        canvas.width,
        canvas.height,
      ]),
    };
  });
}

/**
 * One screenshot of the canvas, and `locate`'s probe positions read on either side of it: if the
 * camera or the canvas moved while the capture was on its way, it is taken again.
 */
async function stableCapture<T>(
  page: Page,
  locate: () => Promise<T>,
): Promise<{ probe: T; pixels: Pixels }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await cameraKey(page);
    const probe = await locate();
    const pixels = await screenshotPixels(page.locator('.map-canvas'));
    const after = await cameraKey(page);
    if (before && after && before.key === after.key) return { probe, pixels };
    await settleMapCanvas(page);
  }
  throw new Error('the camera kept moving while the canvas was captured');
}

const distance = (a: Rgb, b: Rgb) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

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
    for (const dpr of [1, 2] as const) {
      test(`paints the top-down ground under the tiles on ${renderer} at dpr ${dpr}`, async ({
        browser,
        page,
      }, testInfo) => {
        allowSoftwareWebgl(test, renderer);
        await atDpr(browser, page, testInfo, dpr, async (page) => {
          await openPlateFight(page, renderer, 'checker', ['kaya']);
          expect(await page.evaluate(() => window.devicePixelRatio)).toBe(dpr);

          // Every whole tile on the canvas, clear of the HUD and of the figures, probed at its centre
          // and a fifth of a tile in from each corner: the colour there must be that tile's colour.
          const locate = () =>
            page.evaluate(
              ({ board }) => {
                const app = window.fnt?.app;
                const camera = app?.rendererCamera();
                const battle = app?.state?.battle;
                const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
                if (!camera || !battle || !canvas) throw new Error('No top-down board mounted.');
                const rect = canvas.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                const m = camera.groundTransform;
                const sx = rect.width / (canvas.width / dpr);
                const sy = rect.height / (canvas.height / dpr);
                const at = (gx: number, gy: number) => ({
                  x: (m.a * gx * camera.tile + m.c * gy * camera.tile + m.tx) * sx,
                  y: (m.b * gx * camera.tile + m.d * gy * camera.tile + m.ty) * sy,
                });
                const clear = (p: { x: number; y: number }) =>
                  p.x >= 3 &&
                  p.y >= 3 &&
                  p.x <= rect.width - 3 &&
                  p.y <= rect.height - 3 &&
                  document.elementFromPoint(rect.left + p.x, rect.top + p.y) === canvas;
                const nearFigure = (x: number, y: number) =>
                  battle.units.some(
                    (u) => Math.abs(u.pos.x - x) <= 1 && u.pos.y - y >= -1 && u.pos.y - y <= 2,
                  );
                const probes: { tile: { x: number; y: number }; x: number; y: number }[] = [];
                for (let y = 0; y < board.height; y++)
                  for (let x = 0; x < board.width; x++) {
                    if (nearFigure(x, y)) continue;
                    const points = [
                      at(x + 0.5, y + 0.5),
                      at(x + 0.2, y + 0.2),
                      at(x + 0.8, y + 0.2),
                      at(x + 0.2, y + 0.8),
                      at(x + 0.8, y + 0.8),
                    ];
                    if (!points.every(clear)) continue;
                    for (const p of points) probes.push({ tile: { x, y }, ...p });
                  }
                return probes;
              },
              { board: PLATE },
            );

          // The plate is a data URL decoded off the frame; wait for it to be presented, then the
          // very capture that shows it has to hold for every probe.
          let probed = 0;
          await expect
            .poll(
              async () => {
                const { probe, pixels } = await stableCapture(page, locate);
                probed = probe.length;
                const misses: string[] = [];
                for (const p of probe) {
                  const seen = average1(pixels, p.x, p.y);
                  const nearest = CHECKER.map((c) => distance(c, seen));
                  const best = nearest.indexOf(Math.min(...nearest));
                  if (best !== checkerIndex(p.tile.x, p.tile.y))
                    misses.push(
                      `(${p.tile.x},${p.tile.y}) at ${p.x.toFixed(1)},${p.y.toFixed(1)}: ${JSON.stringify(seen)}`,
                    );
                }
                // The first few are enough to see a pattern in a failure report.
                return misses.slice(0, 12);
              },
              {
                message: 'ground pixels that are not their tile',
                timeout: renderer === 'webgl' ? 180_000 : 20_000,
                intervals: [500, 1_000, 2_000],
              },
            )
            .toEqual([]);
          // A board that shows little of itself would prove little: forty clear tiles at least.
          expect(probed).toBeGreaterThanOrEqual(5 * 40);
        });
      });
    }
  }

  /*
   * The same check from the other side: the tap handler's pick. In Move mode a tap on any tile
   * makes it the pending target, so tapping where each tile of a slice of the Forest Road is painted
   * must pend exactly that tile, on both backends. The opening top-down frame is scrolled (the board
   * is wider than a readable zoom shows), so the slice is picked through a non-zero offset.
   */
  for (const renderer of ['canvas', 'webgl'] as const) {
    test(`a tap on every cell of a top-down board slice acts on that cell on ${renderer}`, async ({
      page,
    }) => {
      allowSoftwareWebgl(test, renderer);
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Solo'], ['kaya'], `slice-taps-${renderer}`);
      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);
      await settleMapCanvas(page);
      expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
      expect(await page.evaluate(() => window.fnt?.app.rendererCamera()?.projection)).toBe(
        'topdown',
      );

      await page.getByRole('button', { name: /^Move\b/ }).click();
      const pending = () =>
        page.evaluate(() => {
          const scene = (window.fnt?.app as unknown as { scene?: { pending?: Vec2 | null } })
            ?.scene;
          return scene?.pending ?? null;
        });

      // Three by three beside Kaya: road, the puddle's water and its edge, none under a figure.
      // Each tap costs seconds of software-WebGL frames, so the slice stays small; the ground
      // check above covers the whole visible board for drift.
      const slice: Vec2[] = [];
      for (let y = 6; y <= 8; y++) for (let x = 4; x <= 6; x++) slice.push({ x, y });
      let settled = true;
      for (const cell of slice) {
        // The first pending tile shows the confirm bar, which reflows the map. Settle whenever the
        // camera or the canvas moved since the last point was measured; a software-WebGL settle
        // costs several seconds, so not after every tap.
        if (!settled) await settleMapCanvas(page);
        const measured = await cameraKey(page);
        const point = await paintedTileCentre(page, cell);
        expect(point, `no painted centre for (${cell.x},${cell.y})`).not.toBeNull();
        if (!point) return;
        const onCanvas = await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y) === document.querySelector('.map-canvas'),
          point,
        );
        expect(onCanvas, `(${cell.x},${cell.y}) is not on the canvas`).toBe(true);
        await page.mouse.click(point.x, point.y);
        await expect.poll(pending, { message: `tap on (${cell.x},${cell.y})` }).toEqual(cell);
        const now = await cameraKey(page);
        settled = cell !== slice[0] && now !== null && now.key === measured?.key;
      }
    });
  }

  /*
   * Figure grounding on the top-down board (ADR 0104 T4): each figure stands on Imagination's
   * `feetBlob`, a hard ellipse of the shadow ink under its feet, on both backends. On a plate of one
   * flat colour the blob is the one darker, same-hued colour on the ground, so it can be found
   * without the renderer's own geometry: it must lie under the figure's lowest drawn pixels, centred
   * on them, wider than the feet and a third as tall as it is wide.
   */
  for (const renderer of ['canvas', 'webgl'] as const) {
    test(`stands each top-down figure on its feet blob on ${renderer}`, async ({ page }) => {
      allowSoftwareWebgl(test, renderer);
      await openPlateFight(page, renderer, 'flat', ['kaya', 'sura', 'bo']);

      const figures = () =>
        page.evaluate(() => {
          const app = window.fnt?.app;
          const camera = app?.rendererCamera();
          const battle = app?.state?.battle;
          const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
          if (!camera || !battle || !canvas) throw new Error('No top-down board mounted.');
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          const m = camera.groundTransform;
          const sx = rect.width / (canvas.width / dpr);
          const sy = rect.height / (canvas.height / dpr);
          const active = battle.order[battle.turnIndex];
          return {
            // The last CSS row and column of a fractional box are blended with what is around it.
            width: rect.width - 2,
            height: rect.height - 2,
            figures: battle.units
              .filter((u) => u.hp > 0 && u.size === 1)
              .map((u) => ({
                id: u.id,
                // The active figure stands in its turn ring, drawn over the blob on purpose.
                active: u.id === active,
                left: (m.a * u.pos.x * camera.tile + m.tx) * sx,
                top: (m.d * u.pos.y * camera.tile + m.ty) * sy,
                size: camera.tilePx * sx,
              })),
          };
        });

      await expect
        .poll(
          async () => {
            const { probe, pixels } = await stableCapture(page, figures);
            const others = probe.figures.filter((f) => !f.active);
            const report = others.flatMap((figure) => {
              const result = groundingOf(pixels, figure, probe);
              return result.ok ? [] : [`${figure.id}: ${result.why}`];
            });
            // Two party members besides the active one, and both thugs.
            return others.length >= 4 ? report : [`only ${others.length} figures to check`];
          },
          {
            message: 'figures off their feet blobs',
            timeout: renderer === 'webgl' ? 180_000 : 20_000,
            intervals: [500, 1_000, 2_000],
          },
        )
        .toEqual([]);
    });
  }
});

/** The colour at a point, averaged over the 3x3 CSS px around it. */
function average1(pixels: Pixels, x: number, y: number): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const c = pixels.at(x + dx, y + dy);
      if (!c) continue;
      r += c.r;
      g += c.g;
      b += c.b;
      n++;
    }
  return n ? { r: r / n, g: g / n, b: b / n } : { r: 0, g: 0, b: 0 };
}

const luminance = (c: Rgb) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;

/**
 * Finds a figure's feet blob on the flat plate and checks it is under the figure. The region is the
 * figure's tile and the half tile below it, below the tile's middle (so the health bar and head are
 * out of it). Ground is the plate colour; the blob is the commonest colour that darkens it without
 * changing its hue (the plate is magenta, which no figure wears); the rest is figure.
 */
function groundingOf(
  pixels: Pixels,
  figure: { left: number; top: number; size: number },
  canvas: { width: number; height: number },
): { ok: true } | { ok: false; why: string } {
  const x0 = Math.round(figure.left - figure.size * 0.25);
  const x1 = Math.round(figure.left + figure.size * 1.25);
  const y0 = Math.round(figure.top + figure.size * 0.5);
  const y1 = Math.round(figure.top + figure.size * 1.5);
  if (x0 < 0 || y0 < 0 || x1 > canvas.width || y1 > canvas.height)
    return { ok: false, why: `off the canvas: ${JSON.stringify({ x0, y0, x1, y1, canvas })}` };
  const counts = new Map<string, { c: Rgb; n: number }>();
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const c = pixels.at(x, y);
      if (!c) continue;
      const key = `${c.r},${c.g},${c.b}`;
      const entry = counts.get(key);
      if (entry) entry.n++;
      else counts.set(key, { c, n: 1 });
    }
  const sorted = [...counts.values()].sort((a, b) => b.n - a.n);
  const ground = sorted[0]?.c;
  if (!ground || distance(ground, FLAT) > 30)
    return { ok: false, why: `ground is not the plate: ${JSON.stringify(ground)}` };
  const isBlob = (c: Rgb) =>
    luminance(c) < luminance(ground) * 0.7 &&
    c.r > c.g * 1.3 &&
    c.b > c.g * 1.3 &&
    c.r / c.b > 0.75 &&
    c.r / c.b < 1.35;
  const blob = sorted.find((e) => e.n >= 20 && isBlob(e.c))?.c;
  if (!blob) return { ok: false, why: 'no darkened plate colour near the feet' };

  const shadow = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, sx: 0, n: 0 };
  let soles = -Infinity;
  const figureRows = new Map<number, number[]>();
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const c = pixels.at(x, y);
      if (!c) continue;
      if (distance(c, blob) <= 12) {
        shadow.minX = Math.min(shadow.minX, x);
        shadow.maxX = Math.max(shadow.maxX, x);
        shadow.minY = Math.min(shadow.minY, y);
        shadow.maxY = Math.max(shadow.maxY, y);
        shadow.sx += x;
        shadow.n++;
      } else if (distance(c, ground) > 24) {
        soles = Math.max(soles, y);
        const row = figureRows.get(y) ?? [];
        row.push(x);
        figureRows.set(y, row);
      }
    }
  const width = shadow.maxX - shadow.minX + 1;
  const height = shadow.maxY - shadow.minY + 1;
  const centre = shadow.sx / shadow.n;
  // The feet: the figure's drawn pixels in its lowest three rows.
  const feet = [soles, soles - 1, soles - 2].flatMap((y) => figureRows.get(y) ?? []);
  const seen = JSON.stringify({
    blob,
    ground,
    shadow: { ...shadow, width, height, centre },
    soles,
    feet: feet.length ? [Math.min(...feet), Math.max(...feet)] : null,
  });
  if (!feet.length) return { ok: false, why: `no figure pixels: ${seen}` };
  const feetLeft = Math.min(...feet);
  const feetRight = Math.max(...feet);
  if (soles < shadow.minY || soles > shadow.maxY + 1)
    return { ok: false, why: `the soles are not on the blob: ${seen}` };
  if (centre < feetLeft - 2 || centre > feetRight + 2)
    return { ok: false, why: `the blob is not centred under the feet: ${seen}` };
  if (shadow.minX > feetLeft || shadow.maxX < feetRight)
    return { ok: false, why: `the blob does not reach past the feet: ${seen}` };
  if (width < figure.size * 0.3 || width > figure.size * 0.8 || height > width * 0.6)
    return { ok: false, why: `the blob is not a feet ellipse: ${seen}` };
  return { ok: true };
}
