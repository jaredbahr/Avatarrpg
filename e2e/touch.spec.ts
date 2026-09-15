import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn } from './helpers';

/**
 * Touch ergonomics.
 *
 * Every control has to be hittable by a six-year-old with a finger on a
 * Surface, at normal text size and at the largest. 48 CSS pixels is the
 * threshold, and it is checked against the *rendered* box rather than the
 * stylesheet, so a flex container squeezing a row still fails.
 */
const MIN_TAP_PX = 48;

async function assertAllTappable(controls: Locator, context: string): Promise<void> {
  const count = await controls.count();
  expect(count, `${context}: expected some controls`).toBeGreaterThan(0);

  const undersized: string[] = [];
  for (let i = 0; i < count; i++) {
    const control = controls.nth(i);
    if (!(await control.isVisible())) continue;
    const box = await control.boundingBox();
    if (!box) continue;
    if (box.height < MIN_TAP_PX - 0.5 || box.width < MIN_TAP_PX - 0.5) {
      const label = (await control.textContent())?.trim() ?? '(unlabelled)';
      undersized.push(`${label}: ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
  }

  expect(undersized, `${context}: controls below ${MIN_TAP_PX}px`).toEqual([]);
}

test.describe('touch targets', () => {
  test('title screen buttons are all tappable', async ({ page }) => {
    await resetStorage(page);
    await assertAllTappable(page.locator('.title-card button'), 'title');
  });

  test('every action bar control is tappable during a fight', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'touch-spec');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);

    await expect(page.locator('.action-bar')).toBeVisible();
    await assertAllTappable(page.locator('.action-bar button'), 'action bar');
    await assertAllTappable(page.locator('.top-bar button'), 'combat top bar');
  });

  test('stays tappable with the largest text setting', async ({ page }) => {
    await resetStorage(page);

    await page.getByRole('button', { name: /^Settings$/ }).click();
    await page.getByRole('radio', { name: 'Largest' }).click();
    await page.getByRole('button', { name: /^Done$/ }).click();

    await expect
      .poll(async () => page.evaluate(() => document.documentElement.dataset.largeText))
      .toBe('huge');

    await startGame(page, ['Elias'], ['kaya'], 'touch-large');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);

    await assertAllTappable(page.locator('.action-bar button'), 'action bar at largest text');
  });

  test('the hand-off banner is the only thing tappable between turns', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias', 'Lorelai'], ['kaya', 'bo'], 'handoff-spec');
    await enterNode(page, 'battle_forest_road');

    const banner = page.locator('.handoff-banner');
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('heading')).toHaveText(/Elias|Lorelai/);

    // Tapping the map behind the banner must not do anything.
    const before = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      const unit = battle?.units.find((u) => u.id === battle.order[battle.turnIndex]);
      return unit ? `${unit.pos.x},${unit.pos.y}` : '';
    });

    const map = await page.locator('.map-canvas').boundingBox();
    if (map) await page.touchscreen.tap(map.x + map.width * 0.5, map.y + map.height * 0.5);

    const after = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      const unit = battle?.units.find((u) => u.id === battle.order[battle.turnIndex]);
      return unit ? `${unit.pos.x},${unit.pos.y}` : '';
    });

    expect(after).toBe(before);

    await banner.getByRole('button', { name: /I'm ready/i }).click();
    await expect(banner).toHaveCount(0);
  });

  test('solo play skips the hand-off banner entirely', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Solo'], ['bo'], 'solo-spec');
    await enterNode(page, 'battle_forest_road');

    await expect(page.locator('.action-bar')).toBeVisible();
    await expect(page.locator('.handoff-banner')).toHaveCount(0);
  });
});
