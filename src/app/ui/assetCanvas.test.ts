import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  imageFor: vi.fn(),
  whenLoaded: vi.fn(),
  painterDraw: vi.fn(),
  painterCanvas: vi.fn(),
  resolvePainter: vi.fn(),
}));

vi.mock('../../render/spriteCache', () => ({
  sprites: { imageFor: mocks.imageFor, whenLoaded: mocks.whenLoaded },
}));
vi.mock('../../render/painters/registry', () => ({
  resolvePainter: mocks.resolvePainter,
}));
vi.mock('./dom', () => ({
  painterCanvas: mocks.painterCanvas,
}));

import { assetCanvas } from './assetCanvas';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

describe('assetCanvas image fallback', () => {
  let context: { clearRect: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn> };
  let canvas: {
    isConnected: boolean;
    width: number;
    height: number;
    getContext: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    context = { clearRect: vi.fn(), drawImage: vi.fn() };
    canvas = {
      isConnected: true,
      width: 64,
      height: 64,
      getContext: vi.fn(() => context),
    };
    mocks.resolvePainter.mockReturnValue({ draw: mocks.painterDraw });
    mocks.painterCanvas.mockImplementation(
      (_key: string, _size: number, draw: (ctx: CanvasRenderingContext2D, px: number) => void) => {
        draw(context as unknown as CanvasRenderingContext2D, canvas.width);
        return canvas;
      },
    );
  });

  afterEach(() => vi.clearAllMocks());

  it('shows neutral while an expression is pending, then prefers it after it loads', async () => {
    const expressionLoad = deferred<boolean>();
    const neutralLoad = deferred<boolean>();
    const expressionImage = { key: 'portrait.kaya.worried' };
    const neutralImage = { key: 'portrait.kaya' };
    let expression: object | null = null;
    let neutral: object | null = null;
    mocks.imageFor.mockImplementation((key: string) =>
      key === 'portrait.kaya.worried' ? expression : key === 'portrait.kaya' ? neutral : null,
    );
    mocks.whenLoaded.mockImplementation((key: string) =>
      key === 'portrait.kaya.worried' ? expressionLoad.promise : neutralLoad.promise,
    );

    const portrait = assetCanvas('portrait.kaya.worried', 11, 'stage', 'portrait.kaya');
    expect(portrait).toBe(canvas);
    expect(mocks.resolvePainter).toHaveBeenCalledWith('portrait.kaya');
    expect(mocks.whenLoaded).toHaveBeenCalledWith('portrait.kaya.worried');
    expect(mocks.whenLoaded).toHaveBeenCalledWith('portrait.kaya');

    neutral = neutralImage;
    neutralLoad.resolve(true);
    await neutralLoad.promise;
    await Promise.resolve();
    expect(context.drawImage).toHaveBeenLastCalledWith(neutralImage, 0, 0, 64, 64);

    expression = expressionImage;
    expressionLoad.resolve(true);
    await expressionLoad.promise;
    await Promise.resolve();
    expect(context.drawImage).toHaveBeenLastCalledWith(expressionImage, 0, 0, 64, 64);
  });

  it('keeps the neutral image when the expression request fails', async () => {
    const expressionLoad = deferred<boolean>();
    const neutralLoad = deferred<boolean>();
    const neutralImage = { key: 'portrait.kaya' };
    let neutral: object | null = null;
    mocks.imageFor.mockImplementation((key: string) => (key === 'portrait.kaya' ? neutral : null));
    mocks.whenLoaded.mockImplementation((key: string) =>
      key === 'portrait.kaya.worried' ? expressionLoad.promise : neutralLoad.promise,
    );
    assetCanvas('portrait.kaya.worried', 11, '', 'portrait.kaya');

    expressionLoad.resolve(false);
    await expressionLoad.promise;
    await Promise.resolve();
    expect(mocks.resolvePainter).toHaveBeenCalledWith('portrait.kaya');

    neutral = neutralImage;
    neutralLoad.resolve(true);
    await neutralLoad.promise;
    await Promise.resolve();
    expect(context.drawImage).toHaveBeenLastCalledWith(neutralImage, 0, 0, 64, 64);
  });

  it('does not repaint a detached canvas when either image settles', async () => {
    const expressionLoad = deferred<boolean>();
    const neutralLoad = deferred<boolean>();
    mocks.imageFor.mockReturnValue(null);
    mocks.whenLoaded.mockImplementation((key: string) =>
      key === 'portrait.kaya.worried' ? expressionLoad.promise : neutralLoad.promise,
    );
    assetCanvas('portrait.kaya.worried', 11, '', 'portrait.kaya');
    canvas.isConnected = false;

    neutralLoad.resolve(true);
    await neutralLoad.promise;
    await Promise.resolve();
    expect(context.clearRect).not.toHaveBeenCalled();
    expect(context.drawImage).not.toHaveBeenCalled();
  });
});
