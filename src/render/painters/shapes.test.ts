import { describe, expect, it } from 'vitest';
import type { Box, Ctx } from './shapes';
import { groundShadow } from './shapes';

/**
 * The contact shadow is the one primitive every prop, figure and discovery
 * shares, and the sheet bake reads its foot position as a contract, so its
 * two promises are checked here against a recording stub: the shadow stays
 * inside the box it was given, and it fades out instead of ending on a hard
 * rim. Both matter to the same complaint — an object that touches the ground
 * on a bare dark line reads as a sticker, not as something standing there.
 */

interface Call {
  readonly op: string;
  readonly args: readonly unknown[];
}

interface Recorder {
  readonly ctx: Ctx;
  readonly calls: Call[];
  readonly stops: readonly (readonly [number, string])[];
}

function record(): Recorder {
  const calls: Call[] = [];
  const stops: [number, string][] = [];
  const gradient = {
    addColorStop: (offset: number, color: string): void => void stops.push([offset, color]),
  };
  const ctx = new Proxy(
    {},
    {
      get: (_target, op: string) => {
        if (op === 'createRadialGradient')
          return (...args: unknown[]): unknown => {
            calls.push({ op, args });
            return gradient;
          };
        return (...args: unknown[]): void => void calls.push({ op, args });
      },
      set: (_target, op: string, value: unknown) => {
        calls.push({ op, args: [value] });
        return true;
      },
    },
  );
  return { ctx: ctx as unknown as Ctx, calls, stops };
}

const BOX: Box = { x: 40, y: 24, size: 64 };

/** Alpha of an `rgba(...)` stop, as a plain number. */
function alphaOf(color: string): number {
  const match = /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)$/.exec(color);
  if (!match?.[1]) throw new Error(`not a shadow stop: ${color}`);
  return Number(match[1]);
}

describe('contact shadow', () => {
  it('fades from the contact out instead of ending on a hard rim', () => {
    const { ctx, stops } = record();
    groundShadow(ctx, BOX, 0.5);

    expect(stops.length).toBeGreaterThanOrEqual(3);
    expect(stops[0]?.[0]).toBe(0);
    expect(stops.at(-1)?.[0]).toBe(1);
    const alphas = stops.map(([, color]) => alphaOf(color));
    expect(alphas[0]).toBeCloseTo(0.34, 3);
    expect(alphas.at(-1)).toBe(0);
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]!).toBeLessThan(alphas[i - 1]!);
  });

  it('keeps the whole shadow inside the box it was handed', () => {
    const { ctx, calls } = record();
    groundShadow(ctx, BOX, 0.6);

    const centre = calls.find((call) => call.op === 'translate')?.args ?? [];
    const scale = calls.find((call) => call.op === 'scale')?.args ?? [];
    const radius = calls.find((call) => call.op === 'arc')?.args?.[2];
    // The contact sits on the 0.86 foot line the sheets are baked to, and the
    // shadow falls a hair past it rather than ending level with the feet.
    expect(centre[0]).toBe(BOX.x + BOX.size / 2);
    expect(centre[1]).toBeGreaterThan(BOX.y + BOX.size * 0.86);
    expect(centre[1]).toBeLessThan(BOX.y + BOX.size * 0.89);
    expect(radius).toBeCloseTo((BOX.size * 0.6) / 2, 9);
    expect(scale[1]).toBeCloseTo((BOX.size * 0.09) / (radius as number), 9);

    const cx = centre[0] as number;
    const cy = centre[1] as number;
    const rx = radius as number;
    const ry = rx * (scale[1] as number);
    expect(cx - rx).toBeGreaterThanOrEqual(BOX.x);
    expect(cx + rx).toBeLessThanOrEqual(BOX.x + BOX.size);
    expect(cy - ry).toBeGreaterThanOrEqual(BOX.y);
    expect(cy + ry).toBeLessThanOrEqual(BOX.y + BOX.size);
  });

  it('draws nothing for a box with no size', () => {
    const { ctx, calls } = record();
    groundShadow(ctx, { x: 0, y: 0, size: 0 });
    expect(calls).toEqual([]);
  });
});
