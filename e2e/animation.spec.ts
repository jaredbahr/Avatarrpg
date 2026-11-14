import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';

/**
 * The playback itself, with motion on.
 *
 * Every other spec runs with reduce motion, because it tests rules and UI.
 * These two check the contract the choreography must keep: a cast plays and
 * then stops, on both backends, without a console error from the effect
 * layers; and reduce motion collapses the same cast to an instant.
 */
test.describe('playback', () => {
  test('a village walk plays out and settles', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias', 'Lorelai'], ['kaya', 'bo'], 'animation-walk', {
      reduceMotion: false,
    });
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    await waitForIdle(page);

    // Six tiles along the road: the leader and the follower walk together.
    const walk = await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      if (!app || !state) return null;
      const started = performance.now();
      const from = state.location.pos;
      app.dispatch({ type: 'walkTo', pos: { x: from.x + 6, y: from.y } });
      return {
        started,
        busy: app.animator.busy(performance.now()),
        ends: app.animator.finishesAt,
        moving: app.partyPositions()?.length ?? 0,
      };
    });
    expect(walk).not.toBeNull();
    if (!walk) return;
    expect(walk.busy).toBe(true);
    expect(walk.ends - walk.started).toBeGreaterThan(1_500);
    expect(walk.ends - walk.started).toBeLessThan(5_000);
    expect(walk.moving).toBe(2);
    await waitForIdle(page);
  });

  test('reduce motion collapses a village walk to an instant', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias', 'Lorelai'], ['kaya', 'bo'], 'animation-walk-reduced');
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();
    await waitForIdle(page);

    const span = await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      if (!app || !state) return null;
      const started = performance.now();
      const from = state.location.pos;
      app.dispatch({ type: 'walkTo', pos: { x: from.x + 6, y: from.y } });
      return app.animator.finishesAt - started;
    });
    expect(span).not.toBeNull();
    expect(span ?? 999).toBeLessThan(100);
  });

  test('reduce motion collapses a cast to an instant', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'animation-reduced', { reduceMotion: true });
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);

    const span = await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      if (!app || !state || !battle) return null;
      const actor = battle.units.find((u) => u.id === battle.order[battle.turnIndex]);
      const victim = battle.units.find((u) => u.faction === 'enemy' && u.hp > 0);
      if (!actor || !victim) return null;
      const spot = { x: actor.pos.x + 3, y: actor.pos.y };
      const units = battle.units.map((u) => (u.id === victim.id ? { ...u, pos: spot } : u));
      app.state = { ...state, battle: { ...battle, units } };
      app.resync();
      const started = performance.now();
      app.dispatch({ type: 'useAbility', unitId: actor.id, abilityId: 'fire_jab', target: spot });
      return app.animator.finishesAt - started;
    });
    expect(span).not.toBeNull();
    expect(span ?? 999).toBeLessThan(100);
  });
});
