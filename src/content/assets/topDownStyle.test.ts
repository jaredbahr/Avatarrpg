import { describe, expect, it } from 'vitest';
import { ASSETS, resolveAsset, topDownStyleActive, useTopDownStyle } from './manifest';

describe('?style=topdown (ADR 0104, phase T1)', () => {
  it('is off until asked for, and then records the choice without changing any asset', () => {
    expect(topDownStyleActive()).toBe(false);
    const before = Object.keys(ASSETS).map((key) => resolveAsset(key));
    useTopDownStyle();
    expect(topDownStyleActive()).toBe(true);
    // Plumbing only: nothing draws differently until T2 hangs the top-down sheets on it.
    expect(Object.keys(ASSETS).map((key) => resolveAsset(key))).toEqual(before);
  });
});
