import { expect, test } from '@playwright/test';
import { ALL_ABILITIES } from '../src/content/abilities';
import { FX_CELS } from '../src/content/fxCels';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { stageMotionTransition } from './motion-stage';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`every bending technique renders its animation cels on ${renderer}`, async ({ page }) => {
    test.setTimeout(180_000);
    allowSoftwareWebgl(test, renderer);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install();
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Explorer'], ['kaya'], 'bending-cels', { reduceMotion: false });
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt!.loadedFxCels())).toEqual([...FX_CELS]);
    // The installed clock tracks real time until paused. Give the command room
    // to reach the browser even when CI is busy loading every cel.
    await page.clock.pauseAt(Date.now() + 30_000);
    const techniques = ALL_ABILITIES.filter((a) => /^fx\.(fire|water|earth|air)\./.test(a.fx));
    for (const ability of techniques) {
      await stageMotionTransition(page, 'cast', ability.id);
      await page.clock.fastForward(600);
      await page.clock.runFor(17);
      const cels = await page.evaluate(() =>
        window
          .fnt!.app.animator.emitters(performance.now())
          .flatMap((e) => (e.def.kind === 'particles' && e.def.cel ? [e.def.cel] : [])),
      );
      expect(cels.length, ability.id).toBeGreaterThan(0);
    }
    await page.clock.fastForward(1500);
    await page.clock.runFor(17);
    expect(await page.evaluate(() => window.fnt!.app.animator.emitters(performance.now()))).toEqual(
      [],
    );
    expect(errors).toEqual([]);
  });

  test(`missing cel images keep bending playable on ${renderer}`, async ({ page }) => {
    test.setTimeout(120_000);
    allowSoftwareWebgl(test, renderer);
    await page.route('**/art/fx/*-cels.png', (route) => route.abort());
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Explorer'], ['kaya'], 'bending-fallback', { reduceMotion: false });
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    expect(await page.evaluate(() => window.fnt!.loadedFxCels())).toEqual([]);
    await stageMotionTransition(page, 'cast', 'fire_jab');
    await waitForIdle(page);
    expect(errors).toEqual([]);
  });
}
