import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`forest aftermath retains the world and reloads its conversation on ${renderer}`, async ({
    page,
  }, testInfo) => {
    // The CI software rasterizer spent 54–64 seconds across the retained-world
    // screenshot, save/reload, and final camera settle. Keep this allowance
    // scoped to the forced WebGL case instead of relaxing the E2E suite.
    if (renderer === 'webgl') test.slow();
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'forest-aftermath');
    // Isolate presentation after battle results; the route suite owns winning the fight.
    await enterNode(page, 'forest_explore');
    await enterNode(page, 'after_forest');
    const partyBefore = await page.evaluate(() =>
      window.fnt!.app.state!.party.map(({ id, hp }) => ({ id, hp })),
    );
    await expect(page.locator('.explore-conversation')).toBeVisible();
    await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
    await expect(page.locator('.explore-dock')).toBeHidden();
    await expect(page.locator('.dialogue-line')).toContainText('Stone dust');
    await page.screenshot({ path: testInfo.outputPath(`forest-aftermath-${renderer}.png`) });
    await page.locator('[data-conversation-control="next"]').click();
    await expect(page.locator('.line-count')).toHaveText('2 of 2');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Save game', exact: true }).click();
    await page
      .locator('.slot')
      .filter({ hasText: 'Slot 1' })
      .getByRole('button', { name: /save here/i })
      .click();
    await expect(page.locator('.slot').filter({ hasText: 'Slot 1' })).not.toContainText('Empty');
    await page.reload();
    await page.getByRole('button', { name: /load a save/i }).click();
    await page
      .locator('.slot')
      .filter({ hasText: 'Slot 1' })
      .getByRole('button', { name: 'Load', exact: true })
      .click();
    await expect(page.locator('.explore-conversation')).toBeVisible();
    await expect(page.locator('.line-count')).toHaveText('2 of 2');
    await page.locator('[data-conversation-control="next"]').click();
    await expect(page.locator('.explore-conversation')).toBeHidden();
    await expect(page.locator('.explore-dock')).toBeVisible();
    expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe(
      'forest_after_explore',
    );
    expect(
      await page.evaluate(() => window.fnt!.app.state!.party.map(({ id, hp }) => ({ id, hp }))),
    ).toEqual(partyBefore);
  });
}
