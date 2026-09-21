import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, pauseClock, resetStorage, startGame, waitForIdle } from './helpers';
import type { MapView, RenderUnit } from '../src/render/view';

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const riverside of [false, true]) {
    test(`projected travel and resting poses reach the ${riverside ? 'riverside' : 'world'} renderer (${renderer})`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      allowSoftwareWebgl(test, renderer);
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
        // Logical north/south projects sideways on Ba Dan's oblique basis;
        // riverside retains its orthographic front/back poses.
        const walkClip = riverside ? `walk${direction}` : 'walk';
        const restClip = riverside ? `rest${direction}` : 'rest';
        const facing = riverside || dy < 0 ? 1 : -1;
        /*
         * The leader holds the walk pose for about 1.2 s of app time, and a
         * software-WebGL runner hands back a frame every few seconds: on a
         * real-time cadence the renderer can be handed only the rest pose on
         * either side of the walk, which is a coin flip rather than a claim
         * about the wiring. Pause the clock at the dispatch and publish the
         * frames from this side, so the poses the renderer sees are the app's
         * own state and not the runner's frame rate.
         *
         * `pauseClock` re-reads and widens rather than trusting one margin:
         * the frame the runner is painting when this asks for the pause can
         * outlast the gap between the read and the request.
         */
        await pauseClock(page);
        await page.evaluate((delta) => {
          const app = window.fnt!.app;
          const pos = app.state!.location.pos;
          (window as Window & { directionFrames?: unknown[] }).directionFrames = [];
          app.dispatch({ type: 'walkTo', pos: { x: pos.x, y: pos.y + delta } });
        }, dy);
        // Twenty steps of 60 ms cover the walk, and each step publishes the
        // frames the app would have drawn in it.
        let sawWalk = false;
        for (let step = 0; step < 20 && !sawWalk; step++) {
          await page.clock.runFor(60);
          sawWalk = await page.evaluate(
            ({ clip, facing }) => {
              const frames =
                (window as Window & { directionFrames?: { clip: string; facing: number }[][] })
                  .directionFrames ?? [];
              return frames.some((units) => units[0]?.clip === clip && units[0]?.facing === facing);
            },
            { clip: walkClip, facing },
          );
        }
        expect(sawWalk, `the ${direction} walk pose reached the renderer`).toBe(true);
        // One frame finishes the walk rather than a second's worth of them.
        await page.clock.fastForward(2000);
        await page.clock.resume();
        await waitForIdle(page);
        await expect
          .poll(() =>
            page.evaluate(() => {
              const frames = (window as Window & { directionFrames?: { clip: string }[][] })
                .directionFrames;
              return frames?.at(-1)?.[0]?.clip;
            }),
          )
          .toBe(restClip);
      }
      expect(errors).toEqual([]);
    });
  }
}
