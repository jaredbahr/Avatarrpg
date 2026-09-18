import type { Page } from '@playwright/test';

/** Stage presentation events independently of hit rolls and enemy turn choices. */
export async function stageMotionTransition(
  page: Page,
  kind: 'cast' | 'push',
  abilityId = 'fire_jab',
) {
  return page.evaluate(
    ({ kind, abilityId }) => {
      const app = window.fnt!.app;
      const state = app.state;
      const battle = state?.battle;
      const hero = battle?.units.find((u) => u.faction === 'party');
      const enemy = battle?.units.find((u) => u.faction === 'enemy');
      if (!state || !battle || !hero || !enemy) throw new Error('Expected staged combat');
      const from = { x: 8, y: 8 };
      const target = { x: 5, y: 8 };
      const destination = { x: 10, y: 8 };
      const before = battle.units.map((u) =>
        u.id === hero.id ? { ...u, pos: from } : u.id === enemy.id ? { ...u, pos: target } : u,
      );
      app.state = {
        ...state,
        battle: {
          ...battle,
          units: before.map((u) =>
            kind === 'push' && u.id === hero.id ? { ...u, pos: destination } : u,
          ),
        },
      };
      app.resync();
      app.animator.clear();
      const now = performance.now();
      // A northward walk before a cast, a westward walk before being pushed east.
      app.animator.push(
        now - 500,
        [
          {
            type: 'partyWalked',
            unitId: hero.id,
            from: kind === 'cast' ? { x: 8, y: 9 } : { x: 9, y: 8 },
            path: [from],
          },
        ],
        [],
      );
      app.animator.prune(now);
      app.animator.push(
        now,
        kind === 'cast'
          ? [{ type: 'abilityUsed', unitId: hero.id, abilityId, target, tiles: [target] }]
          : [{ type: 'unitPushed', unitId: hero.id, to: destination }],
        before,
      );
      return { id: hero.id, duration: app.animator.finishesAt - now };
    },
    { kind, abilityId },
  );
}
