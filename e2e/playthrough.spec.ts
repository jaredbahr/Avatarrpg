import { paintedTileCentre, groundPoint } from './projection';
import { expect, test } from '@playwright/test';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { reachable } from '../src/core/rules/grid';
import { BattleDraft } from '../src/core/state/battleDraft';
import {
  battleActive,
  enterNode,
  resetStorage,
  settleDialog,
  settleLayout,
  snapshot,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';

/**
 * The spec the plan asks for: two players get through setup, reach the first
 * fight, move, use an ability, save to a slot, reload the whole page, load
 * that slot, and find everything exactly where they left it.
 *
 * Save/load is the one that matters. A family stopping mid-fight on a Sunday
 * and finding the party somewhere else on Monday is the failure this catches.
 */
test.describe('a session', () => {
  test('creates a party through the real setup flow', async ({ page }) => {
    await resetStorage(page);

    await page.getByRole('button', { name: /new game/i }).click();
    await page.getByRole('button', { name: '2 players' }).click();
    await page.getByRole('button', { name: /^Continue$/ }).click();

    for (const name of ['Elias', 'Lorelai']) {
      const ready = page.getByRole('button', { name: /I've got it/i });
      if (await ready.count()) await ready.click();

      await page.locator('input[type=text]').fill(name);
      await page.getByRole('button', { name: /^Next$/ }).click();

      // Element, then character.
      await page.locator('.pick-card').first().click();
      await page.getByRole('button', { name: /^Next$/ }).click();
      await page.locator('.pick-card:not(.taken)').first().click();
      await page.getByRole('button', { name: /^Confirm$/ }).click();
    }

    await expect(page.getByRole('heading', { name: /the party/i })).toBeVisible();
    await page.getByRole('button', { name: /^Begin$/ }).click();

    const state = await snapshot(page);
    expect(state.players).toEqual(['Elias', 'Lorelai']);
    expect(state.partyPositions).toHaveLength(2);
    expect(state.screen).toBe('dialogue');
  });

  test('will not let two players take the same character', async ({ page }) => {
    await resetStorage(page);

    await page.getByRole('button', { name: /new game/i }).click();
    await page.getByRole('button', { name: '2 players' }).click();
    await page.getByRole('button', { name: /^Continue$/ }).click();

    // Two players means a hand-off card before each of them, including the first.
    await page.getByRole('button', { name: /I've got it/i }).click();

    // First player takes the first firebender.
    await page.locator('input[type=text]').fill('Frehley');
    await page.getByRole('button', { name: /^Next$/ }).click();
    await page.locator('.pick-card').first().click();
    await page.getByRole('button', { name: /^Next$/ }).click();
    const firstName = await page.locator('.pick-card h3').first().textContent();
    await page.locator('.pick-card').first().click();
    await page.getByRole('button', { name: /^Confirm$/ }).click();

    // Second player, same element: that character must now be unavailable.
    await page.getByRole('button', { name: /I've got it/i }).click();
    await page.locator('input[type=text]').fill('Violet');
    await page.getByRole('button', { name: /^Next$/ }).click();
    await page.locator('.pick-card').first().click();
    await page.getByRole('button', { name: /^Next$/ }).click();

    const taken = page.locator('.pick-card.taken');
    await expect(taken).toHaveCount(1);
    await expect(taken.locator('h3')).toHaveText(firstName ?? '');
    await expect(taken).toBeDisabled();
  });

  test('fights, saves, reloads, and loads back into the same position', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias', 'Lorelai'], ['kaya', 'bo'], 'playthrough');
    await enterNode(page, 'battle_forest_road');

    await takeTurn(page);
    const before = await snapshot(page);
    expect(before.screen).toBe('combat');
    expect(before.round).toBe(1);

    // Move: choose a tile the real rules say is reachable, tap it, confirm.
    // A fixed screen fraction can land behind another unit as the battle changes.
    await waitForIdle(page);
    await page.getByRole('button', { name: /^Move/ }).click();
    // Move reflows the HUD and the camera refits on the following frame.
    await settleLayout(page);
    const view = await page.evaluate(() => {
      const app = window.fnt?.app;
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      const camera = app?.rendererCamera();
      const battle = app?.state?.battle;
      if (!app || !canvas || !camera || !battle) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        battle,
        rng: app.state?.rng ?? 0,
        camera,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
    expect(view).not.toBeNull();
    if (!view) return;
    const draft = new BattleDraft(CONTENT, view.battle, new RngCursor(view.rng));
    const actingId = draft.order[draft.turnIndex];
    const acting = actingId ? draft.unit(actingId) : null;
    expect(acting).toBeTruthy();
    if (!acting) return;
    const target = [...reachable(draft.moveContext(acting), acting.pos, acting.move).values()].find(
      (cell) => cell.pos.x !== acting.pos.x,
    );
    expect(target, 'no reachable tile changes the acting unit’s x position').toBeTruthy();
    if (!target) return;
    const targetPoint = groundPoint(view.camera, { x: target.pos.x + 0.5, y: target.pos.y + 0.5 });
    await page.mouse.click(view.rect.x + targetPoint.x, view.rect.y + targetPoint.y);
    await expect(page.locator('.confirm-bar')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Confirm$/ })).toBeEnabled();
    await page.getByRole('button', { name: /^Confirm$/ }).click();

    await expect
      .poll(async () => (await snapshot(page)).partyPositions[0]?.x)
      .not.toBe(before.partyPositions[0]?.x);

    const moved = await snapshot(page);

    // Save to slot 1 through the pause menu.
    await page.getByRole('button', { name: /^Pause$/ }).click();
    await page.getByRole('button', { name: /^Save game$/ }).click();
    await page
      .locator('.slot')
      .filter({ hasText: 'Slot 1' })
      .getByRole('button', { name: /save here/i })
      .click();
    await expect(page.locator('.slot').filter({ hasText: 'Slot 1' })).not.toContainText('Empty');
    await page.getByRole('button', { name: /^Close$/ }).click();

    // A full reload: this is what a closed lid and a flat battery look like.
    await page.reload();
    await page.waitForFunction(() => Boolean(window.fnt?.app));

    await page.getByRole('button', { name: /load a save/i }).click();
    await page
      .locator('.slot')
      .filter({ hasText: 'Slot 1' })
      .getByRole('button', { name: /^Load$/ })
      .click();

    await expect.poll(async () => (await snapshot(page)).screen).toBe('combat');
    const after = await snapshot(page);

    expect(after.partyPositions).toEqual(moved.partyPositions);
    expect(after.round).toBe(moved.round);
    expect(after.activeUnitId).toBe(moved.activeUnitId);
    expect(after.players).toEqual(['Elias', 'Lorelai']);
  });

  test('closes to an enemy and the preview matches what actually happens', async ({ page }) => {
    await resetStorage(page);
    // Keep the original party and seeded combat outcome used by this contract check.
    await startGame(page, ['Elias', 'Lorelai', 'Frehley'], ['bo', 'nilak', 'kaya'], 'ability-spec');
    await enterNode(page, 'battle_forest_road');

    // This test is about the preview contract, not enemy AI playback. Stage the
    // same face-off used by the gallery: give Bo the turn and place one living
    // enemy on an open, unoccupied tile within Rock Throw range.
    await page.evaluate(() => {
      const app = window.fnt?.app;
      const state = app?.state;
      const battle = state?.battle;
      if (!app || !state || !battle) throw new Error('No fight is running.');
      const bo = battle.units.find((unit) => unit.abilities.includes('rock_throw'));
      const enemy = battle.units.find((unit) => unit.faction === 'enemy' && unit.hp > 0);
      if (!bo || !enemy) throw new Error('The fight needs Bo and a living enemy.');

      const candidates = [
        { x: bo.pos.x + 4, y: bo.pos.y },
        { x: bo.pos.x - 4, y: bo.pos.y },
        { x: bo.pos.x, y: bo.pos.y + 4 },
        { x: bo.pos.x, y: bo.pos.y - 4 },
      ];
      const enemyPos = candidates.find((pos) => {
        if (pos.x < 0 || pos.y < 0 || pos.x >= battle.grid.width || pos.y >= battle.grid.height)
          return false;
        const tile = battle.grid.tiles[pos.y * battle.grid.width + pos.x];
        return (
          tile !== undefined &&
          !tile.blocked &&
          !battle.units.some(
            (unit) =>
              unit.id !== enemy.id && unit.hp > 0 && unit.pos.x === pos.x && unit.pos.y === pos.y,
          )
        );
      });
      if (!enemyPos) throw new Error('No open tile can stage an enemy in Rock Throw range.');

      const turnIndex = battle.order.indexOf(bo.id);
      if (turnIndex < 0) throw new Error('Bo is missing from the turn order.');
      const units = battle.units.map((unit) => {
        if (unit.id === bo.id)
          return { ...unit, ap: unit.base.maxAp, move: unit.base.maxMove, cooldowns: {} };
        return unit.id === enemy.id ? { ...unit, pos: enemyPos } : unit;
      });
      app.state = { ...state, battle: { ...battle, units, turnIndex } };
      app.resync();
    });

    expect(await battleActive(page), 'the staged fight is not active').toBe(true);
    // The staged turn still opens with the hot-seat hand-off card: take it as a player would.
    expect(await takeTurn(page)).toBe(true);

    // Aim through the UI and read the preview the player would be reading.
    await waitForIdle(page);
    const rockThrow = page.getByRole('button', { name: /rock throw/i });
    await expect(rockThrow).toBeVisible();
    await rockThrow.click();
    // The aim hint changes the iPad map height. Wait for ResizeObserver and
    // backing-store presentation before projecting a tile into page pixels.
    await settleLayout(page);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
          if (!canvas) return false;
          const rect = canvas.getBoundingClientRect();
          const dpr = Math.min(3, window.devicePixelRatio || 1);
          return (
            Math.abs(canvas.width / dpr - rect.width) < 1 &&
            Math.abs(canvas.height / dpr - rect.height) < 1
          );
        }),
      )
      .toBe(true);

    const target = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      const unit = battle?.units.find((u) => u.id === battle.order[battle.turnIndex]);
      if (!battle || !unit) return null;
      const reach = (a: { x: number; y: number }) =>
        Math.max(Math.abs(a.x - unit.pos.x), Math.abs(a.y - unit.pos.y));
      const enemy = battle.units
        .filter((u) => u.faction === 'enemy' && u.hp > 0 && reach(u.pos) <= 5)
        .sort((a, b) => reach(a.pos) - reach(b.pos))[0];
      return enemy ? { id: enemy.id, pos: enemy.pos, hp: enemy.hp } : null;
    });

    expect(target).not.toBeNull();
    if (!target) return;

    // Tap the enemy's tile on the canvas, exactly as a player would.
    const screenPoint = await paintedTileCentre(page, target.pos);

    expect(screenPoint, 'could not map the target tile to the screen').not.toBeNull();
    if (!screenPoint) return;

    await waitForIdle(page);
    await page.mouse.click(screenPoint.x, screenPoint.y);

    const confirmBar = page.locator('.confirm-bar').filter({ hasText: /Confirm/ });
    await expect(confirmBar).toBeVisible();
    await settleDialog(confirmBar);

    // The chip reads like "Bandit: 90% · ~9 dmg".
    const chip = await confirmBar.locator('.chip-hostile').first().textContent();
    expect(chip, 'no preview chip for the target').toBeTruthy();

    const previewedDamage = Number(/~(\d+)\s*dmg/.exec(chip ?? '')?.[1] ?? NaN);
    const previewedHit = Number(/(\d+)%/.exec(chip ?? '')?.[1] ?? NaN);
    expect(Number.isFinite(previewedDamage)).toBe(true);
    expect(previewedHit).toBeGreaterThan(0);
    expect(previewedHit).toBeLessThanOrEqual(100);

    const confirm = confirmBar.getByRole('button', { name: /^Confirm$/ });
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect
      .poll(async () => page.evaluate(() => window.fnt?.app.state?.log.length ?? 0))
      .toBeGreaterThan(0);

    const outcome = await page.evaluate((id) => {
      const state = window.fnt?.app.state;
      const unit = state?.battle?.units.find((u) => u.id === id);
      return { hp: unit?.hp ?? -1, log: state?.log.slice(-8) ?? [] };
    }, target.id);

    expect(outcome.log.join(' ')).toMatch(/Rock Throw/);

    const missed = /misses/i.test(outcome.log.join(' '));
    if (missed) {
      expect(outcome.hp).toBe(target.hp);
    } else {
      const dealt = target.hp - outcome.hp;
      expect(dealt).toBeGreaterThan(0);
      // Damage rolls +/-10% variance, and a crit multiplies by 1.5. Anything
      // outside that band means the preview is lying to the player.
      expect(dealt).toBeGreaterThanOrEqual(Math.floor(previewedDamage * 0.85));
      expect(dealt).toBeLessThanOrEqual(Math.ceil(previewedDamage * 1.7));
    }
  });

  test('rotates the decider and records the choice', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias', 'Lorelai', 'Frehley'], ['kaya', 'bo', 'riko'], 'choice-spec');
    await enterNode(page, 'ruon_choice');

    await expect(page.locator('.decider-banner')).toBeVisible();
    const decider = await page.locator('.decider-banner strong').textContent();
    expect(['Elias', 'Lorelai', 'Frehley']).toContain(decider?.trim());

    await page.locator('.choice-option').first().click();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const state = window.fnt?.app.state as unknown as { flags: Record<string, unknown> };
          return Boolean(state.flags.ruon_spared);
        }),
      )
      .toBe(true);
  });

  /*
   * The point of showing options you cannot take is that somebody reads them and
   * wants to come back with a different party. That only works if they are
   * legible, say why, and cannot be tapped by mistake — so all three are asserted
   * rather than just the disabled attribute.
   */
  test('shows the roads this party cannot walk, and says why', async ({ page }) => {
    await resetStorage(page);
    // A waterbender and a nonbender: neither gated option at the gate is theirs.
    await startGame(page, ['Elias', 'Lorelai'], ['nilak', 'riko'], 'locked-spec');
    await enterNode(page, 'gate_parley');

    const options = page.locator('.choice-option');
    await expect(options).toHaveCount(3);

    const locked = page.locator('.choice-option.is-locked');
    await expect(locked).toHaveCount(2);

    // Each locked option names who it would take and why it is closed.
    await expect(locked.first().locator('.speaker-tag')).toHaveText(/firebender/i);
    await expect(locked.first().locator('.locked-hint')).toContainText('firebender');
    await expect(locked.nth(1).locator('.speaker-tag')).toHaveText(/earthbender/i);

    // Still a full-size control, per the touch rules.
    const box = await locked.first().boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);

    // And tapping it does nothing at all.
    const before = await page.evaluate(() => window.fnt?.app.state?.story.nodeId);
    await locked.first().click({ force: true });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe(before);
  });

  test('tags an available option with the party member who would say it', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias', 'Lorelai'], ['kaya', 'bo'], 'tagged-spec');
    await enterNode(page, 'gate_parley');

    await expect(page.locator('.choice-option.is-locked')).toHaveCount(0);
    // Kaya is the firebender, Bo the earthbender: the tags name them, not their
    // elements, because "who walks up" is the decision being made.
    await expect(page.locator('.speaker-tag').first()).toContainText('Kaya');
    await expect(page.locator('.speaker-tag').nth(1)).toContainText('Bo');
  });
});
