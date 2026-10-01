import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl, SOFTWARE_WEBGL_BUDGET_MS } from './budget';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import { tileCentre } from './gallery/stage';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`elevation preview explains the shot and ledge drop on ${renderer}`, async ({ page }) => {
    test.setTimeout(renderer === 'webgl' ? 90_000 : 30_000);
    allowSoftwareWebgl(test, renderer);
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Climber'], ['kaya'], `elevation-preview-${renderer}`);
    await enterNode(page, 'battle_quarry_gate');
    await takeTurn(page);
    await waitForIdle(page);
    expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(renderer);
    await setLargeText(page, 'huge');

    await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      const hero = battle?.units.find((unit) => unit.faction === 'party');
      const enemy = battle?.units.find((unit) => unit.faction === 'enemy');
      if (!app || !state || !battle || !hero || !enemy) throw new Error('Missing preview fixture.');
      const tiles = battle.grid.tiles.map((tile) => ({ ...tile }));
      const setTile = (x: number, y: number, elevation: number) => {
        const index = y * battle.grid.width + x;
        const tile = tiles[index];
        if (!tile) throw new Error(`Missing tile ${x},${y}.`);
        tiles[index] = { ...tile, elevation, blocked: false, blocksSight: false, surface: null };
      };
      setTile(2, 4, 1);
      setTile(3, 4, 1);
      setTile(4, 4, 0);
      app.state = {
        ...state,
        battle: {
          ...battle,
          grid: { ...battle.grid, tiles },
          units: battle.units.map((unit) =>
            unit.id === hero.id
              ? { ...unit, pos: { x: 2, y: 4 }, ap: Math.max(2, unit.ap) }
              : unit.id === enemy.id
                ? { ...unit, pos: { x: 3, y: 4 }, hp: Math.max(8, unit.hp) }
                : unit,
          ),
          turnIndex: battle.order.indexOf(hero.id),
        },
      };
      app.resync();
    });
    await settleLayout(page);

    const tapTile = async (pos: { x: number; y: number }) => {
      await settleLayout(page);
      const canvas = page.locator('.map-canvas');
      const box = await canvas.boundingBox();
      if (!box) throw new Error('No combat canvas.');
      const point = await tileCentre(page, pos);
      await canvas.tap({ position: { x: point.x - box.x, y: point.y - box.y } });
    };

    await page.getByRole('button', { name: /^Shove/ }).click();
    await tapTile({ x: 3, y: 4 });
    await expect(page.locator('.shove-drop-forecast')).toHaveText(
      'Fire Nation Deserter drops 1 → 3 damage',
    );
    await page.getByRole('button', { name: /^Cancel$/ }).click();

    await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      const hero = battle?.units.find((unit) => unit.faction === 'party');
      const enemy = battle?.units.find((unit) => unit.faction === 'enemy');
      if (!app || !state || !battle || !hero || !enemy) throw new Error('Missing preview fixture.');
      const tiles = battle.grid.tiles.map((tile) => ({ ...tile }));
      const heroIndex = 2 * battle.grid.width + 2;
      const enemyIndex = 2 * battle.grid.width + 4;
      const heroTile = tiles[heroIndex];
      const enemyTile = tiles[enemyIndex];
      if (!heroTile || !enemyTile) throw new Error('Missing elevation fixture tiles.');
      tiles[heroIndex] = { ...heroTile, elevation: 2, blocked: false, surface: null };
      tiles[enemyIndex] = {
        ...enemyTile,
        elevation: 1,
        blocked: false,
        blocksSight: false,
        surface: { id: 'steam', duration: 2, spread: 0 },
      };
      app.state = {
        ...state,
        battle: {
          ...battle,
          grid: { ...battle.grid, tiles },
          units: battle.units.map((unit) =>
            unit.id === hero.id
              ? { ...unit, pos: { x: 2, y: 2 } }
              : unit.id === enemy.id
                ? { ...unit, pos: { x: 4, y: 2 } }
                : unit,
          ),
        },
      };
      app.resync();
    });
    await settleLayout(page);
    await page.getByRole('button', { name: /^Fire Jab/ }).click();
    await tapTile({ x: 4, y: 2 });

    const targetChip = page.locator('.preview-target-chip').filter({ hasText: '%' }).first();
    await expect(targetChip).toContainText('%');
    await expect(page.locator('.hit-breakdown')).toBeHidden();
    await targetChip.click();
    await expect(page.locator('.hit-breakdown')).toBeVisible();
    await expect(page.locator('.hit-breakdown')).toContainText('Base 90');
    await expect(page.locator('.hit-breakdown')).toContainText('High ground +10');
    await expect(page.locator('.hit-breakdown')).toContainText('Target in cloud −25');
    const readReticle = () =>
      page.evaluate(() => {
        const scene = (
          window.fnt?.app as unknown as {
            scene?: { renderer?: { lastView?: { targetReticle?: unknown } } };
          }
        )?.scene;
        return scene?.renderer?.lastView?.targetReticle ?? null;
      });
    const reticlePoll = { timeout: renderer === 'webgl' ? SOFTWARE_WEBGL_BUDGET_MS : 30_000 };
    await expect
      .poll(readReticle, reticlePoll)
      .toMatchObject({ elevation: 'above', obscured: true });

    await page.getByRole('button', { name: /^Cancel$/ }).click();
    await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      if (!app || !state || !battle) throw new Error('Missing preview fixture.');
      const tiles = battle.grid.tiles.map((tile) => ({ ...tile }));
      const heroIndex = 2 * battle.grid.width + 2;
      const enemyIndex = 2 * battle.grid.width + 4;
      const heroTile = tiles[heroIndex];
      const enemyTile = tiles[enemyIndex];
      if (!heroTile || !enemyTile) throw new Error('Missing elevation fixture tiles.');
      tiles[heroIndex] = { ...heroTile, elevation: 0 };
      tiles[enemyIndex] = { ...enemyTile, elevation: 1 };
      app.state = { ...state, battle: { ...battle, grid: { ...battle.grid, tiles } } };
      app.resync();
    });
    // Cancelling a confirmation returns to the active aim, so choose the new
    // fixture target directly; clicking Fire Jab again would toggle aim off.
    await tapTile({ x: 4, y: 2 });
    await expect.poll(readReticle, reticlePoll).toMatchObject({ elevation: 'below' });
  });
}

test('touching a prop target names its break consequence before confirmation', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Explorer'], ['kaya'], 'combat-preview-touch');
  await enterNode(page, 'battle_quarry_gate');
  await takeTurn(page);
  await waitForIdle(page);

  await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    const hero = battle?.units.find((unit) => unit.faction === 'party');
    if (!app || !state || !battle || !hero) throw new Error('No quarry battle hero.');
    const turnIndex = battle.order.indexOf(hero.id);
    app.state = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((unit) =>
          unit.id === hero.id ? { ...unit, pos: { x: 11, y: 4 } } : unit,
        ),
        turnIndex,
      },
    };
    app.resync();
  });
  await settleLayout(page);

  await page.getByRole('button', { name: /^Fire Jab/ }).click();
  // The aim hint resizes the canvas and the camera pans to the moved hero: map
  // the tile only once that has settled.
  await settleLayout(page);
  const canvas = page.locator('.map-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('No combat canvas.');
  const point = await tileCentre(page, { x: 12, y: 4 });
  await canvas.tap({ position: { x: point.x - box.x, y: point.y - box.y } });

  const confirm = page.locator('.confirm-bar').filter({ hasText: 'Confirm' });
  await expect(confirm).toContainText('Oil Flask');
  await expect(confirm).toContainText('flask shatters and oil spreads');
});

test('movement confirmation warns about a possible direct attack without claiming safety', async ({
  page,
}) => {
  await resetStorage(page);
  await startGame(page, ['Explorer'], ['sura'], 'movement-threat-touch');
  await enterNode(page, 'battle_quarry_gate');
  await takeTurn(page);
  await waitForIdle(page);
  await setLargeText(page, 'huge');

  await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    const hero = battle?.units.find((unit) => unit.faction === 'party');
    if (!app || !state || !battle || !hero) throw new Error('No quarry battle hero.');
    const turnIndex = battle.order.indexOf(hero.id);
    app.state = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((unit) =>
          unit.id === hero.id ? { ...unit, pos: { x: 1, y: 3 } } : unit,
        ),
        turnIndex,
      },
    };
    app.resync();
  });
  await settleLayout(page);

  await page.getByRole('button', { name: /^Move/ }).click();
  const canvas = page.locator('.map-canvas');
  const tapTile = async (pos: { x: number; y: number }) => {
    // Cancel removes the forecast and resizes the canvas. Read both the camera
    // and the element bounds only after that layout change has settled.
    await settleLayout(page);
    const box = await canvas.boundingBox();
    if (!box) throw new Error('No combat canvas.');
    const point = await tileCentre(page, pos);
    await canvas.tap({ position: { x: point.x - box.x, y: point.y - box.y } });
  };

  await tapTile({ x: 5, y: 3 });
  const warning = page.locator('.movement-threat-warning');
  await expect(warning).toContainText('Fire Nation Deserter could hit here.');
  await expect(page.locator('.movement-threat-qualification')).toHaveText(
    'Based on the current battlefield. Other actions and hazards can change this.',
  );

  await page.getByRole('button', { name: /^Cancel$/ }).click();
  await tapTile({ x: 4, y: 3 });
  await expect(page.locator('.movement-threat-empty')).toHaveText(
    'No immediate direct attack found',
  );
  await expect(page.locator('.confirm-bar')).not.toContainText('safe');
});

test('player action controls are disabled during an enemy turn', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Reviewer'], ['kaya'], 'enemy-controls-touch');
  await enterNode(page, 'battle_quarry_gate');
  await takeTurn(page);
  await waitForIdle(page);

  /*
   * Take the enemy's turn and read the HUD in one task. `resync()` renders the
   * action bar synchronously and no timer can run inside a single evaluate, so
   * the read cannot race the AI turn the scene schedules for a quarter-second
   * later. Split across two evaluates the round trip outlasted the whole enemy
   * turn on the slower WebKit iPad project, which is why this check reported
   * `moveDisabled: false` there while passing everywhere else.
   */
  const controls = await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    if (!app || !state || !battle) throw new Error('No battle for enemy-control fixture.');
    const turnIndex = battle.order.findIndex((id) => {
      const unit = battle.units.find((candidate) => candidate.id === id);
      return unit?.faction === 'enemy';
    });
    if (turnIndex < 0) throw new Error('Enemy turn fixture missing an enemy.');
    app.state = { ...state, battle: { ...battle, turnIndex } };
    app.resync();

    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.action-button')];
    return {
      moveDisabled: buttons.find((button) => button.textContent?.includes('Move'))?.disabled,
      endDisabled: buttons.find((button) => button.textContent?.includes('End turn'))?.disabled,
      enemyBanner: document.querySelector('.enemy-turn-banner')?.textContent ?? '',
    };
  });
  expect(controls.moveDisabled).toBe(true);
  expect(controls.endDisabled).toBe(true);
  expect(controls.enemyBanner).toContain('moving');
});

test('movement prevention disables Move and explains the status', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Rooted'], ['riko'], 'movement-status-touch');
  await enterNode(page, 'battle_quarry_gate');
  await takeTurn(page);
  await waitForIdle(page);

  await page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    const battle = state?.battle;
    if (!app || !state || !battle) throw new Error('No battle for movement-status fixture.');
    const activeId = battle.order[battle.turnIndex];
    const active = battle.units.find((unit) => unit.id === activeId);
    if (!active || active.faction !== 'party') throw new Error('Party unit is not active.');
    app.state = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((unit) =>
          unit.id === active.id
            ? {
                ...unit,
                pos: { x: 1, y: 3 },
                statuses: [{ id: 'rooted', duration: 2, stacks: 1 }],
              }
            : unit,
        ),
      },
    };
    app.resync();
  });

  const move = page.getByRole('button', { name: /^Move/ });
  await expect(move).toBeDisabled();
  await expect(move).toHaveAttribute('title', 'Rooted: Cannot walk, but can still use abilities.');
  await move.click({ force: true });
  await expect(page.locator('.confirm-bar')).toHaveCount(0);

  await page.getByRole('button', { name: /^Strike/ }).click();
  await expect(page.locator('.aim-hint')).toContainText(
    'Nothing is within 1 tiles of Riko. Move closer first.',
  );
  const moveInstead = page.getByRole('button', { name: 'Move instead' });
  await expect(moveInstead).toBeDisabled();
  await expect(moveInstead).toHaveAttribute(
    'title',
    'Rooted: Cannot walk, but can still use abilities.',
  );
  await moveInstead.click({ force: true });
  await expect(page.locator('.confirm-dialog')).toHaveCount(0);
});
