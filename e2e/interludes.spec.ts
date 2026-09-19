import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, snapshot, startGame } from './helpers';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Reader'], ['wen']);
});

test('each click advances one still caption and skip reaches the intended destination', async ({
  page,
}) => {
  await expect(page.locator('.interlude-stage')).toBeVisible();
  await expect(page.locator('.line-count')).toHaveText('1 of 3');
  const next = page.locator('[data-interlude-control="next"]');
  await next.tap();
  await expect(page.locator('.line-count')).toHaveText('2 of 3');
  await next.focus();
  await next.dispatchEvent('keydown', { key: 'Enter', repeat: true });
  await expect(page.locator('.line-count')).toHaveText('2 of 3');
  await page.keyboard.press('Enter');
  await expect(page.locator('.line-count')).toHaveText('3 of 3');
  await expect(next).toBeFocused();
  await page.getByRole('button', { name: 'Restart scene' }).click();
  await expect(page.locator('.line-count')).toHaveText('1 of 3');
  await page.getByRole('button', { name: 'Skip scene' }).click();
  expect((await snapshot(page)).node).toBe('village_explore');
  await enterNode(page, 'quarry_descent');
  await page.getByRole('button', { name: 'Skip scene' }).click();
  expect((await snapshot(page)).node).toBe('quarry_assessment');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page
    .locator('button')
    .filter({ hasText: /^Continue$/ })
    .click();
  expect((await snapshot(page)).node).toBe('battle_grumbler');
});

test('the quarry marker assessment keeps the floor visible across save and reload', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Skip scene' }).click();
  await enterNode(page, 'quarry_after_explore');
  await expect(page.locator('.explore-scene')).toBeVisible();
  await page.evaluate(() => window.fnt?.app.dispatch({ type: 'walkTo', pos: { x: 18, y: 5 } }));
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
    .toBe('quarry_descent');
  await expect(page.locator('.interlude-stage')).toBeVisible();
  await page.getByRole('button', { name: 'Skip scene' }).click();

  await expect(page.locator('.explore-scene')).toBeVisible();
  await expect(page.locator('.conversation-panel-compact')).toBeVisible();
  await expect(page.locator('.conversation-compact-speaker')).toHaveText(/^Wen/);
  await expect(page.locator('.dialogue-line')).toContainText("I've repaired drives like that.");
  expect(
    await page.evaluate(() => ({
      node: window.fnt?.app.state?.story.nodeId,
      map: window.fnt?.app.state?.location.mapId,
      pos: window.fnt?.app.state?.location.pos,
      screen: window.fnt?.app.state?.screen,
    })),
  ).toEqual({
    node: 'quarry_assessment',
    map: 'quarry_floor',
    pos: { x: 9, y: 4 },
    screen: 'dialogue',
  });

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.dialogue-line')).toContainText('There is oil under the treads.');
  const checkpoint = await page.evaluate(() => {
    const state = window.fnt?.app.state;
    if (!state) throw new Error('Missing assessment save state.');
    return {
      flags: state.flags,
      fired: state.world.fired,
      location: state.location,
      story: state.story,
    };
  });

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /save here/i })
    .click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.fnt?.app));
  await page.getByRole('button', { name: /load a save/i }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /^Load$/ })
    .click();

  await expect(page.locator('.explore-scene')).toBeVisible();
  await expect(page.locator('.conversation-panel-compact')).toBeVisible();
  await expect(page.locator('.dialogue-line')).toContainText('There is oil under the treads.');
  expect(
    await page.evaluate(() => ({
      screen: window.fnt?.app.state?.screen,
      battle: window.fnt?.app.state?.battle,
      flags: window.fnt?.app.state?.flags,
      fired: window.fnt?.app.state?.world.fired,
      location: window.fnt?.app.state?.location,
      story: window.fnt?.app.state?.story,
    })),
  ).toEqual({
    screen: 'dialogue',
    battle: null,
    flags: checkpoint.flags,
    fired: checkpoint.fired,
    location: checkpoint.location,
    story: checkpoint.story,
  });

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.battle?.encounterId))
    .toBe('enc_grumbler');
});

test('playback pauses for menus and returns to exploration before the road encounter', async ({
  page,
}) => {
  await enterNode(page, 'road_depart');
  await expect
    .poll(() =>
      page
        .locator('.interlude-art')
        .evaluate((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await page.clock.install();
  await page.getByRole('button', { name: 'Play scene', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('.interlude-art')
        .evaluate((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.clock.fastForward(60000);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('.line-count')).toHaveText('1 of 2');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Play scene', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('.interlude-art')
        .evaluate((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await page.clock.fastForward(60000);
  expect((await snapshot(page)).node).toBe('road_depart');
  await expect(page.getByRole('button', { name: 'Play scene', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  expect((await snapshot(page)).node).toBe('forest_explore');
  await expect(page.locator('.explore-scene')).toBeVisible();
  expect(await page.evaluate(() => window.fnt?.app.state?.battle)).toBeNull();
  // Continue releases the party onto the road; crossing the visible group starts combat.
  await page.evaluate(() => window.fnt?.app.dispatch({ type: 'walkTo', pos: { x: 18, y: 4 } }));
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.battle?.encounterId))
    .toBe('enc_forest_road');
});

for (const [node, title, art] of [
  ['act1_victory', 'The Quarry of Ba Dan', 'rescue.webp'],
  ['act1_lost', 'The Quarry Keeps Running', 'ba-dan.webp'],
] as const) {
  test(`${node} shows only its own outcome and can replay without changing flags`, async ({
    page,
  }) => {
    await enterNode(page, node);
    const flags = await page.evaluate(() => window.fnt?.app.state?.flags);
    await expect(page.locator('.interlude-art')).toHaveAttribute('src', new RegExp(art));
    await page.getByRole('button', { name: 'Read summary' }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Replay scene', exact: true }).click();
    await expect(page.locator('.line-count')).toHaveText('1 of 5');
    expect(await page.evaluate(() => window.fnt?.app.state?.flags)).toEqual(flags);
  });
}

test('portrait large text keeps the complete painting above reachable captions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.evaluate(() => document.documentElement.style.setProperty('--ui-scale', '1.4'));
  const image = page.locator('.interlude-art');
  await expect
    .poll(() => image.evaluate((img) => img instanceof HTMLImageElement && img.naturalWidth > 0))
    .toBe(true);
  const art = await image.boundingBox();
  const caption = await page.locator('.interlude-caption').boundingBox();
  expect(art && caption && art.y + art.height <= caption.y).toBe(true);
  await page.getByRole('button', { name: 'Skip scene' }).click();
  await expect(page.locator('.explore-scene')).toBeVisible();
});

test('autoplay advances one frame and a hidden tab pauses it', async ({ page }) => {
  await enterNode(page, 'road_depart');
  await page.clock.install();
  await page.getByRole('button', { name: 'Play scene', exact: true }).click();
  await page.locator('.interlude-art').evaluate((img) => (img as HTMLImageElement).decode());
  await page.clock.fastForward(16000);
  await expect(page.locator('.line-count')).toHaveText('2 of 2');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'Play scene', exact: true })).toBeVisible();
  await page.clock.fastForward(60000);
  expect((await snapshot(page)).node).toBe('road_depart');
});

test('missing art leaves the caption and skip usable', async ({ page }) => {
  await page.route('**/art/interludes/east-road.webp', (route) => route.abort());
  await enterNode(page, 'road_depart');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByText('Rainwater fills the wheel ruts of a winding road through pine woods.'),
  ).toBeVisible();
  await expect(page.locator('.dialogue-line')).toHaveText(
    'At the bend, a boot scrapes on stone. Someone is standing behind the trees.',
  );
  await page.getByRole('button', { name: 'Skip scene' }).click();
  expect((await snapshot(page)).node).toBe('forest_explore');
  await expect(page.locator('.explore-scene')).toBeVisible();
  expect(await page.evaluate(() => window.fnt?.app.state?.battle)).toBeNull();
});

test('a saved cutscene resumes at its caption with playback paused', async ({ page }) => {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /save here/i })
    .click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.fnt?.app));
  await page.getByRole('button', { name: /load a save/i }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /^Load$/ })
    .click();
  await expect(page.locator('.line-count')).toHaveText('2 of 3');
  await expect(page.getByRole('button', { name: 'Play scene', exact: true })).toBeVisible();
});
