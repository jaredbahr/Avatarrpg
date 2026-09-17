import type { Beat } from './beats';
import { resetStorage } from '../helpers';

export const DIRECTIONAL_BEATS: readonly Beat[] = (
  [
    ['north', 8],
    ['south', 16],
  ] as const
).map(([direction, y]) => ({
  id: `29-walking-${direction}`,
  title: `Character walks: ${direction}`,
  note: 'Sura and Kaya turn from side-facing poses to rear and front walk cycles, then retain their direction at rest.',
  projects: ['surface-canvas', 'surface-webgl'],
  async run(ctx) {
    await resetStorage(ctx.page, ctx.query());
    await ctx.page.evaluate(() => {
      window.fnt!.app.updateSettings({ reduceMotion: false });
      window.fnt!.app.startVillagePreview();
    });
    await ctx.page.waitForFunction(
      () =>
        document.querySelector('.village-life-canvas')?.getAttribute('data-illustrated-actors') ===
        '2',
    );
    await ctx.filmstrip(
      `Walking ${direction}, then standing in the same direction.`,
      [150, 350, 600, 950, 1300],
      async () => {
        await ctx.page.evaluate(
          (targetY) => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 16, y: targetY } }),
          y,
        );
      },
    );
  },
}));
