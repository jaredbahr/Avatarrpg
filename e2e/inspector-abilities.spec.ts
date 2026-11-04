import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { knownAbilities } from '../src/core/rules/abilities';
import { upcomingOrder } from '../src/core/rules/turnOrder';
import type { Unit } from '../src/core/types';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

async function expectKit(dialog: Locator, unit: Unit): Promise<void> {
  const expected = knownAbilities(CONTENT, unit);
  await expect(dialog.locator('.ability-card h3')).toHaveText(
    expected.map((ability) => ability.name),
  );
}

async function expectShoveCard(dialog: Locator): Promise<void> {
  const shove = CONTENT.abilities.get('shove');
  if (!shove) throw new Error('The universal Shove definition is missing');
  const card = dialog.getByRole('heading', { name: shove.name, exact: true }).locator('..');
  await expect(card).toHaveCount(1);
  await card.scrollIntoViewIfNeeded();
  const push = shove.effects.find((effect) => effect.kind === 'push');
  if (!push) throw new Error('Shove must describe its real push effect');
  // These independent reads share the same scrolled card. Batch their native
  // Playwright assertions so software WebGL does not charge a frame per read.
  await Promise.all([
    expect(card.locator('.chip-ap')).toHaveText(`${shove.apCost} AP`),
    expect(card.getByText(`Range ${shove.range}`, { exact: true })).toBeVisible(),
    expect(card.getByText(shove.description, { exact: true })).toBeVisible(),
    expect(card.locator('.effect-list li')).toHaveText(`Pushes ${push.distance} tiles away`),
  ]);
}

async function inspectCombatUnit(page: Page, unit: Unit): Promise<Locator> {
  // The caller selects the first matching name in the actual upcoming strip,
  // so duplicate enemy names still focus the unit whose foot is projected.
  await page
    .getByRole('button', { name: `Focus ${unit.name}`, exact: true })
    .first()
    .click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    return (
      Math.abs(canvas.width / dpr - rect.width) < 1 &&
      Math.abs(canvas.height / dpr - rect.height) < 1
    );
  });
  const point = await paintedTileCentre(page, unit.pos);
  if (!point) throw new Error('The inspected unit has no painted foot position');
  expect(
    await page.evaluate(
      (point) =>
        document.elementFromPoint(point.x, point.y) === document.querySelector('.map-canvas'),
      point,
    ),
    'the unit foot must be on the visible canvas',
  ).toBe(true);
  await page.mouse.click(point.x, point.y);
  const dialog = page.getByRole('dialog');
  await Promise.all([
    expect(dialog).toHaveCount(1),
    expect(dialog.getByRole('heading', { level: 2 })).toContainText(unit.name),
  ]);
  return dialog;
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test.describe(`unit inspector ability truth on ${renderer}`, () => {
    test.beforeEach(async ({ page }) => {
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Inspector'], ['kaya'], 'inspector-ability-truth');
    });

    test('the exploration roster shows the full party kit and restores focus', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await enterNode(page, 'village_explore');
      await waitForIdle(page);
      await expect
        .poll(() => page.evaluate(() => window.fnt!.app.rendererBackend()))
        .toBe(renderer);
      const before = await page.evaluate(() => window.fnt!.app.state!);
      const unit = before.party[0];
      if (!unit) throw new Error('The fresh party is empty');
      const roster = page.locator('.roster-row').first();
      await roster.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();
      await expectKit(dialog, unit);
      await expectShoveCard(dialog);
      expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(before);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(roster).toBeFocused();
      expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(before);
      expect(errors).toEqual([]);
    });

    test('the combat party inspector matches the actual ability hotbar', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page, { settleCamera: false })).toBe(true);
      await waitForIdle(page);
      await expect
        .poll(() => page.evaluate(() => window.fnt!.app.rendererBackend()))
        .toBe(renderer);
      const before = await page.evaluate(() => window.fnt!.app.state!);
      const battle = before.battle;
      if (!battle) throw new Error('The authored forest battle did not start');
      const unit = battle.units.find(
        (candidate) => candidate.id === battle.order[battle.turnIndex],
      );
      if (!unit || unit.faction !== 'party') throw new Error('No party unit is acting');
      const abilities = knownAbilities(CONTENT, unit);
      const hotbar = page.locator('.action-bar .action-row');
      await Promise.all([
        expect(hotbar.locator('button[class*="element-"]')).toHaveCount(abilities.length),
        ...abilities.map((ability) =>
          expect(
            hotbar.getByRole('button', { name: new RegExp(`^${ability.name}\\b`) }),
          ).toHaveCount(1),
        ),
      ]);
      const dialog = await inspectCombatUnit(page, unit);
      await expectKit(dialog, unit);
      await expectShoveCard(dialog);
      expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(before);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      const [, afterClose] = await Promise.all([
        expect(page.getByRole('dialog')).toHaveCount(0),
        page.evaluate(() => window.fnt!.app.state),
      ]);
      expect(afterClose).toEqual(before);
      expect(errors).toEqual([]);
    });

    test('an enemy inspector retains exactly its authored techniques', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page, { settleCamera: false })).toBe(true);
      await waitForIdle(page);
      await expect
        .poll(() => page.evaluate(() => window.fnt!.app.rendererBackend()))
        .toBe(renderer);
      const before = await page.evaluate(() => window.fnt!.app.state!);
      const battle = before.battle;
      if (!battle) throw new Error('The authored forest battle did not start');
      const unit = upcomingOrder(battle, battle.units.length).find(
        (candidate) => candidate.faction === 'enemy' && candidate.hp > 0 && candidate.size === 1,
      );
      if (!unit) throw new Error('No living authored enemy to inspect');
      const authored = unit.abilities.map((id) => CONTENT.abilities.get(id)?.name);
      expect(authored.every(Boolean)).toBe(true);
      const dialog = await inspectCombatUnit(page, unit);
      await expect(
        dialog.getByRole('heading', { name: 'What it can do', exact: true }),
      ).toBeVisible();
      await expectKit(dialog, unit);
      await expect(dialog.locator('.ability-card h3')).toHaveText(authored as string[]);
      for (const id of CONTENT.universalAbilities.filter((id) => !unit.abilities.includes(id))) {
        const ability = CONTENT.abilities.get(id);
        if (!ability) throw new Error(`Missing universal ability ${id}`);
        await expect(dialog.getByRole('heading', { name: ability.name, exact: true })).toHaveCount(
          0,
        );
      }
      expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(before);
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(before);
      expect(errors).toEqual([]);
    });
  });
}
