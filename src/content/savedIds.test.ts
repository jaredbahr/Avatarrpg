import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '.';
import { ID_ALIASES } from './idAliases';
import { currentSavedIds, mergeLedger, savedIdProblems, type SavedIds } from './savedIds';
import { SAVED_ID_KINDS } from '../core/save/aliases';

const LEDGER = JSON.parse(
  readFileSync(new URL('./ids.ledger.json', import.meta.url), 'utf8'),
) as Partial<SavedIds>;
const CURRENT = currentSavedIds(CONTENT);

describe('content ids are forever', () => {
  it('the ledger, the content and the alias table agree', () => {
    expect(savedIdProblems(LEDGER, CURRENT, ID_ALIASES)).toEqual([]);
  });

  it('the ledger has every kind, sorted', () => {
    expect(Object.keys(LEDGER).sort()).toEqual([...SAVED_ID_KINDS].sort());
    for (const kind of SAVED_ID_KINDS) {
      const ids = LEDGER[kind] ?? [];
      expect(ids, kind).toEqual([...new Set(ids)].sort());
    }
  });

  it('reads the ids a save names from every region', () => {
    expect(CURRENT.story).toContain('act1_open');
    expect(CURRENT.maps).toContain('ba_dan_village');
    expect(CURRENT.npcs.every((key) => key.includes(':'))).toBe(true);
    expect(CURRENT.triggers.length).toBeGreaterThan(0);
    expect(CURRENT.flags.length).toBeGreaterThan(0);
  });
});

/* A tiny fixture: one live id per kind used, and what can go wrong with it. */
const LIVE: SavedIds = {
  ...Object.fromEntries(SAVED_ID_KINDS.map((kind) => [kind, []])),
  story: ['camp', 'road'],
  maps: ['village'],
  npcs: ['village:mira'],
} as unknown as SavedIds;

describe('savedIdProblems', () => {
  it('asks for a new id to be added to the ledger', () => {
    expect(savedIdProblems({ ...LIVE, story: ['camp'] }, LIVE, {})).toEqual([
      'story "road" is not in the ledger: run npm run ids:ledger',
    ]);
  });

  it('rejects a shipped id that is gone without an alias', () => {
    const ledger = { ...LIVE, story: ['camp', 'old_road', 'road'] };
    expect(savedIdProblems(ledger, LIVE, {})).toEqual([
      'story "old_road" was shipped and is gone: restore it or alias it in idAliases.ts',
    ]);
    expect(savedIdProblems(ledger, LIVE, { story: { old_road: 'road' } })).toEqual([]);
  });

  it('rejects an alias to nothing', () => {
    const ledger = { ...LIVE, story: ['camp', 'road', 'x'] };
    expect(savedIdProblems(ledger, LIVE, { story: { x: 'nowhere' } })).toEqual([
      'story "x" is aliased to "nowhere", which does not exist',
    ]);
  });

  it('rejects an alias that shadows a live id', () => {
    expect(savedIdProblems(LIVE, LIVE, { story: { road: 'camp' } })).toEqual([
      'story alias "road" shadows a live id',
    ]);
  });

  it('rejects an alias loop', () => {
    const ledger = { ...LIVE, story: ['a', 'b', 'camp', 'road'] };
    const problems = savedIdProblems(ledger, LIVE, { story: { a: 'b', b: 'a' } });
    expect(problems).toContain('story alias "a" -> "b" loops');
    expect(problems).toContain('story alias "b" -> "a" loops');
  });

  it('follows a renamed map to its NPCs without an NPC row', () => {
    const ledger = mergeLedger(
      { ...LIVE, maps: ['old_village', 'village'], npcs: ['old_village:mira', 'village:mira'] },
      LIVE,
    );
    expect(savedIdProblems(ledger, LIVE, { maps: { old_village: 'village' } })).toEqual([]);
  });

  it('never drops an id when merging', () => {
    const merged = mergeLedger({ story: ['gone'] }, LIVE);
    expect(merged.story).toEqual(['camp', 'gone', 'road']);
  });
});
