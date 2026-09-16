import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

/**
 * The playback itself, with motion on.
 *
 * Every other spec runs with reduce motion, because it tests rules and UI.
 * These two check the contract the choreography must keep: a cast plays and
 * then stops, on both backends, without a console error from the effect
 * layers; and reduce motion collapses the same cast to an instant.
 */
test.describe('playback', () => {
  for (const renderer of ['canvas', 'webgl'] as const) {
    test(`a cast plays out and settles on ${renderer}`, async ({ page, browserName }) => {
      test.setTimeout(120_000);
      if (renderer === 'webgl' && browserName === 'webkit') test.slow();

      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));

      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Elias'], ['kaya'], 'animation-spec', { reduceMotion: false });
      await enterNode(page, 'battle_forest_road');
      await takeTurn(page);
      await waitForIdle(page);
      await settleLayout(page);

      // Stand a bandit in reach and fire straight at the rules, then watch.
      const cast = await page.evaluate(() => {
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
        return {
          started,
          busy: app.animator.busy(performance.now()),
          ends: app.animator.finishesAt,
        };
      });
      expect(cast, 'could not stage the cast').not.toBeNull();
      if (!cast) return;

      // Something plays, for a fraction of a second, and then it is over.
      expect(cast.busy).toBe(true);
      expect(cast.ends - cast.started).toBeGreaterThan(200);
      expect(cast.ends - cast.started).toBeLessThan(5_000);
      await waitForIdle(page);
      expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
    });
  }

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
