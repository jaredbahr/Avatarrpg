import { describe, expect, it } from 'vitest';
import type { BendTrajectory } from '../../content/bends';
import { projectGround } from '../projection';
import {
  aimDeg,
  boardStep,
  celTurnDeg,
  flightDurationMs,
  flightPoint,
  flightStretch,
  lerp,
  segmentBetween,
  whipHead,
} from './trajectory';

/** The shipped trajectories (public/art/fx/bend-effects.json). */
const FIRE: BendTrajectory = { kind: 'arc', heightTiles: 0.2, spin: 0 };
const WATER: BendTrajectory = { kind: 'whipBolt', whipFraction: 0.333, whipMaxTiles: 1.5 };
const STRAIGHT: BendTrajectory = { kind: 'straight' };
/** Any flight's length: the sampler hands it in. */
const TOTAL = 300;

const STEP = Math.hypot(1, 0.5);
const board = (x: number, y: number) => projectGround({ x, y }, 'oblique');
const ORIGIN = board(0, 0);
/** A grid axis is a screen diagonal on the oblique board; a grid diagonal is screen-horizontal. */
const CASES = {
  shortCardinal: { to: board(3, 0) },
  longCardinal: { to: board(5, 0) },
  shortDiagonal: { to: board(3, -3) },
  longDiagonal: { to: board(5, -5) },
} as const;

describe('bend trajectories', () => {
  it('measures a tile as one board step, as the prototype did', () => {
    // The prototype's STEP = (96, 48) px, one grid step on the oblique board.
    expect(boardStep('oblique')).toBe(Math.hypot(96, 48) / 96);
    expect(boardStep('orthographic')).toBe(1);
    expect(board(1, 0)).toEqual({ x: 1, y: 0.5 });
    expect(board(3, -3)).toEqual({ x: 6, y: 0 });
  });

  it('stretches the prototype flight by a tenth a tile of range from 3, within 0.8-1.3', () => {
    const stretch: [number, number][] = [
      [0, 0.8],
      [1, 0.8],
      [2, 0.9],
      [3, 1],
      [4, 1.1],
      [5, 1.2],
      [6, 1.3],
      [9, 1.3],
      [20, 1.3],
    ];
    for (const [tiles, k] of stretch) expect(flightStretch(tiles), `${tiles}`).toBeCloseTo(k, 12);
    // The prototype's own flight at its own 3-tile range; the rest follow the rule.
    expect(flightDurationMs(280, 3)).toBe(280);
    expect(flightDurationMs(280, 1)).toBeCloseTo(224, 9);
    expect(flightDurationMs(280, 5)).toBeCloseTo(336, 9);
    expect(flightDurationMs(280, 9)).toBeCloseTo(364, 9);
  });

  it('covers any distance in the flight it is given, at an even speed', () => {
    for (const { to } of Object.values(CASES)) {
      expect(flightPoint(STRAIGHT, ORIGIN, to, STEP, TOTAL / 2, TOTAL)).toEqual({
        ...lerp(ORIGIN, to, 0.5),
        spin: 0,
      });
      expect(flightPoint(STRAIGHT, ORIGIN, to, STEP, TOTAL, TOTAL)).toMatchObject(to);
    }
    // A flight with no time left is already there.
    expect(flightPoint(FIRE, ORIGIN, CASES.shortCardinal.to, STEP, 0, 0)).toMatchObject({
      x: 3,
      y: 1.5,
    });
  });

  it('lifts an arc by its height in tiles at the middle and lands on the target', () => {
    const { to } = CASES.shortCardinal;
    const mid = flightPoint(FIRE, ORIGIN, to, STEP, TOTAL / 2, TOTAL);
    expect(mid.x).toBeCloseTo(1.5, 12);
    expect(mid.y).toBeCloseTo(0.75 - 0.2 * STEP, 12);
    const quarter = flightPoint(FIRE, ORIGIN, to, STEP, TOTAL / 4, TOTAL);
    expect(quarter.x).toBeCloseTo(0.75, 12);
    expect(quarter.y).toBeCloseTo(0.375 - 4 * 0.2 * STEP * 0.25 * 0.75, 12);
    expect(flightPoint(FIRE, ORIGIN, to, STEP, -50, TOTAL)).toMatchObject({ x: 0, y: 0 });
    expect(flightPoint(FIRE, ORIGIN, to, STEP, TOTAL + 50, TOTAL)).toMatchObject({ x: 3, y: 1.5 });
    // The long diagonal lifts by the same height: it is in tiles, not a fraction of the path.
    const farMid = flightPoint(FIRE, ORIGIN, CASES.longDiagonal.to, STEP, TOTAL / 2, TOTAL);
    expect(farMid.x).toBeCloseTo(5, 12);
    expect(farMid.y).toBeCloseTo(-0.2 * STEP, 12);
  });

  it('keeps a straight path and a bolt on the chord', () => {
    const { to } = CASES.shortDiagonal;
    expect(flightPoint(STRAIGHT, ORIGIN, to, STEP, TOTAL / 2, TOTAL)).toEqual({
      x: 3,
      y: 0,
      spin: 0,
    });
    expect(flightPoint(WATER, ORIGIN, to, STEP, TOTAL / 2, TOTAL)).toEqual({ x: 3, y: 0, spin: 0 });
  });

  it('spins an arc by whole turns over the flight', () => {
    const spun: BendTrajectory = { ...FIRE, spin: 2 };
    const { to } = CASES.longCardinal;
    expect(flightPoint(spun, ORIGIN, to, STEP, TOTAL / 4, TOTAL).spin).toBeCloseTo(180, 9);
    expect(flightPoint(spun, ORIGIN, to, STEP, TOTAL, TOTAL).spin).toBeCloseTo(720, 9);
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
