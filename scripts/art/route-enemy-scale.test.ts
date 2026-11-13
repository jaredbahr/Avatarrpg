import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { enemyScale, partyScale } from '../../src/app/anim/actorScale';
import { resolvePainter } from '../../src/render/painters/registry';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { readPng } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { validateSheets } from './validate';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

it.each(['thug', 'slinger', 'bruiser', 'quarrybender'])(
  'draws the %s at the party’s scale (ADR 0059, ADR 0062)',
  (name) => {
    const key = `unit.enemy.${name}`;
    expect(enemyScale(key, 1)).toBe(partyScale());
    expect(enemyScale(key, 0.9)).toBeCloseTo(partyScale(0.9));
  },
);

it('validates the live lossless Driller sheet and its UI headroom cap', async () => {
  expect(ASSETS['unit.enemy.driller']).toMatchObject({ uiHeadroomCap: 0.85 });
  expect(
    await validateSheets('public', { 'unit.enemy.driller': ASSETS['unit.enemy.driller']! }),
  ).toEqual([]);
  expect(enemyScale('unit.enemy.driller', 1)).toBe(1);
});

it('keeps the legacy route crossbow scale without changing its pixels or feet', async () => {
  for (const name of ['crossbow']) {
    const key = `unit.enemy.${name}`;
    const entry = ASSETS[key];
    if (entry?.kind !== 'sheet') throw new Error(`Missing ${key}`);
    const atlas = parseAtlasJson(readFileSync(`public/${entry.atlas}`, 'utf8'));
    const pixels = readPng(`public/art/units/${name}.png`);
    const standing = atlas.frames.get(`${key}/idle/0`);
    if (!standing) throw new Error('Missing standing frame');
    const body = alphaBounds(
      crop(pixels, { x: standing.x, y: standing.y, width: standing.w, height: standing.h }),
    );
    if (!body) throw new Error('Empty standing frame');
    // Its 1.23 kept it level with the oblique board's 1.25 party; that board retired at T7.
    expect(enemyScale(key, 1)).toBeCloseTo(1.23, 12);
    expect(body.height).toBe(121);
    expect(entry.pixelsPerTile).toBe(128);
    expect(entry.footprint).toEqual({ w: 1, h: 1 });
    expect(entry.anchor).toEqual({ x: 0.5, y: 0.85 });
    for (const rect of atlas.frames.values()) {
      const bounds = alphaBounds(
        crop(pixels, { x: rect.x, y: rect.y, width: rect.w, height: rect.h }),
      );
      if (!bounds) throw new Error('Empty pose');
      expect(bounds.y + bounds.height).toBe(163);
      expect(rect.w).toBe(128);
      expect(rect.h).toBe(192);
    }
    expect(await validateSheets('public', { [key]: entry })).toEqual([]);
    expect(resolvePainter(key).variant).toBeTruthy();
    expect(enemyScale(key, 0.96)).toBeCloseTo(enemyScale(key) * 0.96);
  }
  for (const key of [
    'unit.ally.ruon',
    'unit.enemy.merc',
    'unit.enemy.sergeant',
    'unit.enemy.deserter',
    'npc.guard',
  ]) {
    expect(enemyScale(key)).toBe(1);
    expect(enemyScale(key, 0.9)).toBe(0.9);
  }
});
