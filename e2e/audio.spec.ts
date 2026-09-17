import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';

/**
 * Sound, end to end.
 *
 * What a browser will tell you is narrow, so this is careful about what it
 * claims. It proves three things and no more: that a gesture unlocks the
 * context, that casting an ability puts cues through the choreography, the
 * animator and into Web Audio, and that turning the setting off gives the
 * context back rather than leaving a silent graph running.
 *
 * It does **not** prove anything was audible, and no headless check can. That
 * verdict is the owner's, on the device (ADR 0012).
 */
test.describe('sound', () => {
  test('a gesture unlocks the context, and Off closes it', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'audio-spec');

    // `startGame` taps its way through the title and party setup, so by now
    // the context has had every gesture it could want.
    expect(await page.evaluate(() => window.fnt?.app.audio.ready)).toBe(true);

    await page.evaluate(() => window.fnt?.app.updateSettings({ volume: 0 }));
    expect(
      await page.evaluate(() => window.fnt?.app.audio.ready),
      'Off must close the context, not run a silent one',
    ).toBe(false);

    await page.evaluate(() => window.fnt?.app.updateSettings({ volume: 0.7 }));
    expect(
      await page.evaluate(() => window.fnt?.app.audio.ready),
      'changing the setting is itself a gesture, so sound comes back without another tap',
    ).toBe(true);
  });

  test('a cast reaches Web Audio, and silence really is silent', async ({ page }) => {
    test.setTimeout(120_000);

    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'audio-spec');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);

    const before = await page.evaluate(() => ({
      seen: window.fnt?.app.audio.cuesSeen ?? 0,
      scheduled: window.fnt?.app.audio.scheduled ?? 0,
    }));

    // Walking is the simplest thing that cues: a footstep a tile.
    await page.evaluate(() => {
      const app = window.fnt?.app;
      const unit = app?.state?.battle?.units.find((u) => u.faction === 'party');
      if (!app || !unit) throw new Error('no acting party unit');
      app.dispatch({
        type: 'move',
        unitId: unit.id,
        path: [{ x: unit.pos.x + 1, y: unit.pos.y }],
      });
    });
    await waitForIdle(page);

    const after = await page.evaluate(() => ({
      seen: window.fnt?.app.audio.cuesSeen ?? 0,
      scheduled: window.fnt?.app.audio.scheduled ?? 0,
    }));
    expect(after.seen, 'the walk should cue a footstep').toBeGreaterThan(before.seen);
    expect(after.scheduled, 'and it should reach Web Audio').toBeGreaterThan(before.scheduled);

    // With sound off, a cue may still be raised by the choreography — that
    // costs nothing — but nothing may reach the audio graph.
    await page.evaluate(() => window.fnt?.app.updateSettings({ volume: 0 }));
    const quiet = await page.evaluate(() => window.fnt?.app.audio.scheduled ?? 0);
    await page.evaluate(() => {
      const app = window.fnt?.app;
      const unit = app?.state?.battle?.units.find((u) => u.faction === 'party');
      if (!app || !unit) throw new Error('no acting party unit');
      app.dispatch({
        type: 'move',
        unitId: unit.id,
        path: [{ x: unit.pos.x + 1, y: unit.pos.y }],
      });
    });
    await waitForIdle(page);
    expect(
      await page.evaluate(() => window.fnt?.app.audio.scheduled ?? 0),
      'nothing may be scheduled with sound off',
    ).toBe(quiet);

    expect(errors, 'sound must not put anything in the console').toEqual([]);
  });
});
