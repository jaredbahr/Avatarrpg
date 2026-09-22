import type { Beat } from './beats';
import { tileCentre, focusStagedUnit } from './stage';
import {
  enterNode,
  resetStorage,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from '../helpers';

const CAST = [
  { name: 'slinger', enemy: 'bandit_slinger', ability: 'sling_stone' },
  { name: 'bruiser', enemy: 'bandit_bruiser', ability: 'club_swing' },
  { name: 'quarrybender', enemy: 'bandit_earthbender', ability: 'rock_throw' },
] as const;

/** Art staging, independent of which legal forest roster the seed selects. */
export const QUARRY_BANDIT_BEATS: readonly Beat[] = CAST.map((spec) => ({
  id: `39-${spec.name}`,
  title: `${spec.name}: illustrated movement, action and portrait`,
  note: 'Contact and passing walk phases, coherent weapon or empty hands, and a matching circular portrait.',
  projects: ['surface-canvas', 'surface-webgl', 'portrait-canvas'],
  async run(ctx) {
    await resetStorage(ctx.page, ctx.query());
    await startGame(ctx.page, ['Reviewer'], ['kaya'], 'quarry-art', { reduceMotion: false });
    await enterNode(ctx.page, 'battle_forest_road');
    await takeTurn(ctx.page, { settleTimeout: ctx.settleTimeout });
    await waitForIdle(ctx.page, ctx.idleTimeout);
    const unitId = await ctx.page.evaluate(({ enemy }) => {
      const app = window.fnt!.app;
      const state = app.state;
      const battle = state?.battle;
      const unit = battle?.units.find((u) => u.faction === 'enemy');
      const def = app.content.enemies.get(enemy);
      if (!state || !battle || !unit || !def) throw new Error('Missing art-stage enemy');
      // Replace the staged actor with authored appearance and kit; no rules acceptance claimed.
      app.state = {
        ...state,
        battle: {
          ...battle,
          units: battle.units.map((u) =>
            u.id === unit.id
              ? {
                  ...u,
                  name: def.name,
                  enemyId: def.id,
                  sprite: def.sprite,
                  element: def.element,
                  abilities: def.abilities,
                  base: def.stats,
                  hp: def.stats.maxHp,
                  ap: def.stats.maxAp,
                  pos: { x: 8, y: 8 },
                }
              : u.faction === 'party'
                ? { ...u, pos: { x: 10, y: 8 } }
                : u,
          ),
        },
      };
      app.resync();
      return unit.id;
    }, spec);
    await settleLayout(ctx.page, ctx.settleTimeout);
    await ctx.page.evaluate(async (name) => {
      await Promise.all(
        [`art/units/${name}.png`, `art/portraits/enemy.${name}.png`].map(async (url) => {
          const image = new Image();
          image.src = url;
          await image.decode();
        }),
      );
    }, spec.name);
    await focusStagedUnit(ctx.page, unitId, ctx.settleTimeout);
    await ctx.filmstrip(this.note, [60, 140, 260, 400, 560, 850], async () => {
      await ctx.page.evaluate(
        ({ unitId, ability }) => {
          const app = window.fnt!.app;
          const state = app.state;
          const battle = state?.battle;
          if (!state || !battle) throw new Error('Missing staged battle');
          const before = battle.units;
          const to = { x: 9, y: 8 },
            target = { x: 10, y: 8 };
          app.state = {
            ...state,
            battle: {
              ...battle,
              units: before.map((u) => (u.id === unitId ? { ...u, pos: to } : u)),
            },
          };
          app.resync();
          app.animator.clear();
          app.animator.push(
            performance.now(),
            [
              { type: 'unitMoved', unitId, path: [to], cost: 1 },
              { type: 'abilityUsed', unitId, abilityId: ability, target, tiles: [target] },
            ],
            before,
          );
        },
        { unitId, ability: spec.ability },
      );
    });
    await waitForIdle(ctx.page, ctx.idleTimeout);
    await focusStagedUnit(ctx.page, unitId, ctx.settleTimeout);
    const point = await tileCentre(ctx.page, { x: 9, y: 8 });
    await ctx.page.mouse.click(point.x, point.y, { button: 'right' });
    await ctx.page.locator(`.dialog canvas[data-asset="portrait.enemy.${spec.name}"]`).waitFor();
    await ctx.page.locator('.dialog').evaluate(async (dialog) => {
      await Promise.all(
        dialog.getAnimations({ subtree: true }).map((animation) => animation.finished),
      );
    });
    await ctx.shoot('Matching illustrated portrait at the initial inspector position.', 'portrait');
  },
}));
