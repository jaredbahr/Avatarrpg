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
    // Pixel portraits draw at a whole multiple, centred (ADR 0107), so both are
    // reduced to a small thumbnail of the same region and compared within a
    // tolerance that ignores the scaling method but not a different picture.
    await expect
      .poll(async () =>
        canvas.evaluate(async (element, name) => {
          if (!(element instanceof HTMLCanvasElement)) return Infinity;
          const image = new Image();
          image.src = new URL(`art/portraits/${name}.png`, document.baseURI).href;
          await image.decode();
          const n = image.naturalWidth;
          const ratio = element.width / n;
          const near = Math.round(ratio);
          const mult = Math.abs(ratio - near) <= 0.25 ? near : ratio >= 3 ? Math.floor(ratio) : 0;
          const size = mult >= 1 ? n * mult : element.width;
          const offset = mult >= 1 ? Math.floor((element.width - size) / 2) : 0;
          const thumb = (draw: (ctx: CanvasRenderingContext2D) => void) => {
            const c = document.createElement('canvas');
            c.width = c.height = 32;
            const ctx = c.getContext('2d')!;
            ctx.imageSmoothingQuality = 'high';
            draw(ctx);
            return ctx.getImageData(0, 0, 32, 32).data;
          };
          const got = thumb((ctx) =>
            ctx.drawImage(element, offset, offset, size, size, 0, 0, 32, 32),
          );
          const want = thumb((ctx) => ctx.drawImage(image, 0, 0, 32, 32));
          let sum = 0;
          for (let i = 0; i < got.length; i++) sum += Math.abs((got[i] ?? 0) - (want[i] ?? 0));
          return sum / got.length;
        }, portrait),
      )
      .toBeLessThan(6);
  });
}
