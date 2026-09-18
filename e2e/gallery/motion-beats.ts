import type { Beat } from './beats';
import {
  enterNode,
  resetStorage,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from '../helpers';
import { stageMotionTransition } from '../motion-stage';

export const MOTION_BEATS: readonly Beat[] = (['cast', 'push'] as const).map((kind) => ({
  id: `31-motion-${kind}`,
  title: kind === 'cast' ? 'Attack recovery keeps its facing' : 'Knockback holds the struck stance',
  note:
    kind === 'cast'
      ? 'Kaya turns from a northward walk to a westward cast and keeps facing west at rest.'
      : 'Kaya slides east while facing west, without a walking lift, and retains her direction afterward.',
  projects: ['surface-canvas', 'surface-webgl'],
  async run(ctx) {
    await resetStorage(ctx.page, ctx.query());
    await startGame(ctx.page, ['Explorer'], ['kaya'], 'motion-transitions', {
      reduceMotion: false,
    });
    await enterNode(ctx.page, 'battle_forest_road');
    await takeTurn(ctx.page);
    await waitForIdle(ctx.page);
    await settleLayout(ctx.page);
    await ctx.filmstrip(
      kind === 'cast'
        ? 'Wind-up, release, recovery, then the same resting direction.'
        : 'Backward displacement without footsteps or walking bounce.',
      kind === 'cast' ? [80, 280, 450, 800, 1400] : [32, 80, 150, 220, 400],
      async () => {
        await stageMotionTransition(ctx.page, kind);
      },
    );
  },
}));

export const ELEMENT_BEATS: readonly Beat[] = (
  [
    ['fire', 'kaya', 'fire_jab', [180, 315, 360, 405, 700]],
    ['water', 'nilak', 'water_whip', [180, 410, 490, 590, 780]],
    ['earth', 'bo', 'rock_throw', [240, 440, 510, 620, 900]],
    ['air', 'nima', 'air_blast', [160, 325, 390, 455, 750]],
  ] as const
).map(([element, character, ability, times]) => ({
  id: `32-element-${element}`,
  title: `${element} attack: body, release and recovery`,
  note: 'Existing character art with hand-drawn elemental cels and aimed bending strokes.',
  projects: ['surface-canvas', 'surface-webgl'],
  async run(ctx) {
    await resetStorage(ctx.page, ctx.query());
    await startGame(ctx.page, ['Explorer'], [character], 'element-review', { reduceMotion: false });
    await enterNode(ctx.page, 'battle_forest_road');
    await takeTurn(ctx.page);
    await waitForIdle(ctx.page);
    await settleLayout(ctx.page);
    await ctx.page.evaluate(() => window.fnt!.loadedFxCels());
    await ctx.filmstrip(`${element} release follows the body's extension.`, times, async () => {
      await stageMotionTransition(ctx.page, 'cast', ability);
    });
  },
}));
