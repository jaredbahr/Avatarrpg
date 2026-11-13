import { expect, test, type Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { reachable } from '../src/core/rules/grid';
import { BattleDraft } from '../src/core/state/battleDraft';
import { allowSoftwareWebgl } from './budget';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleLayout,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import { groundPoint, paintedTileCentre } from './projection';

async function lowestVisibleMoveTarget(page: Page): Promise<{ x: number; y: number }> {
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
      rect: { width: rect.width, height: rect.height },
    };
  });
  if (!view) throw new Error('Missing combat state for movement target.');

  const draft = new BattleDraft(CONTENT, view.battle, new RngCursor(view.rng));
  const actingId = draft.order[draft.turnIndex];
  const acting = actingId ? draft.unit(actingId) : null;
  if (!acting) throw new Error('Missing acting unit for movement target.');

  const visible = [...reachable(draft.moveContext(acting), acting.pos, acting.move).values()]
    .filter((cell) => cell.pos.x !== acting.pos.x || cell.pos.y !== acting.pos.y)
    .map((cell) => ({
      cell,
      point: groundPoint(view.camera, { x: cell.pos.x + 0.5, y: cell.pos.y + 0.5 }),
    }))
    .filter(
      ({ point }) =>
        point.x > 8 &&
        point.x < view.rect.width - 8 &&
        point.y > 8 &&
        point.y < view.rect.height - 8,
    )
    .sort((a, b) => b.point.y - a.point.y);
  const target = visible[0]?.cell.pos;
  if (!target) throw new Error('No visible legal movement target.');
  return target;
}

test.describe('resize across integer zoom stops at DPR 2', () => {
  // A 96px preference floors to 64px at DPR 1 (ADR 0088), so these two
  // viewports only exercise a scale-changing refit at DPR 2.
  test.use({ deviceScaleFactor: 2 });
});

test.describe('motion-enabled compact save load at DPR 2', () => {
  test.use({ deviceScaleFactor: 2 });
});

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const largeText of ['normal', 'large', 'huge'] as const) {
    test(`reveals a legal lower move through confirmation reflow on ${renderer}/${largeText}`, async ({
      page,
    }) => {
      allowSoftwareWebgl(test, renderer);
      await page.setViewportSize({ width: 1280, height: 720 });
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Sura'], ['sura'], `move-reveal-${renderer}-${largeText}`);
      if (largeText !== 'normal') await setLargeText(page, largeText === 'huge' ? 'huge' : 'on');
      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);
      await settleLayout(page);

      // Start from the real acting-unit focus so the target is near the lower
      // edge of the 1280x720 battlefield, as it is in the compact UI.
      await page.getByRole('button', { name: 'Focus Sura', exact: true }).click();
      await settleLayout(page);
      await page.getByRole('button', { name: /^Move/ }).click();
      await settleLayout(page);

      const target = await lowestVisibleMoveTarget(page);
      const before = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
      const canvas = page.locator('.map-canvas');
      const beforeBox = await canvas.boundingBox();
      const beforePoint = await paintedTileCentre(page, target);
      if (!beforeBox || !beforePoint) throw new Error('Missing compact movement geometry.');
      expect(beforePoint.x).toBeGreaterThan(beforeBox.x);
      expect(beforePoint.x).toBeLessThan(beforeBox.x + beforeBox.width);
      expect(beforePoint.y).toBeGreaterThan(beforeBox.y);
      expect(beforePoint.y).toBeLessThan(beforeBox.y + beforeBox.height);

      await page.mouse.click(beforePoint.x, beforePoint.y);
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
      await settleLayout(page);

      const after = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
      const afterBox = await canvas.boundingBox();
      const afterPoint = await paintedTileCentre(page, target);
      if (!afterBox || !afterPoint) throw new Error('Missing reflowed movement geometry.');
      expect(afterPoint.x).toBeGreaterThan(afterBox.x + 4);
      expect(afterPoint.x).toBeLessThan(afterBox.x + afterBox.width - 4);
      expect(afterPoint.y).toBeGreaterThan(afterBox.y + 4);
      expect(afterPoint.y).toBeLessThan(afterBox.y + afterBox.height - 4);
      expect(
        await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y) === document.querySelector('.map-canvas'),
          afterPoint,
        ),
      ).toBe(true);
      expect(after.tilePx).toBeCloseTo(before.tilePx, 5);

      const compactMetrics = await page.evaluate(() => {
        const body = document.querySelector<HTMLElement>('.confirm-dialog > .confirm-body');
        const dialog = document.querySelector<HTMLElement>('.confirm-dialog');
        const controls = [
          ...document.querySelectorAll<HTMLButtonElement>('.confirm-dialog button'),
        ];
        return {
          dialogClass: dialog?.className ?? '',
          bodyOverflow: body ? body.scrollWidth > body.clientWidth : true,
          dialogHeight: dialog?.getBoundingClientRect().height ?? 0,
          controls: controls.map((control) => {
            const box = control.getBoundingClientRect();
            return { width: box.width, height: box.height };
          }),
        };
      });
      expect(compactMetrics.dialogClass).toContain('confirm-dialog');
      expect(compactMetrics.bodyOverflow).toBe(false);
      expect(
        compactMetrics.controls.every(({ width, height }) => width >= 44 && height >= 44),
      ).toBe(true);
      if (largeText === 'normal') expect(afterBox.height).toBeGreaterThan(300);
      if (largeText === 'large') expect(afterBox.height).toBeGreaterThan(230);

      if (process.env.FNT_REVIEW_DIR)
        await page.screenshot({
          path: `${process.env.FNT_REVIEW_DIR}/move-reveal-${renderer}-${largeText}.png`,
        });

      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      await waitForIdle(page);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const battle = window.fnt!.app.state!.battle!;
            const unit = battle.units.find((candidate) => candidate.characterId === 'sura');
            return unit?.pos ?? null;
          }),
        )
        .toEqual(target);
    });
  }
}
