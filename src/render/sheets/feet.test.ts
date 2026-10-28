/**
 * A figure stands on its own soles (ADR 0093's planting amendment; owner, 2026-10-28: "They're still floating").
 * Every idle and walk cel of every eight-way sheet the game ships, and of the `?style=world` test sheets, is stood
 * by the anchor the store resolves for it (`plantAnchor`), and that anchor must be the row under its lowest opaque
 * sole within one world pixel at the oblique figure scale: no hovering, no sinking.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import decode, { init } from '@jsquash/webp/decode.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { OBLIQUE_FIGURE_SCALE } from '../../app/anim/actorScale';
import {
  ASSETS,
  resolveAsset,
  useWorldStyleTest,
  type SheetEntry,
} from '../../content/assets/manifest';
import { TILE } from '../camera';
import { poolOffset } from '../figureShadowArt';
import { feetFromPixels, plantAnchor, restingClip, standsOnSoles } from './feet';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

type Page = { readonly width: number; readonly data: Uint8ClampedArray };
const pages = new Map<string, Page>();

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  await init(
    await WebAssembly.compile(
      readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm')),
    ),
  );
});

async function page(path: string): Promise<Page> {
  let found = pages.get(path);
  if (!found) {
    const bytes = readFileSync(`public/${path}`);
    const image = await decode(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    found = { width: image.width, data: image.data };
    pages.set(path, found);
  }
  return found;
}

interface Cel {
  readonly clip: string;
  readonly name: string;
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;
}

/** Every idle and walk cel of a sheet, cut out of its atlas pages. */
async function standingCels(entry: SheetEntry): Promise<Cel[]> {
  const frames = new Map<string, { image: string; x: number; y: number; w: number; h: number }>();
  for (const json of [entry.atlas, ...(entry.atlasPages ?? [])]) {
    const atlas = JSON.parse(readFileSync(`public/${json}`, 'utf8')) as {
      frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
      meta: { image: string };
    };
    const image = json.replace(/[^/]+$/, atlas.meta.image);
    for (const [name, { frame }] of Object.entries(atlas.frames))
      frames.set(name, { image, ...frame });
  }
  const cels: Cel[] = [];
  for (const [clip, def] of Object.entries(entry.clips))
    if (def && /^(idle|walk)/.test(clip))
      for (const name of def.frames) {
        const f = frames.get(name);
        if (!f) continue;
        const p = await page(f.image);
        const data = new Uint8ClampedArray(f.w * f.h * 4);
        for (let row = 0; row < f.h; row += 1)
          data.set(
            p.data.subarray(
              ((f.y + row) * p.width + f.x) * 4,
              ((f.y + row) * p.width + f.x + f.w) * 4,
            ),
            row * f.w * 4,
          );
        cels.push({ clip, name, w: f.w, h: f.h, data });
      }
  return cels;
}

/** The lowest row with an opaque pixel, measured here on its own. */
function lowestOpaqueRow(cel: Cel): number {
  for (let y = cel.h - 1; y >= 0; y -= 1)
    for (let x = 0; x < cel.w; x += 1)
      if ((cel.data[(y * cel.w + x) * 4 + 3] ?? 0) >= 128) return y;
  return -1;
}

const EIGHT_WAY = Object.entries(ASSETS)
  .filter(([, asset]) => asset.kind === 'sheet' && asset.locomotion)
  .map(([key]) => key);
const WORLD_STYLE = ['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo', 'npc.shopkeeper'];

function holdsEveryCelOnItsSoles(
  label: string,
  keys: () => readonly string[],
  atlas: RegExp = /./,
): void {
  it(`stands every idle and walk cel of the ${label} sheets on its lowest sole, within a world pixel`, async () => {
    let checked = 0;
    for (const key of keys()) {
      const entry = resolveAsset(key);
      if (entry.kind !== 'sheet') continue;
      expect(entry.atlas).toMatch(atlas);
      // World px a cel's art px covers on an oblique board.
      const k = (TILE * OBLIQUE_FIGURE_SCALE) / entry.pixelsPerTile;
      for (const cel of await standingCels(entry)) {
        const feet = feetFromPixels(cel.data, cel.w, cel.h, entry.pixelsPerTile) ?? undefined;
        const def = entry.clips[cel.clip as keyof typeof entry.clips];
        const anchor = plantAnchor(
          cel.clip,
          def?.anchor ?? entry.anchor,
          cel,
          feet,
          entry.pixelsPerTile,
        );
        const gap = (anchor.y * cel.h - (lowestOpaqueRow(cel) + 1)) * k;
        expect(
          Math.abs(gap),
          `${key} ${cel.name}: sole ${gap.toFixed(1)} world px off the anchor`,
        ).toBeLessThanOrEqual(1);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
}

describe('every figure stands on its own soles', () => {
  holdsEveryCelOnItsSoles('shipped eight-way', () => EIGHT_WAY);

  describe('the ?style=world test sheets', () => {
    beforeAll(() => useWorldStyleTest());
    holdsEveryCelOnItsSoles('?style=world', () => WORLD_STYLE, /style-test/);
  });
});

describe('the feet of a cel', () => {
  /** A cel `w` wide, opaque where `solid(x, y)`. */
  const cel = (w: number, h: number, solid: (x: number, y: number) => boolean) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 1)
      for (let x = 0; x < w; x += 1) if (solid(x, y)) data[(y * w + x) * 4 + 3] = 255;
    return data;
  };

  it('finds both feet on an oblique stance, the far one higher, and centres between them', () => {
    // Near foot columns 4-7 down to row 30; far foot columns 12-15 down to row 27 (3 px higher).
    const data = cel(
      20,
      40,
      (x, y) => (x >= 4 && x <= 7 && y <= 30) || (x >= 12 && x <= 15 && y <= 27),
    );
    const feet = feetFromPixels(data, 20, 40, 80);
    expect(feet?.ground).toBe(31);
    expect([...(feet?.soles ?? [])].filter((row) => row >= 0)).toHaveLength(8);
    expect(feet?.soles[5]).toBe(31);
    expect(feet?.soles[13]).toBe(28);
    expect(feet?.centre.x).toBeCloseTo(10, 6);
    expect(feet?.centre.y).toBeCloseTo(29.5, 6);
  });

  it('gives a lifted swing foot no contact', () => {
    // The swing foot is 8 px up: well past the reach of a foot on the ground.
    const data = cel(
      20,
      40,
      (x, y) => (x >= 4 && x <= 7 && y <= 30) || (x >= 12 && x <= 15 && y <= 22),
    );
    const feet = feetFromPixels(data, 20, 40, 80);
    expect(feet?.soles[13]).toBe(-1);
    expect(feet?.centre.x).toBeCloseTo(6, 6);
  });

  it('plants only standing and walking cels, and only as far as a foot could be off', () => {
    const feet = feetFromPixels(
      cel(8, 100, (_, y) => y <= 80),
      8,
      100,
      64,
    );
    expect(
      plantAnchor('walkSouthEast', { x: 0.5, y: 0.85 }, { h: 100 }, feet ?? undefined, 64).y,
    ).toBeCloseTo(0.81, 6);
    expect(plantAnchor('hit', { x: 0.5, y: 0.85 }, { h: 100 }, feet ?? undefined, 64).y).toBe(0.85);
    // 40 px off at 64 px a tile is a fallen body, not a foot.
    expect(plantAnchor('idle', { x: 0.5, y: 0.85 }, { h: 160 }, feet ?? undefined, 64).y).toBe(
      0.85,
    );
    expect(standsOnSoles('stanceSouth')).toBe(true);
    expect(standsOnSoles('koSouthEast')).toBe(false);
  });

  it("centres the pool on the heading's resting feet, mirrored with the body", () => {
    const feet =
      feetFromPixels(
        cel(20, 40, (x, y) => x >= 12 && x <= 15 && y <= 30),
        20,
        40,
        80,
      ) ?? undefined;
    const resting = {
      frame: { w: 20, h: 40 },
      anchor: { x: 0.5, y: 31 / 40 },
      pixelsPerTile: 80,
      feet,
    };
    expect(poolOffset(resting, false).x).toBeCloseTo(4 / 80, 6);
    expect(poolOffset(resting, true).x).toBeCloseTo(-4 / 80, 6);
    expect(poolOffset(null, false)).toEqual({ x: 0, y: 0 });
    expect(restingClip('walkNorthWest')).toBe('idleNorthWest');
    expect(restingClip('stanceSouth')).toBe('idleSouth');
  });
});
