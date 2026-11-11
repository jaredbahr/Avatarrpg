import { expect, test } from '@playwright/test';
import { paintedTileCentre } from './projection';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

/**
 * Ba Dan under `?style=topdown` (ADR 0104, T3) on Canvas 2D: the baked top-down scene loads, a tap
 * where a tile is painted walks the party to that tile (the camera's pick and its paint agree), and
 * the walk east along the road leaves by the east exit for the Forest Road.
 */
test('the top-down village walks from the spawn out of the east exit', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await resetStorage(page, '?renderer=canvas&style=topdown');
  await startGame(page, ['Elias'], ['kaya'], 'topdown-ba-dan', { reduceMotion: false });
  await enterNode(page, 'village_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await settleLayout(page);

  // The top-down board: 40 px tiles, nothing raised.
  const camera = await page.evaluate(() => window.fnt?.app.rendererCamera());
  expect(camera?.projection).toBe('topdown');
  expect(camera?.tile).toBe(40);
  const spawn = await page.evaluate(() => window.fnt?.app.state?.location.pos ?? null);
  expect(spawn).not.toBeNull();

  // East along the road in short hops, each tapped where its tile is painted: the pick of that
  // point is the tile, so the rules stand the party on it.
  // At the top-down zoom about ten tiles fit across, so each hop stays on screen; the camera
  // follows the walk (with full motion: a reduced-motion walk lands at once and does not pan).
  for (const to of [
    { x: 5, y: 7 },
    { x: 8, y: 8 },
    { x: 11, y: 7 },
    { x: 14, y: 8 },
    { x: 17, y: 7 },
    { x: 20, y: 8 },
    { x: 22, y: 7 },
  ]) {
    const point = await paintedTileCentre(page, to);
    expect(point, 'no camera to map the tile through').not.toBeNull();
    if (!point) return;
    await page.mouse.click(point.x, point.y);
    await waitForIdle(page);
    await expect
      .poll(async () => page.evaluate(() => window.fnt?.app.state?.location.pos))
      .toEqual(to);
  }

  // The east exit's mouth, one more tile on, leads to the Forest Road.
  const gate = await paintedTileCentre(page, { x: 23, y: 7 });
  expect(gate).not.toBeNull();
  if (!gate) return;
  await page.mouse.click(gate.x, gate.y);
  await expect
    .poll(async () => page.evaluate(() => window.fnt?.app.state?.location.mapId))
    .toBe('forest_road');
  expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
});
