/**
 * `?style=topdown` (ADR 0104): T1's plumbing, and T2's top-down sheets hung on it. Every sheet is a valid
 * manifest entry at one art px a world px on the 40 px tile, draws each of PixelLab's eight headings from
 * its own cels (never mirrored), and every cel it names is packed at the size it promises, with no cel
 * packed that nothing names.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE } from '../index';
import { TOPDOWN_TILE } from '../../render/projection';
import { crispRatio } from '../../render/pixelSampling';
import { resolveClip } from '../../render/sheets/resolveClip';
import { sheetClipProblems, validateContent, type ContentBundle } from '../schemas';
import type { ClipDef, ClipName } from './clips';
import { HEADINGS, KO_HEADINGS, headingClip, hitClip, koClip } from './clips';
import {
  ASSETS,
  TOPDOWN_KEYS,
  TOPDOWN_OBJECTS,
  resolveAsset,
  topDownStyleActive,
  useTopDownStyle,
  type AssetEntry,
  type SheetEntry,
} from './manifest';

type Frames = Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
const read = <T>(path: string): T => JSON.parse(readFileSync(`public/${path}`, 'utf8')) as T;
const COMBAT = ['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo', 'unit.enemy.thug'];
const FIGHTERS = [
  ...COMBAT,
  'unit.enemy.slinger',
  'unit.enemy.bruiser',
  // T5: the quarry cast, Ruon and the Driller.
  'unit.enemy.deserter',
  'unit.enemy.quarrybender',
  'unit.enemy.merc',
  'unit.enemy.crossbow',
  'unit.enemy.sergeant',
  'unit.ally.ruon',
  'unit.enemy.driller',
  // T8: the heroes the tutorial does not cast.
  'unit.fire.tenzo',
  'unit.water.nilak',
  'unit.earth.linmei',
  'unit.air.nima',
  'unit.air.jinu',
  'unit.non.riko',
  'unit.non.wen',
];

function sheet(key: string): SheetEntry {
  const entry = resolveAsset(key);
  if (entry.kind !== 'sheet') throw new Error(`${key} is not a sheet`);
  return entry;
}

/** The clips a sheet draws once its clip file is in: its own and the fetched ones. */
function allClips(entry: SheetEntry): Partial<Record<ClipName, ClipDef>> {
  return {
    ...entry.clips,
    ...(entry.clipData ? read<Record<string, ClipDef>>(entry.clipData) : {}),
  };
}
const actionsOf = (entry: SheetEntry): Record<string, Record<string, ClipDef>> =>
  entry.actions ? read(entry.actions) : {};

describe('?style=topdown (ADR 0104)', () => {
  it('is off until asked for, and then changes only the top-down keys', () => {
    expect(topDownStyleActive()).toBe(false);
    const before = Object.fromEntries(Object.keys(ASSETS).map((key) => [key, resolveAsset(key)]));
    for (const key of Object.keys(TOPDOWN_KEYS)) {
      const entry = resolveAsset(key);
      // Hanru is still the painted figure by default.
      if (entry.kind === 'sheet') expect(entry.atlas).not.toMatch(/^art\/topdown\//);
    }
    useTopDownStyle();
    expect(topDownStyleActive()).toBe(true);
    for (const [key, entry] of Object.entries(before)) {
      if (key in TOPDOWN_KEYS || key in TOPDOWN_OBJECTS)
        expect(sheet(key).atlas).toMatch(/^art\/topdown\//);
      else expect(resolveAsset(key)).toEqual(entry);
    }
  });

  it('passes the content validation with every top-down sheet in the manifest', () => {
    useTopDownStyle();
    const assets: Record<string, AssetEntry> = { ...ASSETS };
    for (const key of [...Object.keys(TOPDOWN_KEYS), ...Object.keys(TOPDOWN_OBJECTS)])
      assets[key] = resolveAsset(key);
    expect(validateContent({ ...CONTENT_BUNDLE, assets } as ContentBundle)).toEqual([]);
    for (const key of Object.keys(TOPDOWN_KEYS)) {
      const entry = sheet(key);
      // The fetched clips are held to the manifest's rules too, as `art:validate` holds a G sheet's.
      expect(sheetClipProblems(key, allClips(entry), true)).toEqual([]);
    }
  });

  it('draws one art px on one world px at every integer zoom, eight drawn headings, never mirrored', () => {
    useTopDownStyle();
    for (const key of Object.keys(TOPDOWN_KEYS)) {
      const entry = sheet(key);
      expect(entry.pixelsPerTile).toBe(TOPDOWN_TILE);
      for (const n of [1, 2, 3, 4])
        expect(crispRatio((n * TOPDOWN_TILE) / entry.pixelsPerTile)).toBe(true);
      expect(entry.facing).toBe('both');
      expect(entry.locomotion?.headings).toBe(8);
      const walks = new Set<string>();
      const idles = new Set<string>();
      for (const heading of HEADINGS) {
        for (const base of ['idle', 'walk', 'rest'] as const) {
          const resolved = resolveClip(entry.clips, headingClip(base, heading));
          // Every heading resolves to its own clip, not a fallback through another heading.
          expect(resolved?.exact, `${key} ${base} ${heading}`).toBe(true);
        }
        walks.add(entry.clips[headingClip('walk', heading)]?.frames[0] ?? '');
        idles.add(entry.clips[headingClip('idle', heading)]?.frames[0] ?? '');
      }
      expect(walks.size, `${key}: eight walks of its own`).toBe(8);
      expect(idles.size, `${key}: eight idles of its own`).toBe(8);
    }
  });

  it('gives each fighter a hit in all eight headings and a knockout on each diagonal, from its own cels', () => {
    useTopDownStyle();
    for (const key of FIGHTERS) {
      const entry = sheet(key);
      const clips = allClips(entry);
      for (const heading of HEADINGS) {
        const hit = resolveClip(clips, hitClip(heading));
        expect(hit?.exact, `${key} ${hitClip(heading)}`).toBe(true);
        expect(hit?.def.frames.length).toBeGreaterThanOrEqual(2);
        expect(resolveClip(clips, koClip(heading))?.exact).toBe(true);
      }
      for (const heading of KO_HEADINGS) expect(clips[koClip(heading)]?.loop).toBe(false);
      // All eight knockouts and every ability's eight headings wait in the actions file for T4.
      const actions = actionsOf(entry);
      expect(Object.keys(actions.ko ?? {}).sort()).toEqual([...HEADINGS].sort());
      expect(Object.keys(actions).length).toBeGreaterThanOrEqual(2);
      for (const [pose, byHeading] of Object.entries(actions))
        expect(Object.keys(byHeading).sort(), `${key} ${pose}`).toEqual([...HEADINGS].sort());
      expect(clips.cast?.frameMs?.length).toBe(clips.cast?.frames.length);
    }
  });

  it('packs every cel it names at the size it promises, and nothing else', () => {
    useTopDownStyle();
    for (const key of Object.keys(TOPDOWN_KEYS)) {
      const entry = sheet(key);
      const packed = new Map<string, { w: number; h: number }>();
      for (const page of [entry.atlas, ...(entry.atlasPages ?? [])]) {
        const atlas = read<{ frames: Frames; meta: { size: { w: number; h: number } } }>(page);
        expect(atlas.meta.size.w).toBeLessThanOrEqual(2048);
        expect(atlas.meta.size.h).toBeLessThanOrEqual(2048);
        for (const [name, { frame }] of Object.entries(atlas.frames)) packed.set(name, frame);
      }
      const named = new Set<string>();
      const expectCels = (clip: ClipDef, label: string) => {
        const size = clip.frameSize ?? entry.frameSize;
        const anchor = clip.anchor ?? entry.anchor;
        expect(anchor.x, label).toBeGreaterThanOrEqual(0);
        expect(anchor.y, label).toBeLessThanOrEqual(1);
        for (const name of clip.frames) {
          named.add(name);
          const frame = packed.get(name);
          expect(frame, `${label}: ${name} is not packed`).toBeDefined();
          expect({ w: frame?.w, h: frame?.h }, `${label}: ${name}`).toEqual(size);
        }
      };
      for (const [clip, def] of Object.entries(allClips(entry)))
        if (def) expectCels(def, `${key} ${clip}`);
      for (const [pose, byHeading] of Object.entries(actionsOf(entry)))
        for (const [heading, def] of Object.entries(byHeading))
          expectCels(def, `${key} ${pose} ${heading}`);
      expect(
        [...packed.keys()].filter((name) => !named.has(name)),
        `${key}: cels nothing names`,
      ).toEqual([]);
      expect(entry.footprint.w === 2 ? entry.frameSize?.w === entry.frameSize?.h : true).toBe(true);
    }
  });
});
