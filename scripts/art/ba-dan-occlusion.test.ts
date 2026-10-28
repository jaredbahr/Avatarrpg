import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BA_DAN_PAINTING, BA_DAN_UPRIGHTS } from '../../src/content/scenes/baDan.art';
import type { Image } from './lib/image';
import { decodeWebp } from './lib/webp';

/**
 * A figure behind a Ba Dan upright is hidden by that upright's own pixels, whatever the painting's scale (ADR 0090).
 *
 * For every upright, and every walkable cell a figure can stand on behind it (the frozen depth key is past the cell's,
 * the rule `Village.needed` uses), a figure's body is sampled at its feet, waist and head (8, 32 and 56 world px above
 * the foot) and 12 px either side. Wherever the frozen geometry's silhouette is solid there (the point and its eight
 * neighbours at one world px, so an antialiased rim is not asked to be solid), the shipped upright must be opaque at
 * that world point. A dropped piece, a lost or shifted alpha, or a sprite placed off its frozen rectangle fails here.
 */
interface FrozenPiece {
  id: string;
  file: string;
  sourceRect: { x: number; y: number; width: number; height: number } | null;
  x: number;
  y: number;
  width: number;
  height: number;
  flip: boolean;
  depth: { x: number; y: number };
}
const GEOMETRY = 'art/source/ba-dan-regions/geometry';
const geometry = JSON.parse(readFileSync(`${GEOMETRY}/scene.json`, 'utf8')) as {
  pieces: FrozenPiece[];
  walkable: [number, number][];
};

const images = new Map<string, Promise<Image>>();
function image(path: string): Promise<Image> {
  let found = images.get(path);
  if (!found) {
    found = decodeWebp(new Uint8Array(readFileSync(path)));
    images.set(path, found);
  }
  return found;
}

const alphaAt = (img: Image, x: number, y: number): number =>
  x < 0 || y < 0 || x >= img.width || y >= img.height
    ? 0
    : (img.data[(y * img.width + x) * 4 + 3] ?? 0);

/** The frozen silhouette's alpha at a world point (nearest sprite pixel). */
function frozenAlpha(piece: FrozenPiece, sprite: Image, wx: number, wy: number): number {
  const u = (wx - piece.x) / piece.width;
  const v = (wy - piece.y) / piece.height;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0;
  const rect = piece.sourceRect ?? { x: 0, y: 0, width: sprite.width, height: sprite.height };
  const fx = Math.floor((piece.flip ? 1 - u : u) * rect.width);
  return alphaAt(
    sprite,
    rect.x + Math.min(rect.width - 1, fx),
    rect.y + Math.floor(v * rect.height),
  );
}

/** The shipped upright's alpha at a world point. */
function shippedAlpha(page: Image, id: string, wx: number, wy: number): number {
  const [, sx, sy, vx, vy, width, height] = BA_DAN_UPRIGHTS[id]!;
  const { scale, origin } = BA_DAN_PAINTING;
  const px = Math.floor((wx - origin.x) * scale) - vx;
  const py = Math.floor((wy - origin.y) * scale) - vy;
  if (px < 0 || py < 0 || px >= width || py >= height) return 0;
  return alphaAt(page, sx + px, sy + py);
}

const LIFTS = [8, 32, 56];
const ACROSS = [-12, 0, 12];

describe.each(geometry.pieces.filter((p) => BA_DAN_UPRIGHTS[p.id]).map((p) => [p.id, p] as const))(
  'upright %s',
  (_id, piece) => {
    it('covers a figure behind it wherever its frozen silhouette is solid', async () => {
      const sprite = await image(`${GEOMETRY}/sprites/${piece.file}`);
      const page = await image(
        `public/art/maps/ba-dan-scene/uprights-${BA_DAN_UPRIGHTS[piece.id]![0]}.webp`,
      );
      const depthKey = piece.depth.x + piece.depth.y;
      let checked = 0;
      const missed: string[] = [];
      for (const [cx, cy] of geometry.walkable) {
        if (!(depthKey > cx + cy + 1)) continue;
        const fx = cx + 0.5;
        const fy = cy + 0.5;
        const footX = 1024 + (fx - fy) * 64;
        const footY = (fx + fy) * 32;
        for (const lift of LIFTS)
          for (const dx of ACROSS) {
            const wx = Math.floor(footX + dx) + 0.5;
            const wy = Math.floor(footY - lift) + 0.5;
            let solid = true;
            for (let oy = -1; oy <= 1 && solid; oy++)
              for (let ox = -1; ox <= 1 && solid; ox++)
                if (frozenAlpha(piece, sprite, wx + ox, wy + oy) < 250) solid = false;
            if (!solid) continue;
            checked++;
            if (shippedAlpha(page, piece.id, wx, wy) < 250)
              missed.push(`(${cx},${cy}) lift ${lift} dx ${dx}`);
          }
      }
      expect(missed, `${piece.id}: a figure behind it shows through at`).toEqual([]);
      // Every house has figures behind it; a tree or a dressing piece may not on this map.
      if (/house/.test(piece.id))
        expect(checked, `${piece.id}: no figure behind it was checked`).toBeGreaterThan(20);
    });
  },
);
