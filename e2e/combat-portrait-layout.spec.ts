import { expect, test, type Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { RngCursor } from '../src/core/rng';
import { reachable } from '../src/core/rules/grid';
import { BattleDraft } from '../src/core/state/battleDraft';
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
    return {
      battle,
      rng: app.state?.rng ?? 0,
      camera,
      rect: { width: canvas.clientWidth, height: canvas.clientHeight },
    };
  });
  if (!view) throw new Error('Missing combat state for a legal movement target.');
  const draft = new BattleDraft(CONTENT, view.battle, new RngCursor(view.rng));
  const unitId = draft.order[draft.turnIndex];
  const actor = unitId ? draft.unit(unitId) : null;
  if (!actor) throw new Error('Missing active unit.');
  const target = [...reachable(draft.moveContext(actor), actor.pos, actor.move).values()]
    .filter(({ pos }) => pos.x !== actor.pos.x || pos.y !== actor.pos.y)
    .map(({ pos }) => ({
      pos,
      point: groundPoint(view.camera, { x: pos.x + 0.5, y: pos.y + 0.5 }),
    }))
    .filter(
      ({ point }) =>
        point.x > 8 &&
        point.x < view.rect.width - 8 &&
        point.y > 8 &&
        point.y < view.rect.height - 8,
    )
    .sort((a, b) => b.point.y - a.point.y)[0]?.pos;
  if (!target) throw new Error('No visible legal movement target.');
  return target;
}

async function showMovementConfirmation(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Move/ }).click();
  await settleLayout(page);
  const target = await lowestVisibleMoveTarget(page);
  const point = await paintedTileCentre(page, target);
  if (!point) throw new Error('Missing camera projection for the legal move.');
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
  await settleLayout(page);
}

async function startPortraitBattle(
  page: Page,
  width: number,
  height: number,
  text: 'normal' | 'huge',
) {
  await page.setViewportSize({ width, height });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Sura'], ['sura'], `combat-portrait-${width}-${text}`);
  if (text === 'huge') await setLargeText(page, 'huge');
  await enterNode(page, 'battle_forest_road');
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  await settleLayout(page);
}

for (const fixture of [
  { width: 820, height: 1180 },
  { width: 834, height: 1194 },
]) {
  for (const text of ['normal', 'huge'] as const) {
    test(`iPad portrait combat keeps the header compact and board legible at ${fixture.width}/${text}`, async ({
      page,
    }) => {
      await startPortraitBattle(page, fixture.width, fixture.height, text);
      const more = page.getByRole('button', { name: 'More', exact: true });
      await expect(more).toBeVisible();
      const header = await page.locator('.combat-bar').evaluate((bar) => {
        const box = bar.getBoundingClientRect();
        const title = bar.querySelector<HTMLElement>('.title-plate')?.getBoundingClientRect();
        const pause = bar.querySelector<HTMLElement>('.combat-pause')?.getBoundingClientRect();
        const toggle = bar
          .querySelector<HTMLElement>('.combat-more-toggle')
          ?.getBoundingClientRect();
        const topOf = (rect: DOMRect | undefined) => rect?.top ?? Number.NaN;
        return {
          bar: { top: box.top, bottom: box.bottom },
          title: title && {
            top: title.top,
            bottom: title.bottom,
            left: title.left,
            right: title.right,
          },
          pause: pause && {
            top: pause.top,
            bottom: pause.bottom,
            left: pause.left,
            right: pause.right,
            width: pause.width,
            height: pause.height,
          },
          toggle: toggle && {
            top: toggle.top,
            bottom: toggle.bottom,
            left: toggle.left,
            right: toggle.right,
            width: toggle.width,
            height: toggle.height,
          },
          rootTap:
            parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap')) *
            parseFloat(getComputedStyle(document.documentElement).fontSize),
          tops: [topOf(title), topOf(pause), topOf(toggle)],
        };
      });
      expect(header.title).toBeTruthy();
      expect(header.pause).toBeTruthy();
      expect(header.toggle).toBeTruthy();
      expect(header.tops.every((top) => Number.isFinite(top))).toBe(true);
      if (!header.title || !header.pause || !header.toggle)
        throw new Error('Portrait header title, Pause or More has no box.');
      const top = Math.max(header.title.top, header.pause.top, header.toggle.top);
      const bottom = Math.min(header.title.bottom, header.pause.bottom, header.toggle.bottom);
      expect(top).toBeLessThan(bottom);
      for (const item of [header.title, header.pause, header.toggle]) {
        expect(item.top).toBeGreaterThanOrEqual(header.bar.top);
        expect(item.bottom).toBeLessThanOrEqual(header.bar.bottom);
      }
      expect(header.title.right).toBeLessThanOrEqual(header.toggle.left + 1);
      expect(header.toggle.right).toBeLessThanOrEqual(header.pause.left + 1);
      expect(header.pause.width).toBeGreaterThanOrEqual(header.rootTap);
      expect(header.pause.height).toBeGreaterThanOrEqual(header.rootTap);
      expect(header.toggle.width).toBeGreaterThanOrEqual(header.rootTap);
      expect(header.toggle.height).toBeGreaterThanOrEqual(header.rootTap);

      await showMovementConfirmation(page);
      const geometry = await page.evaluate(() => {
        const canvas = document.querySelector('.map-canvas')!.getBoundingClientRect();
        const hud = document.querySelector('.combat-scene .hud')!;
        const unitPanel = hud.querySelector<HTMLElement>('.unit-panel')!;
        const unit = unitPanel.getBoundingClientRect();
        const actions = hud.querySelector<HTMLElement>('.action-bar')!.getBoundingClientRect();
        const readouts = [
          ...unitPanel.querySelectorAll<HTMLElement>(
            '.unit-panel-body .grow > .row .unit-name, .unit-panel-body .grow > .row .tiny',
          ),
        ].map((node) => {
          const box = node.getBoundingClientRect();
          return { text: node.textContent?.trim() ?? '', left: box.left, right: box.right };
        });
        return {
          boardRatio: canvas.height / innerHeight,
          hudOverflowY: getComputedStyle(hud).overflowY,
          unitHeight: unit.height,
          unitLeft: unit.left,
          unitRight: unit.right,
          readouts,
          actionsHeight: actions.height,
          hudScrollHeight: hud.scrollHeight,
          hudClientHeight: hud.clientHeight,
        };
      });
      expect(geometry.boardRatio).toBeGreaterThanOrEqual(0.55);
      expect(geometry.hudOverflowY).toBe('auto');
      expect(geometry.unitHeight).toBeLessThan(geometry.actionsHeight);
      expect(geometry.hudScrollHeight).toBeGreaterThanOrEqual(geometry.hudClientHeight);
      expect(geometry.readouts.some(({ text }) => text === 'Sura')).toBe(true);
      expect(geometry.readouts.some(({ text }) => text.startsWith('Level '))).toBe(true);
      for (const readout of geometry.readouts) {
        expect(readout.left).toBeGreaterThanOrEqual(geometry.unitLeft - 1);
        expect(readout.right).toBeLessThanOrEqual(geometry.unitRight + 1);
      }

      const confirmationControls = page.locator('.confirm-dialog button');
      expect(await confirmationControls.count()).toBeGreaterThan(0);
      const confirmationTapTargets = await confirmationControls.evaluateAll((buttons) => {
        const root = getComputedStyle(document.documentElement);
        const tap = parseFloat(root.getPropertyValue('--tap')) * parseFloat(root.fontSize);
        return {
          tap,
          boxes: buttons.map((button) => {
            const box = button.getBoundingClientRect();
            return { width: box.width, height: box.height };
          }),
        };
      });
      for (const control of await confirmationControls.all()) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        if (!box) throw new Error('Confirmation control lost its rendered box while scrolling.');
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(fixture.height);
      }
      expect(
        confirmationTapTargets.boxes.every(
          ({ width, height }) =>
            width >= confirmationTapTargets.tap && height >= confirmationTapTargets.tap,
        ),
      ).toBe(true);

      const list = page.locator('#combat-more');
      await more.focus();
      await page.keyboard.press('Enter');
      await expect(list).toBeVisible();
      await expect(list.locator('button:not([hidden])').first()).toBeFocused();
      const tapTargets = await page
        .locator('.combat-bar > button, #combat-more > button')
        .evaluateAll((buttons) => {
          const root = getComputedStyle(document.documentElement);
          const tap = parseFloat(root.getPropertyValue('--tap')) * parseFloat(root.fontSize);
          return {
            tap,
            boxes: buttons
              .filter((button) => {
                const box = button.getBoundingClientRect();
                return button.getClientRects().length > 0 && box.width > 0 && box.height > 0;
              })
              .map((button) => {
                const box = button.getBoundingClientRect();
                return { width: box.width, height: box.height };
              }),
          };
        });
      expect(tapTargets.boxes.length).toBeGreaterThan(0);
      expect(
        tapTargets.boxes.every(
          ({ width, height }) => width >= tapTargets.tap && height >= tapTargets.tap,
        ),
      ).toBe(true);
      const toast = page.locator('.toasts[aria-live="polite"]');
      await page.evaluate(() =>
        window.fnt!.app.toasts.show('Portrait menu clearance', 'info', 60_000),
      );
      await expect(toast).toBeVisible();
      const expectMenuClear = async () =>
        expect
          .poll(() =>
            page.evaluate(() => {
              const menu = document.querySelector('#combat-more')?.getBoundingClientRect();
              const message = document
                .querySelector('.toasts .toast:last-child')
                ?.getBoundingClientRect();
              if (!menu || !message) return 'missing';
              return menu.left < message.right &&
                message.left < menu.right &&
                menu.top < message.bottom &&
                message.top < menu.bottom
                ? 'overlap'
                : 'clear';
            }),
          )
          .toBe('clear');
      await expectMenuClear();

      // Rotate with More open and the toast alive, then back. Its disclosure
      // state and focus must survive while the menu's toast-clear band moves.
      await page.setViewportSize({ width: 1194, height: 834 });
      await settleLayout(page);
      await expect(more).toBeHidden();
      await expect(page.getByRole('button', { name: 'Tip', exact: true })).toBeVisible();
      await page.setViewportSize({ width: fixture.width, height: fixture.height });
      await settleLayout(page);
      await expect(more).toBeVisible();
      await expect(more).toHaveAttribute('aria-expanded', 'true');
      await expect(list).toBeVisible();
      await expectMenuClear();
      await page.evaluate(() => window.fnt!.app.toasts.clear());
      await page.keyboard.press('Escape');
      await expect(more).toBeFocused();
    });
  }
}

for (const fixture of [
  { name: 'iPad landscape', width: 1194, height: 834 },
  { name: 'Surface landscape', width: 1368, height: 912 },
]) {
  for (const text of ['normal', 'huge'] as const) {
    test(`${fixture.name} keeps combat view controls inline at ${text} text`, async ({ page }) => {
      await page.setViewportSize({ width: fixture.width, height: fixture.height });
      await resetStorage(page, '?renderer=canvas');
      await startGame(page, ['Sura'], ['sura'], `combat-${fixture.name}`);
      if (text === 'huge') await setLargeText(page, 'huge');
      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);
      await expect(page.getByRole('button', { name: 'More', exact: true })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Tip', exact: true })).toBeVisible();
      await expect(page.locator('#combat-more')).toHaveCSS('display', 'contents');
    });
  }
}
