import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BA_DAN_GARDEN_PLATES, BA_DAN_SCENE } from '../../src/content/scenes/baDan';
import { pixelAt } from './lib/image';
import { decodeWebp } from './lib/webp';
import {
  CONTACT_FEET,
  contactWear,
  footprintDistance,
  GRAIN,
  flagstonePixel,
  gardenTexel,
  gardenPlatePath,
  onExit,
  packGardenPlate,
  wearOwner,
  worldLogical,
} from './ba-dan-garden';
import { villageBake } from './ba-dan-village-material';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

// Each plate is packed once for the whole file: the generator is the cost, and both
// the shipped-bytes check and the pixel-contract check read the same image.
const packed = new Map<number, ReturnType<typeof packGardenPlate>>();
function packedPlate(index: number) {
  let image = packed.get(index);
  if (!image) {
    const plate = BA_DAN_GARDEN_PLATES[index];
    if (!plate) throw new Error(`No garden plate ${index}`);
    image = packGardenPlate(plate);
    packed.set(index, image);
  }
  return image;
}

describe('Ba Dan outer garden', () => {
  it('ships the deterministic garden plates: exact alpha, lossy paint within the encoder noise', async () => {
    // The plates ship as lossy WebP (a lossless alpha plane) to stay inside the
    // asset budget, so the paint is held to the encoder's noise rather than to
    // the byte. The alpha, which decides what the apron may continue, is exact.
    for (const index of BA_DAN_GARDEN_PLATES.keys()) {
      const expected = packedPlate(index);
      const shipped = await decodeWebp(readFileSync(gardenPlatePath(index)));
      expect({ width: shipped.width, height: shipped.height }).toEqual({
        width: expected.width,
        height: expected.height,
      });
      let channels = 0;
      let error = 0;
      let large = 0;
      let alphaAt = -1;
      for (let at = 0; at < expected.data.length; at += 4) {
        if (alphaAt < 0 && shipped.data[at + 3] !== expected.data[at + 3]) alphaAt = at;
        if (expected.data[at + 3] === 0) continue;
        for (let channel = 0; channel < 3; channel++) {
          const diff = Math.abs(
            (shipped.data[at + channel] ?? 0) - (expected.data[at + channel] ?? 0),
          );
          error += diff;
          if (diff > 16) large++;
          channels++;
        }
      }
      // One assertion per plate instead of one per pixel; it names the first bad pixel.
      expect(alphaAt >= 0 ? shipped.data[alphaAt + 3] : 0, `alpha at ${alphaAt / 4}`).toBe(
        alphaAt >= 0 ? expected.data[alphaAt + 3] : 0,
      );
      expect(error / channels, `plate ${index} mean error`).toBeLessThan(3.5);
      expect(large / channels, `plate ${index} share of large errors`).toBeLessThan(0.005);
    }
  });

  it('uses opaque one-world-pixel paint or transparent exterior', () => {
    let painted = 0;
    let clear = 0;
    let exit = 0;
    const check = (
      rgba: readonly number[],
      want: readonly number[],
      x: number,
      y: number,
    ): void => {
      if (bad) return;
      if (rgba[0] !== want[0] || rgba[1] !== want[1] || rgba[2] !== want[2])
        bad = { at: `${x},${y}`, got: rgba.slice(0, 3), want: [...want] };
    };
    let bad: { at: string; got: number[]; want: number[] } | undefined;
    let badAlpha: number | undefined;
    for (const [index, plate] of BA_DAN_GARDEN_PLATES.entries()) {
      const image = packedPlate(index);
      for (let y = 0; y < image.height; y += GRAIN) {
        for (let x = 0; x < image.width; x += GRAIN) {
          const rgba = pixelAt(image, x, y);
          const tx = (plate.x + x) / GRAIN;
          const ty = (plate.y + y) / GRAIN;
          const at = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
          if (rgba[3] === 0) clear++;
          else {
            painted++;
            if (rgba[3] !== 255) badAlpha ??= rgba[3];
            // A road exit's last tile is the painted flagstone, not a garden tone.
            if (onExit(at.x, at.y)) {
              exit++;
              // Every plate pixel is the material, then the one shared bake.
              check(
                rgba,
                villageBake(
                  plate.x + x + 0.5,
                  plate.y + y + 0.5,
                  flagstonePixel(plate.x + x + 0.5, plate.y + y + 0.5),
                ),
                plate.x + x,
                plate.y + y,
              );
            } else
              check(
                rgba,
                villageBake((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN, gardenTexel(tx, ty)),
                plate.x + x,
                plate.y + y,
              );
          }
        }
      }
    }
    expect(badAlpha, 'painted pixels are opaque').toBeUndefined();
    expect(bad, 'every plate pixel is the material, then the one shared bake').toBeUndefined();
    expect(painted).toBeGreaterThan(100_000);
    expect(clear).toBeGreaterThan(1_000);
    expect(exit, 'both road exits carry flagstone under the courts').toBeGreaterThan(1_000);
  });

  it('grounds scenery at its painted foot, never in a ring that traces the footprint', () => {
    const exterior = new Set(
      BA_DAN_SCENE.scenery.filter((piece) => piece.exterior).map((piece) => piece.id),
    );
    expect(CONTACT_FEET.every((foot) => !exterior.has(foot.piece))).toBe(true);
    expect(CONTACT_FEET.some((foot) => foot.tree)).toBe(true);
    expect(CONTACT_FEET.some((foot) => !foot.tree)).toBe(true);
    // Walk the band just outside each piece's logical footprint in sixteen arcs
    // around its centre, and count the arcs that are noticeably worn. A ring
    // drawn from the footprint wears nearly all of them: 0.75 to 1.0 for every
    // tree, 0.84 of all arcs over the scene, for the ring of 3bc0ce5. Wear laid
    // from the sprite's foot is lopsided and patchy.
    const shares: number[] = [];
    for (const piece of BA_DAN_SCENE.scenery.filter((piece) => !piece.exterior)) {
      const cells = piece.footprint;
      const cx = cells.reduce((sum, cell) => sum + cell.x + 0.5, 0) / cells.length;
      const cy = cells.reduce((sum, cell) => sum + cell.y + 0.5, 0) / cells.length;
      const arcs = Array.from({ length: 16 }, () => ({ all: 0, worn: 0 }));
      const xs = cells.map((cell) => cell.x);
      const ys = cells.map((cell) => cell.y);
      const [minX, maxX] = [Math.min(...xs) - 1, Math.max(...xs) + 2];
      const [minY, maxY] = [Math.min(...ys) - 1, Math.max(...ys) + 2];
      for (
        let ty = Math.floor(((minX + minY) * 32) / GRAIN);
        ty < ((maxX + maxY) * 32) / GRAIN;
        ty++
      )
        for (
          let tx = Math.floor((1024 + (minX - maxY) * 64) / GRAIN);
          tx < (1024 + (maxX - minY) * 64) / GRAIN;
          tx++
        ) {
          const { x, y } = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
          const distance = footprintDistance(x, y, cells);
          if (distance <= 0.02 || distance > 0.2) continue;
          const turn = (Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI);
          const arc = arcs[Math.min(15, Math.floor(turn * 16))];
          if (!arc) continue;
          arc.all++;
          // Only this piece's own wear: along the woodland rim a neighbouring
          // trunk's spill reaches round a tree, and that is not a ring.
          if (contactWear(tx, ty) && wearOwner(tx, ty) === piece.id) arc.worn++;
        }
      const sampled = arcs.filter((arc) => arc.all > 0);
      const share = sampled.filter((arc) => arc.worn / arc.all >= 0.2).length / sampled.length;
      expect(share, `${piece.id} is worn all round its footprint`).toBeLessThan(0.75);
      shares.push(share);
    }
    const mean = shares.reduce((sum, share) => sum + share, 0) / shares.length;
    expect(mean, 'the scene wears footprints in rings').toBeLessThan(0.5);
  });
});
