import type { Beat } from './beats';
import { enterNode, resetStorage, settleLayout, startGame } from '../helpers';
import { updateSettings } from './stage';

export const PLAYER_VIEW_BEATS: readonly Beat[] = [
  {
    id: '36-player-view-exploration',
    title: 'Full-width exploration and party dock',
    note: 'First implementation toward the approved player views: real Ba Dan art, bottom portraits, health, actions and Follow party.',
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await startGame(ctx.page, ['Jared'], ['nima', 'kaya', 'sura', 'bo', 'wen', 'jinu']);
      await enterNode(ctx.page, 'village_explore');
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.shoot('The existing playable map uses the full width above a compact party dock.');
      await updateSettings(ctx.page, { largeText: 'huge' });
      await settleLayout(ctx.page, ctx.settleTimeout);
      await ctx.shoot('Six members and the available actions at Largest text.', 'largest');
    },
  },
];
