import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`Ruon's ambush aftermath stays in the Cutting on ${renderer}`, async ({ page }) => {
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'cutting-aftermath');
    // The route suite owns combat outcomes; isolate the post-result presentation.
    await enterNode(page, 'cutting_explore');
    await enterNode(page, 'after_ambush');
    await expect(page.locator('.explore-conversation')).toBeVisible();
    await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
    await expect(page.locator('.dialogue-line')).toContainText('We cannot stay on the road');
    const next = page.locator('[data-conversation-control="next"]');
    await next.click();
    await expect(page.locator('.dialogue-line')).toContainText('quartermaster');
    await next.click();
    await expect(page.locator('.dialogue-line')).toContainText('signed for the delivery');
    await next.click();
    await expect(page.locator('.explore-conversation')).toBeHidden();
    await expect(page.locator('.explore-dock')).toBeVisible();
    expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe(
      'cutting_after_explore',
    );
    expect(await page.evaluate(() => window.fnt!.app.state!.location.mapId)).toBe('ambush_road');
  });
}
