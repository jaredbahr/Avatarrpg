import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

for (const [nodeId, portrait] of [
  ['mira_intro', 'mira'],
  ['after_forest', 'kaya'],
] as const) {
  test(`${portrait} renders its imported portrait on the dialogue stage`, async ({ page }) => {
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Elias'], ['kaya']);
    await enterNode(page, nodeId);
    const canvas = page.locator(
      `.stage-portrait canvas[data-asset="portrait.${portrait}"], .conversation-compact-portrait canvas[data-asset="portrait.${portrait}"]`,
    );
    await expect(canvas).toBeVisible();
    // Compare actual canvas pixels with the shipped bitmap, not just the
    // existence of a canvas that could still contain the painter fallback.
    await expect
      .poll(async () =>
        canvas.evaluate(async (element, name) => {
          if (!(element instanceof HTMLCanvasElement)) return false;
          const image = new Image();
          image.src = new URL(`art/portraits/${name}.png`, document.baseURI).href;
          await image.decode();
          const expected = document.createElement('canvas');
          expected.width = element.width;
          expected.height = element.height;
          expected.getContext('2d')?.drawImage(image, 0, 0, expected.width, expected.height);
          return element.toDataURL() === expected.toDataURL();
        }, portrait),
      )
      .toBe(true);
  });
}
