/**
 * The top-down family is fetched at run time, not precached, until T6 switches the default style
 * (ADR 0104 §3, 2026-11-10 note): workbox is told so, the asset budget counts the precache the same
 * way, and nothing else is left out of it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRECACHE_IGNORES, isPrecacheIgnored } from './precache.mjs';

describe('the precache', () => {
  it('leaves the top-down family, and only it, for run time', () => {
    expect([...PRECACHE_IGNORES]).toEqual(['art/topdown/**']);
    for (const path of [
      'art/topdown/kaya.webp',
      'art/topdown/vfx.json',
      'art/topdown/quarry-gate/ground.webp',
      'art/topdown/props/brazier.png',
    ])
      expect(isPrecacheIgnored(path), path).toBe(true);
    for (const path of [
      'index.html',
      'art/maps/quarry_gate.webp',
      'art/topdownish.webp',
      'art/units/kaya.webp',
      'sw.js',
    ])
      expect(isPrecacheIgnored(path), path).toBe(false);
  });

  it('is what workbox ignores and what the asset budget leaves out of its total', () => {
    const vite = readFileSync('vite.config.ts', 'utf8');
    expect(vite).toMatch(/globIgnores:\s*\[\.\.\.PRECACHE_IGNORES\]/);
    expect(vite).toContain("from './scripts/precache.mjs'");
    const budget = readFileSync('scripts/check-asset-budget.mjs', 'utf8');
    expect(budget).toContain("from './precache.mjs'");
    expect(budget).toMatch(/isPrecacheIgnored\(/);
    // the family keeps its own budget
    expect(budget).toMatch(/\['topdown', TOPDOWN_BUDGET_MB\]/);
  });
});
