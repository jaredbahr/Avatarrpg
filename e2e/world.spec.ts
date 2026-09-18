import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

test('riverside roaming keeps the journal and campaign saves across a round trip', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], ['bo'], 'roaming-preserves-campaign');
  const before = await page.evaluate(() => {
    const app = window.fnt!.app;
    app.saveTo('slot1');
    app.saveTo('auto');
    return { state: JSON.stringify(app.state), storage: JSON.stringify(localStorage) };
  });
  await page.evaluate(() => window.fnt!.app.startVillagePreview());
  await page.getByRole('button', { name: 'Meet Pebble', exact: true }).click();
  await expect(page.locator('.village-note')).toContainText('Pebble leans');
  await page.getByRole('button', { name: 'Walk to Ba Dan', exact: true }).click();
  await expect(page.locator('.title-plate-name')).toHaveText('Ba Dan Village');
  await page.getByRole('button', { name: 'Travel journal', exact: true }).click();
  const journal = page.getByRole('dialog', { name: 'Travel journal', exact: true });
  await expect(journal.getByRole('region', { name: 'Places', exact: true })).toContainText(
    'Ba Dan · The Riverside · Visited',
  );
  await expect(journal).toContainText('Remembered · A very important otter-turtle');
  await journal.getByRole('button', { name: 'Return to the path', exact: true }).click();
  await page.getByRole('button', { name: 'River path → Riverside', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Water form', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Leave preview', exact: true }).click();
  expect(
    await page.evaluate(() => ({
      state: JSON.stringify(window.fnt!.app.state),
      storage: JSON.stringify(localStorage),
    })),
  ).toEqual(before);
});

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
