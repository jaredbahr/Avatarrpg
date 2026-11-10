import { readFileSync, readdirSync } from 'node:fs';
import { Container, type Sprite, Texture, TextureSource } from 'pixi.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readPng, type Image } from '../../scripts/art/lib/image';
import { decodeWebp } from '../../scripts/art/lib/webp';
import { HEADINGS, headingClip, type ClipDef, type Heading } from '../content/assets/clips';
import { TOPDOWN_SHEETS } from '../content/assets/topdownSheets';
import { Canvas2DBackend } from './backends/canvas2d';
import { PixiBackend } from './backends/pixi';
import { drillerGroundingArt, drillerGroundingPose } from './drillerGrounding';
import { DEFAULT_ACTOR_GROUNDING, shadowCeiling } from './lighting';
import type { AtlasFrame } from './sheets/atlasJson';
import type { ResolvedFrame } from './sheets/store';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url));
const atlas = JSON.parse(read('public/art/topdown/driller.json').toString()) as {
  frames: Record<string, { frame: AtlasFrame }>;
};
const actions = JSON.parse(read('public/art/topdown/driller-actions.json').toString()) as {
  slam: Record<Heading, ClipDef>;
};
const data = TOPDOWN_SHEETS.driller;
let page: Image;
const dirs = [
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
  'north',
  'north-east',
];

/** A tiny pixel canvas: only the unscaled crop/read/write operations used by the caster. */
class PixelCanvas {
  width = 0;
  height = 0;
  pixels: Uint8ClampedArray = new Uint8ClampedArray();
  getContext() {
    return {
      drawImage: (source: Image | PixelCanvas, sx: number, sy: number, w: number, h: number) => {
        const pixels = source instanceof PixelCanvas ? source.pixels : source.data;
        this.pixels = new Uint8ClampedArray(this.width * this.height * 4);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const from = ((sy + y) * source.width + sx + x) * 4;
            this.pixels.set(pixels.subarray(from, from + 4), (y * this.width + x) * 4);
          }
      },
      getImageData: () => ({ data: this.pixels }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (image: { data: Uint8ClampedArray }) => {
        this.pixels = image.data;
      },
    };
  }
}

beforeAll(async () => {
  page = await decodeWebp(read('public/art/topdown/driller.webp'));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function pixelDocument() {
  vi.stubGlobal('document', { createElement: () => new PixelCanvas() });
}

function frame(name: string, clip: ResolvedFrame['clip'] = 'idle'): ResolvedFrame {
  const rect = atlas.frames[name]?.frame;
  if (!rect) throw new Error(`missing ${name}`);
  return {
    source: page as unknown as HTMLImageElement,
    frame: rect,
    anchor: data.anchor,
    pixelsPerTile: 40,
    footprint: { w: 2, h: 2 },
    headroom: 3,
    clip,
    index: 0,
    placeholder: false,
  };
}
const idle = (heading: Heading) => frame(`unit.enemy.driller/${headingClip('idle', heading)}/0`);

function crop(rect: AtlasFrame): Image {
  const pixels = new Uint8Array(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++)
    pixels.set(
      page.data.subarray(
        ((rect.y + y) * page.width + rect.x) * 4,
        ((rect.y + y) * page.width + rect.x + rect.w) * 4,
      ),
      y * rect.w * 4,
    );
  return { width: rect.w, height: rect.h, data: pixels };
}

function bounds(image: Image | PixelCanvas) {
  const pixels = image instanceof PixelCanvas ? image.pixels : image.data;
  let x0 = image.width,
    y0 = image.height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++)
      if ((pixels[(y * image.width + x) * 4 + 3] ?? 0) >= 128) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
  return { x0, y0, x1, y1 };
}

/** Independent measurement of the decoded, packed static cel, not the rotation or source crop. */
function treads(heading: Heading) {
  const resolved = idle(heading);
  const image = crop(resolved.frame);
  const box = bounds(image);
  let left = image.width,
    right = 0;
  for (let y = Math.max(box.y0, box.y1 - 16); y < box.y1; y++)
    for (let x = 0; x < image.width; x++)
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) >= 128) {
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
      }
  return {
    left: left - resolved.anchor.x * image.width,
    right: right - resolved.anchor.x * image.width,
    baseline: box.y1 - resolved.anchor.y * image.height,
  };
}

describe('Driller static tread grounding', () => {
  it('packs the measured span, center and baseline of all eight decoded idle cels', () => {
    expect(HEADINGS.map((h) => treads(h).right - treads(h).left)).toEqual([
      69, 65, 80, 67, 74, 81, 73, 81,
    ]);
    for (const [index, heading] of HEADINGS.entries()) {
      const measured = treads(heading);
      const metadata = data.treadGrounding?.[index];
      expect(metadata?.spanPx).toBe(measured.right - measured.left);
      expect(metadata?.centerXFromAnchorPx).toBeCloseTo((measured.right + measured.left) / 2, 5);
      expect(metadata?.baselineYFromAnchorPx).toBeCloseTo(measured.baseline, 4);
    }
  });

  for (const heading of HEADINGS)
    for (const mirror of [false, true])
      it(`covers and centers ${heading} treads, mirrored=${mirror}, in both actual backend emissions`, () => {
        pixelDocument();
        const resolved = idle(heading);
        const art = drillerGroundingArt(resolved, heading, DEFAULT_ACTOR_GROUNDING.castKey, mirror);
        if (!art) throw new Error('no grounding');
        const measured = treads(heading);
        const opaque = bounds(art.blob as unknown as PixelCanvas);
        const scale = 1.25,
          zoom = 3,
          foot = { x: 200, y: 180 };
        const cels = {
          drawn: resolved,
          resting: resolved,
          scale,
          flip: mirror,
          driller: { frame: resolved, heading, mirror },
        };
        const canvasDraws: { source: HTMLCanvasElement; box: number[] }[] = [];
        const canvasBounds: { x0: number; y0: number; x1: number; y1: number }[] = [];
        const target = {
          save() {},
          restore() {},
          drawImage(source: HTMLCanvasElement, ...box: number[]) {
            canvasDraws.push({ source, box });
          },
        };
        const canvas = Object.create(Canvas2DBackend.prototype);
        Object.assign(canvas, {
          grounding: DEFAULT_ACTOR_GROUNDING,
          castInto(
            _target: unknown,
            _level: number,
            box: (typeof canvasBounds)[number],
            draw: (ctx: unknown) => void,
          ) {
            canvasBounds.push(box);
            draw(target);
          },
        });
        canvas.projectFigureShadow(target, foot, scale, 2, 0.7, zoom, cels);
        expect(canvasDraws).toHaveLength(2);
        const emitted = canvasDraws[1];
        expect(emitted?.source).toBe(art.blob);
        const [x = NaN, y = NaN, w = NaN, h = NaN] = emitted?.box ?? [];
        expect(canvasBounds[1]).toEqual({ x0: x, y0: y, x1: x + w, y1: y + h });

        const pixi = Object.create(PixiBackend.prototype);
        const sprites = new Map<string, Sprite>();
        Object.assign(pixi, {
          grounding: DEFAULT_ACTOR_GROUNDING,
          castLive: new Set(),
          castSprites: sprites,
          shadowMaskSources: new Container(),
          texture: () =>
            new Texture({
              source: new TextureSource({
                width: art.blob.width,
                height: art.blob.height,
              }),
            }),
        });
        pixi.projectFigureShadow('boss', foot, scale, 2, 0.7, cels);
        expect(sprites.size).toBe(2);
        const blob = sprites.get('boss:foot');
        if (!blob) throw new Error('missing emitted blob');
        expect(blob.blendMode).toBe('max');
        expect(blob.alpha).toBeCloseTo(
          (0.7 * DEFAULT_ACTOR_GROUNDING.contact) / shadowCeiling(DEFAULT_ACTOR_GROUNDING),
        );
        const wantedLeft = mirror ? -measured.right : measured.left;
        const wantedRight = mirror ? -measured.left : measured.right;
        const assertPlacement = (box: {
          x: number;
          y: number;
          w: number;
          h: number;
          pixelScale: number;
        }) => {
          const px = scale * box.pixelScale;
          const actualLeft = (box.x - foot.x) / px + opaque.x0;
          const actualRight = (box.x - foot.x) / px + opaque.x1;
          expect(actualLeft).toBeLessThanOrEqual(wantedLeft);
          expect(actualRight).toBeGreaterThanOrEqual(wantedRight);
          expect((actualLeft + actualRight) / 2).toBeCloseTo((wantedLeft + wantedRight) / 2, 6);
          expect((box.y - foot.y) / px + (opaque.y0 + opaque.y1) / 2).toBeCloseTo(
            measured.baseline,
            4,
          );
          expect(box.w).toBe(art.blob.width * px);
          expect(box.h).toBe(art.blob.height * px);
        };
        for (const box of [
          { x, y, w, h, pixelScale: zoom },
          { x: blob.x, y: blob.y, w: blob.width, h: blob.height, pixelScale: 1 },
        ]) {
          assertPlacement(box);
          // Negatives pass the actual emitted box through the same assertions.
          expect(() =>
            assertPlacement({ ...box, x: box.x + 2 * scale * box.pixelScale }),
          ).toThrow();
          expect(() =>
            assertPlacement({ ...box, y: box.y + 2 * scale * box.pixelScale }),
          ).toThrow();
        }
        const castBytes = Buffer.from((art.cast as unknown as PixelCanvas).pixels);
        const castBox = canvasDraws[0]?.box;
        const pixiCast = sprites.get('boss');
        const pixiCastBox = [pixiCast?.x, pixiCast?.y, pixiCast?.width, pixiCast?.height];
        for (const name of actions.slam[heading].frames) {
          const attacking = { ...cels, drawn: frame(name, 'cast') };
          canvasDraws.length = 0;
          canvas.projectFigureShadow(target, foot, scale, 2, 0.7, zoom, attacking);
          pixi.projectFigureShadow('boss', foot, scale, 2, 0.7, attacking);
          expect(canvasDraws[0]?.source).toBe(art.cast);
          expect(canvasDraws[0]?.box).toEqual(castBox);
          expect([pixiCast?.x, pixiCast?.y, pixiCast?.width, pixiCast?.height]).toEqual(
            pixiCastBox,
          );
          expect(Buffer.from((art.cast as unknown as PixelCanvas).pixels).equals(castBytes)).toBe(
            true,
          );
        }
        for (const sprite of sprites.values()) {
          sprite.texture.destroy(true);
          sprite.destroy();
        }
      });

  it('holds byte-identical cached static casts through every slam cel and the mirrored compatibility cast', () => {
    pixelDocument();
    const create = vi.spyOn(document, 'createElement');
    for (const heading of HEADINGS) {
      const staticFrame = idle(heading);
      const first = drillerGroundingArt(staticFrame, heading, DEFAULT_ACTOR_GROUNDING.castKey);
      if (!first) throw new Error('no cast');
      const bytes = (first.cast as unknown as PixelCanvas).pixels.slice();
      const calls = create.mock.calls.length;
      for (const _name of actions.slam[heading].frames) {
        const again = drillerGroundingArt(
          { ...staticFrame },
          heading,
          DEFAULT_ACTOR_GROUNDING.castKey,
        );
        expect(again).toBe(first);
        expect(
          Buffer.from((again?.cast as unknown as PixelCanvas).pixels).equals(Buffer.from(bytes)),
        ).toBe(true);
      }
      expect(create.mock.calls.length).toBe(calls);
    }
    expect(drillerGroundingPose('cast', true)).toEqual({ heading: 'east', mirror: true });
    expect(drillerGroundingPose('idleWest', true)).toEqual({ heading: 'west', mirror: false });
    expect(drillerGroundingPose('walkNorth', true)).toEqual({ heading: 'north', mirror: false });
  });
});

describe('Driller slam registration (authored pixels are not re-anchored to dust)', () => {
  for (const [index, heading] of HEADINGS.entries())
    it(`preserves every decoded ${heading} slam pixel relative to the authored ground anchor`, () => {
      const dir = dirs[index];
      const rotation = readPng(`prototypes/topdown/assets/driller/rotations__${dir}.png`);
      const box = bounds(rotation);
      const anchor = { x: Math.round((box.x0 + box.x1) / 2), y: box.y1 };
      const files = readdirSync('prototypes/topdown/assets/driller')
        .filter(
          (name) =>
            name.startsWith(
              `animations__${heading === 'southWest' ? 'the_mecha-driller_rears' : 'the_whole_mecha-driller_winds'}`,
            ) && name.includes(`__${dir}__frame_`),
        )
        .sort();
      const action = actions.slam[heading];
      expect(files).toHaveLength(13);
      expect(action.frames).toHaveLength(13);
      const width = action.frameSize?.w ?? 0,
        height = action.frameSize?.h ?? 0;
      const anchorX = (action.anchor?.x ?? NaN) * width,
        anchorY = (action.anchor?.y ?? NaN) * height;
      expect(Math.abs(anchorY - Math.round(anchorY))).toBeLessThan(0.0001);
      for (const [i, name] of action.frames.entries()) {
        const source = readPng(`prototypes/topdown/assets/driller/${files[i]}`);
        const packed = crop(frame(name).frame);
        const originX = anchor.x - Math.round(anchorX),
          originY = anchor.y - Math.round(anchorY);
        // Compare actual source alpha on the basis canvas to decoded atlas pixels: catches a
        // moved/cropped cel even when all 13 metadata anchors still agree with each other.
        for (let y = 0; y < source.height; y++)
          for (let x = 0; x < source.width; x++) {
            const sx = x - originX,
              sy = y - originY;
            const expected = (source.data[(y * source.width + x) * 4 + 3] ?? 0) >= 128;
            const actual =
              sx >= 0 &&
              sy >= 0 &&
              sx < width &&
              sy < height &&
              (packed.data[(sy * width + sx) * 4 + 3] ?? 0) >= 128;
            if (actual !== expected)
              throw new Error(
                `${heading} cel ${i}: source pixel ${x},${y} moved relative to ground`,
              );
          }
      }
    });
});

/** Lowest edge of the largest connected dark tread fragment in an explicitly bounded ROI.
 * Cream drill-contact/dust is excluded by material; this is an observation, not an anchor calculation.
 */
function visibleSupport(image: Image, roi: readonly [number, number], baseline: number) {
  const pixels = new Set<number>();
  for (let y = Math.max(0, baseline - 16); y < Math.min(image.height, baseline + 9); y++)
    for (let x = roi[0]; x < Math.min(image.width, roi[1]); x++) {
      const i = (y * image.width + x) * 4;
      if (
        (image.data[i + 3] ?? 0) >= 128 &&
        Math.max(image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0) <= 80
      )
        pixels.add(y * image.width + x);
    }
  let largest: number[] = [];
  while (pixels.size) {
    const start = pixels.values().next().value as number;
    pixels.delete(start);
    const todo = [start],
      component: number[] = [];
    while (todo.length) {
      const i = todo.pop();
      if (i === undefined) break;
      component.push(i);
      const x = i % image.width,
        y = Math.floor(i / image.width);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx < roi[0] || x + dx >= roi[1]) continue;
          const neighbor = (y + dy) * image.width + x + dx;
          if (pixels.delete(neighbor)) todo.push(neighbor);
        }
    }
    if (component.length > largest.length) largest = component;
  }
  return {
    pixels: largest.length,
    bottom: Math.max(...largest.map((i) => Math.floor(i / image.width) + 1)),
  };
}

describe('observable slam tread support', () => {
  for (const [index, heading] of HEADINGS.entries())
    it(`observes ${heading} support separately from dust and packed anchors`, () => {
      const rotation = readPng(`prototypes/topdown/assets/driller/rotations__${dirs[index]}.png`);
      const sourceBox = bounds(rotation);
      const sourceAnchor = { x: Math.round((sourceBox.x0 + sourceBox.x1) / 2), y: sourceBox.y1 };
      const action = actions.slam[heading];
      const anchorX = Math.round((action.anchor?.x ?? NaN) * (action.frameSize?.w ?? 0));
      const anchorY = Math.round((action.anchor?.y ?? NaN) * (action.frameSize?.h ?? 0));
      const originX = sourceAnchor.x - anchorX;
      // South's center contains the drill, not tread. North has two separate tread banks.
      const rawRois: readonly (readonly [number, number])[] =
        heading === 'south'
          ? [
              [18, 38],
              [74, 98],
            ]
          : heading === 'north'
            ? [
                [28, 52],
                [73, 102],
              ]
            : [[sourceBox.x0, sourceBox.x1]];
      const unobservable: string[] = [];
      for (const [i, name] of action.frames.entries()) {
        const image = crop(frame(name).frame);
        for (const [roiIndex, roi] of rawRois.entries()) {
          // These fragments are occluded or joined to impact debris. Their lowest dark pixel
          // cannot establish the tread baseline; exact source placement is checked above.
          if (
            (heading === 'north' &&
              ((i === 10 && roiIndex === 0) || ((i === 10 || i === 11) && roiIndex === 1))) ||
            (heading === 'northEast' && i === 11)
          ) {
            unobservable.push(`${i}:${roiIndex}`);
            continue;
          }
          const observed = visibleSupport(image, [roi[0] - originX, roi[1] - originX], anchorY);
          expect(observed.pixels, `${heading} cel ${i} bank ${roiIndex}`).toBeGreaterThan(30);
          expect(
            Math.abs(observed.bottom - anchorY),
            `${heading} cel ${i} bank ${roiIndex}`,
          ).toBeLessThanOrEqual(1);
        }
      }
      expect(unobservable).toEqual(
        heading === 'north' ? ['10:0', '10:1', '11:1'] : heading === 'northEast' ? ['11:0'] : [],
      );
    });

  it('rejects a genuine two-pixel source shift with unchanged metadata', () => {
    const action = actions.slam.east;
    const name = action.frames[0];
    if (!name) throw new Error('missing east slam');
    const image = crop(frame(name).frame);
    const baseline = Math.round((action.anchor?.y ?? NaN) * image.height);
    const shifted = { ...image, data: new Uint8Array(image.data.length) };
    shifted.data.set(image.data.subarray(0, -image.width * 8), image.width * 8);
    const assertSeated = (pixels: Image) =>
      expect(
        Math.abs(visibleSupport(pixels, [0, image.width], baseline).bottom - baseline),
      ).toBeLessThanOrEqual(1);
    assertSeated(image);
    expect(() => assertSeated(shifted)).toThrow();
  });
});
