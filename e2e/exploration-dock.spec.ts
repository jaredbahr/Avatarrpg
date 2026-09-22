import { paintedTileCentre } from './projection';
import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame } from './helpers';

const PARTY = ['nima', 'kaya', 'sura', 'bo', 'wen', 'jinu'];

type LargeText = 'off' | 'on' | 'huge';

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
    if (layout.largeText !== 'off') {
      await page.evaluate(
        (largeText) => window.fnt?.app.updateSettings({ largeText }),
        layout.largeText,
      );
    }
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
