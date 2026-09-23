import { describe, expect, it } from 'vitest';
import type { SurfaceId, Tile } from '../../core/types';
import type { Edges } from '../geometry/board';
import { RUBBLE_CHIP, SURFACE_STYLES } from '../palettes';
import type { Box, Ctx } from './shapes';
import { paintSurface } from './tiles';

/**
 * Surface painting is geometry until it meets a canvas, so a recording stub is
 * enough to hold the contracts the material treatments keep: a surface covers
 * its own cell and never paints into a neighbour, water reads from its painted
 * shore, and the tactical outline still marks the other surfaces.
 */

const BOX: Box = { x: 40, y: 24, size: 64 };
const SHORE: Edges = { n: true, e: true, s: true, w: true };
/** North and west face open ground; east and south are shared with the pool. */
const PART_SHARED: Edges = { n: true, e: false, s: false, w: true };

interface Call {
  readonly op: string;
  readonly args: readonly number[];
}

function record(): { ctx: Ctx; calls: Call[] } {
  const calls: Call[] = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, op: string) =>
        (...args: number[]) =>
          void calls.push({ op, args }),
      set: () => true,
    },
  );
  return { ctx: ctx as unknown as Ctx, calls };
}

const surface = (id: SurfaceId, duration: number): Tile =>
  ({ terrain: 'dirt', surface: { id, duration, spread: 0 } }) as Tile;

const fills = (calls: readonly Call[]): readonly (readonly number[])[] =>
  calls.filter((call) => call.op === 'fillRect').map((call) => call.args);

describe('surface material painting', () => {
  it('covers a whole water cell, with every coat inside its own square', () => {
    const { ctx, calls } = record();
    paintSurface(ctx, BOX, surface('water', -1), { x: 5, y: 6 }, false, SHORE);

    // The first coat covers the entire cell and no coat reaches beyond it: the
    // pool keeps its hazard footprint exactly while the shore erodes it.
    const coats = fills(calls);
    expect(coats[0]).toEqual([40, 24, 64, 64]);
    for (const [x, y, w, h] of coats) {
      expect(x).toBeGreaterThanOrEqual(BOX.x);
      expect(y).toBeGreaterThanOrEqual(BOX.y);
      expect(x! + w!).toBeLessThanOrEqual(BOX.x + BOX.size);
      expect(y! + h!).toBeLessThanOrEqual(BOX.y + BOX.size);
    }
    // The material is still drawn: soft drift patches and one flow line.
    expect(calls.some((call) => call.op === 'ellipse')).toBe(true);
    expect(calls.filter((call) => call.op === 'stroke')).toHaveLength(1);
  });

  it('leaves water to its painted shore and rims the other surfaces', () => {
    for (const duration of [-1, 3]) {
      const water = record();
      paintSurface(water.ctx, BOX, surface('water', duration), { x: 5, y: 6 }, false, SHORE);
      // Two coats of wash and nothing else: no band inside the edge and no line
      // along it. That outline is what made a pond read as a filled polygon.
      expect(fills(water.calls).length, `water duration ${duration}`).toBe(2);
    }
    for (const id of ['oil', 'mud', 'ice', 'rubble'] as const) {
      const pool = record();
      paintSurface(pool.ctx, BOX, surface(id, -1), { x: 5, y: 6 }, false, SHORE);
      // One thin coat over the whole cell, then a firmer interior inside the
      // ragged outline, so the material fades at its bank instead of stopping
      // on the rule's own edge.
      expect(fills(pool.calls), `${id} keeps its base coat`).toEqual([[40, 24, 64, 64]]);
      expect(
        pool.calls.filter((call) => call.op === 'fill').length,
        `${id} keeps its firmer interior`,
      ).toBeGreaterThan(0);
      expect(
        pool.calls.filter((call) => call.op === 'stroke').length,
        `${id} keeps its outline`,
      ).toBeGreaterThan(0);
    }
  });

  it('never draws a bank, a wash outline or a gather outside the cell', () => {
    for (const id of ['oil', 'mud', 'ice', 'rubble', 'water'] as const) {
      const { ctx, calls } = record();
      paintSurface(ctx, BOX, surface(id, -1), { x: 5, y: 6 }, false, SHORE);
      for (const call of calls) {
        if (call.op !== 'moveTo' && call.op !== 'lineTo') continue;
        const [x, y] = call.args;
        expect(x, `${id} ${call.op} x`).toBeGreaterThanOrEqual(BOX.x);
        expect(y, `${id} ${call.op} y`).toBeGreaterThanOrEqual(BOX.y);
        expect(x, `${id} ${call.op} x`).toBeLessThanOrEqual(BOX.x + BOX.size);
        expect(y, `${id} ${call.op} y`).toBeLessThanOrEqual(BOX.y + BOX.size);
      }
    }
  });

  it('fades the wash at a shore and keeps it flush against the rest of the pool', () => {
    const shored = record();
    paintSurface(shored.ctx, BOX, surface('water', -1), { x: 5, y: 6 }, false, SHORE);
    const inner = fills(shored.calls)[1] ?? [];
    // Every side is shore, so the firmer second coat is inset all round and the
    // last tenth of the cell keeps the lighter first-coat strength.
    expect(inner[0]).toBeGreaterThan(BOX.x);
    expect(inner[1]).toBeGreaterThan(BOX.y);
    expect(inner[0]! + inner[2]!).toBeLessThan(BOX.x + BOX.size);
    expect(inner[1]! + inner[3]!).toBeLessThan(BOX.y + BOX.size);

    const shared = record();
    paintSurface(shared.ctx, BOX, surface('water', -1), { x: 5, y: 6 }, false, PART_SHARED);
    const flush = fills(shared.calls)[1] ?? [];
    // No seam between two water tiles: the shared sides stay at the boundary.
    expect(flush[0]).toBeGreaterThan(BOX.x);
    expect(flush[1]).toBeGreaterThan(BOX.y);
    expect(flush[0]! + flush[2]!).toBe(BOX.x + BOX.size);
    expect(flush[1]! + flush[3]!).toBe(BOX.y + BOX.size);
  });

  it('scatters rubble chips in the spoil chip tone, never the ink bank', () => {
    // The bank is an outline; ink chips inside the patch read as oil or scorch.
    const strokes = (edges: Edges): string[] => {
      const seen: string[] = [];
      let strokeStyle = '';
      const ctx = new Proxy(
        {},
        {
          get: (_target, op: string) =>
            op === 'strokeStyle'
              ? strokeStyle
              : () => void (op === 'stroke' && seen.push(strokeStyle)),
          set: (_target, op: string, value: unknown) => {
            if (op === 'strokeStyle') strokeStyle = String(value);
            return true;
          },
        },
      );
      paintSurface(ctx as unknown as Ctx, BOX, surface('rubble', 3), { x: 5, y: 6 }, false, edges);
      return seen;
    };
    const open: Edges = { n: false, e: false, s: false, w: false };
    const chips = strokes(open);
    expect(chips.length).toBeGreaterThan(0);
    for (const tone of chips) expect(tone).toBe(RUBBLE_CHIP);
    expect(RUBBLE_CHIP).not.toBe(SURFACE_STYLES.rubble.edge);
    // The ragged bank round the patch keeps the ink.
    const banked = strokes(SHORE);
    expect(banked.filter((tone) => tone === SURFACE_STYLES.rubble.edge)).toHaveLength(4);
    expect(banked.filter((tone) => tone === RUBBLE_CHIP)).toHaveLength(chips.length);
  });
});
