import { expect, test, type Page } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame, waitForIdle } from './helpers';

/** Knocks every enemy out on the open Forest Road fight, as a won fight ends. */
async function winTheFight(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state!.battle!;
    app.state = {
      ...app.state!,
      battle: {
        ...battle,
        phase: 'victory',
        units: battle.units.map((u) => (u.faction === 'enemy' ? { ...u, hp: 0 } : u)),
      },
    };
    app.resync();
  });
}

test('the victory card lists what each hero earned, and matches the real result', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Ana', 'Ben', 'Cal'], ['kaya', 'sura', 'bo'], 'victory-card');
  await setLargeText(page, 'huge');
  await enterNode(page, 'battle_forest_road');
  await page.waitForFunction(() => window.fnt?.app.state?.battle?.phase === 'active');
  await waitForIdle(page);
  // The opening caption is still up; the card clears it rather than sit under it.
  await expect(page.locator('.toast')).not.toHaveCount(0);
  await winTheFight(page);

  const panel = page.locator('.result-panel');
  await expect(panel.getByRole('heading', { name: 'The fight is won' })).toBeVisible();
  await expect(page.locator('.toast')).toHaveCount(0);
  const rows = panel.locator('.victory-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('Kaya');
  await expect(rows.first()).toContainText('Ana');
  const xp = await rows.locator('.victory-xp').allTextContents();

  // Even at Largest text the whole card, Continue included, is on screen.
  const viewport = page.viewportSize()!;
  const box = (await panel.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

  const before = await page.evaluate(() => window.fnt!.app.state!.party.map((u) => u.xp));
  await panel.getByRole('button', { name: 'Continue' }).click();
  await page.waitForFunction(() => window.fnt?.app.state?.battle === null);
  const after = await page.evaluate(() => window.fnt!.app.state!.party.map((u) => u.xp));
  expect(xp).toEqual(after.map((value, i) => `+${value - before[i]!} XP`));
});
