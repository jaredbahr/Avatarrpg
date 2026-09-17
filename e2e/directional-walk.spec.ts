import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';
import type { MapView, RenderUnit } from '../src/render/view';

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const riverside of [false, true]) {
    test(`north/south poses reach the ${riverside ? 'riverside' : 'world'} renderer (${renderer})`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (/failed to load|404/.test(message.text())) errors.push(message.text());
      });
      await resetStorage(page, `?renderer=${renderer}`);
      if (riverside) await page.evaluate(() => window.fnt!.app.startVillagePreview());
      else {
        await startGame(
          page,
          ['One', 'Two', 'Three'],
          ['kaya', 'sura', 'wen'],
          'directional-walk',
          { reduceMotion: false },
        );
        await enterNode(page, 'village_explore');
      }
      await page.locator('.explore-scene .map-canvas').waitFor();
      await waitForIdle(page);
      // Observe the view handed to the real renderer, including the riverside
      // adapter, rather than calling the direction helper in isolation.
      await page.evaluate(() => {
        type Recorded = { clip: string | undefined; facing: number | undefined; moving: boolean };
        const win = window as Window & { directionFrames?: Recorded[][] };
        win.directionFrames = [];
        const capture = (units: readonly RenderUnit[]) => {
          win.directionFrames?.push(
            units.map((u) => ({ clip: u.clip, facing: u.facing, moving: Boolean(u.renderPos) })),
          );
          if ((win.directionFrames?.length ?? 0) > 240) win.directionFrames?.shift();
        };
        const scene = (
          window.fnt!.app as unknown as {
            scene: {
              renderer: { draw: (view: MapView) => void };
              life?: { draw: (units: readonly RenderUnit[], ...args: unknown[]) => void };
            };
          }
        ).scene;
        if (scene.life) {
          const draw = scene.life.draw.bind(scene.life);
          scene.life.draw = (units, ...args) => {
            capture(units);
            draw(units, ...args);
          };
        } else {
          const draw = scene.renderer.draw.bind(scene.renderer);
          scene.renderer.draw = (view) => {
            capture(view.units);
            draw(view);
          };
        }
      });
      for (const [direction, dy] of [
        ['North', -4],
        ['South', 4],
      ] as const) {
        await page.evaluate((delta) => {
          const app = window.fnt!.app;
          const pos = app.state!.location.pos;
          (window as Window & { directionFrames?: unknown[] }).directionFrames = [];
          app.dispatch({ type: 'walkTo', pos: { x: pos.x, y: pos.y + delta } });
        }, dy);
        await expect
          .poll(() =>
            page.evaluate((wanted) => {
              const frames =
                (window as Window & { directionFrames?: { clip: string; facing: number }[][] })
                  .directionFrames ?? [];
              return frames.some(
                (units) => units[0]?.clip === `walk${wanted}` && units[0]?.facing === 1,
              );
            }, direction),
          )
          .toBe(true);
        await waitForIdle(page);
        await expect
          .poll(() =>
            page.evaluate(() => {
              const frames = (window as Window & { directionFrames?: { clip: string }[][] })
                .directionFrames;
              return frames?.at(-1)?.[0]?.clip;
            }),
          )
          .toBe(`idle${direction}`);
      }
      expect(errors).toEqual([]);
    });
  }
}
