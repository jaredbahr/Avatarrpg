import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

for (const renderer of ['canvas', 'webgl']) {
  test(`inspect a roadside discovery on ${renderer}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Jared'], ['kaya'], 'roadside');
    await enterNode(page, 'forest_explore');
    await page.evaluate(() => {
      const app = window.fnt?.app;
      if (!app?.state) throw new Error('No game');
      app.state = { ...app.state, location: { mapId: 'forest_road', pos: { x: 2, y: 8 } } };
      app.resync();
    });
    await waitForIdle(page);
    await page.getByRole('button', { name: /Inspect.*Turtle-duck nest/ }).click();
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
      .toBe('discover_duck_nest');
    await page.evaluate(() => {
      const app = window.fnt?.app;
      for (let i = 0; app?.state?.screen === 'dialogue' && i < 10; i++)
        app.dispatch({ type: 'advanceDialogue' });
    });
    await expect(page.locator('.explore-scene')).toBeVisible();
    await page.getByRole('button', { name: /Inspect.*Turtle-duck nest/ }).click();
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
      .toBe('revisit_duck_nest');
    expect(errors).toEqual([]);
  });
}
