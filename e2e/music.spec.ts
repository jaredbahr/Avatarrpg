import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

/**
 * Area music, end to end (ADR 0108).
 *
 * Playwright's Chromium is built without the AAC decoder, so this cannot hear the loops and does
 * not try: it proves the player asked the real `<audio>` path for the right file at the right
 * moment, and let go of it when Music went Off. Whether it sounds right is the owner's call on the
 * iPad, as with every other sound (ADR 0012).
 */

declare global {
  interface Window {
    musicProbe?: { played: string[]; elements: HTMLMediaElement[] };
  }
}

test('the title tap starts the title theme, Ba Dan switches it, and Off stops it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const probe = { played: [] as string[], elements: [] as HTMLMediaElement[] };
    window.musicProbe = probe;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      // The player blesses its two elements with an empty play() inside the first gesture.
      if (this.src) probe.played.push(this.src);
      if (!probe.elements.includes(this)) probe.elements.push(this);
      return play.call(this);
    };
  });
  await resetStorage(page, '?renderer=canvas');
  await expect(page.locator('.title-card')).toBeVisible();

  // Nothing may sound before a gesture.
  expect(
    await page.evaluate(() => ({
      track: window.fnt?.app.music.track,
      played: window.musicProbe?.played.length,
    })),
  ).toEqual({ track: null, played: 0 });

  // The title's first tap, on an empty corner rather than a button.
  await page.mouse.click(4, 4);
  await expect.poll(() => page.evaluate(() => window.fnt?.app.music.track)).toBe('title');
  expect(await page.evaluate(() => window.fnt?.app.music.playing)).toBe(true);
  expect(await page.evaluate(() => window.musicProbe?.played)).toEqual([
    expect.stringMatching(/\/audio\/music\/title\.m4a$/),
  ]);

  await startGame(page, ['Elias'], ['kaya'], 'music-spec');
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  await expect.poll(() => page.evaluate(() => window.fnt?.app.music.track)).toBe('ba-dan');
  const played = (await page.evaluate(() => window.musicProbe?.played)) ?? [];
  expect(played.at(-1)).toMatch(/\/audio\/music\/ba-dan\.m4a$/);
  // A conversation or a second scene in Ba Dan does not restart it.
  const starts = played.filter((src) => src.endsWith('ba-dan.m4a')).length;
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  expect(
    (await page.evaluate(() => window.musicProbe?.played))?.filter((src) =>
      src.endsWith('ba-dan.m4a'),
    ).length,
  ).toBe(starts);

  await page.evaluate(() => window.fnt?.app.updateSettings({ music: 0 }));
  expect(
    await page.evaluate(() => ({
      track: window.fnt?.app.music.track,
      playing: window.fnt?.app.music.playing,
      allPaused: window.musicProbe?.elements.every((element) => element.paused),
    })),
  ).toEqual({ track: null, playing: false, allPaused: true });

  // Sound effects are untouched by the music setting.
  expect(await page.evaluate(() => window.fnt?.app.settings.volume)).toBe(0.7);
});
