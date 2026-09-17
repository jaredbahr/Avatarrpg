import type { Beat } from './beats';
import { enterNode, resetStorage, startGame } from '../helpers';

export const WORLD_BEATS: readonly Beat[] = [
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
  {
    id: '33-path-discoveries',
    title: 'Look around along the forest path',
    note: 'Nearby people and discoveries have readable, touch-sized routes without revealing distant places.',
    projects: ['surface-canvas', 'surface-webgl', 'portrait-canvas'],
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await startGame(ctx.page, ['Elias'], ['kaya', 'bo'], 'gallery-nearby');
      await enterNode(ctx.page, 'forest_explore');
      await ctx.page.getByRole('button', { name: 'Look around', exact: true }).click();
      await ctx.shoot('A local invitation to explore, with the forest still behind it.');
    },
  },
];
