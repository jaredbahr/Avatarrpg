import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`the forest crossing keeps the party near its approach and returns on clear road (${renderer})`, async ({
    page,
  }, testInfo) => {
    allowSoftwareWebgl(test, renderer);
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya', 'Nilak', 'Bo'], ['kaya', 'nilak', 'bo'], `ambush-${renderer}`, {
      reduceMotion: true,
    });
    await enterNode(page, 'village_explore');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await page.getByRole('button', { name: 'East road → Forest Road', exact: true }).click();
    await waitForIdle(page);
    await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 18, y: 4 } }));
    await waitForIdle(page);
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state?.story.nodeId))
      .toBe('road_depart');
    await page.evaluate(() => {
      const app = window.fnt!.app;
      for (let i = 0; app.state?.screen === 'dialogue' && i < 10; i++)
        app.dispatch({ type: 'advanceDialogue' });
    });
    await expect(page.locator('.explore-scene')).toBeVisible();
    await settleLayout(page);

    // The final crossing is a painted-map tap, through the same camera transform as a player.
    const point = await paintedTileCentre(page, { x: 8, y: 4 });
    const box = await page.locator('.map-canvas').boundingBox();
    if (!point || !box) throw new Error('Forest crossing is not visible');
    expect(point.x).toBeGreaterThan(box.x);
    expect(point.x).toBeLessThan(box.x + box.width);
    expect(point.y).toBeGreaterThan(box.y);
    expect(point.y).toBeLessThan(box.y + box.height);
    await page.touchscreen.tap(point.x, point.y);
    await waitForIdle(page);
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state?.battle?.encounterId))
      .toBe('enc_forest_road');
    expect(
      await page.evaluate(() =>
        window
          .fnt!.app.state!.battle!.units.filter((unit) => unit.faction === 'party')
          .map((unit) => unit.pos),
      ),
    ).toEqual([
      { x: 8, y: 4 },
      { x: 8, y: 3 },
      { x: 9, y: 5 },
    ]);
    await page.getByRole('button', { name: "I'm ready", exact: true }).click();
    await waitForIdle(page);
    await page.screenshot({ path: testInfo.outputPath(`forest-approach-${renderer}.png`) });

    // Give the party the simulator's profiles, then finish through legal AI turns.
    const phase = await page.evaluate(() => {
      const app = window.fnt!.app;
      const state = app.state!;
      const battle = state.battle!;
      app.state = {
        ...state,
        battle: {
          ...battle,
          units: battle.units.map((unit) =>
            unit.faction === 'party'
              ? {
                  ...unit,
                  ai:
                    unit.element === 'water'
                      ? 'support'
                      : unit.element === 'earth' || unit.element === 'air'
                        ? 'cautious'
                        : 'aggressive',
                }
              : unit,
          ),
        },
      };
      for (let i = 0; i < 200 && app.state?.battle?.phase === 'active'; i++)
        app.dispatch({ type: 'runAiTurn' });
      return app.state?.battle?.phase;
    });
    expect(['victory', 'defeat']).toContain(phase);
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('.explore-conversation')).toBeVisible();
    expect(await page.evaluate(() => window.fnt!.app.state!.world.returnPos.forest_road)).toEqual({
      x: 8,
      y: 3,
    });
    expect(await page.evaluate(() => window.fnt!.app.state!.location.pos)).toEqual({ x: 8, y: 3 });
    await page.screenshot({ path: testInfo.outputPath(`forest-aftermath-${renderer}.png`) });
  });
}

test('six followers enter the forest fight near their walked approach (canvas)', async ({
  page,
}, testInfo) => {
  await resetStorage(page, '?renderer=canvas');
  const characters = ['kaya', 'nilak', 'bo', 'nima', 'riko', 'sura'];
  await startGame(page, characters, characters, 'ambush-six', { reduceMotion: true });
  await enterNode(page, 'village_explore');
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'East road → Forest Road', exact: true }).click();
  await waitForIdle(page);
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 18, y: 4 } }));
  await waitForIdle(page);
  await page.evaluate(() => {
    const app = window.fnt!.app;
    for (let i = 0; app.state?.screen === 'dialogue' && i < 10; i++)
      app.dispatch({ type: 'advanceDialogue' });
  });
  await expect(page.locator('.explore-scene')).toBeVisible();
  for (const x of [7, 8]) {
    await settleLayout(page);
    const point = await paintedTileCentre(page, { x, y: 4 });
    if (!point) throw new Error(`Forest tile ${x},4 is not painted`);
    await page.touchscreen.tap(point.x, point.y);
    await waitForIdle(page);
    if (x === 7)
      await page.screenshot({ path: testInfo.outputPath('forest-six-before-canvas.png') });
  }
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state?.battle?.encounterId))
    .toBe('enc_forest_road');
  expect(
    await page.evaluate(() =>
      window
        .fnt!.app.state!.battle!.units.filter((unit) => unit.faction === 'party')
        .map((unit) => unit.pos),
    ),
  ).toEqual([
    { x: 8, y: 4 },
    { x: 8, y: 3 },
    { x: 9, y: 5 },
    { x: 5, y: 3 },
    { x: 4, y: 4 },
    { x: 3, y: 8 },
  ]);
  await page.getByRole('button', { name: "I'm ready", exact: true }).click();
  await waitForIdle(page);
  await page.screenshot({ path: testInfo.outputPath('forest-six-battle-canvas.png') });
});
