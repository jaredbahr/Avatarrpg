import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { resolvePainter } from '../../src/render/painters/registry';
import type { Ctx } from '../../src/render/painters/shapes';
import { UNIT_PAINTERS } from '../../src/render/painters/units';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { readPng } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { validateImages, validateSheets } from './validate';

it('ships nine compact grounded deserter poses at the established adult scale', async () => {
  const key = 'unit.enemy.deserter';
  const entry = ASSETS[key];
  if (entry?.kind !== 'sheet') throw new Error('Missing deserter sheet');
  const atlas = parseAtlasJson(readFileSync(`public/${entry.atlas}`, 'utf8'));
  const image = readPng('public/art/units/deserter.png');
  expect(atlas.frames.size).toBe(9);
  expect([atlas.width, atlas.height]).toEqual([9 * 128, 192]);
  expect(entry.pixelsPerTile).toBe(128);
  expect(entry.footprint).toEqual({ w: 1, h: 1 });
  expect(entry.anchor).toEqual({ x: 0.5, y: 0.85 });
  expect(entry.clips.melee).toBeUndefined();
  expect(await validateSheets('public', { [key]: entry })).toEqual([]);
  for (const [name, r] of atlas.frames) {
    const bounds = alphaBounds(crop(image, { x: r.x, y: r.y, width: r.w, height: r.h }));
    expect(bounds, name).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBe(163);
    if (name.includes('/idle/')) expect(bounds!.height).toBe(151);
  }
});

it('retains the original fire-bandit bender when the deserter atlas is unavailable', () => {
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

it('registers the matching face through the existing 512px portrait contract', () => {
  const key = 'portrait.enemy.deserter';
  const entry = ASSETS[key];
  if (entry?.kind !== 'image') throw new Error('Missing deserter portrait');
  expect(entry.url).toBe('art/portraits/enemy.deserter.webp');
  expect(validateImages('public', { [key]: entry })).toEqual([]);
  expect(readFileSync(`public/${entry.url}`).length).toBeLessThanOrEqual(38_228);
});
