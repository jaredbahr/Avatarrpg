import { describe, expect, it } from 'vitest';
import { buildGrid } from '../../core/rules/grid';
import { QUARRY_FLOOR } from '../../content/maps/combat';
import { Camera, TILE } from '../camera';
import { TIER_LIFT, liftAlong, liftAt, pickCell } from './elevation';
import { clusters, liftOps, liftPlan, markedCells, marksSchedule } from './lift';
import type { LiveMarks } from './lift';

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
    const list = ops(TIER_LIFT);
    // Nothing is drawn over it: its blocks are only put back, unshifted.
    expect(list.every((op) => op.kind === 'top' || op.kind === 'overlay')).toBe(true);
    for (const op of list) if (op.kind === 'top') expect(op.shift).toBe(0);
  });

  /*
   * The live marks (hover, ranges, the path, surfaces, exits, High-contrast
   * markers) must sit where a tap picks the tile, whatever the art paints:
   * moved by the cell's whole lift, onto the same top the pick hits.
   */
  for (const artLift of [0, 0.06, TIER_LIFT, [0.06, TIER_LIFT]]) {
    it(`lifts each raised cell's marks by its whole lift over art at ${String(artLift)}`, () => {
      const list = liftOps({ grid, project, tilePx, artLift, contrast: false });
      const marks = list.flatMap((op) => (op.kind === 'overlay' ? [op] : []));
      expect(marks).toHaveLength(raised.length);
      for (const op of marks) {
        const sx = op.poly.reduce((sum, p) => sum + p.x, 0) / 4;
        const sy = op.poly.reduce((sum, p) => sum + p.y, 0) / 4;
        const unproject = (y: number) => ({
          x: y / tilePx + sx / tilePx / 2,
          y: y / tilePx - sx / tilePx / 2,
        });
        const flat = unproject(sy + op.shift);
        const cell = { x: Math.floor(flat.x), y: Math.floor(flat.y) };
        const lift = liftAt(grid, cell, 'oblique');
        expect(lift, `${cell.x},${cell.y}`).toBeGreaterThan(0);
        // The shift is the cell's whole lift, the lift an actor and a pick use.
        expect(op.shift).toBeCloseTo(lift * tilePx, 9);
        // The polygon is that cell's lifted top: its corners, a lift up the screen.
        const corners = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ].map(([gx = 0, gy = 0]) => project({ x: cell.x + gx, y: cell.y + gy }));
        op.poly.forEach((p, i) => {
          expect(p.x).toBeCloseTo(corners[i]?.x ?? NaN, 9);
          expect(p.y).toBeCloseTo((corners[i]?.y ?? NaN) - lift * tilePx, 9);
        });
        // And a tap on its centre picks it, unless a taller block stands in front.
        const picked = pickCell(grid, unproject(sy), 'oblique');
        if (liftAt(grid, picked, 'oblique') <= lift) expect(picked).toEqual(cell);
      }
    });
  }

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
    const faces = (list: typeof ramp) => list.filter((op) => op.kind === 'face').length;
    expect(faces(ramp)).toBe(2);
    expect(faces(ledge)).toBe(2);
    expect(ramp.length).toBeGreaterThan(ledge.length + 5);
  });
});

/*
 * What keeps the pass cheap on an iPad: the layer is cropped to the raised
 * blocks on screen, and the live marks go only on the tops near one.
 */
describe('liftPlan cost', () => {
  const noMarks: LiveMarks = {
    overlays: [],
    hoverTile: null,
    path: [],
    pathFrom: null,
    aimArc: null,
    exit: null,
    emitters: [],
  };

  it('crops the layer to the raised blocks on screen and drops it with none there', () => {
    const cam = camera();
    const plan = liftPlan(grid, cam, 0, false);
    const { width, height, dpr } = cam.viewport;
    const rect = plan.bounds;
    expect(rect).not.toBeNull();
    if (!rect) return;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.w).toBeLessThanOrEqual(width);
    expect(rect.y + rect.h).toBeLessThanOrEqual(height);
    // On whole device pixels, so the layer's texels sit on the screen's.
    for (const v of [rect.x, rect.y, rect.w, rect.h])
      expect(v * dpr).toBeCloseTo(Math.round(v * dpr), 6);
    // Every op a cell draws lies inside it.
    for (const cell of plan.cells)
      for (const poly of cell.block)
        for (const p of poly) {
          if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) continue;
          expect(p.x).toBeGreaterThanOrEqual(rect.x);
          expect(p.y).toBeLessThanOrEqual(rect.y + rect.h);
        }
    // Panned off the board, nothing raised is on screen: no layer at all.
    cam.offsetX = -5000;
    const off = liftPlan(grid, cam, 0, false);
    expect(off.cells).toHaveLength(0);
    expect(off.bounds).toBeNull();
  });

  it('asks the same plan back while nothing moves', () => {
    const cam = camera();
    const still = liftPlan(grid, cam, 0, false);
    expect(liftPlan(grid, cam, 0, false)).toBe(still);
    cam.offsetX += 1;
    expect(liftPlan(grid, cam, 0, false)).not.toBe(still);
  });

  it('marks nothing with no live marks, and only the tops near one', () => {
    const plan = liftPlan(grid, camera(), 0, false);
    expect(markedCells(grid, noMarks)).toBeNull();
    // A surface the art paints (reach 0) is no live mark.
    expect(markedCells(grid, noMarks, { surfaces: () => 0 })).toBeNull();
    expect(marksSchedule(plan, grid, markedCells(grid, noMarks))).toEqual([]);
    // A hover on the (5,1) ramp bench marks it and its neighbours, no more.
    const marked = markedCells(grid, { ...noMarks, hoverTile: { x: 5, y: 1 } });
    const steps = marksSchedule(plan, grid, marked);
    const tops = plan.cells.filter((c) => c.top);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThan(10);
    expect(steps.length).toBeLessThan(tops.length / 3);
    const hovered = steps.find((s) => s.cell.x === 5 && s.cell.y === 1);
    expect(hovered?.marks).toBe(true);
    for (const { cell } of steps)
      expect(Math.max(Math.abs(cell.x - 5), Math.abs(cell.y - 1))).toBeLessThanOrEqual(2);
    // In painter order, as the layer's own blocks are.
    for (let i = 1; i < steps.length; i++) {
      const [a, b] = [steps[i - 1]?.cell, steps[i]?.cell];
      expect(a && b && a.x + a.y <= b.x + b.y).toBe(true);
    }
    // The grid lines reach every tile.
    const all = markedCells(grid, noMarks, { gridLines: true });
    expect(marksSchedule(plan, grid, all).filter((s) => s.marks)).toHaveLength(tops.length);
  });

  it('keeps far-apart marked tops in targets of their own', () => {
    const a = { x: 0, y: 0, w: 100, h: 60 };
    const near = { x: 90, y: 10, w: 100, h: 60 };
    const far = { x: 900, y: 700, w: 100, h: 60 };
    const groups = clusters([a, far, near]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.members.includes(0))?.members.sort()).toEqual([0, 2]);
    expect(groups.find((g) => g.members.includes(1))?.rect).toEqual(far);
    expect(clusters([])).toEqual([]);
  });

  it('copies back a taller block in front of a marked top before its own marks', () => {
    // A tier-1 bench with a tier-2 perch just in front of it.
    const small = buildGrid({
      ...QUARRY_FLOOR,
      width: 4,
      height: 4,
      rows: ['....', '.^..', '.^A.', '....'],
    });
    const cam = new Camera({ width: 800, height: 600, dpr: 2 }, small, 'oblique');
    cam.fit();
    const plan = liftPlan(small, cam, 0, false);
    const perch = { x: 2, y: 2 };
    expect(liftAt(small, perch, 'oblique')).toBe(2 * TIER_LIFT);
    const marked = markedCells(small, { ...noMarks, hoverTile: { x: 0, y: 0 } });
    const steps = marksSchedule(plan, small, marked);
    // The hover reaches (1,1), whose top the perch stands over: the perch is
    // copied back over it, and takes no marks of its own.
    expect(steps.find((s) => s.cell.x === 1 && s.cell.y === 1)?.marks).toBe(true);
    expect(steps.find((s) => s.cell.x === perch.x && s.cell.y === perch.y)).toEqual(
      expect.objectContaining({ recover: true, marks: false }),
    );
  });
});
