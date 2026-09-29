import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { enemyScale, partyScale } from '../../src/app/anim/actorScale';
import { resolvePainter } from '../../src/render/painters/registry';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { readPng } from './lib/image';
import { decodeWebp } from './lib/webp';
import { alphaBounds, crop } from './lib/trim';
import { validateSheets } from './validate';

it('stands the G thug at the party G body’s height and scale (ADR 0059)', async () => {
  const key = 'unit.enemy.thug';
  const standing = async (asset: string, clip: string) => {
    const entry = ASSETS[asset];
    if (entry?.kind !== 'sheet') throw new Error(`Missing ${asset}`);
    const atlas = parseAtlasJson(readFileSync(`public/${entry.atlas}`, 'utf8'));
    const pixels = await decodeWebp(
      new Uint8Array(readFileSync(`public/art/units/${atlas.image}`)),
    );
    const rect = atlas.frames.get(`${asset}/${clip}/0`);
    if (!rect) throw new Error(`Missing ${asset}/${clip}/0`);
    const body = alphaBounds(crop(pixels, { x: rect.x, y: rect.y, width: rect.w, height: rect.h }));
    if (!body) throw new Error('Empty standing frame');
    return body.height;
  };
  // Same camera, same 75% map: within a few px of Kaya's, 113-121 px.
  const thug = await standing(key, 'idleSouth');
  expect(Math.abs(thug - (await standing('unit.fire.kaya', 'idleSouth')))).toBeLessThanOrEqual(8);
  for (const projection of ['oblique', 'orthographic'] as const) {
    expect(enemyScale(key, 1, projection)).toBe(partyScale(projection));
    expect(enemyScale(key, 0.9, projection)).toBeCloseTo(partyScale(projection, 0.9));
  }
  expect(await validateSheets('public', { [key]: ASSETS[key]! })).toEqual([]);
}, 60_000);

it('keeps four legacy route adults near party height without changing their pixels or feet', async () => {
  const heights: Record<string, number> = {};
  for (const name of ['bruiser', 'slinger', 'quarrybender', 'crossbow']) {
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
    const height = (body.height / entry.pixelsPerTile) * enemyScale(key);
    heights[name] = height;
    const adult = (121 / 128) * partyScale('oblique');
    expect(height / adult).toBeGreaterThan(0.95);
    expect(height / adult).toBeLessThan(1.04);
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
  expect(heights.bruiser).toBeGreaterThan(heights.quarrybender!);
  expect(heights.quarrybender).toBeGreaterThan(heights.slinger!);
  for (const key of [
    'unit.enemy.grumbler',
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
