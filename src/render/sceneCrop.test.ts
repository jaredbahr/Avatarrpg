import { afterEach, expect, it, vi } from 'vitest';
import { drawSceneImage, sceneImage, sceneImages, sceneSourceRect } from './scene';
import type { SceneImage } from '../core/types';
import { mapSchema } from '../content/schemas';
import { QUARRY_GATE } from '../content/maps/combat';

const image = { naturalWidth: 256, naturalHeight: 128 } as HTMLImageElement;
const whole: SceneImage = { url: 'page.webp', x: 40, y: 80, width: 64, height: 96 };
const crop = { x: 2, y: 2, width: 32, height: 64 };
afterEach(() => vi.restoreAllMocks());

it('keeps destination geometry independent of source pixels and excludes gutters', () => {
  const drawImage = vi.fn();
  const context = { drawImage } as unknown as CanvasRenderingContext2D;
  drawSceneImage(context, image, { ...whole, sourceRect: crop }, 17, 23, 90, 120);
  expect(drawImage).toHaveBeenCalledWith(image, 2, 2, 32, 64, 17, 23, 90, 120);
  drawSceneImage(context, image, whole, 17, 23, 90, 120);
  expect(drawImage).toHaveBeenLastCalledWith(image, 0, 0, 256, 128, 17, 23, 90, 120);
});

it('rejects malformed and out-of-page crops as unavailable, without drawing', () => {
  vi.spyOn(sceneImages, 'get').mockReturnValue(image);
  const drawImage = vi.fn();
  for (const sourceRect of [
    { ...crop, x: -1 },
    { ...crop, y: 0.5 },
    { ...crop, width: 0 },
    { ...crop, height: Infinity },
    { ...crop, x: 240 },
  ]) {
    const piece = { ...whole, sourceRect };
    expect(sceneImage(piece)).toBeNull();
    drawSceneImage({ drawImage } as unknown as CanvasRenderingContext2D, image, piece, 0, 0, 1, 1);
  }
  expect(drawImage).not.toHaveBeenCalled();
  expect(
    sceneSourceRect({ ...whole, sourceRect: crop }, {
      naturalWidth: 2049,
      naturalHeight: 128,
    } as HTMLImageElement),
  ).toBeNull();
});

it('schema preserves optional integer source rectangles and existing scenes', () => {
  const withCrop = (sourceRect: object) => ({
    ...QUARRY_GATE,
    scene: { ground: [{ ...whole, sourceRect }], scenery: [] },
  });
  expect(mapSchema.safeParse(QUARRY_GATE).success).toBe(true);
  expect(mapSchema.parse(withCrop(crop)).scene?.ground[0]?.sourceRect).toEqual(crop);
  for (const bad of [
    { ...crop, x: -1 },
    { ...crop, y: 0.5 },
    { ...crop, height: 0 },
  ])
    expect(mapSchema.safeParse(withCrop(bad)).success).toBe(false);
});
