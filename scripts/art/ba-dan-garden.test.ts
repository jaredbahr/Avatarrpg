import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BA_DAN_GARDEN_PLATES, BA_DAN_SCENE } from '../../src/content/scenes/baDan';
import { pixelAt } from './lib/image';
import { decodeWebp } from './lib/webp';
import {
  CONTACT_FEET,
  FLAGSTONE_TONES,
  contactWear,
  footprintDistance,
  GARDEN_TONES,
  GRAIN,
  MATERIAL_TONES,
  flagstoneTexel,
  gardenPlatePath,
  onExit,
  packGardenPlate,
  worldLogical,
} from './ba-dan-garden';

describe('Ba Dan outer garden', () => {
  it('ships the deterministic garden plates byte-for-pixel', async () => {
    for (const [index, plate] of BA_DAN_GARDEN_PLATES.entries()) {
      const expected = packGardenPlate(plate);
      const shipped = await decodeWebp(readFileSync(gardenPlatePath(index)));
      expect({ width: shipped.width, height: shipped.height }).toEqual({
        width: expected.width,
        height: expected.height,
      });
      expect(Buffer.from(shipped.data).equals(Buffer.from(expected.data))).toBe(true);
    }
  });

  it('uses only opaque two-pixel colour clusters or transparent exterior', () => {
    const allowed = new Set(
      [...Object.values(GARDEN_TONES), MATERIAL_TONES.road.shadow].map((tone) => tone.join(',')),
    );
    let painted = 0;
    let clear = 0;
    let exit = 0;
    const stone = new Set(FLAGSTONE_TONES.map(({ tone }) => tone.join(',')));
    for (const plate of BA_DAN_GARDEN_PLATES) {
      const image = packGardenPlate(plate);
      for (let y = 0; y < image.height; y += GRAIN) {
        for (let x = 0; x < image.width; x += GRAIN) {
          const rgba = pixelAt(image, x, y);
          if (rgba[3] === 0) clear++;
          else {
            painted++;
            expect(rgba[3]).toBe(255);
            const tx = (plate.x + x) / GRAIN;
            const ty = (plate.y + y) / GRAIN;
            const at = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
            // A road exit's last tile is the painted flagstone, not a garden tone.
            if (onExit(at.x, at.y)) {
              exit++;
              expect(rgba.slice(0, 3)).toEqual([...flagstoneTexel(tx, ty)]);
              expect(stone.has(rgba.slice(0, 3).join(','))).toBe(true);
            } else expect(allowed.has(rgba.slice(0, 3).join(','))).toBe(true);
          }
          for (let dy = 0; dy < GRAIN; dy++)
            for (let dx = 0; dx < GRAIN; dx++) expect(pixelAt(image, x + dx, y + dy)).toEqual(rgba);
        }
      }
    }
    expect(painted).toBeGreaterThan(100_000);
    expect(clear).toBeGreaterThan(1_000);
    expect(exit, 'both road exits carry flagstone under the courts').toBeGreaterThan(1_000);
  });

  it('wears the ground in clusters rather than a repeating ordered screen', () => {
    const wear = MATERIAL_TONES.road.shadow.join(',');
    let worn = 0;
    let singles = 0;
    for (const plate of BA_DAN_GARDEN_PLATES) {
      const image = packGardenPlate(plate);
      const isWear = (tx: number, ty: number): boolean =>
        pixelAt(image, tx * GRAIN, ty * GRAIN)
          .slice(0, 3)
          .join(',') === wear;
      for (let ty = 1; ty < image.height / GRAIN - 1; ty++)
        for (let tx = 1; tx < image.width / GRAIN - 1; tx++) {
          if (!isWear(tx, ty)) continue;
          worn++;
          // A worn texel with no worn neighbour: the unit an ordered screen is made of.
          const neighbours = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ] as const;
          if (!neighbours.some(([dx, dy]) => isWear(tx + dx, ty + dy))) singles++;
        }
    }
    expect(worn).toBeGreaterThan(1_000);
    // Measured: 37% for the 4x4 Bayer wear of 0fbcc40, 1.6% for these clusters.
    expect(singles / worn).toBeLessThan(0.05);
  });

  it('grounds scenery at its painted foot, never in a ring that traces the footprint', () => {
    expect(CONTACT_FEET.some((foot) => foot.tree)).toBe(true);
    expect(CONTACT_FEET.some((foot) => !foot.tree)).toBe(true);
    // Walk the band just outside each piece's logical footprint in sixteen arcs
    // around its centre, and count the arcs that are noticeably worn. A ring
    // drawn from the footprint wears nearly all of them: 0.75 to 1.0 for every
    // tree, 0.84 of all arcs over the scene, for the ring of 3bc0ce5. Wear laid
    // from the sprite's foot is lopsided and patchy.
    const shares: number[] = [];
    for (const piece of BA_DAN_SCENE.scenery) {
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
          if (contactWear(tx, ty)) arc.worn++;
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
