import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, setLargeText, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

for (const renderer of ['canvas', 'webgl']) {
  test(`portrait initiative locates threats without changing actions on ${renderer}`, async ({
    page,
  }) => {
    allowSoftwareWebgl(test, renderer);
    await page.setViewportSize({ width: 820, height: 1180 });
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya'], ['kaya'], 'forest-focus');
    await enterNode(page, 'battle_forest_road');
    await takeTurn(page);
    await waitForIdle(page);
    await page.getByRole('button', { name: /^Move/ }).click();
    const before = await page.evaluate(() => {
      const app = window.fnt!.app;
      const battle = app.state!.battle!;
      const actor = battle.units.find((u) => u.id === battle.order[battle.turnIndex])!;
      const enemy = battle.units.find((u) => u.faction === 'enemy' && u.hp > 0)!;
      return {
        battle: JSON.stringify(battle),
        actor: actor.pos,
        enemy: enemy.pos,
        name: enemy.name,
        tilePx: app.rendererCamera()!.tilePx,
      };
    });
    const intent = await page.locator('.action-bar').innerText();
    const focus = page.getByRole('button', { name: `Focus ${before.name}`, exact: true }).first();
    if (renderer === 'webgl') {
      await focus.focus();
      await focus.press('Enter');
    } else await focus.tap();
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10000 });
    const box = await page.locator('.map-canvas').boundingBox();
    if (!box) throw new Error('Missing battlefield');
    const enemyPoint = await paintedTileCentre(page, before.enemy);
    if (!enemyPoint) throw new Error('Missing camera');
    expect(enemyPoint.x).toBeGreaterThan(box.x + 20);
    expect(enemyPoint.x).toBeLessThan(box.x + box.width - 20);
    expect(enemyPoint.y).toBeGreaterThan(box.y + 20);
    expect(enemyPoint.y).toBeLessThan(box.y + box.height - 20);
    await page.screenshot({ path: `.shots/forest-${renderer}-focus-enemy.png` });
    await page.getByRole('button', { name: 'Acting unit', exact: true }).click();
    const actorPoint = await paintedTileCentre(page, before.actor);
    if (!actorPoint) throw new Error('Missing camera');
    expect(actorPoint.x).toBeGreaterThan(box.x + 20);
    expect(actorPoint.x).toBeLessThan(box.x + box.width - 20);
    expect(actorPoint.y).toBeGreaterThan(box.y + 20);
    expect(actorPoint.y).toBeLessThan(box.y + box.height - 20);
    expect(await page.evaluate(() => JSON.stringify(window.fnt!.app.state!.battle))).toBe(
      before.battle,
    );
    expect(await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx)).toBe(before.tilePx);
    expect(await page.locator('.action-bar').innerText()).toBe(intent);
    await page.screenshot({ path: `.shots/forest-${renderer}-focus-actor.png` });
  });
}

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
