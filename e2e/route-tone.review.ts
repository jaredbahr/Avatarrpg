/**
 * Route tone review: how far does a `TERRAIN_STYLES` lift reach on the boards
 * the route actually plays?
 *
 * `road` and `stone` are not one material along the route. The village rim
 * falls back to them against bright illustrated paving, but the forest road is
 * packed brown earth and the cutting is flagstone over earth, and both of
 * those boards are `groundMode: 'partial'`: the procedural terrain is painted
 * under the authored plates and stays visible wherever a plate does not cover
 * it. A palette lift is only safe if that fallback moves toward the plates
 * rather than away from them, so this probe reads the authored board, the
 * procedural-only board and the bare cells, per node and per renderer, and
 * writes the frames beside a per-material table.
 *
 * Run it on the head before and the head after, then compare the two folders
 * with `scripts/route-tone-compare.mjs`: the pixels that move are the change's
 * blast radius, and their direction says whether it goes the right way.
 *
 * It shoots `.map-canvas` only, so the DOM hand-off card cannot cover the
 * frame the way a whole-page shot let it:
 *
 *   FNT_RT_TAG=after FNT_RT_RENDERER=canvas \
 *     npx playwright test -c playwright.route-tone.config.ts route-tone
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

const RENDERER = (process.env.FNT_RT_RENDERER ?? 'canvas') as 'canvas' | 'webgl';
const TAG = process.env.FNT_RT_TAG ?? 'head';
const NODES = (process.env.FNT_RT_NODES ?? 'battle_forest_road,battle_ambush').split(',');
const FOLDER = `.shots/route-tone/${TAG}`;

/** Swap the map's scene for one with the authored ground (and scenery) gone. */
const restyle = async (page: Page, mode: 'ground' | 'both') => {
  await page.evaluate((stripMode) => {
    const app = window.fnt!.app;
    const mapId = app.state!.battle?.mapId ?? app.state!.location?.mapId;
    const map = app.content.maps.get(mapId!);
    if (!map) throw new Error(`No map for ${mapId}`);
    const scene = map.scene;
    (window as unknown as Record<string, unknown>).__rtScene = scene;
    Object.defineProperty(map, 'scene', {
      value:
        stripMode === 'ground' ? { ...scene, ground: [] } : { ...scene, ground: [], scenery: [] },
      configurable: true,
    });
    app.resync();
  }, mode);
};

const restore = async (page: Page) => {
  await page.evaluate(() => {
    const app = window.fnt!.app;
    const mapId = app.state!.battle?.mapId ?? app.state!.location?.mapId;
    const map = app.content.maps.get(mapId!);
    const scene = (window as unknown as Record<string, unknown>).__rtScene;
    Object.defineProperty(map!, 'scene', { value: scene, configurable: true });
    app.resync();
  });
};

const mean = (rows: number[][]): number[] => {
  if (rows.length === 0) return [0, 0, 0];
  const sum = rows.reduce(
    (acc, r) => [acc[0]! + r[0]!, acc[1]! + r[1]!, acc[2]! + r[2]!],
    [0, 0, 0],
  );
  return [sum[0]! / rows.length, sum[1]! / rows.length, sum[2]! / rows.length];
};
const hex = (v: number[]) =>
  `#${v.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
const lum = (v: number[]) => 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!;

/** One projected tile centre, in canvas CSS px, plus the terrain under it. */
interface Sample {
  readonly x: number;
  readonly y: number;
  readonly terrain: string;
}

for (const NODE of NODES) {
  test(`${RENDERER} ${NODE} paving reach`, async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(FOLDER, { recursive: true });
    await resetStorage(page, `?renderer=${RENDERER}`);
    await startGame(page, ['Sura', 'Riko', 'Kaya'], ['sura', 'riko', 'kaya'], 'tone-probe', {
      reduceMotion: true,
    });
    await enterNode(page, NODE);
    await page.locator('.map-canvas').waitFor({ timeout: 30_000 });
    /*
     * The first party turn opens behind the pass-the-tablet card. It is a DOM
     * overlay, so the canvas shot below never sees it, but clearing it also
     * settles the HUD the camera is measured from.
     */
    const ready = page.getByRole('button', { name: /I.m ready/i });
    if (await ready.count()) await ready.click();
    await waitForIdle(page);
    await settleLayout(page);
    await page.waitForTimeout(300);

    const shot = async (name: string) => {
      writeFileSync(`${FOLDER}/${NODE}-${RENDERER}-${name}.png`, await canvasShot(page));
    };
    const canvasShot = async (page: Page) => page.locator('.map-canvas').screenshot();

    await shot('authored');
    /*
     * Where is each cell on the screen, and what is it made of? The camera
     * transform is the same one the e2e taps use, so a sample lands on the
     * cell the rules mean — which is what turns "the board got lighter" into
     * "the road cells got lighter".
     */
    const samples = await page.evaluate((): Sample[] => {
      const app = window.fnt!.app;
      const mapId = app.state!.battle?.mapId ?? app.state!.location?.mapId;
      const map = app.content.maps.get(mapId!)!;
      const camera = app.rendererCamera()!;
      const m = camera.groundTransform;
      const legend = map.legend ?? {};
      const out: Sample[] = [];
      map.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const template = legend[row[x]!];
          if (!template || template.blocked) continue;
          out.push({
            x: m.a * (x + 0.5) * 64 + m.c * (y + 0.5) * 64 + m.tx,
            y: m.b * (x + 0.5) * 64 + m.d * (y + 0.5) * 64 + m.ty,
            terrain: template.elevation ? `${template.terrain}+` : template.terrain,
          });
        }
      });
      return out;
    });
    await restyle(page, 'ground');
    await page.waitForTimeout(400);
    await shot('procedural');
    await restore(page);
    await page.waitForTimeout(400);
    await restyle(page, 'both');
    await page.waitForTimeout(400);
    await shot('cells');
    await restore(page);

    const a = PNG.sync.read(readFileSync(`${FOLDER}/${NODE}-${RENDERER}-authored.png`));
    const b = PNG.sync.read(readFileSync(`${FOLDER}/${NODE}-${RENDERER}-procedural.png`));

    // Pixels the authored plates actually cover, and the tone under them.
    const covered: number[][] = [];
    const bare: number[][] = [];
    const full: number[][] = [];
    for (let y = 0; y < a.height; y += 2)
      for (let x = 0; x < a.width; x += 2) {
        const i = (y * a.width + x) * 4;
        const row = [a.data[i]!, a.data[i + 1]!, a.data[i + 2]!];
        full.push(row);
        const delta =
          Math.abs(a.data[i]! - b.data[i]!) +
          Math.abs(a.data[i + 1]! - b.data[i + 1]!) +
          Math.abs(a.data[i + 2]! - b.data[i + 2]!);
        if (delta > 24) covered.push(row);
        else bare.push([b.data[i]!, b.data[i + 1]!, b.data[i + 2]!]);
      }
    const cm = mean(covered);
    const bm = mean(bare);
    console.log(
      `${TAG} ${RENDERER} ${NODE}: canvas ${a.width}x${a.height} mean ${hex(mean(full))} ` +
        `(lum ${lum(mean(full)).toFixed(1)}); authored-covered ${covered.length}px lum ` +
        `${lum(cm).toFixed(1)}, bare cells ${bare.length}px lum ${lum(bm).toFixed(1)} -> ` +
        `step ${(lum(cm) / lum(bm)).toFixed(2)}x`,
    );

    // A coarse map of where the authored ground is, on the same grid the
    // gallery reports: 48 px cells, `#` covered, `.` bare.
    const lines: string[] = [];
    for (let y = 24; y < a.height - 24; y += 48) {
      let line = '';
      for (let x = 24; x < a.width - 24; x += 48) {
        const i = (y * a.width + x) * 4;
        const delta =
          Math.abs(a.data[i]! - b.data[i]!) +
          Math.abs(a.data[i + 1]! - b.data[i + 1]!) +
          Math.abs(a.data[i + 2]! - b.data[i + 2]!);
        line += delta > 24 ? '#' : '.';
      }
      lines.push(`  ${line}`);
    }
    console.log(`${TAG} ${NODE}: authored ground coverage (# = plate, . = bare cell)`);
    console.log(lines.join('\n'));

    // Per-material tone of the rendered board, sampled at tile centres.
    const byTerrain = new Map<string, number[][]>();
    for (const s of samples) {
      const px = Math.round(s.x);
      const py = Math.round(s.y);
      if (px < 0 || py < 0 || px >= a.width || py >= a.height) continue;
      const i = (py * a.width + px) * 4;
      const row = [a.data[i]!, a.data[i + 1]!, a.data[i + 2]!];
      const bucket = byTerrain.get(s.terrain) ?? [];
      bucket.push(row);
      byTerrain.set(s.terrain, bucket);
    }
    const table = [...byTerrain.entries()]
      .map(([terrain, rows]) => ({
        terrain,
        n: rows.length,
        hex: hex(mean(rows)),
        lum: Number(lum(mean(rows)).toFixed(1)),
      }))
      .sort((p, q) => q.n - p.n);
    for (const t of table)
      console.log(
        `  ${TAG} ${NODE} ${RENDERER} ${t.terrain.padEnd(7)} n=${String(t.n).padStart(3)} ` +
          `${t.hex} lum ${t.lum.toFixed(1)}`,
      );
    writeFileSync(
      `${FOLDER}/${NODE}-${RENDERER}-tiles.json`,
      `${JSON.stringify({ tag: TAG, renderer: RENDERER, node: NODE, table }, null, 2)}\n`,
    );
  });
}
