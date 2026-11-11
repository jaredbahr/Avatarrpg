import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

for (const [nodeId, portrait] of [
  ['mira_intro', 'mira'],
  ['after_forest', 'kaya'],
] as const) {
  test.describe(portrait, () => {
    // iPad landscape at dpr 2: the 15rem stage portrait is 480 device px, exactly 3x the
    // 160 px art (ADR 0107), so the whole canvas has one exact, independent reference.
    test.use({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });

    test(`${portrait} renders its imported portrait on the dialogue stage`, async ({ page }) => {
      await resetStorage(page, '?renderer=canvas');
      await startGame(page, ['Elias'], ['kaya']);
      await enterNode(page, nodeId);
      const canvas = page.locator(`.stage-portrait canvas[data-asset="portrait.${portrait}"]`);
      await expect(canvas).toBeVisible();
      await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBe(480);
      // Compare every canvas pixel with the shipped bitmap scaled 3x nearest-neighbour,
      // not just the existence of a canvas that could still hold the painter fallback.
      await expect
        .poll(async () =>
          canvas.evaluate(async (element, name) => {
            if (!(element instanceof HTMLCanvasElement)) return false;
            const image = new Image();
            image.src = new URL(`art/portraits/${name}.png`, document.baseURI).href;
            await image.decode();
            if (image.naturalWidth * 3 !== element.width) return false;
            const expected = document.createElement('canvas');
            expected.width = element.width;
            expected.height = element.height;
            const ctx = expected.getContext('2d');
            if (!ctx) return false;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(image, 0, 0, expected.width, expected.height);
            return element.toDataURL() === expected.toDataURL();
          }, portrait),
        )
        .toBe(true);
    });
  });
}
