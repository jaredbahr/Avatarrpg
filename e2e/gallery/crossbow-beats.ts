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
export const CROSSBOW_BEATS: readonly Beat[] = [
  {
    id: '38-crossbow-portrait',
    title: 'The crossbow mercenary keeps the same face in combat and the inspector',
    note: 'Matching iron helmet, serious face and squared rust armor in the circular turn strip and the larger inspector crop.',
    projects: ['surface-canvas', 'surface-webgl', 'ipad-canvas', 'ipad-webgl', 'portrait-canvas'],
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await startGame(
        ctx.page,
        ['Explorer', 'Scout', 'Guard'],
        ['kaya', 'nilak', 'bo'],
        'crossbow-review',
      );
      await enterNode(ctx.page, 'battle_ambush');
      await takeTurn(ctx.page);
      await waitForIdle(ctx.page);
      await settleLayout(ctx.page, ctx.settleTimeout);
      const pos = await ctx.page.evaluate(() => {
        const crossbow = window.fnt?.app.state?.battle?.units.find(
          (u) => u.sprite === 'unit.enemy.crossbow',
        );
        if (!crossbow) throw new Error('Expected a crossbow');
        return crossbow.pos;
      });
      const point = await tileCentre(ctx.page, pos);
      await ctx.page.mouse.click(point.x, point.y, { button: 'right' });
      await ctx.page.locator('.dialog canvas[data-asset="portrait.enemy.crossbow"]').waitFor();
      await ctx.shoot(this.note);
    },
  },
  {
    id: '38-crossbow-motion',
    title: 'Crossbow mercenary walks, aims and fires',
    note: 'Opposite walking contacts, supported aim, trigger release and recovery with one crossbow.',
    projects: ['surface-canvas', 'surface-webgl'],
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await startGame(
        ctx.page,
        ['Explorer', 'Scout', 'Guard'],
        ['kaya', 'nilak', 'bo'],
        'crossbow-review',
        { reduceMotion: false },
      );
      await enterNode(ctx.page, 'battle_ambush');
      await takeTurn(ctx.page);
      await waitForIdle(ctx.page);
      await settleLayout(ctx.page, ctx.settleTimeout);
      // Decode the real asset before freezing the clock for the filmstrip.
      await ctx.page.evaluate(async () => {
        const img = new Image();
        img.src = new URL('art/units/crossbow.png', document.baseURI).href;
        await img.decode();
      });
      await ctx.filmstrip(
        'The mercenary steps and fires; projectile and impact remain separate cues.',
        [60, 140, 260, 400, 560, 850],
        async () => {
          await ctx.page.evaluate(() => {
            const app = window.fnt!.app;
            const state = app.state;
            const battle = state?.battle;
            const hero = battle?.units.find((u) => u.faction === 'party');
            const crossbow = battle?.units.find((u) => u.sprite === 'unit.enemy.crossbow');
            if (!state || !battle || !hero || !crossbow)
              throw new Error('Expected a crossbow battle');
            const from = { x: 8, y: 8 };
            const to = { x: 9, y: 8 };
            const target = { x: 13, y: 8 };
            const before = battle.units.map((u) =>
              u.id === crossbow.id
                ? { ...u, pos: from }
                : u.id === hero.id
                  ? { ...u, pos: target }
                  : u,
            );
            app.state = {
              ...state,
              battle: {
                ...battle,
                units: before.map((u) => (u.id === crossbow.id ? { ...u, pos: to } : u)),
              },
            };
            app.resync();
            app.animator.clear();
            app.animator.push(
              performance.now(),
              [
                { type: 'unitMoved', unitId: crossbow.id, path: [to], cost: 1 },
                {
                  type: 'abilityUsed',
                  unitId: crossbow.id,
                  abilityId: 'merc_crossbow',
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
