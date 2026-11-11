import { expect, test, type Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame } from './helpers';

/**
 * ADR 0104 T6: top-down is the default style. A fresh link with no `style` draws the top-down
 * boards, a Continue from the title lands in them too (the style is never part of a save), and
 * `?style=oblique` keeps the old look until T7.
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

test('?style=oblique keeps the old look until T7, and ?style=topdown stays an alias', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas&style=oblique');
  await startGame(page, ['Sam'], ['kaya'], 'oblique-style');
  const oblique = await board(page, 'village_explore');
  expect(oblique.projection).not.toBe('topdown');
  expect(oblique.ground ?? '').not.toMatch(/^art\/topdown\//);

  await resetStorage(page, '?renderer=canvas&style=topdown');
  await startGame(page, ['Sam'], ['kaya'], 'topdown-alias');
  expect((await board(page, 'village_explore')).projection).toBe('topdown');
});
