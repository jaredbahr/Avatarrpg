import { expect, test } from '@playwright/test';
import {
  enterNode,
  pauseClock,
  resetStorage,
  setLargeText,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';

test('a fresh battle establishes the full formation before the acting-unit hand-off', async ({
  page,
}) => {
  test.setTimeout(40_000);
  // Keep the 700 ms formation hold from elapsing between two host-side polls
  // when a loaded software renderer delivers its next frame seconds later.
  await page.clock.install();
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya'], ['kaya'], 'battle-opening-camera', { reduceMotion: false });
  await pauseClock(page);
  await enterNode(page, 'battle_forest_road');

  await expect
    .poll(
      async () => {
        await page.clock.runFor(50);
        return page.locator('.combat-scene').getAttribute('data-battle-opening');
      },
      { timeout: 25_000, intervals: [50] },
    )
    .toBe('hold');
  const formation = await page.evaluate(() => window.fnt!.app.rendererCamera());
  // Jump inside the authored hold without painting every intermediate frame;
  // the hold and camera assertions still read the real scene after the jump.
  await page.clock.fastForward(300);
  expect(await page.locator('.combat-scene').getAttribute('data-battle-opening')).toBe('hold');
  expect(await page.evaluate(() => window.fnt!.app.rendererCamera())).toEqual(formation);

  await expect
    .poll(
      async () => {
        await page.clock.fastForward(100);
        return page.locator('.combat-scene').getAttribute('data-battle-opening');
      },
      { timeout: 25_000, intervals: [50] },
    )
    .toBeNull();
  const actor = await page.evaluate(() => window.fnt!.app.rendererCamera());
  expect(actor).not.toEqual(formation);
});

test.describe('AI camera reveal at DPR 2', () => {
  test.use({ deviceScaleFactor: 2 });
});

test('six-person combat keeps initiative navigation usable on a narrow screen with huge text', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Native touch-scroll injection uses the Chromium protocol.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    ['Nima', 'Kaya', 'Sura', 'Bo', 'Wen', 'Tenzo'],
    ['nima', 'kaya', 'sura', 'bo', 'wen', 'tenzo'],
    'forest-six',
  );
  await setLargeText(page, 'huge');
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);
  const strip = page.locator('.turn-strip');
  expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const last = strip.getByRole('button').last();
  await last.scrollIntoViewIfNeeded();
  const box = await last.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await last.tap();
  // A phone folds the header's view buttons behind More.
  await page.getByRole('button', { name: 'More', exact: true }).tap();
  await page.getByRole('button', { name: 'Acting unit', exact: true }).tap();
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10000 });
  expect((await page.locator('.map-canvas').boundingBox())?.height).toBeGreaterThan(160);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.shots/forest-six-huge-phone.png' });
  const beforeScroll = await page.evaluate(() => ({
    battle: JSON.stringify(window.fnt!.app.state!.battle),
    camera: window.fnt!.app.rendererCamera(),
  }));
  // Native touch scrolling exercises browser overflow, not the map's synthetic
  // pointer adapter. Scrolling the dock must never spend AP or pan the world.
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: from.x + ((to.x - from.x) * step) / 6, y: from.y + ((to.y - from.y) * step) / 6 },
        ],
      });
    }
    // Hold still before lifting, as a person does after a drag. Six instant
    // moves otherwise lift at speed and start a fling, and the browser spends
    // the next tap stopping that fling without sending a click.
    for (let hold = 0; hold < 4; hold++) {
      await page.waitForTimeout(50);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [to] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await swipe({ x: 200, y: 780 }, { x: 200, y: 590 });
  await swipe({ x: 340, y: 730 }, { x: 50, y: 730 });
  await expect
    .poll(() => page.locator('.hud').evaluate((el) => el.scrollTop + el.scrollLeft))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle))).toBe(
    beforeScroll.battle,
  );
  expect(await page.evaluate(() => window.fnt!.app.rendererCamera())).toEqual(beforeScroll.camera);
  const end = page.getByRole('button', { name: /^End turn/ });
  await end.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.shots/forest-six-huge-end-turn.png' });
  await end.tap();
  await expect(page.locator('.toast')).toContainText('Tap End turn again');
  expect(await page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle))).toBe(
    beforeScroll.battle,
  );
  await end.tap();
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle)))
    .not.toBe(beforeScroll.battle);
  await cdp.detach();
});
