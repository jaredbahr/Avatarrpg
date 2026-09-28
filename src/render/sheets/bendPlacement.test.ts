/**
 * A bend cel stands exactly where the stance does (ADR 0055).
 *
 * Every heading of a bend is trimmed to its own rectangle with its own foot
 * anchor, where the stance is a full 128x192 cel on the sheet's anchor. This
 * places both at one unit's tile through the rectangle Canvas 2D draws and the
 * bounds of a real Pixi sprite set up as the WebGL backend sets it, then
 * compares the decoded pixels: the bend's first and last cels must cover the
 * stance cel's alpha exactly, for every heading of every G bend.
 */

import { readFileSync } from 'node:fs';
import { Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { HEADINGS, headingClip } from '../../content/assets/clips';
import { BEND_SOCKETS } from '../../content/bends';
import type { Image } from '../../../scripts/art/lib/image';
import { decodeWebp } from '../../../scripts/art/lib/webp';
import { celOffset, placeFrame } from './placement';
import type { ResolvedFrame } from './store';
import { SheetStore } from './store';

/** A stand-in `Image` that loads on the next tick; the pixels are decoded here instead. */
class LoadingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';
  private url = '';
  get src(): string {
    return this.url;
  }
  set src(url: string) {
    this.url = url;
    setTimeout(() => this.onload?.(), 0);
  }
}

const PARTY = ['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo'] as const;
/** Board zooms: the atlas's own 128 px, a phone's and a tablet's. */
const TILE_SIZES = [128, 77, 213.5] as const;

const decoded = new Map<string, Image>();

async function image(source: ResolvedFrame['source']): Promise<Image> {
  const path = `public${(source as unknown as LoadingImage).src}`;
  let found = decoded.get(path);
  if (!found) {
    found = await decodeWebp(new Uint8Array(readFileSync(path)));
    decoded.set(path, found);
  }
  return found;
}

/** Alpha of `frame` at cel pixel (x, y), clear outside it. */
function alphaAt(page: Image, frame: ResolvedFrame['frame'], x: number, y: number): number {
  if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) return 0;
  return page.data[((frame.y + y) * page.width + frame.x + x) * 4 + 3] ?? 0;
}

/** What the WebGL backend covers: its sprite, anchored and sized as `pixi.ts` sets it. */
function pixiBounds(
  frame: Pick<ResolvedFrame, 'frame' | 'anchor' | 'pixelsPerTile'>,
  footX: number,
  footY: number,
  tilePx: number,
) {
  const f = frame.frame;
  const texture = new Texture({
    source: new TextureSource({ width: f.x + f.w, height: f.y + f.h }),
    frame: new Rectangle(f.x, f.y, f.w, f.h),
  });
  const sprite = new Sprite(texture);
  sprite.anchor.set(frame.anchor.x, frame.anchor.y);
  sprite.position.set(footX, footY);
  const placed = placeFrame(frame, 0, 0, tilePx);
  sprite.width = placed.w;
  sprite.height = placed.h;
  const bounds = sprite.getBounds();
  return { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height };
}

const store = new SheetStore();

beforeAll(async () => {
  vi.stubGlobal('Image', LoadingImage);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(readFileSync(`public${url}`, 'utf8')),
      }),
    ),
  );
  for (const key of PARTY) store.preloadBend(key);
  // Poll the loads rather than guess how long they take.
  const settled = () => PARTY.every((key) => store.bendState(key) !== 'loading');
  for (let tries = 0; tries < 1000 && !settled(); tries++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  for (const key of PARTY) expect(store.bendState(key)).toBe('loaded');
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('a bend cel placed at a unit’s tile (ADR 0055)', () => {
  for (const key of PARTY) {
    it(`stands ${key}'s every heading on the stance's feet, on both backends`, async () => {
      const set = store.bendSet(key);
      expect(set?.unitAsset).toBe(key);
      for (const heading of HEADINGS) {
        const stance = store.frame(key, headingClip('stance', heading), 0, 0, 128, 1);
        const count = set?.facings[heading].frames.length ?? 0;
        if (!stance) throw new Error(`${key} has no ${heading} stance`);
        expect(stance.clip).toBe(headingClip('stance', heading));
        for (const index of [0, count - 1]) {
          const bend = store.bendFrame(key, heading, index);
          if (!bend) throw new Error(`${key} ${heading} has no bend cel ${index}`);
          for (const tilePx of TILE_SIZES) {
            // A unit whose tile's foot point is somewhere awkward on the board.
            const footX = 311.25 + tilePx / 2;
            const footY = 97.5 + 0.85 * tilePx;
            const canvasStance = placeFrame(stance, footX, footY, tilePx);
            const canvasBend = placeFrame(bend, footX, footY, tilePx);
            const glStance = pixiBounds(stance, footX, footY, tilePx);
            const glBend = pixiBounds(bend, footX, footY, tilePx);
            for (const [canvas, gl] of [
              [canvasStance, glStance],
              [canvasBend, glBend],
            ] as const) {
              expect(gl.x).toBeCloseTo(canvas.x, 6);
              expect(gl.y).toBeCloseTo(canvas.y, 6);
              expect(gl.w).toBeCloseTo(canvas.w, 6);
              expect(gl.h).toBeCloseTo(canvas.h, 6);
            }
            // The bend cel's pixels sit on the stance cel's pixel grid: a whole
            // number of cel pixels apart, at any zoom.
            const scale = bend.pixelsPerTile / tilePx;
            const dx = (canvasBend.x - canvasStance.x) * scale;
            const dy = (canvasBend.y - canvasStance.y) * scale;
            expect(Math.abs(dx - Math.round(dx))).toBeLessThan(1e-3);
            expect(Math.abs(dy - Math.round(dy))).toBeLessThan(1e-3);
            if (tilePx !== 128) continue;
            // Same offset at 1:1, and the pixels there are the stance's alpha.
            const ox = Math.round(dx);
            const oy = Math.round(dy);
            const stancePage = await image(stance.source);
            const bendPage = await image(bend.source);
            let differ = 0;
            const x0 = Math.min(0, ox);
            const y0 = Math.min(0, oy);
            const x1 = Math.max(stance.frame.w, ox + bend.frame.w);
            const y1 = Math.max(stance.frame.h, oy + bend.frame.h);
            for (let y = y0; y < y1; y++) {
              for (let x = x0; x < x1; x++) {
                const a = alphaAt(bendPage, bend.frame, x - ox, y - oy);
                if (a !== alphaAt(stancePage, stance.frame, x, y)) differ++;
              }
            }
            expect(differ, `${key} ${heading} cel ${index}`).toBe(0);
          }
        }
      }
    }, 60_000);
  }
});

describe('bend sockets (ADR 0055, sub-pixel sockets)', () => {
  it('are cel-corner points that move with the cel exactly as its anchor does', () => {
    const bend = store.bendFrame('unit.fire.kaya', 'southEast', 2);
    if (!bend) throw new Error('No Kaya south-east cel 2');
    const lw = bend.sockets.LW;
    if (!lw) throw new Error('Kaya south-east cel 2 has no LW');
    // The jab's left wrist, as the packer wrote it: packed-cel pixels from
    // the cel's top-left corner, not from a pixel centre.
    expect(lw).toEqual({ x: 99.125, y: 61.175 });
    // The anchor itself, as a socket, is the foot: offset zero.
    const foot = { x: bend.anchor.x * bend.frame.w, y: bend.anchor.y * bend.frame.h };
    expect(celOffset(bend, foot)).toEqual({ x: 0, y: 0 });
    // The cel's top-left corner is the rectangle's corner, at any zoom.
    for (const tilePx of TILE_SIZES) {
      const rect = placeFrame(bend, 500, 400, tilePx);
      const corner = celOffset(bend, { x: 0, y: 0 });
      expect(500 + corner.x * tilePx).toBeCloseTo(rect.x, 9);
      expect(400 + corner.y * tilePx).toBeCloseTo(rect.y, 9);
      // And a socket lands its own fraction of the way across the drawn cel.
      const at = celOffset(bend, lw);
      expect(500 + at.x * tilePx).toBeCloseTo(rect.x + (lw.x / bend.frame.w) * rect.w, 9);
      expect(400 + at.y * tilePx).toBeCloseTo(rect.y + (lw.y / bend.frame.h) * rect.h, 9);
    }
  });

  it('lie inside their cel on every frame of every heading', () => {
    for (const key of PARTY) {
      const set = store.bendSet(key);
      for (const heading of HEADINGS) {
        const count = set?.facings[heading].frames.length ?? 0;
        for (let index = 0; index < count; index++) {
          const bend = store.bendFrame(key, heading, index);
          if (!bend) throw new Error(`${key} ${heading} has no cel ${index}`);
          for (const socket of BEND_SOCKETS) {
            const point = bend.sockets[socket];
            if (!point) continue;
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThanOrEqual(bend.frame.w);
            expect(point.y).toBeLessThanOrEqual(bend.frame.h);
          }
        }
      }
    }
  });
});
