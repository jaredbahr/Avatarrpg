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
  {
    id: '34-next-walk',
    title: 'Plan the next stroll',
    note: 'The party keeps walking while a dotted route and a cancelable next destination remain visible.',
    projects: ['surface-canvas', 'surface-webgl', 'portrait-canvas'],
    async run(ctx) {
      await resetStorage(ctx.page, ctx.query());
      await startGame(ctx.page, ['Elias'], ['kaya', 'bo'], 'gallery-next-walk', {
        reduceMotion: false,
      });
      await enterNode(ctx.page, 'village_explore');
      await ctx.filmstrip('Queued route and grounded party movement.', [150, 800], async () => {
        await ctx.page.evaluate(() => {
          const app = window.fnt?.app;
          const canvas = document.querySelector('canvas.map-canvas');
          const camera = app?.rendererCamera();
          if (!app || !camera || !(canvas instanceof HTMLCanvasElement)) throw new Error('No map');
          app.dispatch({ type: 'walkTo', pos: { x: 9, y: 7 } });
          const box = canvas.getBoundingClientRect();
          const point = {
            clientX: box.left + camera.offsetX + 7.5 * camera.tilePx,
            clientY: box.top + camera.offsetY + 8.5 * camera.tilePx,
            bubbles: true,
            pointerId: 19,
            pointerType: 'touch',
            isPrimary: true,
          };
          canvas.dispatchEvent(new PointerEvent('pointerdown', { ...point, buttons: 1 }));
          canvas.dispatchEvent(new PointerEvent('pointerup', { ...point, buttons: 0 }));
        });
      });
    },
  },
];
