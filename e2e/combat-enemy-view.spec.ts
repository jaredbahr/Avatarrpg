import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

const PARTY = [
  { player: 'Elias', character: 'kaya' },
  { player: 'Lorelai', character: 'sura' },
  { player: 'Frehley', character: 'bo' },
] as const;

test('Show enemies frames the forest ambush, then restores the acting-unit view', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    PARTY.map((member) => member.player),
    PARTY.map((member) => member.character),
    'first-turn-context-328',
  );
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);

  const showEnemies = page.getByRole('button', { name: 'Show enemies', exact: true });
  await expect(showEnemies).toBeVisible();
  const defaultTap = await showEnemies.boundingBox();
  expect(defaultTap?.height).toBeGreaterThanOrEqual(48);

  const assertTargetsVisible = async () => {
    const targets = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      if (!battle) return [];
      return [
        ...battle.units
          .filter((unit) => unit.faction === 'enemy' && unit.hp > 0)
          .map((unit) => unit.pos),
        ...battle.props.filter((prop) => prop.hp > 0).map((prop) => prop.pos),
      ];
    });
    expect(targets.length).toBeGreaterThan(1);
    expect(
      targets.some((target) => target.x === 13 && target.y === 6),
      'the live oil flask at (13, 6) is included',
    ).toBe(true);
    const canvas = page.locator('.combat-scene .map-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    for (const target of targets) {
      const point = await paintedTileCentre(page, target);
      expect(point).not.toBeNull();
      expect(point!.x).toBeGreaterThanOrEqual(box!.x);
      expect(point!.x).toBeLessThanOrEqual(box!.x + box!.width);
      expect(point!.y).toBeGreaterThanOrEqual(box!.y);
      expect(point!.y).toBeLessThanOrEqual(box!.y + box!.height);
    }
  };
  const showingEnemiesView = () =>
    page.evaluate(() => {
      const scene = (window.fnt!.app as unknown as { scene?: { showingEnemiesView?: boolean } })
        .scene;
      return scene?.showingEnemiesView ?? false;
    });

  await showEnemies.click();
  await assertTargetsVisible();
  expect(await showingEnemiesView()).toBe(true);
  if (process.env.FNT_CAPTURE_328 === '1') {
    await page.screenshot({ path: '/tmp/avatarrpg-328-show-enemies-1280x800.png' });
  }
  const enemyFrame = await page.evaluate(() => window.fnt!.app.rendererCamera());
  const actorBeforeTap = await page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state!.battle!;
    const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex])!;
    return { id: actor.id, pos: actor.pos, ap: actor.ap };
  });

  await page.locator('.combat-scene .map-canvas').click({ position: { x: 30, y: 30 } });
  await waitForIdle(page);
  const tapReturned = await page.evaluate(() => window.fnt!.app.rendererCamera());
  expect(tapReturned).not.toEqual(enemyFrame);
  expect(await showingEnemiesView()).toBe(false);
  expect(
    await page.evaluate(() => {
      const battle = window.fnt!.app.state!.battle!;
      const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex])!;
      return { id: actor.id, pos: actor.pos, ap: actor.ap };
    }),
  ).toEqual(actorBeforeTap);

  await showEnemies.click();
  await assertTargetsVisible();
  await page.getByRole('button', { name: 'Recentre', exact: true }).click();
  expect(await showingEnemiesView()).toBe(false);
  const recentred = await page.evaluate(() => window.fnt!.app.rendererCamera());
  expect(recentred).not.toEqual(enemyFrame);

  await page.setViewportSize({ width: 834, height: 1194 });
  await waitForIdle(page);
  await showEnemies.click();
  await assertTargetsVisible();
  if (process.env.FNT_CAPTURE_328 === '1') {
    await page.screenshot({ path: '/tmp/avatarrpg-328-show-enemies-834x1194.png' });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await setLargeText(page, 'huge');
  const more = page.getByRole('button', { name: 'More', exact: true });
  await expect(more).toBeVisible();
  await more.click();
  const phoneButton = page.getByRole('button', { name: 'Show enemies', exact: true });
  await expect(phoneButton).toBeVisible();
  const hugeTap = await phoneButton.boundingBox();
  expect(hugeTap?.height).toBeGreaterThanOrEqual(48);

  await phoneButton.click();
  expect(await showingEnemiesView()).toBe(true);
  await page.locator('.combat-scene .map-canvas').evaluate((canvas) => {
    const box = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -400,
        ctrlKey: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(await showingEnemiesView()).toBe(false);
  const pinchFrame = await page.evaluate(() => window.fnt!.app.rendererCamera());
  const actorBeforeTurn = await page.evaluate(() => {
    const battle = window.fnt!.app.state!.battle!;
    return battle.order[battle.turnIndex] ?? null;
  });
  await page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state!.battle!;
    const unitId = battle.order[battle.turnIndex]!;
    app.dispatch({ type: 'endTurn', unitId });
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const battle = window.fnt!.app.state!.battle!;
        return battle.order[battle.turnIndex] ?? null;
      }),
    )
    .not.toBe(actorBeforeTurn);
  expect(await showingEnemiesView()).toBe(false);
  const afterTurn = await page.evaluate(() => window.fnt!.app.rendererCamera());
  expect(afterTurn?.tilePx).toBe(pinchFrame?.tilePx);
});

test('a turn change from Show enemies restores the new acting-unit frame', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    PARTY.map((member) => member.player),
    PARTY.map((member) => member.character),
    'first-turn-context-328-turn-change',
  );
  await enterNode(page, 'battle_forest_road');
  await takeTurn(page);
  await waitForIdle(page);

  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Show enemies', exact: true }).click();
  const showing = () =>
    page.evaluate(() => {
      const scene = (window.fnt!.app as unknown as { scene?: { showingEnemiesView?: boolean } })
        .scene;
      return scene?.showingEnemiesView ?? false;
    });
  expect(await showing()).toBe(true);
  const enemyFrame = await page.evaluate(() => window.fnt!.app.rendererCamera());
  const actorBeforeTurn = await page.evaluate(() => {
    const battle = window.fnt!.app.state!.battle!;
    return battle.order[battle.turnIndex] ?? null;
  });

  await page.evaluate(() => {
    const app = window.fnt!.app;
    const battle = app.state!.battle!;
    const unitId = battle.order[battle.turnIndex]!;
    app.dispatch({ type: 'endTurn', unitId });
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const battle = window.fnt!.app.state!.battle!;
        return battle.order[battle.turnIndex] ?? null;
      }),
    )
    .not.toBe(actorBeforeTurn);
  expect(await showing()).toBe(false);

  const actorPos = await page.evaluate(() => {
    const battle = window.fnt!.app.state!.battle!;
    const id = battle.order[battle.turnIndex];
    return battle.units.find((unit) => unit.id === id)?.pos ?? null;
  });
  expect(actorPos).not.toBeNull();
  const point = await paintedTileCentre(page, actorPos!);
  const box = await page.locator('.combat-scene .map-canvas').boundingBox();
  expect(point).not.toBeNull();
  expect(box).not.toBeNull();
  expect(point!.x).toBeGreaterThanOrEqual(box!.x);
  expect(point!.x).toBeLessThanOrEqual(box!.x + box!.width);
  expect(point!.y).toBeGreaterThanOrEqual(box!.y);
  expect(point!.y).toBeLessThanOrEqual(box!.y + box!.height);
  expect(await page.evaluate(() => window.fnt!.app.rendererCamera())).not.toEqual(enemyFrame);
});
