import type { Beat } from './beats';
import { tileCentre } from './stage';
import {
  enterNode,
  resetStorage,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from '../helpers';

/** Exercise the shipped enemy sheet through both production renderers. */
export const ENEMY_BEATS: readonly Beat[] = [
  {
    id: '34-bandit-portrait',
    title: 'The bandit has the same face in combat and the inspector',
    note: 'Matching rust head-rag, scarf and stubble in the circular turn strip and the larger inspector crop.',
    projects: ['surface-canvas', 'surface-webgl', 'ipad-canvas', 'ipad-webgl', 'portrait-canvas'],
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await startGame(ctx.page, ['Explorer'], ['kaya'], 'bandit-review');
      await enterNode(ctx.page, 'battle_forest_road');
      await takeTurn(ctx.page, { settleTimeout: ctx.settleTimeout });
      await waitForIdle(ctx.page);
      await settleLayout(ctx.page, ctx.settleTimeout);
      const pos = await ctx.page.evaluate(() => {
        const bandit = window.fnt?.app.state?.battle?.units.find(
          (u) => u.sprite === 'unit.enemy.thug',
        );
        if (!bandit) throw new Error('Expected a bandit');
        return bandit.pos;
      });
      const point = await tileCentre(ctx.page, pos);
      await ctx.page.mouse.click(point.x, point.y, { button: 'right' });
      await ctx.page.locator('.dialog canvas[data-asset="portrait.enemy.thug"]').waitFor();
      await ctx.shoot(this.note);
    },
  },
  {
    id: '34-bandit-motion',
    title: 'Bandit steps into a club swing',
    note: 'Opposite walking contacts, two-handed wind-up, downward strike and recovery in the rust palette.',
    projects: ['surface-canvas', 'surface-webgl'],
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await startGame(ctx.page, ['Explorer'], ['kaya'], 'bandit-review', { reduceMotion: false });
      await enterNode(ctx.page, 'battle_forest_road');
      await takeTurn(ctx.page, { settleTimeout: ctx.settleTimeout });
      await waitForIdle(ctx.page);
      await settleLayout(ctx.page, ctx.settleTimeout);
      // Decode the real asset before freezing the clock for the filmstrip.
      await ctx.page.evaluate(async () => {
        const img = new Image();
        img.src = new URL('art/units/thug.png', document.baseURI).href;
        await img.decode();
      });
      await ctx.filmstrip(
        'The bandit closes one tile and swings; impact remains a separate cue.',
        [60, 140, 260, 400, 560, 850],
        async () => {
          await ctx.page.evaluate(() => {
            const app = window.fnt!.app;
            const state = app.state;
            const battle = state?.battle;
            const hero = battle?.units.find((u) => u.faction === 'party');
            const bandit = battle?.units.find((u) => u.sprite === 'unit.enemy.thug');
            if (!state || !battle || !hero || !bandit) throw new Error('Expected a bandit battle');
            const from = { x: 8, y: 8 };
            const to = { x: 9, y: 8 };
            const target = { x: 10, y: 8 };
            const before = battle.units.map((u) =>
              u.id === bandit.id
                ? { ...u, pos: from }
                : u.id === hero.id
                  ? { ...u, pos: target }
                  : u,
            );
            app.state = {
              ...state,
              battle: {
                ...battle,
                units: before.map((u) => (u.id === bandit.id ? { ...u, pos: to } : u)),
              },
            };
            app.resync();
            app.animator.clear();
            app.animator.push(
              performance.now(),
              [
                { type: 'unitMoved', unitId: bandit.id, path: [to], cost: 1 },
                {
                  type: 'abilityUsed',
                  unitId: bandit.id,
                  abilityId: 'club_swing',
                  target,
                  tiles: [target],
                },
              ],
              before,
            );
          });
        },
      );
    },
  },
];
