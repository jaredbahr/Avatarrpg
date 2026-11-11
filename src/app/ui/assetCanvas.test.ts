import { describe, expect, it, vi } from 'vitest';
import { drawPixelPortrait, PIXEL_PORTRAIT_PX } from './assetCanvas';

function fakeCtx() {
  return { imageSmoothingEnabled: true, imageSmoothingQuality: 'low', drawImage: vi.fn() };
}

describe('drawPixelPortrait', () => {
  it('draws a 160 px portrait at a whole multiple with smoothing off', () => {
    const ctx = fakeCtx();
    drawPixelPortrait(ctx as unknown as CanvasRenderingContext2D, {} as CanvasImageSource, 320);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 320, 320);
  });

  it('centres at the nearest multiple when the box is slightly off', () => {
    const ctx = fakeCtx();
    drawPixelPortrait(ctx as unknown as CanvasRenderingContext2D, {} as CanvasImageSource, 352);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 16, 16, 320, 320);
    expect(PIXEL_PORTRAIT_PX).toBe(160);
  });
});
