import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { stageMotionTransition } from './motion-stage';
import type { MapView, RenderUnit } from '../src/render/view';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`attack recovery and backward knockback stay grounded on ${renderer}`, async ({ page }) => {
    test.setTimeout(120_000);
    allowSoftwareWebgl(test, renderer);
    // Capture the game's first RAF in the controlled clock, including on WebKit.
    await page.clock.install();
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Explorer'], ['kaya'], 'motion-transitions', { reduceMotion: false });
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);
    // The clock advances until this command reaches the browser. Leave room
    // for busy CI instead of racing a browser round trip against one second.
    await page.clock.pauseAt(Date.now() + 30_000);
    await page.evaluate(() => {
      const win = window as Window & { motionUnits?: readonly RenderUnit[] };
      const scene = (
        window.fnt!.app as unknown as {
          scene: { renderer: { draw(view: MapView): void } };
        }
      ).scene;
      const draw = scene.renderer.draw.bind(scene.renderer);
      scene.renderer.draw = (view) => {
        win.motionUnits = view.units;
        draw(view);
      };
    });
    const rendered = (id: string) =>
      page.evaluate(
        (id) =>
          (window as Window & { motionUnits?: readonly RenderUnit[] }).motionUnits?.find(
            (u) => u.id === id,
          ),
        id,
      );

    const cast = await stageMotionTransition(page, 'cast');
    await page.clock.runFor(50);
    expect(await rendered(cast.id)).toMatchObject({ clip: 'cast', facing: -1 });
    await page.clock.fastForward(cast.duration);
    await page.clock.runFor(32);
    // Kaya's sheet declares eight-way locomotion: she settles on her authored
    // west idle rather than the mirrored side idle four-way sheets use.
    expect(await rendered(cast.id)).toMatchObject({ clip: 'idleWest', facing: -1 });

    const push = await stageMotionTransition(page, 'push');
    await page.clock.runFor(64);
    expect(await rendered(push.id)).toMatchObject({
      clip: 'hit',
      facing: -1,
      offset: { x: 0, y: 0 },
    });
    await page.clock.fastForward(push.duration);
    await page.clock.runFor(32);
    // The logical westward walk projects to screen north-west on this
    // oblique map, and the push does not turn her: she keeps that idle.
    expect(await rendered(push.id)).toMatchObject({ clip: 'idleNorthWest', facing: -1 });
  });
}
