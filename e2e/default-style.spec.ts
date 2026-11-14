import { expect, test, type Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame } from './helpers';

/**
 * ADR 0104: top-down is the only style (T7 retired the oblique one). A fresh link draws the
 * top-down boards, a Continue from the title lands in them too, and an old link's `?style=` is
 * ignored.
 */
async function board(page: Page, node: string): Promise<{ projection?: string; ground?: string }> {
  await enterNode(page, node);
  await page.locator('.explore-scene .map-canvas').waitFor();
  await settleLayout(page);
  return page.evaluate(() => {
    const app = window.fnt?.app;
    const map = app?.state?.location.mapId;
    return {
      projection: app?.rendererCamera()?.projection,
      ground: map ? app?.content.maps.get(map)?.scene?.ground[0]?.url : undefined,
    };
  });
}

test('a fresh link boots top-down: Ba Dan and the Forest Road draw their top-down boards', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Sam'], ['kaya'], 'default-style');

  const village = await board(page, 'village_explore');
  expect(village.projection).toBe('topdown');
  expect(village.ground).toMatch(/^art\/topdown\/ba-dan\//);
  const forest = await board(page, 'forest_explore');
  expect(forest.projection).toBe('topdown');
  expect(forest.ground).toMatch(/^art\/topdown\/forest-road\//);

  // Continue after a reload, from a link with no style at all, comes back top-down.
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.explore-scene .map-canvas').waitFor();
  await settleLayout(page);
  expect(await page.evaluate(() => window.fnt?.app.rendererCamera()?.projection)).toBe('topdown');
  expect(await page.evaluate(() => window.fnt?.app.state?.location.mapId)).toBe('forest_road');
  expect(errors).toEqual([]);
});

test('an old link that names a style still boots top-down', async ({ page }) => {
  for (const style of ['oblique', 'world', 'topdown']) {
    await resetStorage(page, `?renderer=canvas&style=${style}`);
    await startGame(page, ['Sam'], ['kaya'], `old-link-${style}`);
    const village = await board(page, 'village_explore');
    expect(village.projection, style).toBe('topdown');
    expect(village.ground, style).toMatch(/^art\/topdown\/ba-dan\//);
  }
});
