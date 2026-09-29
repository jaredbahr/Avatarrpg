import { describe, expect, it } from 'vitest';
import { buildGrid } from '../../core/rules/grid';
import { QUARRY_FLOOR } from '../../content/maps/combat';
import { Camera, TILE } from '../camera';
import { TIER_LIFT, liftAlong, liftAt, pickCell } from './elevation';
import { liftOps } from './lift';

const grid = buildGrid(QUARRY_FLOOR);
const cells = Array.from({ length: grid.width * grid.height }, (_, i) => ({
  x: i % grid.width,
  y: Math.floor(i / grid.width),
}));
const raised = cells.filter((c) => liftAt(grid, c, 'oblique') > 0);

function camera(): Camera {
  const cam = new Camera({ width: 1194, height: 700, dpr: 2 }, grid, 'oblique');
  cam.scale = 1.4;
  cam.offsetX = 180;
  cam.offsetY = -40;
  return cam;
}

describe('lift', () => {
  it('lifts walkable raised tiles a quarter tile a tier and leaves masses flat', () => {
    expect(raised.length).toBeGreaterThan(30);
    expect(liftAt(grid, { x: 5, y: 1 }, 'oblique')).toBe(TIER_LIFT); // S ramp bench
    expect(liftAt(grid, { x: 2, y: 1 }, 'oblique')).toBe(2 * TIER_LIFT); // A gantry perch
    expect(liftAt(grid, { x: 5, y: 0 }, 'oblique')).toBe(0); // X rock face
    expect(liftAt(grid, { x: 5, y: 1 }, 'orthographic')).toBeCloseTo(0.06, 9);
  });

  it('climbs smoothly between a floor cell and a bench', () => {
    expect(liftAlong(grid, { x: 5, y: 1.5 }, 'oblique')).toBeCloseTo(TIER_LIFT / 2, 9);
    expect(liftAlong(grid, { x: 5, y: 2 }, 'oblique')).toBe(0);
  });
});

describe('pickCell', () => {
  it('still picks every cell at its flat centre', () => {
    for (const c of cells)
      expect(pickCell(grid, { x: c.x + 0.5, y: c.y + 0.5 }, 'oblique')).toEqual(c);
  });

  it('picks a raised cell anywhere on its lifted top, where the flat pick missed it', () => {
    let missedFlat = 0;
    for (const c of raised) {
      const lift = liftAt(grid, c, 'oblique');
      for (const [fx, fy] of [
        [0.5, 0.5],
        [0.1, 0.1],
        [0.9, 0.12],
        [0.12, 0.9],
      ] as const) {
        // The screen point over (fx, fy) of the lifted top lies over this flat ground point.
        const ground = { x: c.x + fx - lift, y: c.y + fy - lift };
        const picked = pickCell(grid, ground, 'oblique');
        // A later, taller block may stand in front; otherwise the top is what is hit.
        const front = picked.x + picked.y > c.x + c.y && liftAt(grid, picked, 'oblique') > lift;
        if (!front) expect(picked, `${c.x},${c.y} at ${fx},${fy}`).toEqual(c);
        if (Math.floor(ground.x) !== c.x || Math.floor(ground.y) !== c.y) missedFlat++;
      }
    }
    expect(missedFlat).toBeGreaterThan(raised.length);
  });

  it('picks a raised cell by its visible faces, and the lower cell below the foot', () => {
    // (5,1) is a tier-1 bench over the floor at (5,2): its south face hangs over
    // (5,1)'s own lower edge, and just past the edge is the floor cell.
    const edge = { x: 5.5, y: 1.99 };
    expect(pickCell(grid, edge, 'oblique')).toEqual({ x: 5, y: 1 });
    expect(pickCell(grid, { x: 5.5, y: 2.01 }, 'oblique')).toEqual({ x: 5, y: 2 });
  });

  it('is flat on the orthographic board', () => {
    expect(pickCell(grid, { x: 5.2, y: 0.95 }, 'orthographic')).toEqual({ x: 5, y: 0 });
  });

  it('inverts the camera for the lifted tile centre the renderers draw', () => {
    const cam = camera();
    for (const c of raised) {
      const lift = liftAt(grid, c, 'oblique');
      const p = cam.project({ x: c.x + 0.5, y: c.y + 0.5 });
      const y = p.y - lift * TILE * cam.scale;
      expect(cam.pickTile(p.x, y, grid)).toEqual(c);
      expect(cam.pickTile(p.x, y, null)).toEqual(cam.toTile(p.x, y));
    }
  });
});

describe('liftOps', () => {
  const tilePx = 90;
  const project = (pos: { x: number; y: number }) => ({
    x: (pos.x - pos.y) * tilePx,
    y: ((pos.x + pos.y) / 2) * tilePx,
  });
  const ops = (artLift = 0) => liftOps({ grid, project, tilePx, artLift, contrast: false });

  /** The cell a top op redraws, and the ground under the centre of that top. */
  const tops = () =>
    ops().flatMap((op) => {
      if (op.kind !== 'top') return [];
      const sx = op.poly.reduce((sum, p) => sum + p.x, 0) / 4;
      const sy = op.poly.reduce((sum, p) => sum + p.y, 0) / 4;
      const unproject = (y: number) => ({
        x: y / tilePx + sx / tilePx / 2,
        y: y / tilePx - sx / tilePx / 2,
      });
      const flat = unproject(sy + op.shift);
      return [{ cell: { x: Math.floor(flat.x), y: Math.floor(flat.y) }, top: unproject(sy) }];
    });

  it('draws one lifted top per raised walkable cell, back to front', () => {
    const drawn = tops().map(({ cell }) => cell);
    expect([...drawn].sort((a, b) => a.y - b.y || a.x - b.x)).toEqual(raised);
    for (let i = 1; i < drawn.length; i++) {
      const [a, b] = [drawn[i - 1], drawn[i]];
      expect(a && b && a.x + a.y <= b.x + b.y).toBe(true);
    }
  });

  it('draws every top where a tap picks that cell', () => {
    for (const { cell, top } of tops()) {
      const picked = pickCell(grid, top, 'oblique');
      const taller = liftAt(grid, picked, 'oblique') > liftAt(grid, cell, 'oblique');
      if (!taller) expect(picked).toEqual(cell);
    }
  });

  it('samples the flat picture from where the art already stands', () => {
    const [flat] = ops(0).filter((op) => op.kind === 'top');
    const [painted] = ops(0.06).filter((op) => op.kind === 'top');
    expect(flat && painted && flat.kind === 'top' && painted.kind === 'top').toBe(true);
    if (flat?.kind !== 'top' || painted?.kind !== 'top') return;
    expect(flat.poly).toEqual(painted.poly);
    // (2,1) is the first raised cell drawn: a tier-2 perch.
    expect(flat.shift).toBeCloseTo(2 * TIER_LIFT * tilePx, 9);
    expect(painted.shift).toBeCloseTo((2 * TIER_LIFT - 0.12) * tilePx, 9);
  });

  it('leaves art painted at the full lift in charge', () => {
    expect(ops(TIER_LIFT)).toEqual([]);
  });

  it('gives a ramp stair treads that a plain ledge does not get', () => {
    const one = (key: 'S' | '^') =>
      liftOps({
        grid: buildGrid({ ...QUARRY_FLOOR, width: 3, height: 3, rows: ['...', `.${key}.`, '...'] }),
        project,
        tilePx,
        artLift: 0,
        contrast: false,
      });
    const ramp = one('S');
    const ledge = one('^');
    const faces = (list: typeof ramp) =>
      list.filter((op) => op.kind === 'fill' && op.alpha === 1).length;
    expect(faces(ramp)).toBe(2);
    expect(faces(ledge)).toBe(2);
    expect(ramp.length).toBeGreaterThan(ledge.length + 5);
  });
});
