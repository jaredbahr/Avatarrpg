import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

async function openActivities(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Activities', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

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
  await openActivities(page);
  await page.getByRole('button', { name: 'Meet Pebble', exact: true }).click();
  await expect(page.locator('.village-note')).toContainText('Pebble leans');
  await settleLayout(page);
  await openActivities(page);
  await page.getByRole('button', { name: 'Walk to Ba Dan', exact: true }).click();
  await expect(page.locator('.title-plate-name')).toHaveText('Ba Dan Village');
  await page.getByRole('button', { name: 'Travel journal', exact: true }).click();
  const journal = page.getByRole('dialog', { name: 'Travel journal', exact: true });
  await expect(journal.getByRole('region', { name: 'Places', exact: true })).toContainText(
    'Ba Dan · The Riverside · Visited',
  );
  await expect(journal).toContainText('Remembered · Pebble by the river');
  await journal.getByRole('button', { name: 'Return to the path', exact: true }).click();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
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

test('Riverside preview can close while the party is walking', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], ['bo'], 'roaming-close-during-walk', { reduceMotion: false });
  await page.evaluate(() => window.fnt!.app.startVillagePreview());

  await openActivities(page);
  await page.getByRole('button', { name: 'Meet Pebble', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.animator.busy(performance.now())))
    .toBe(true);
  await page.getByRole('button', { name: 'Leave preview', exact: true }).click();

  await expect(page.locator('.title-scene')).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.previewActive)).toBe(false);
});

test('rescued riverside return keeps the shrine discovery and party health', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'rescued-riverside-return', {
    reduceMotion: false,
  });
  await enterNode(page, 'village_explore');

  // This is an explicit rescued-campaign fixture for the route UI. It skips
  // the legal campaign path while retaining the state this regression checks.
  const fixture = await page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app?.state) throw new Error('No game');
    const party = app.state.party.map((unit) => ({ ...unit, hp: Math.max(1, unit.hp - 7) }));
    app.state = {
      ...app.state,
      screen: 'explore',
      party,
      battle: null,
      flags: { ...app.state.flags, act1_complete: true },
      story: { ...app.state.story, nodeId: 'village_explore', lineIndex: 0 },
      location: { mapId: 'ba_dan_village', pos: { x: 19, y: 14 } },
    };
    app.resync();
    return party.map((unit) => ({ id: unit.id, hp: unit.hp }));
  });

  await expect(page.locator('.explore-context strong')).toHaveText('Walk to Riverside');
  const walkRiverside = page.locator('.explore-hud .action-button').first();
  await expect(walkRiverside).toContainText('Walk');
  await expect(walkRiverside).toContainText('Riverside');
  await walkRiverside.click();
  await waitForIdle(page);
  await expect(page.locator('.title-plate-name')).toHaveText('Ba Dan · The Riverside');
  await openActivities(page);
  await expect(page.getByRole('button', { name: 'Visit the shrine', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Visit the shrine', exact: true }).click();
  await expect(page.locator('.explore-conversation')).toBeVisible();
  const next = page.locator('[data-conversation-control="next"]');
  for (let line = 1; line <= 3; line++) {
    await expect(page.locator('.line-count')).toHaveText(`${line} of 3`);
    await next.click();
  }
  await expect(page.getByRole('button', { name: 'Walk to Ba Dan', exact: true })).toBeVisible();
  await expect(page.locator('.title-plate-objective')).toContainText('Rest by the river');

  const afterShrine = await page.evaluate(() => {
    const state = window.fnt!.app.state!;
    return {
      mapId: state.location.mapId,
      shrineFound: state.flags.riverside_shrine_found,
      act1Complete: state.flags.act1_complete,
      party: state.party.map((unit) => ({ id: unit.id, hp: unit.hp })),
    };
  });
  expect(afterShrine.mapId).toBe('ba_dan_riverside');
  expect(afterShrine.shrineFound).toBe(true);
  expect(afterShrine.act1Complete).toBe(true);
  expect(afterShrine.party).toEqual(fixture);

  await openActivities(page);
  await page.getByRole('button', { name: 'Walk to Ba Dan', exact: true }).click();
  await waitForIdle(page);
  await expect(page.locator('.title-plate-name')).toHaveText('Ba Dan Village');
  await expect(page.locator('.title-plate-objective')).toContainText('The workers are home');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window.fnt!.app.state!;
        return {
          mapId: state.location.mapId,
          shrineFound: state.flags.riverside_shrine_found,
          act1Complete: state.flags.act1_complete,
          party: state.party.map((unit) => ({ id: unit.id, hp: unit.hp })),
        };
      }),
    )
    .toEqual({
      mapId: 'ba_dan_village',
      shrineFound: true,
      act1Complete: true,
      party: fixture,
    });
});

for (const renderer of ['canvas', 'webgl']) {
  test(`connected exploration crosses maps and returns on ${renderer}`, async ({ page }) => {
    test.setTimeout(60_000);
    allowSoftwareWebgl(test, renderer);
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
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await page.getByRole('button', { name: 'East road → Forest Road', exact: true }).click();
    await waitForIdle(page);
    await expect(page.locator('.title-plate-name')).toHaveText('The Forest Road');
    await expect(page.locator('.explore-context strong')).toHaveText(
      'Speak with Dema, road keeper',
    );
    await expect(page.locator('.explore-hud .action-button').first()).toContainText('Talk');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
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
  await page.getByRole('button', { name: 'Map', exact: true }).click();
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
