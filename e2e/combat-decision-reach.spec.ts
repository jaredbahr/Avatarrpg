import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import type { LargeText } from './helpers';
import { tileCentre } from './gallery/stage';

/**
 * #695: the page never scrolls, and a dock that has to be scrolled to find
 * Confirm is a dock a first-time player never finishes. At every text size on
 * the iPad's landscape sizes, and in portrait, the guided fight's coach and a
 * pending move's Confirm and Cancel must be hit-testable where they are drawn,
 * before anything scrolls the dock.
 */
const VIEWPORTS = [
  { width: 1180, height: 820 },
  { width: 1366, height: 1024 },
  { width: 820, height: 1180 },
] as const;
const SIZES: readonly LargeText[] = ['off', 'on', 'huge'];

/** The control's centre is on screen and a tap there lands on the control itself. */
async function expectReachable(control: Locator): Promise<{ x: number; y: number }> {
  await expect(control).toHaveCount(1);
  const reach = await control.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    const root = getComputedStyle(document.documentElement);
    const tap = parseFloat(root.getPropertyValue('--tap')) * parseFloat(root.fontSize);
    return {
      x,
      y,
      inside: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth,
      hit: hit !== null && (hit === node || node.contains(hit)),
      tall: !(node instanceof HTMLButtonElement) || box.height >= tap - 0.5,
      label: node.textContent?.trim() ?? '',
    };
  });
  expect(reach, `${reach.label} must be visible and tappable without scrolling`).toMatchObject({
    inside: true,
    hit: true,
    tall: true,
  });
  return { x: reach.x, y: reach.y };
}

for (const viewport of VIEWPORTS) {
  for (const size of SIZES) {
    test.describe(`${viewport.width}x${viewport.height} at ${size} text`, () => {
      test.use({ viewport });

      test('the coach and a pending move confirm without scrolling the dock', async ({ page }) => {
        await resetStorage(page, '?renderer=canvas');
        await startGame(page, ['A', 'B', 'C'], ['kaya', 'sura', 'bo'], 'decision-reach-695');
        await setLargeText(page, size);
        await enterNode(page, 'battle_forest_road');
        await takeTurn(page);

        const coach = page.locator('.combat-guidance');
        await expect(coach).toContainText('Choose Move, then tap a highlighted tile.');
        await expectReachable(coach.locator('span'));
        await expectReachable(coach.getByRole('button', { name: 'Skip guidance' }));
        await expectReachable(page.getByRole('button', { name: /^Move/ }));

        const actor = await page.evaluate(() => {
          const battle = window.fnt!.app.state!.battle!;
          const unit = battle.units.find((u) => u.id === battle.order[battle.turnIndex])!;
          return { id: unit.id, pos: unit.pos };
        });
        const step = { x: actor.pos.x, y: actor.pos.y + 1 };
        await page.getByRole('button', { name: /^Move/ }).click();
        await settleLayout(page);
        const canvas = page.locator('.map-canvas');
        const box = await canvas.boundingBox();
        if (!box) throw new Error('The combat board is not visible.');
        const point = await tileCentre(page, step);
        await canvas.tap({ position: { x: point.x - box.x, y: point.y - box.y } });

        const dock = page.locator('.combat-scene .hud');
        await expect(page.locator('.confirm-dialog')).toHaveCount(1);
        expect(await dock.evaluate((node) => node.scrollTop)).toBe(0);
        await expectReachable(coach.locator('span'));
        await expectReachable(page.getByRole('button', { name: 'Cancel', exact: true }));
        const confirm = await expectReachable(
          page.getByRole('button', { name: 'Confirm', exact: true }),
        );

        // Tap where Confirm is drawn: no scroll, no focus jump, just the move.
        await page.touchscreen.tap(confirm.x, confirm.y);
        await waitForIdle(page);
        await expect
          .poll(() =>
            page.evaluate(
              (id) => window.fnt!.app.state!.battle!.units.find((u) => u.id === id)!.pos,
              actor.id,
            ),
          )
          .toEqual(step);
        expect(await dock.evaluate((node) => node.scrollTop)).toBe(0);
      });
    });
  }
}
