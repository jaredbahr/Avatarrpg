import { expect, test } from '@playwright/test';
import { resetStorage } from './helpers';
import { fightToTheEnd, gamepadDriver, installGamepad, playToFirstFight } from './input-play';

/**
 * A controller alone (ADR 0112): what a Steam Remote Play guest on a phone or
 * a TV has. The pad is synthetic, a `navigator.getGamepads()` the game polls
 * as it would a real one, so this proves the mapping and the routing, not a
 * particular controller. Real hardware is on the checklist in
 * `docs/device-matrix.md`.
 */
test('a gamepad alone plays from the title to the end of the first fight', async ({ page }) => {
  test.setTimeout(360_000);
  await installGamepad(page);
  await resetStorage(page, '?renderer=canvas&titleArtHold=0');
  const pad = gamepadDriver(page);
  await playToFirstFight(page, pad);

  // Hints are in the pad's own letters, and the bar is where a turn starts.
  await expect(page.locator('html')).toHaveAttribute('data-pad', 'xbox');
  await expect.poll(() => page.evaluate(() => window.fnt?.app.boardBusy() === false)).toBe(true);
  await expect(page.locator('.combat-scene .hud .action-row > button').first()).toBeFocused();
  await expect(page.locator('.input-legend kbd').first()).toHaveText('D-pad');

  const outcome = await fightToTheEnd(page, pad);
  test.info().annotations.push({ type: 'fight outcome', description: outcome });
  expect(await page.evaluate(() => window.fnt?.app.state?.battle ?? null)).toBeNull();
  expect(await page.evaluate(() => window.fnt?.app.state?.story.visited)).toContain(
    'battle_forest_road',
  );
});
