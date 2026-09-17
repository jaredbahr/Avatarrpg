import type { Beat } from './beats';
import { enterNode, resetStorage, startGame } from '../helpers';

export const WORLD_BEATS: readonly Beat[] = [
  {
    id: '29-travel-journal',
    title: 'The valley travel journal',
    note: 'Places, readable route conditions and remembered discoveries, derived from the journey.',
    projects: ['surface-canvas', 'portrait-canvas'],
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await startGame(ctx.page, ['Elias'], ['sura', 'kaya'], 'gallery-journal');
      await enterNode(ctx.page, 'riverside_explore');
      await ctx.page.evaluate(() =>
        window.fnt!.app.dispatch({ type: 'setFlags', flags: { riverside_pet: true } }),
      );
      await ctx.page.getByRole('button', { name: 'Travel journal', exact: true }).click();
      await ctx.shoot('The journal remembers Pebble and suggests the other riverside paths.');
    },
  },
  {
    id: '28-connected-world',
    title: 'Explore the forest road',
    note: 'Two named routes, a visible road encounter, and the party standing within the illustrated forest.',
    projects: ['surface-canvas', 'surface-webgl', 'portrait-canvas'],
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await startGame(ctx.page, ['Elias'], ['kaya', 'bo', 'nilak'], 'gallery-world');
      await enterNode(ctx.page, 'forest_explore');
      await ctx.shoot('The forest is now a place to walk, return to, and encounter enemies.');
    },
  },
];
