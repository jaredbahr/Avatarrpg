import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { focusStagedUnit, tileCentre } from './gallery/stage';

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`long-pressing a prop opens its inspect card on ${renderer}`, async ({ page }) => {
    test.setTimeout(renderer === 'webgl' ? 90_000 : 30_000);
    allowSoftwareWebgl(test, renderer);
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Inspector'], ['kaya'], `prop-inspector-${renderer}`);
    await enterNode(page, 'battle_quarry_gate');
    await takeTurn(page);
    await waitForIdle(page);
    await settleLayout(page);

    const canvas = page.locator('.map-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('No combat canvas.');
    // Hold on a prop that is on screen with nobody standing on it: which one
    // that is depends on the camera, so ask the live battle rather than a map.
    const props = await page.evaluate(() => {
      const app = window.fnt?.app;
      const battle = app?.state?.battle;
      if (!app || !battle) return [];
      return battle.props
        .filter(
          (prop) => !battle.units.some((u) => u.pos.x === prop.pos.x && u.pos.y === prop.pos.y),
        )
        .map((prop) => ({ pos: prop.pos, name: app.content.props.get(prop.propId)?.name ?? '' }));
    });
    const held = props[0];
    if (!held) throw new Error('The Quarry Gate should place props.');
    expect(held.name).not.toBe('');
    // Bring it to the middle of the board: a prop near the rim can sit under a HUD bar.
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const before = await tileCentre(page, held.pos);
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + (centre.x - before.x), centre.y + (centre.y - before.y), {
      steps: 12,
    });
    await page.mouse.up();
    await settleLayout(page);
    const point = await tileCentre(page, held.pos);
    expect(point.x).toBeGreaterThan(box.x + 20);
    expect(point.x).toBeLessThan(box.x + box.width - 20);
    expect(point.y).toBeGreaterThan(box.y + 20);
    expect(point.y).toBeLessThan(box.y + box.height - 20);
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y) === document.querySelector('.map-canvas'),
        point,
      ),
      'The held tile must be on the interactive canvas',
    ).toBe(true);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForTimeout(650);

    const dialog = page.getByRole('dialog', { name: held.name });
    await expect(dialog).toBeVisible();
    await page.mouse.up();
    await expect(dialog.getByText('Break it', { exact: false }).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    // Pressing the map takes focus before the card opens, so there is no control
    // to return to: focus must simply not be stranded on the removed dialog.
    expect(
      await page.evaluate(
        () => document.activeElement !== null && document.contains(document.activeElement),
      ),
    ).toBe(true);
    expect(await page.locator('[role="dialog"]').count()).toBe(0);
  });

  test(`tapping a unit still opens its unit inspector on ${renderer}`, async ({ page }) => {
    test.setTimeout(renderer === 'webgl' ? 90_000 : 30_000);
    allowSoftwareWebgl(test, renderer);
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Inspector'], ['kaya'], `unit-inspector-${renderer}`);
    await enterNode(page, 'battle_quarry_gate');
    await takeTurn(page);
    await waitForIdle(page);

    const unit = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      const found = battle?.units.find(
        (candidate) => candidate.faction === 'party' && candidate.hp > 0,
      );
      return found ? { id: found.id, name: found.name, pos: found.pos } : null;
    });
    if (!unit) throw new Error('The Quarry Gate should place a living party unit.');
    await focusStagedUnit(page, unit.id, 10_000);
    await settleLayout(page);
    const point = await tileCentre(page, unit.pos);
    await page.mouse.click(point.x, point.y);
    await expect(page.getByRole('dialog', { name: new RegExp(`^${unit.name}`) })).toBeVisible();
  });
}
