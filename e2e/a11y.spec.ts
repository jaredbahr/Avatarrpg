import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { earnedRewardFixture } from './earnedRewardFixture';
import { enterNode, settleDialog, startGame, takeTurn, waitForIdle } from './helpers';

const wcag21AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function audit(page: Page, info: TestInfo) {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withTags(wcag21AA).analyze();
  await info.attach('axe-results', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  const blocking = results.violations
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) }));
  expect.soft(blocking, 'serious or critical WCAG 2.1 AA violations').toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible();
});

test('accessibility of the title screen', async ({ page }, info) => {
  await audit(page, info);
});

test('accessibility of party setup', async ({ page }, info) => {
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: '1 player', exact: true }).click();
  await page.getByRole('button', { name: 'Choose your own', exact: true }).click();
  await expect(page.locator('input[type=text]')).toBeVisible();
  await audit(page, info);
});

test('accessibility of Settings', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await settleDialog(dialog);
  await audit(page, info);
});

test('accessibility of the exploration HUD', async ({ page }, info) => {
  await startGame(page, ['Aster'], ['kaya'], 'a11y');
  await enterNode(page, 'village_explore');
  await expect(page.locator('.explore-dock')).toBeVisible();
  const map = page.locator('.explore-scene canvas.map-canvas');
  await expect(map).toBeVisible();
  await expect(map).toHaveAccessibleName(/\bmap$/i);
  await audit(page, info);
});

test('accessibility of dialogue', async ({ page }, info) => {
  await startGame(page, ['Aster'], ['kaya'], 'a11y');
  await enterNode(page, 'village_explore');
  await expect(page.locator('.explore-dock')).toBeVisible();
  await enterNode(page, 'mira_intro');
  await expect(page.locator('.explore-conversation .dialogue-panel')).toBeVisible();
  await expect(page.locator('.explore-dock')).toBeHidden();
  await audit(page, info);
});

test('accessibility of the combat HUD with an ability selected', async ({ page }, info) => {
  await startGame(page, ['Aster'], ['kaya'], 'a11y');
  await enterNode(page, 'battle_forest_road');
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  await page.getByRole('button', { name: 'Skip guidance', exact: true }).click();
  const board = page.locator('.combat-scene canvas.map-canvas');
  await expect(board).toBeVisible();
  await expect(board).toHaveAccessibleName('Battlefield');

  const fireJab = page.getByRole('button', { name: /^Fire Jab/ });
  await fireJab.click();
  await expect(fireJab).toHaveClass(/\bselected\b/);
  await audit(page, info);

  const log = page.getByRole('button', { name: 'Log', exact: true });
  if (!(await log.isVisible()))
    await page.getByRole('button', { name: 'More', exact: true }).click();
  await log.click();
  const panel = page.locator('.log-panel');
  await expect(panel).toContainText('What happened');
  await expect(panel.locator('.log-lines p').first()).toContainText(/\S/);
});

test('accessibility of the earned reward screen', async ({ page }, info) => {
  const { state, session } = earnedRewardFixture();
  await page.evaluate(({ state, session }) => window.fnt!.app.adoptSave(state, session), {
    state,
    session,
  });
  const dialog = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('button', { name: /learn/i }) });
  await expect(dialog).toBeVisible();
  await settleDialog(dialog);
  await audit(page, info);
});

test('accessibility of the ending summary', async ({ page }, info) => {
  await startGame(page, ['Aster'], ['kaya'], 'a11y');
  await enterNode(page, 'demo_complete');
  const summary = page.locator('.stage[data-kind="end"] .end-panel');
  await expect(summary.getByRole('heading', { name: 'Home to Ba Dan' })).toBeVisible();
  await expect(summary).toContainText('Demo complete');
  await audit(page, info);
});
