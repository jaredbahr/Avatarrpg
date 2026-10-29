import { afterEach, describe, expect, it, vi } from 'vitest';
import { durationTokenMs } from './durationToken';

afterEach(() => vi.unstubAllGlobals());

describe('CSS duration tokens', () => {
  it.each([
    ['1000ms', 1000],
    [' 1.2s ', 1200],
    ['.5s', 500],
    ['0ms', 0],
    ['', 700],
    ['invalid', 700],
    ['-1ms', 700],
    ['100', 700],
  ])('reads %j as %s milliseconds', (raw, expected) => {
    vi.stubGlobal('document', { documentElement: {} });
    const getPropertyValue = vi.fn(() => raw);
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue }));

    expect(durationTokenMs('--duration', 700)).toBe(expected);
    expect(getPropertyValue).toHaveBeenCalledWith('--duration');
  });
});
