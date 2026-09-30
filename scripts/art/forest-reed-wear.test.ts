import { expect, it } from 'vitest';
import { FOREST_ROAD_SCENE } from '../../src/content/scenes/forestRoad';
import {
  REED_FEET,
  REED_PIECES,
  REED_WEAR_REACH,
  reedWear,
  worldLogical,
} from './forest-reed-wear';

it('seats exactly the pieces that opt out of the contact shadow', () => {
  const optedOut = FOREST_ROAD_SCENE.scenery.filter((piece) => piece.contactShadow === false);
  expect(optedOut.map((piece) => piece.id).sort()).toEqual(
    REED_PIECES.map((piece) => piece.id).sort(),
  );
  // Every one of them has painted feet to wear the ground at.
  for (const piece of REED_PIECES) {
    const feet = REED_FEET.filter(
      (f) =>
        f.x >= piece.x &&
        f.x <= piece.x + piece.width &&
        f.y >= piece.y &&
        f.y <= piece.y + 2 * piece.height,
    );
    // The new 20 px sedge samples exactly ten opaque foot columns; that is
    // enough to seat its deliberately smaller footprint without demanding
    // the density of the broader reed fans.
    expect(feet.length, piece.id).toBeGreaterThanOrEqual(10);
  }
});

it('wears the ground at the painted foot, never round the footprint', () => {
  for (const piece of REED_PIECES) {
    const cell = piece.footprint[0];
    if (!cell) throw new Error(piece.id);
    let worn = 0,
      far = 0;
    // The cell's boundary band, walked in eight arcs: wear that closed every
    // one of them would be the footprint's outline again.
    const arcs = new Array<boolean>(8).fill(false);
    for (let wy = piece.y - REED_WEAR_REACH; wy < piece.y + piece.height + REED_WEAR_REACH; wy++)
      for (let wx = piece.x - REED_WEAR_REACH; wx < piece.x + piece.width + REED_WEAR_REACH; wx++) {
        if (!reedWear(wx + 0.5, wy + 0.5)) continue;
        worn++;
        const near = Math.min(
          ...REED_FEET.map((f) => Math.hypot(wx + 0.5 - f.x, 2 * (wy + 0.5 - f.y))),
        );
        if (near > REED_WEAR_REACH) far++;
        const { x, y } = worldLogical(wx + 0.5, wy + 0.5);
        const dx = x - cell.x - 0.5,
          dy = y - cell.y - 0.5;
        if (Math.abs(Math.max(Math.abs(dx), Math.abs(dy)) - 0.5) < 0.06) {
          const arc = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 8) % 8;
          arcs[arc] = true;
        }
      }
    expect(worn, piece.id).toBeGreaterThan(80);
    expect(far, piece.id).toBe(0);
    expect(arcs.filter(Boolean).length, piece.id).toBeLessThan(8);
  }
});
