/**
 * Review captures for the Ba Dan art-direction demo (issue #284): one bounded
 * slice of the village, the canal market corner, photographed the same way for
 * every route so a before and an after line up frame for frame.
 *
 * Slice: tiles x 0..13, y 0..9. Gao's house and shopfront, the market display
 * by the canal and its canopy tree, the bench and fence, the bridge, the canal
 * bank, the road, the south market display and its baskets, and Mira's midday
 * table at the slice's east edge.
 *
 * For each backend it writes, under FNT_DEMO_REVIEW_DIR (default
 * .shots/ba-dan-demo/<label>/<renderer>):
 * - slice-1x.png: the whole slice at game zoom (77 px tiles), the party in it;
 * - stop-NN-<name>.png and -walking.png: fixed walk beats through the slice;
 * - crop-<name>-4x.png: nearest-neighbour 4x enlargements of fixed regions;
 * - provenance.json: revision, renderer, seed, tile size, day phase, errors.
 * Playwright records the run as video (see the config) for the walk-through clip.
 *
 * Local review fixture only: not a playthrough, not a CI check.
 *
 * FNT_DEMO_LABEL=before npx playwright test -c playwright.ba-dan-demo.config.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

const TILE_PX = 77;

async function zoom(page: Page, target: number): Promise<void> {
  const current = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!current || !box) throw new Error('Missing camera');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, Math.log(current / target) / 0.002);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx))
    .toBeCloseTo(target, 0);
  await settleLayout(page);
}

/** Canvas-relative pixel centre of a tile, through the camera the tap handler reads. */
async function tilePoint(page: Page, x: number, y: number) {
  return page.evaluate(
    ({ x, y }) => {
      const m = window.fnt!.app.rendererCamera()!.groundTransform;
      return {
        x: m.a * (x + 0.5) * 64 + m.c * (y + 0.5) * 64 + m.tx,
        y: m.b * (x + 0.5) * 64 + m.d * (y + 0.5) * 64 + m.ty,
      };
    },
    { x, y },
  );
}

async function centerTile(page: Page, tx: number, ty: number): Promise<void> {
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  const point = await tilePoint(page, tx, ty);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + box.width / 2 - point.x, start.y + box.height / 2 - point.y, {
    steps: 6,
  });
  await page.mouse.up();
  await settleLayout(page);
}

async function place(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([x, y]) => {
      const app = window.fnt!.app;
      const state = app.state!;
      app.adoptSave({ ...state, location: { ...state.location, pos: { x, y } } }, undefined);
    },
    [x, y] as const,
  );
  await waitForIdle(page);
}

/**
 * Stand the party on `from`, keep the camera on the slice centre, tap `to`,
 * photograph it on the way and at the stop. The stop is re-framed on the slice
 * centre, so every beat frames the same ground and a before and an after compare.
 */
async function walk(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
  shot: string,
): Promise<void> {
  await place(page, from[0], from[1]);
  await centerTile(page, ...SLICE_CENTRE);
  await page
    .locator('.map-canvas')
    .click({ position: await tilePoint(page, to[0], to[1]), timeout: 5_000 });
  await page.waitForTimeout(450);
  await page.locator('.map-canvas').screenshot({ path: `${shot}-walking.png` });
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos), { timeout: 10_000 })
    .toEqual({ x: to[0], y: to[1] });
  await waitForIdle(page);
  // Walking pans the camera after the party; frame the slice again so every stop compares.
  await centerTile(page, ...SLICE_CENTRE);
  await page.waitForTimeout(600);
  await page.locator('.map-canvas').screenshot({ path: `${shot}.png` });
}

const SLICE_CENTRE = [7, 5] as const;

/** Walk beats through the slice; endpoints stay off resident anchors. */
const STOPS = [
  ['road-past-market', [1, 8], [8, 8]],
  ['over-bridge-to-shopfront', [9, 8], [8, 4]],
  ['behind-market-table', [8, 4], [3, 4]],
  ['back-to-the-bridge', [3, 4], [9, 5]],
  ['toward-mira', [11, 8], [10, 5]],
] as const;

/** 4x crop regions: a tile to centre on, and the crop's size in screen px before enlargement. */
const CROPS = [
  ['market-table', [6.5, 5], 200, 150],
  ['shopfront-and-door', [9, 3], 220, 160],
  ['south-display-and-baskets', [3, 9], 200, 150],
  ['canal-bank-and-bridge', [9, 6], 200, 150],
  ['tree-and-bench', [4.5, 5], 200, 160],
] as const;

function crop4x(source: string, cx: number, cy: number, w: number, h: number, out: string): void {
  const src = PNG.sync.read(readFileSync(source));
  const x0 = Math.max(0, Math.min(src.width - w, Math.round(cx - w / 2)));
  const y0 = Math.max(0, Math.min(src.height - h, Math.round(cy - h / 2)));
  const scale = 4;
  const dst = new PNG({ width: w * scale, height: h * scale });
  for (let y = 0; y < h * scale; y++) {
    for (let x = 0; x < w * scale; x++) {
      const s = ((y0 + Math.floor(y / scale)) * src.width + x0 + Math.floor(x / scale)) * 4;
      const d = (y * w * scale + x) * 4;
      dst.data[d] = src.data[s]!;
      dst.data[d + 1] = src.data[s + 1]!;
      dst.data[d + 2] = src.data[s + 2]!;
      dst.data[d + 3] = src.data[s + 3]!;
    }
  }
  writeFileSync(out, PNG.sync.write(dst));
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} Ba Dan demo slice`, async ({ page }) => {
    test.setTimeout(300_000);
    const revision =
      process.env.FNT_DEMO_REVISION ??
      execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
    const label = process.env.FNT_DEMO_LABEL ?? 'current';
    const folder = `${process.env.FNT_DEMO_REVIEW_DIR ?? '.shots/ba-dan-demo'}/${label}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'ba-dan-demo', {
      reduceMotion: false,
    });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);

    await zoom(page, TILE_PX);
    await place(page, 8, 8);
    await centerTile(page, ...SLICE_CENTRE);
    await page.waitForTimeout(600);
    const slice = `${folder}/slice-1x.png`;
    await page.locator('.map-canvas').screenshot({ path: slice });
    await page.screenshot({ path: `${folder}/slice-with-ui.png` });

    for (const [name, tile, w, h] of CROPS) {
      const p = await tilePoint(page, tile[0], tile[1]);
      crop4x(slice, p.x, p.y, w, h, `${folder}/crop-${name}-4x.png`);
    }

    for (const [index, [name, from, to]] of STOPS.entries()) {
      await walk(page, from, to, `${folder}/stop-${String(index + 1).padStart(2, '0')}-${name}`);
    }

    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          issue: 284,
          label,
          revision,
          renderer,
          seed: 'ba-dan-demo',
          tilePx: TILE_PX,
          slice: { x: [0, 13], y: [0, 9], centre: SLICE_CENTRE },
          dayPhase: await page.evaluate(() => {
            const s = window.fnt!.app.state as unknown as Record<string, unknown>;
            return s.dayPhase ?? (s.world as Record<string, unknown> | undefined)?.phase ?? null;
          }),
          diff: execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }),
          errors,
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
  });
}
