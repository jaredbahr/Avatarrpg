import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame } from './helpers';

const PARTY = ['nima', 'kaya', 'sura', 'bo', 'wen', 'jinu'];

for (const layout of [
  { name: 'Surface', width: 1368, height: 912, huge: false },
  { name: 'iPad landscape', width: 1194, height: 834, huge: false },
  { name: 'iPad portrait at largest text', width: 834, height: 1194, huge: true },
  { name: 'narrow portrait at largest text', width: 390, height: 844, huge: true },
]) {
  test(`exploration keeps its map and six-member dock usable on ${layout.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Jared'], PARTY, 'player-view-dock');
    await enterNode(page, 'village_explore');
    if (layout.huge) {
      await page.evaluate(() => window.fnt?.app.updateSettings({ largeText: 'huge' }));
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
        dockBottom: dock?.bottom ?? 0,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.canvasWidth).toBeCloseTo(geometry.sceneWidth, 0);
    expect(geometry.canvasHeight).toBeGreaterThan(layout.height * 0.4);
    expect(geometry.dockTop).toBeGreaterThanOrEqual(geometry.canvasBottom - 1);
    expect(geometry.dockBottom).toBeLessThanOrEqual(layout.height + 1);
    expect(geometry.pageWidth).toBeLessThanOrEqual(layout.width);

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
