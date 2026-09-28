import { describe, expect, it } from 'vitest';
import type { BendTrajectory } from '../../content/bends';
import { projectGround } from '../projection';
import {
  aimDeg,
  boardStep,
  celTurnDeg,
  flightMs,
  flightPoint,
  segmentBetween,
  whipHead,
} from './trajectory';

/** The shipped trajectories (public/art/fx/bend-effects.json). */
const FIRE: BendTrajectory = { kind: 'arc', speedTilesPerSecond: 9.8, heightTiles: 0.2, spin: 0 };
const WATER: BendTrajectory = {
  kind: 'whipBolt',
  whipFraction: 0.333,
  whipMaxTiles: 1.5,
  boltSpeedTilesPerSecond: 11.1,
};
const STRAIGHT: BendTrajectory = { kind: 'straight', speedTilesPerSecond: 10 };

const STEP = Math.hypot(1, 0.5);
const board = (x: number, y: number) => projectGround({ x, y }, 'oblique');
const ORIGIN = board(0, 0);
/** A grid axis is a screen diagonal on the oblique board; a grid diagonal is screen-horizontal. */
const CASES = {
  shortCardinal: { to: board(3, 0), tiles: 3 },
  longCardinal: { to: board(5, 0), tiles: 5 },
  shortDiagonal: { to: board(3, -3), tiles: 6 / STEP },
  longDiagonal: { to: board(5, -5), tiles: 10 / STEP },
} as const;

describe('bend trajectories', () => {
  it('measures a tile as one board step, as the prototype did', () => {
    // The prototype's STEP = (96, 48) px, one grid step on the oblique board.
    expect(boardStep('oblique')).toBe(Math.hypot(96, 48) / 96);
    expect(boardStep('orthographic')).toBe(1);
    expect(board(1, 0)).toEqual({ x: 1, y: 0.5 });
    expect(board(3, -3)).toEqual({ x: 6, y: 0 });
  });

  it('times a flight by its real length over its speed', () => {
    for (const [name, { to, tiles }] of Object.entries(CASES)) {
      expect(flightMs(FIRE, ORIGIN, to, STEP), name).toBeCloseTo((tiles / 9.8) * 1000, 9);
    }
    expect(flightMs(FIRE, ORIGIN, CASES.shortCardinal.to, STEP)).toBeCloseTo(306.1224489796, 9);
    expect(flightMs(FIRE, ORIGIN, CASES.longDiagonal.to, STEP)).toBeCloseTo(912.6808071428, 9);
    // A square board's step is a tile width.
    expect(flightMs(STRAIGHT, { x: 0, y: 0 }, { x: 3, y: 4 }, 1)).toBeCloseTo(500, 9);
    // Nowhere to go takes no time.
    expect(flightMs(FIRE, ORIGIN, ORIGIN, STEP)).toBe(0);
  });

  it('lifts an arc by its height in tiles at the middle and lands on the target', () => {
    const { to } = CASES.shortCardinal;
    const total = flightMs(FIRE, ORIGIN, to, STEP);
    const mid = flightPoint(FIRE, ORIGIN, to, STEP, total / 2);
    expect(mid.x).toBeCloseTo(1.5, 12);
    expect(mid.y).toBeCloseTo(0.75 - 0.2 * STEP, 12);
    const quarter = flightPoint(FIRE, ORIGIN, to, STEP, total / 4);
    expect(quarter.x).toBeCloseTo(0.75, 12);
    expect(quarter.y).toBeCloseTo(0.375 - 4 * 0.2 * STEP * 0.25 * 0.75, 12);
    expect(flightPoint(FIRE, ORIGIN, to, STEP, -50)).toMatchObject({ x: 0, y: 0 });
    expect(flightPoint(FIRE, ORIGIN, to, STEP, total + 50)).toMatchObject({ x: 3, y: 1.5 });
    // The long diagonal lifts by the same height: it is in tiles, not a fraction of the path.
    const far = CASES.longDiagonal.to;
    const farMid = flightPoint(FIRE, ORIGIN, far, STEP, flightMs(FIRE, ORIGIN, far, STEP) / 2);
    expect(farMid.x).toBeCloseTo(5, 12);
    expect(farMid.y).toBeCloseTo(-0.2 * STEP, 12);
  });

  it('keeps a straight path and a bolt on the chord', () => {
    const { to } = CASES.shortDiagonal;
    const half = flightMs(STRAIGHT, ORIGIN, to, STEP) / 2;
    expect(flightPoint(STRAIGHT, ORIGIN, to, STEP, half)).toEqual({ x: 3, y: 0, spin: 0 });
    const bolt = flightPoint(WATER, ORIGIN, to, STEP, flightMs(WATER, ORIGIN, to, STEP) / 2);
    expect(bolt).toEqual({ x: 3, y: 0, spin: 0 });
  });

  it('spins an arc by whole turns over the flight', () => {
    const spun: BendTrajectory = { ...FIRE, spin: 2 };
    const { to } = CASES.longCardinal;
    const total = flightMs(spun, ORIGIN, to, STEP);
    expect(flightPoint(spun, ORIGIN, to, STEP, total / 4).spin).toBeCloseTo(180, 9);
    expect(flightPoint(spun, ORIGIN, to, STEP, total).spin).toBeCloseTo(720, 9);
  });

  it('stops the whip at a third of the way, and never past 1.5 tiles', () => {
    const short = whipHead(WATER, ORIGIN, CASES.shortCardinal.to, STEP);
    expect(short.x).toBeCloseTo(3 * 0.333, 12);
    expect(short.y).toBeCloseTo(1.5 * 0.333, 12);
    const long = whipHead(WATER, ORIGIN, CASES.longCardinal.to, STEP);
    // Five tiles: a third is 1.665, over the cap.
    expect(Math.hypot(long.x, long.y) / STEP).toBeCloseTo(1.5, 12);
    expect(long.y / long.x).toBeCloseTo(0.5, 12);
    const diagonal = whipHead(WATER, ORIGIN, CASES.shortDiagonal.to, STEP);
    expect(diagonal.x).toBeCloseTo(1.5 * STEP, 12);
    expect(diagonal.y).toBe(0);
    // The bolt flies the rest at its own speed.
    const rest = flightMs(WATER, diagonal, CASES.shortDiagonal.to, STEP);
    expect(rest).toBeCloseTo(((6 / STEP - 1.5) / 11.1) * 1000, 9);
    // Anything but a whip-bolt has no whip.
    expect(whipHead(FIRE, ORIGIN, CASES.shortCardinal.to, STEP)).toBe(ORIGIN);
    expect(whipHead(WATER, ORIGIN, ORIGIN, STEP)).toBe(ORIGIN);
  });

  it('turns a cel toward the target, by a fixed angle, or not at all', () => {
    const cardinal = aimDeg(ORIGIN, CASES.shortCardinal.to);
    expect(cardinal).toBeCloseTo((Math.atan(0.5) * 180) / Math.PI, 12);
    expect(aimDeg(ORIGIN, CASES.shortDiagonal.to)).toBe(0);
    expect(aimDeg(ORIGIN, board(0, 3))).toBeCloseTo(180 - cardinal, 12);
    // The fire cels were painted pointing 32 degrees clockwise.
    expect(celTurnDeg({ facing: 32 }, cardinal)).toBeCloseTo(cardinal - 32, 12);
    expect(celTurnDeg({ facing: 32 }, 0)).toBe(-32);
    expect(celTurnDeg({ angle: -8 }, cardinal)).toBe(-8);
    expect(celTurnDeg({}, cardinal)).toBe(0);
  });

  it('stretches a segment between two points about their midpoint', () => {
    const flat = segmentBetween({ x: 0, y: 0 }, { x: 2, y: 0 }, { facing: 0 }, 1.353);
    expect(flat.at).toEqual({ x: 1, y: 0 });
    expect(flat.turn).toBe(0);
    expect(flat.width).toBeCloseTo(2.706, 12);
    const down = segmentBetween({ x: 1, y: 1 }, { x: 2, y: 2 }, {}, 1.12);
    expect(down.at).toEqual({ x: 1.5, y: 1.5 });
    expect(down.turn).toBeCloseTo(45, 12);
    expect(down.width).toBeCloseTo(1.12 * Math.SQRT2, 12);
  });
});
