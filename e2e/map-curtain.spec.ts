import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

/**
 * Walking off one map onto the next keeps the explore scene and swaps its
 * board in place. Without a cover, the new map's procedural fallback showed
 * for a few frames until its painting arrived: flat green, octagon trees and
 * a placeholder figure, between Ba Dan and the forest road. The swap is now
 * curtained like a scene change, and the curtain lifts once the art is in.
 */
test('the walk from Ba Dan to the forest road is curtained', async ({ page }) => {
  test.setTimeout(90_000);
  await resetStorage(page);
  await startGame(page, ['Elias'], ['kaya'], 'map-curtain', { reduceMotion: false });
  await enterNode(page, 'village_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await settleLayout(page);

  // Watch the curtain, noting which map the scene drew whenever it changed.
  await page.evaluate(() => {
    const log: { cls: string; map: string | null }[] = [];
    (window as unknown as { curtainLog: typeof log }).curtainLog = log;
    const node = document.querySelector('.curtain');
    if (!node) throw new Error('No curtain');
    const scene = () =>
      (window.fnt?.app as unknown as { scene?: { drawnMapId?: () => string | null } }).scene;
    new MutationObserver(() =>
      log.push({ cls: node.className, map: scene()?.drawnMapId?.() ?? null }),
    ).observe(node, { attributes: true, attributeFilter: ['class'] });
  });

  // Stand beside the gate and step onto it.
  await page.evaluate(() => {
    const app = window.fnt!.app;
    const state = app.state!;
    app.adoptSave({ ...state, location: { ...state.location, pos: { x: 22, y: 7 } } }, undefined);
  });
  await waitForIdle(page);
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 23, y: 7 } }));
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId))
    .toBe('forest_road');

  // The cover went down over the forest's first frame, and came off again.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (
            window as unknown as { curtainLog: { cls: string; map: string | null }[] }
          ).curtainLog.some(
            (entry) => entry.cls.includes('is-down') && entry.map === 'forest_road',
          ),
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
  await expect(page.locator('.curtain')).not.toHaveClass(/is-down/, { timeout: 10_000 });
});
