import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

for (const renderer of ['canvas', 'webgl']) {
  test(`portrait initiative locates threats without changing actions on ${renderer}`, async ({
    page,
  }) => {
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
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    ['Nima', 'Kaya', 'Sura', 'Bo', 'Wen', 'Tenzo'],
    ['nima', 'kaya', 'sura', 'bo', 'wen', 'tenzo'],
    'forest-six',
  );
  await page.evaluate(() => window.fnt!.app.updateSettings({ largeText: 'huge' }));
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
  expect((await page.locator('.map-canvas').boundingBox())?.height).toBeGreaterThan(160);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.shots/forest-six-huge-phone.png' });
});
