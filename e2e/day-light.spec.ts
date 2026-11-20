import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DAY_LIGHT } from '../src/content/dayLight';
import type { DayPhase, Grid } from '../src/core/types';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

/**
 * The day's light (ADR 0121, issue #881), read off the real canvas on both backends: at evening the
 * graded board is the midday board times the grade plus its lift, and the ground under a lit lamp is
 * warmer than the grade alone leaves it. Reduce motion is on (the default here), so no ripple or
 * mote moves between the two frames, and the grade and pools are static anyway.
 */

type Rgb = [number, number, number];

/** Puts the party at the canal lamps in `phase` and returns the map canvas as CSS pixels. */
async function frame(page: Page, phase: DayPhase) {
  await page.evaluate((phase) => {
    const app = window.fnt!.app;
    const state = app.state!;
    app.adoptSave(
      {
        ...state,
        screen: 'explore',
        story: { ...state.story, nodeId: 'village_explore', visited: ['mira_intro'] },
        location: { mapId: 'ba_dan_village', pos: { x: 20, y: 11 } },
        world: { ...state.world, clock: { day: 1, phase } },
      },
      undefined,
    );
  }, phase);
  await waitForIdle(page);
  await settleLayout(page);
  const canvas = page.locator('.explore-scene .map-canvas');
  const png = PNG.sync.read(await canvas.screenshot({ scale: 'css' }));
  const camera = await page.evaluate(() => window.fnt!.app.rendererCamera());
  if (!camera) throw new Error('No camera');
  /** The pixel over world px (x, y). */
  const at = (x: number, y: number): Rgb => {
    const m = camera.groundTransform;
    const px = Math.floor(m.a * x + m.c * y + m.tx);
    const py = Math.floor(m.b * x + m.d * y + m.ty);
    expect(px).toBeGreaterThanOrEqual(0);
    expect(py).toBeGreaterThanOrEqual(0);
    expect(px).toBeLessThan(png.width);
    expect(py).toBeLessThan(png.height);
    const i = (py * png.width + px) * 4;
    return [png.data[i] ?? 0, png.data[i + 1] ?? 0, png.data[i + 2] ?? 0];
  };
  return at;
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer}: evening grades the board and the lamps pool light on the ground`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Jared'], ['kaya'], 'day-light-881');
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);

    // Where to look, from the scene's data: the east canal lamp, and the canal's water a little west.
    const where = await page.evaluate(() => {
      const map = window.fnt!.app.content.maps.get('ba_dan_village');
      const scene = map?.scene;
      const lamp = scene?.scenery.find((p) => p.id.endsWith('canal-lamp-east'));
      const glass = scene?.ambienceSources?.lanterns.find(
        (l) => lamp && l.x * 40 >= lamp.x && l.x * 40 < lamp.x + lamp.width,
      );
      // The explore scene's live grid: the rules' water, where no one walks.
      const grid = (
        window.fnt!.app as unknown as {
          scene: { grid?: Grid };
        }
      ).scene.grid;
      const water: { x: number; y: number }[] = [];
      if (grid)
        for (let y = 0; y < grid.height; y++)
          for (let x = 0; x < grid.width; x++) {
            const tile = grid.tiles[y * grid.width + x];
            if (tile?.surface?.id === 'water' && tile.surface.duration < 0) water.push({ x, y });
          }
      return { lamp, glass, water };
    });
    if (!where.lamp || !where.glass) throw new Error('The east canal lamp is missing');
    // The pool's inner ring, just below the post's foot on its own (blocked) cell: nobody stands there.
    const pool = { x: where.glass.x * 40, y: where.lamp.y + where.lamp.height + 4 };
    // Water nobody walks on, nearest the party, away from every lamp's pool.
    const cell = where.water
      .filter((c) => Math.abs(c.x - 21) <= 3)
      .sort((p, q) => Math.abs(p.y - 13) - Math.abs(q.y - 13))[0];
    if (!cell) throw new Error('No canal water near the lamps');
    const bare = { x: cell.x * 40 + 20, y: cell.y * 40 + 20 };

    const midday = await frame(page, 'midday');
    const dayBare = midday(bare.x, bare.y);
    const dayPool = midday(pool.x, pool.y);
    const evening = await frame(page, 'evening');
    const duskBare = evening(bare.x, bare.y);
    const duskPool = evening(pool.x, pool.y);

    const grade = DAY_LIGHT.evening.grade;
    if (!grade) throw new Error('Evening has no grade');
    const graded = (c: Rgb): Rgb =>
      c.map((v, i) => Math.min(255, v * (grade.multiply[i] ?? 1) + (grade.lift[i] ?? 0))) as Rgb;

    // The bare board is the midday board, graded: within a little rounding on each channel.
    const want = graded(dayBare);
    duskBare.forEach((v, i) =>
      expect(Math.abs(v - (want[i] ?? 0)), `channel ${i}`).toBeLessThanOrEqual(4),
    );
    // Visibly so: green drops by a fifth.
    expect(duskBare[1]).toBeLessThan(dayBare[1] * 0.88);

    // Under the lamp the ground is lit warm, well past what the grade alone would leave.
    const unlit = graded(dayPool);
    expect(duskPool[0] - unlit[0]).toBeGreaterThan(25);
    expect(duskPool[1] - unlit[1]).toBeGreaterThan(12);
    expect(duskPool[0] - unlit[0]).toBeGreaterThan(duskPool[2] - unlit[2]);
  });
}
