import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { enemyScale, partyScale } from '../../src/app/anim/actorScale';
import { resolvePainter } from '../../src/render/painters/registry';
import type { Ctx } from '../../src/render/painters/shapes';
import { UNIT_PAINTERS } from '../../src/render/painters/units';
import { validateImages, validateSheets } from './validate';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const ROUTE_FIGURES = [
  'unit.enemy.thug',
  'unit.enemy.slinger',
  'unit.enemy.bruiser',
  'unit.enemy.quarrybender',
  'unit.enemy.deserter',
  'unit.enemy.crossbow',
  'unit.enemy.merc',
  'unit.enemy.sergeant',
  'unit.enemy.driller',
  'unit.ally.ruon',
  'npc.guard',
];

it.each(ROUTE_FIGURES)(
  'draws %s from its top-down sheet at the party’s scale (ADR 0059, ADR 0104)',
  (key) => {
    const entry = ASSETS[key];
    if (entry?.kind !== 'sheet') throw new Error(`Missing ${key}`);
    expect(entry.atlas).toMatch(/^art\/topdown\//);
    expect(entry.locomotion?.headings).toBe(8);
    expect(enemyScale(key, 1)).toBe(partyScale());
    expect(enemyScale(key, 0.9)).toBeCloseTo(partyScale(0.9));
  },
);

it('validates the top-down Driller sheet', async () => {
  const entry = ASSETS['unit.enemy.driller'];
  if (entry?.kind !== 'sheet') throw new Error('Missing the Driller');
  expect(entry.footprint).toEqual({ w: 2, h: 2 });
  expect(await validateSheets('public', { 'unit.enemy.driller': entry })).toEqual([]);
});

it('keeps each quarry figure’s drawn fallback while its atlas loads', () => {
  for (const [key, variant] of [
    ['unit.ally.ruon', 'sergeant'],
    ['unit.enemy.merc', 'blade'],
    ['unit.enemy.sergeant', 'sergeant'],
  ] as const)
    expect(resolvePainter(key).variant, key).toBe(variant);
  expect(resolvePainter('unit.enemy.crossbow').variant).toBeTruthy();
  const bandit = vi.spyOn(UNIT_PAINTERS, 'bandit').mockImplementation(() => {});
  try {
    const fallback = resolvePainter('unit.enemy.deserter');
    fallback.draw({} as Ctx, { x: 0, y: 0, size: 64 });
    expect(bandit).toHaveBeenCalledTimes(1);
    expect(bandit.mock.calls[0]?.[3]?.variant).toBe('bender');
    expect(fallback.palette.base).toBe('#d1462f');
  } finally {
    bandit.mockRestore();
  }
});

it('registers the deserter’s face through the 160 px pixel portrait contract', () => {
  const key = 'portrait.enemy.deserter';
  const entry = ASSETS[key];
  if (entry?.kind !== 'image') throw new Error('Missing deserter portrait');
  expect(entry.url).toBe('art/portraits/enemy.deserter.png');
  expect(validateImages('public', { [key]: entry })).toEqual([]);
  expect(readFileSync(`public/${entry.url}`).length).toBeLessThanOrEqual(38_228);
});
