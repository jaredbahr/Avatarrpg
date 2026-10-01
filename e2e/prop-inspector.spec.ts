import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import { tileCentre } from './gallery/stage';

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
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();

    const dialog = page.getByRole('dialog', { name: held.name });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Break it', { exact: false }).first()).toBeVisible();
  });
}
