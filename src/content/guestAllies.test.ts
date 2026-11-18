import { describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE } from './index';
import { encounterSchema, validateContent } from './schemas';
import type { ContentBundle } from './schemas';
import type { EncounterDef, GuestAllyDef } from '../core/types';

/**
 * The guest-ally schema (ADR 0116). A second guest needs data only, so every
 * way that data can be wrong has to fail here rather than at the table.
 * The guests are placeholders on a test copy of the Forest Road.
 */
const BASE = CONTENT_BUNDLE.encounters.find((e) => e.id === 'enc_forest_road');
if (!BASE) throw new Error('The Forest Road encounter is missing');

const VALID: readonly GuestAllyDef[] = [
  { characterId: 'sura', pos: { x: 4, y: 5 }, level: { partyOffset: 1 } },
  { enemyId: 'ruon_ally', pos: { x: 5, y: 6 }, level: 2, ai: 'support' },
  { characterId: 'bo', pos: { x: 4, y: 7 }, control: 'table', name: 'Placeholder Guest' },
];

function withEncounter(encounter: Partial<EncounterDef>): ContentBundle {
  return {
    ...CONTENT_BUNDLE,
    encounters: CONTENT_BUNDLE.encounters.map((e) =>
      e.id === BASE!.id ? { ...BASE!, ...encounter } : e,
    ),
  };
}

function guestProblems(encounter: Partial<EncounterDef>): string[] {
  return validateContent(withEncounter(encounter)).filter((problem) =>
    problem.includes('enc_forest_road'),
  );
}

describe('guest allies in encounter data', () => {
  it('accepts well-formed guests of both kinds and both control modes', () => {
    expect(encounterSchema.safeParse({ ...BASE, guests: VALID }).success).toBe(true);
    expect(guestProblems({ guests: VALID, loseIfGuestFalls: true })).toEqual([]);
  });

  it('keeps guests and the loss rule optional, so existing encounters need no change', () => {
    expect('guests' in BASE!).toBe(false);
    expect('loseIfGuestFalls' in BASE!).toBe(false);
    expect(encounterSchema.safeParse(BASE).success).toBe(true);
  });

  it('rejects shapes the schema can see: unknown keys, bad levels, unknown modes', () => {
    const parse = (guest: unknown) =>
      encounterSchema.safeParse({ ...BASE, guests: [guest] }).success;
    expect(parse({ characterId: 'sura', pos: { x: 4, y: 5 }, team: 'party' })).toBe(false);
    expect(parse({ characterId: 'sura', pos: { x: 4, y: 5 }, level: 11 })).toBe(false);
    expect(parse({ characterId: 'sura', pos: { x: 4, y: 5 }, level: { offset: 1 } })).toBe(false);
    expect(parse({ characterId: 'sura', pos: { x: 4, y: 5 }, control: 'player' })).toBe(false);
    expect(parse({ characterId: 'sura', pos: { x: 4, y: 5 }, ai: 'boss' })).toBe(false);
  });

  it('needs exactly one of a character and an enemy, and both must exist', () => {
    expect(guestProblems({ guests: [{ pos: { x: 4, y: 5 } }] })).toEqual([
      'encounter "enc_forest_road" guest 0 must name exactly one of characterId and enemyId',
    ]);
    expect(
      guestProblems({
        guests: [{ characterId: 'sura', enemyId: 'ruon_ally', pos: { x: 4, y: 5 } }],
      }),
    ).toHaveLength(1);
    expect(guestProblems({ guests: [{ characterId: 'nobody', pos: { x: 4, y: 5 } }] })).toEqual([
      'encounter "enc_forest_road" guest 0 names unknown character "nobody"',
    ]);
    expect(guestProblems({ guests: [{ enemyId: 'nothing', pos: { x: 4, y: 5 } }] })).toEqual([
      'encounter "enc_forest_road" guest 0 names unknown enemy "nothing"',
    ]);
  });

  it('rejects settings that would never be used, and picks the kit cannot make', () => {
    expect(
      guestProblems({
        guests: [{ characterId: 'sura', pos: { x: 4, y: 5 }, control: 'table', ai: 'support' }],
      }),
    ).toEqual([
      'encounter "enc_forest_road" guest 0 is table-controlled, so its "ai" profile would never be used',
    ]);
    expect(
      guestProblems({ guests: [{ enemyId: 'ruon_ally', pos: { x: 4, y: 5 }, chosen: ['x'] }] }),
    ).toEqual([
      'encounter "enc_forest_road" guest 0 is an enemy, so "chosen" and "discipline" do not apply',
    ]);
    expect(
      guestProblems({
        guests: [
          { characterId: 'sura', pos: { x: 4, y: 5 }, chosen: ['not_a_pick'], discipline: 'nope' },
        ],
      }),
    ).toEqual([
      'encounter "enc_forest_road" guest 0 takes discipline "nope", which sura cannot',
      `encounter "enc_forest_road" guest 0 picks "not_a_pick", which no choice in sura's kit offers`,
    ]);
  });

  it('checks the spawn like any placement: walkable, unshared, off the party spawns', () => {
    const map = CONTENT_BUNDLE.maps.find((m) => m.id === BASE!.mapId)!;
    const spawn = map.partySpawns[0]!;
    expect(guestProblems({ guests: [{ characterId: 'sura', pos: spawn }] })).toEqual([
      `encounter "enc_forest_road" places a unit on party spawn (${spawn.x},${spawn.y})`,
    ]);
    const enemy = BASE!.enemies[0]!.pos;
    expect(guestProblems({ guests: [{ characterId: 'sura', pos: enemy }] })).toEqual([
      `encounter "enc_forest_road" stacks two units on (${enemy.x},${enemy.y})`,
    ]);
    expect(
      guestProblems({ guests: [{ characterId: 'sura', pos: { x: 0, y: 0 } }] }).some((p) =>
        p.includes('stands on a blocked tile (0,0)'),
      ),
    ).toBe(true);
  });

  it('refuses a loss rule with nobody it could apply to', () => {
    expect(guestProblems({ loseIfGuestFalls: true })).toEqual([
      'encounter "enc_forest_road" loses if a guest falls, but has no guest or ally',
    ]);
  });
});
