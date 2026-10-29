import { paintedTileCentre } from './projection';
import { expect, test } from '@playwright/test';
import { CONTENT } from '../src/content';
import { buildGrid, tileAt } from '../src/core/rules/grid';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleLayout,
  startGame,
  waitForIdle,
} from './helpers';

const PARTY = ['nima', 'kaya', 'sura', 'bo', 'wen', 'jinu'];

type LargeText = 'off' | 'on' | 'huge';

for (const layout of [
  { name: '1280×800 normal', width: 1280, height: 800, largeText: 'off' as LargeText },
  { name: '1280×800 largest', width: 1280, height: 800, largeText: 'huge' as LargeText },
  { name: 'iPad landscape normal', width: 1194, height: 834, largeText: 'off' as LargeText },
  { name: 'iPad landscape largest', width: 1194, height: 834, largeText: 'huge' as LargeText },
  { name: 'iPad portrait normal', width: 834, height: 1194, largeText: 'off' as LargeText },
  { name: 'iPad portrait largest', width: 834, height: 1194, largeText: 'huge' as LargeText },
]) {
  test(`objective card stays out of the first map rows and clears map toasts on ${layout.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Explorer'], ['kaya'], `objective-dock-${layout.name}`);
    await enterNode(page, 'village_explore');
    await setLargeText(page, layout.largeText);
    await settleLayout(page);

    const objective = page.locator('.explore-objective');
    await expect(objective).toBeVisible();
    await expect(objective).toHaveAttribute('aria-expanded', 'true');

    const walked = await page.evaluate(() => {
      const app = window.fnt!.app;
      const state = app.state!;
      const from = state.location.pos;
      for (const pos of [
        { x: from.x + 1, y: from.y },
        { x: from.x, y: from.y + 1 },
        { x: from.x - 1, y: from.y },
        { x: from.x, y: from.y - 1 },
      ]) {
        const events = app.dispatch({ type: 'walkTo', pos });
        if (events.some((event) => event.type === 'partyWalked')) return true;
      }
      return false;
    });
    expect(walked).toBe(true);
    await waitForIdle(page);
    await settleLayout(page);
    await expect(objective).toHaveAttribute('aria-expanded', 'false');

    // The persistent button toggles in place, so the keyboard focus stays on
    // the same control while its contents are rebuilt.
    await objective.focus();
    await page.keyboard.press('Enter');
    await expect(objective).toHaveAttribute('aria-expanded', 'true');
    expect(await objective.evaluate((element) => document.activeElement === element)).toBe(true);
    await page.keyboard.press('Enter');
    await expect(objective).toHaveAttribute('aria-expanded', 'false');
    await settleLayout(page);

    const walkableCells = (() => {
      const map = CONTENT.maps.get('ba_dan_village');
      if (!map) throw new Error('Missing Ba Dan map');
      const grid = buildGrid(map);
      return Array.from({ length: grid.height }, (_, y) =>
        Array.from({ length: grid.width }, (_, x) => ({ x, y })).filter((pos) => {
          const tile = tileAt(grid, pos);
          return tile !== undefined && !tile.blocked;
        }),
      ).flat();
    })();
    const geometry = await page.evaluate((cells) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      const card = document.querySelector<HTMLElement>('.explore-objective');
      const camera = window.fnt!.app.rendererCamera();
      if (!canvas || !card || !camera) throw new Error('Missing exploration geometry');
      const mapBox = canvas.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const scaleX = mapBox.width / (canvas.width / dpr);
      const scaleY = mapBox.height / (canvas.height / dpr);
      const m = camera.groundTransform;
      const tilePx = camera.tilePx;
      const firstRows = cells
        .map((cell) => {
          const project = (x: number, y: number) => ({
            x: mapBox.left + (m.a * x * 64 + m.c * y * 64 + m.tx) * scaleX,
            y: mapBox.top + (m.b * x * 64 + m.d * y * 64 + m.ty) * scaleY,
          });
          const corners = [
            project(cell.x, cell.y),
            project(cell.x + 1, cell.y),
            project(cell.x, cell.y + 1),
            project(cell.x + 1, cell.y + 1),
          ];
          const raw = {
            left: Math.min(...corners.map((point) => point.x)),
            right: Math.max(...corners.map((point) => point.x)),
            top: Math.min(...corners.map((point) => point.y)),
            bottom: Math.max(...corners.map((point) => point.y)),
          };
          return {
            left: Math.max(mapBox.left, raw.left),
            right: Math.min(mapBox.right, raw.right),
            top: Math.max(mapBox.top, raw.top),
            bottom: Math.min(mapBox.bottom, raw.bottom),
          };
        })
        .filter(
          (tile) =>
            tile.right > tile.left &&
            tile.bottom > tile.top &&
            tile.bottom >= mapBox.top &&
            tile.top <= mapBox.top + tilePx * 2,
        );
      const intersects = (tile: { left: number; right: number; top: number; bottom: number }) =>
        tile.left < cardBox.right &&
        tile.right > cardBox.left &&
        tile.top < cardBox.bottom &&
        tile.bottom > cardBox.top;
      return {
        objective: { top: cardBox.top, bottom: cardBox.bottom },
        map: { top: mapBox.top },
        firstRows: firstRows.length,
        covered: firstRows.filter(intersects).length,
      };
    }, walkableCells);
    expect(geometry.firstRows).toBeGreaterThan(0);
    expect(geometry.objective.bottom).toBeLessThanOrEqual(geometry.map.top + 1);
    expect(geometry.covered).toBe(0);

    await page.evaluate(() =>
      window.fnt!.app.toasts.show('Objective clearance test', 'info', 10_000),
    );
    const toast = page.locator('.toasts .toast').last();
    await expect(toast).toBeVisible();
    await expect(page.locator('.toasts')).toHaveAttribute('data-place', 'map');
    // Playwright visibility allows opacity 0. The finite entry animation can
    // still report its invisible starting box, even with reduced motion.
    await toast.evaluate(async (element) => {
      const animations = element
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
    });
    const expectToastClear = async () => {
      const toastGeometry = await page.evaluate(() => {
        const toast = document.querySelector('.toasts .toast:last-child')?.getBoundingClientRect();
        const objective = document.querySelector('.explore-objective')?.getBoundingClientRect();
        const canvas = document.querySelector('.map-canvas')?.getBoundingClientRect();
        if (!toast || !objective || !canvas) throw new Error('Missing toast clearance geometry');
        return {
          toast: { top: toast.top, bottom: toast.bottom, left: toast.left, right: toast.right },
          objective: {
            top: objective.top,
            bottom: objective.bottom,
            left: objective.left,
            right: objective.right,
          },
          mapTop: canvas.top,
        };
      });
      expect(toastGeometry.toast.top).toBeGreaterThanOrEqual(toastGeometry.mapTop);
      const overlaps =
        toastGeometry.toast.left < toastGeometry.objective.right &&
        toastGeometry.toast.right > toastGeometry.objective.left &&
        toastGeometry.toast.top < toastGeometry.objective.bottom &&
        toastGeometry.toast.bottom > toastGeometry.objective.top;
      expect(overlaps).toBe(false);
    };
    await expectToastClear();
    await page.keyboard.press('Enter');
    await expect(objective).toHaveAttribute('aria-expanded', 'true');
    await settleLayout(page);
    await expectToastClear();
    await page.keyboard.press('Enter');
    await expect(objective).toHaveAttribute('aria-expanded', 'false');
    await settleLayout(page);
    await expectToastClear();
  });
}

test('objective hides during conversation, resumes, and starts expanded in a fresh scene', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Elias'], ['kaya'], 'objective-conversation');
  await enterNode(page, 'village_explore');
  const objective = page.locator('.explore-objective');
  await expect(objective).toBeVisible();
  await expect(objective).toHaveAttribute('aria-expanded', 'true');

  const walked = await page.evaluate(() => {
    const app = window.fnt!.app;
    const from = app.state!.location.pos;
    for (const pos of [
      { x: from.x + 1, y: from.y },
      { x: from.x, y: from.y + 1 },
      { x: from.x - 1, y: from.y },
      { x: from.x, y: from.y - 1 },
    ]) {
      if (app.dispatch({ type: 'walkTo', pos }).some((event) => event.type === 'partyWalked'))
        return true;
    }
    return false;
  });
  expect(walked).toBe(true);
  await waitForIdle(page);
  await settleLayout(page);
  await expect(objective).toHaveAttribute('aria-expanded', 'false');
  await enterNode(page, 'mira_intro');
  await expect(page.locator('.explore-conversation')).toBeVisible();
  await expect(objective).toBeHidden();

  const next = page.locator('[data-conversation-control="next"]');
  const total = Number((await page.locator('.line-count').textContent())?.split(' of ')[1]);
  expect(Number.isFinite(total)).toBe(true);
  expect(total).toBeGreaterThan(0);
  for (let line = 0; line < total; line++) await next.click();
  await expect(page.locator('.explore-conversation')).toBeHidden();
  await expect(objective).toBeVisible();

  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Elias'], ['kaya'], 'objective-fresh-scene');
  await enterNode(page, 'village_explore');
  const freshObjective = page.locator('.explore-objective');
  await expect(freshObjective).toBeVisible();
  await expect(freshObjective).toHaveAttribute('aria-expanded', 'true');
});

for (const layout of [
  { name: 'Surface', width: 1368, height: 912, largeText: 'off' as LargeText },
  { name: 'Surface at large text', width: 1368, height: 912, largeText: 'on' as LargeText },
  { name: 'Surface at largest text', width: 1368, height: 912, largeText: 'huge' as LargeText },
  { name: 'iPad landscape', width: 1194, height: 834, largeText: 'off' as LargeText },
  { name: 'iPad landscape at large text', width: 1194, height: 834, largeText: 'on' as LargeText },
  {
    name: 'iPad landscape at largest text',
    width: 1194,
    height: 834,
    largeText: 'huge' as LargeText,
  },
  {
    name: 'iPad portrait at largest text',
    width: 834,
    height: 1194,
    largeText: 'huge' as LargeText,
  },
  {
    name: 'narrow portrait at largest text',
    width: 390,
    height: 844,
    largeText: 'huge' as LargeText,
  },
]) {
  test(`exploration keeps its map and six-member dock usable on ${layout.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Jared'], PARTY, 'player-view-dock');
    await enterNode(page, 'village_explore');
    await setLargeText(page, layout.largeText);
    await settleLayout(page);

    const geometry = await page.evaluate(() => {
      const scene = document.querySelector('.explore-scene')?.getBoundingClientRect();
      const canvas = document.querySelector('.map-canvas')?.getBoundingClientRect();
      const dock = document.querySelector('.explore-dock')?.getBoundingClientRect();
      return {
        sceneWidth: scene?.width ?? 0,
        canvasWidth: canvas?.width ?? 0,
        canvasHeight: canvas?.height ?? 0,
        canvasBottom: canvas?.bottom ?? 0,
        dockTop: dock?.top ?? 0,
        dockHeight: dock?.height ?? 0,
        dockBottom: dock?.bottom ?? 0,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.canvasWidth).toBeCloseTo(geometry.sceneWidth, 0);
    expect(geometry.canvasHeight).toBeGreaterThan(layout.height * 0.4);
    expect(geometry.dockTop).toBeGreaterThanOrEqual(geometry.canvasBottom - 1);
    expect(geometry.dockBottom).toBeLessThanOrEqual(layout.height + 1);
    expect(geometry.pageWidth).toBeLessThanOrEqual(layout.width);
    // The world is the majority of the screen: the dock never takes more than
    // two fifths of it, at any text size.
    expect(geometry.dockHeight).toBeLessThanOrEqual(layout.height * 0.4 + 1);

    // Every action stays on screen. A button may wrap to a second row and the
    // hint may shorten, but nothing is allowed off the edge, which is where
    // "Party / 6 strong" went at Largest text on an iPad.
    const actions = await page.evaluate(() =>
      [...document.querySelectorAll('.explore-hud button')]
        .map((button) => button.getBoundingClientRect())
        .filter((box) => box.width > 0 && box.height > 0)
        .map((box) => ({ left: box.left, top: box.top, right: box.right, bottom: box.bottom })),
    );
    expect(actions.length).toBeGreaterThan(0);
    for (const box of actions) {
      expect(box.left).toBeGreaterThanOrEqual(-1);
      expect(box.top).toBeGreaterThanOrEqual(-1);
      expect(box.right).toBeLessThanOrEqual(layout.width + 1);
      expect(box.bottom).toBeLessThanOrEqual(layout.height + 1);
    }

    if (layout.largeText !== 'off') {
      // A card is a portrait, a name and a health bar — and nothing after it.
      // Stretched to the action column's height it grew a hand's width of
      // empty parchment below the bar, so measure the gap between the card's
      // own bottom edge and its last child's against the padding it declares.
      const cards = await page.evaluate(() =>
        [...document.querySelectorAll('.roster-row')].map((card) => {
          const style = getComputedStyle(card);
          const last = card.lastElementChild?.getBoundingClientRect();
          return {
            slack: card.getBoundingClientRect().bottom - (last?.bottom ?? 0),
            padded: parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth),
          };
        }),
      );
      expect(cards).toHaveLength(6);
      for (const card of cards) expect(card.slack).toBeLessThanOrEqual(card.padded + 2);
    }

    const cards = page.locator('.roster-row');
    await expect(cards).toHaveCount(6);
    await expect(cards.first()).toHaveClass(/active/);
    await expect(page.locator('.roster .pips')).toHaveCount(0);
    await cards.last().scrollIntoViewIfNeeded();
    await cards.last().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Pause', exact: true }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}

test('Follow party restores the view without moving the party or changing zoom', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], PARTY, 'follow-party');
  await enterNode(page, 'village_explore');
  await settleLayout(page);
  const canvas = page.locator('.map-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('No exploration canvas');
  // Exercise the real wheel adapter on either engine without depending on
  // Playwright's unsupported native wheel operation in mobile WebKit.
  await canvas.dispatchEvent('wheel', {
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    deltaY: -500,
    bubbles: true,
    cancelable: true,
  });
  await page.getByRole('button', { name: 'Follow party', exact: true }).click();
  const before = await page.evaluate(() => ({
    camera: window.fnt?.app.rendererCamera(),
    pos: window.fnt?.app.state?.location.pos,
  }));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 180, box.y + box.height / 2 - 100, { steps: 8 });
  await page.mouse.up();
  const panned = await page.evaluate(() => window.fnt?.app.rendererCamera());
  expect(panned?.offsetX).not.toBe(before.camera?.offsetX);
  await page.getByRole('button', { name: 'Follow party', exact: true }).click();
  const after = await page.evaluate(() => ({
    camera: window.fnt?.app.rendererCamera(),
    pos: window.fnt?.app.state?.location.pos,
  }));
  expect(after).toEqual(before);
});

test('resizing exploration keeps zoom and map focus while taps follow the painted tiles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1368, height: 912 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], ['kaya'], 'explore-resize');
  await enterNode(page, 'village_explore');
  await settleLayout(page);

  const canvas = page.locator('.map-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('No exploration canvas');
  await canvas.dispatchEvent('wheel', {
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    deltaY: -500,
    bubbles: true,
    cancelable: true,
  });
  await page.getByRole('button', { name: 'Follow party', exact: true }).click();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 180, box.y + box.height / 2 - 100, { steps: 8 });
  await page.mouse.up();
  await settleLayout(page);

  const view = () =>
    page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
      const camera = window.fnt?.app.rendererCamera();
      if (!canvas || !camera) throw new Error('No exploration camera');
      const rect = canvas.getBoundingClientRect();
      const m = camera.groundTransform;
      const x = rect.width / 2 - m.tx,
        y = rect.height / 2 - m.ty;
      const det = m.a * m.d - m.b * m.c;
      return {
        tilePx: camera.tilePx,
        width: rect.width,
        height: rect.height,
        centreX: (m.d * x - m.c * y) / det / 64,
        centreY: (m.a * y - m.b * x) / det / 64,
      };
    });
  const before = await view();
  await page.setViewportSize({ width: 1194, height: 834 });
  await settleLayout(page);
  const after = await view();
  expect(after.width).toBeLessThan(before.width);
  expect(after.tilePx).toBeCloseTo(before.tilePx, 3);
  expect(after.centreX).toBeCloseTo(before.centreX, 1);
  expect(after.centreY).toBeCloseTo(before.centreY, 1);

  const target = await paintedTileCentre(page, { x: 6, y: 7 });
  if (!target) throw new Error('No exploration camera');
  await page.mouse.click(target.x, target.y);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.location.pos))
    .toEqual({
      x: 6,
      y: 7,
    });
});
