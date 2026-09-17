import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

for (const renderer of ['canvas', 'webgl']) {
  test(`connected exploration crosses maps and returns on ${renderer}`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(browserName === 'webkit' && renderer === 'webgl' ? 120_000 : 60_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Elias'], ['kaya', 'bo'], 'world-walk', { reduceMotion: false });
    await enterNode(page, 'village_explore');
    // Stage beside the exit; the crossing itself uses the real route button and animation.
    await page.evaluate(() => {
      const app = window.fnt?.app;
      if (!app?.state) throw new Error('No game');
      app.state = { ...app.state, location: { mapId: 'ba_dan_village', pos: { x: 22, y: 7 } } };
      app.resync();
    });
    await page.getByRole('button', { name: 'East road → Forest Road', exact: true }).click();
    await waitForIdle(page);
    await expect(page.locator('.title-plate-name')).toHaveText('The Forest Road');
    await expect(
      page.getByRole('button', { name: 'East → Quarry Gate', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'East → Quarry Gate', exact: true }),
    ).toHaveAttribute('title', /roadblock/);
    await expect(page.locator('canvas.map-canvas')).toHaveAttribute(
      'aria-label',
      'The Forest Road map',
    );
    const arrival = await page.evaluate(() => ({ location: window.fnt?.app.state?.location }));
    expect(arrival.location).toEqual({ mapId: 'forest_road', pos: { x: 1, y: 4 } });
    await page.getByRole('button', { name: 'West → Ba Dan Village', exact: true }).click();
    await waitForIdle(page);
    await expect(page.locator('.title-plate-name')).toHaveText('Ba Dan Village');
    expect(await page.evaluate(() => window.fnt?.app.state?.location.pos)).toEqual({ x: 22, y: 7 });
    expect(errors).toEqual([]);
  });
}

test('a long walk meets the road story and then its enemies', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Elias'], ['kaya'], 'world-encounter');
  await enterNode(page, 'village_explore');
  await page.getByRole('button', { name: 'East road → Forest Road', exact: true }).click();
  await waitForIdle(page);
  await page.evaluate(() => window.fnt?.app.dispatch({ type: 'walkTo', pos: { x: 18, y: 4 } }));
  await waitForIdle(page);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
    .toBe('road_depart');
  await page.evaluate(() => {
    const app = window.fnt?.app;
    for (let i = 0; app?.state?.screen === 'dialogue' && i < 10; i++)
      app.dispatch({ type: 'advanceDialogue' });
  });
  await expect(page.locator('.explore-scene')).toBeVisible();
  await page.evaluate(() => window.fnt?.app.dispatch({ type: 'walkTo', pos: { x: 18, y: 4 } }));
  await waitForIdle(page);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.battle?.encounterId))
    .toBe('enc_forest_road');
});
