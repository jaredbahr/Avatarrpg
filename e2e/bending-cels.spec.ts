import { expect, test } from '@playwright/test';
import { ALL_ABILITIES } from '../src/content/abilities';
import { FX_CELS } from '../src/content/fxCels';
import { allowSoftwareWebgl } from './budget';
import {
  enterNode,
  pauseClock,
  resetStorage,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import { stageMotionTransition } from './motion-stage';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`every bending technique renders its animation cels on ${renderer}`, async ({ page }) => {
    test.setTimeout(180_000);
    allowSoftwareWebgl(test, renderer);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // A particle shader that fails to link or bind throws nothing in Pixi; it
    // logs and draws nothing (ADR 0057 took the WGSL program off it).
    const glErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /shader|webgl|glsl/i.test(message.text())) {
        glErrors.push(message.text());
      }
    });
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
      // Kaya's single-target bending attacks play her bend and its painted
      // effect instead of particle cels (ADR 0055, step 7); the rest keep cels.
      const drawn = await page.evaluate(() => {
        const now = performance.now();
        const animator = window.fnt!.app.animator;
        return {
          cels: animator
            .emitters(now)
            .flatMap((e) => (e.def.kind === 'particles' && e.def.cel ? [e.def.cel] : [])).length,
          bend: animator.bendFx(now).length,
        };
      });
      expect(drawn.cels + drawn.bend, ability.id).toBeGreaterThan(0);
    }
    await page.clock.fastForward(1500);
    await page.clock.runFor(17);
    expect(await page.evaluate(() => window.fnt!.app.animator.emitters(performance.now()))).toEqual(
      [],
    );
    expect(await page.evaluate(() => window.fnt!.app.animator.bendFx(performance.now()))).toEqual(
      [],
    );
    expect(errors).toEqual([]);
    expect(glErrors).toEqual([]);
  });

  test(`missing cel images keep bending playable on ${renderer}`, async ({ page }) => {
    test.setTimeout(120_000);
    allowSoftwareWebgl(test, renderer);
    await page.clock.install();
    await page.route('**/art/fx/*-cels.png', (route) => route.abort());
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Explorer'], ['kaya'], 'bending-fallback', { reduceMotion: false });
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    expect(await page.evaluate(() => window.fnt!.loadedFxCels())).toEqual([]);
    // Freeze before the cast begins. On a loaded software-WebGL runner the
    // effect could otherwise expire in performance time before the first
    // fallback frame was presented, leaving `waitForIdle` racing a render.
    // The missing-cel contract is that the cast completes without an error;
    // emitter counts do not expose whether the fallback was painted.
    await pauseClock(page);
    const transition = await stageMotionTransition(page, 'cast', 'fire_jab');
    await page.clock.fastForward(transition.duration);
    await page.clock.runFor(17);
    await waitForIdle(page);
    expect(errors).toEqual([]);
  });
}
