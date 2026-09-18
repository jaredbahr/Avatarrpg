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

/** Specialist silhouettes alongside the four core element release filmstrips. */
export const BENDING_BEATS: readonly Beat[] = [
  [
    'lightning',
    'kaya',
    'lightning',
    'Branches split and break into hand-inked electrical fragments.',
  ],
  ['wave', 'nilak', 'tidal_wave', 'A rising water crest breaks into separate falling droplets.'],
  ['ice', 'nilak', 'ice_spikes', 'Sharp ice facets grow from a fixed ground baseline.'],
  [
    'healing',
    'nilak',
    'healing_stream',
    'Calm ribbons circle the recipient; the middle stays open.',
  ],
  ['metal', 'bo', 'metalbending', 'Hard folded metal bands stay distinct from flowing water.'],
  ['wall', 'bo', 'earth_wall', 'Broad ground slabs erupt with a fixed baseline.'],
  ['cyclone', 'nima', 'tornado', 'Open wind bands turn without hiding the painted ground.'],
  ['shield', 'nima', 'air_shield', 'A low revolving wind cushion forms around the caster.'],
].map(([id, character, ability, note]): Beat => ({
  id: `33-cels-${id}`,
  title: `Hand-drawn ${id} bending`,
  note: note ?? '',
  projects: ['surface-canvas', 'surface-webgl'],
  async run(ctx) {
    await resetStorage(ctx.page, ctx.query());
    await startGame(ctx.page, ['Explorer'], [character ?? 'kaya'], 'cel-review', {
      reduceMotion: false,
    });
    await enterNode(ctx.page, 'battle_forest_road');
    await takeTurn(ctx.page);
    await waitForIdle(ctx.page);
    await settleLayout(ctx.page, ctx.settleTimeout);
    await ctx.page.evaluate(() => window.fnt!.loadedFxCels());
    await ctx.filmstrip(note ?? '', [240, 450, 570, 720, 940], async () => {
      await stageMotionTransition(ctx.page, 'cast', ability);
    });
  },
}));
