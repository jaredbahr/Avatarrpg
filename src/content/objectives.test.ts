import { describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE } from './index';
import { encounterSchema, validateContent } from './schemas';
import type { ContentBundle } from './schemas';
import type { EncounterDef } from '../core/types';

/**
 * The objective and round-limit schema (ADR 0116's 2026-11-15 amendment), on a
 * test copy of the Forest Road with a placeholder objective. A bad objective
 * must fail here, not at the table: a cell nobody can stand on is a fight that
 * cannot be won, and one under a party spawn is a fight that opens won.
 */
const BASE = CONTENT_BUNDLE.encounters.find((e) => e.id === 'enc_forest_road');
if (!BASE) throw new Error('The Forest Road encounter is missing');

const OBJECTIVE = {
  kind: 'holdAtRoundEnd',
  cells: [{ x: 5, y: 8 }],
  label: 'Placeholder objective',
} as const;

function withEncounter(encounter: Partial<EncounterDef>): ContentBundle {
  return {
    ...CONTENT_BUNDLE,
    encounters: CONTENT_BUNDLE.encounters.map((e) =>
      e.id === BASE!.id ? { ...BASE!, ...encounter } : e,
    ),
  };
}

function problems(encounter: Partial<EncounterDef>): string[] {
  return validateContent(withEncounter(encounter)).filter((problem) =>
    problem.includes('enc_forest_road'),
  );
}

const parse = (fields: Record<string, unknown>) =>
  encounterSchema.safeParse({ ...BASE, ...fields }).success;

describe('objectives in encounter data', () => {
  it('accepts a well-formed objective and round limit', () => {
    expect(parse({ objective: OBJECTIVE, loseAfterRound: 6 })).toBe(true);
    expect(problems({ objective: OBJECTIVE, loseAfterRound: 6 })).toEqual([]);
  });

  it('keeps both optional, so existing encounters need no change', () => {
    expect('objective' in BASE!).toBe(false);
    expect('loseAfterRound' in BASE!).toBe(false);
    expect(parse({})).toBe(true);
    for (const encounter of CONTENT_BUNDLE.encounters) {
      expect(encounterSchema.safeParse(encounter).success).toBe(true);
    }
  });

  it('rejects shapes the schema can see', () => {
    expect(parse({ objective: { ...OBJECTIVE, kind: 'reachExit' } })).toBe(false);
    expect(parse({ objective: { ...OBJECTIVE, cells: [] } })).toBe(false);
    expect(parse({ objective: { ...OBJECTIVE, label: '' } })).toBe(false);
    expect(parse({ objective: { ...OBJECTIVE, byRound: 6 } })).toBe(false);
    expect(parse({ objective: { kind: 'holdAtRoundEnd', cells: [{ x: 5, y: 8 }] } })).toBe(false);
    expect(parse({ loseAfterRound: 0 })).toBe(false);
    expect(parse({ loseAfterRound: 2.5 })).toBe(false);
    expect(parse({ loseAfterRound: 51 })).toBe(false);
  });

  it('refuses cells nobody can stand on, or that would open the fight won', () => {
    const at = (x: number, y: number) => ({ objective: { ...OBJECTIVE, cells: [{ x, y }] } });
    expect(problems(at(0, 0))).toEqual([
      'encounter "enc_forest_road" objective cell (0,0) is blocked on "forest_road"',
    ]);
    expect(problems(at(40, 40))).toEqual([
      'encounter "enc_forest_road" objective cell (40,40) is blocked on "forest_road"',
    ]);
    expect(problems(at(2, 5))).toEqual([
      'encounter "enc_forest_road" objective cell (2,5) is a party spawn',
    ]);
    expect(problems(at(13, 6))).toContain(
      'encounter "enc_forest_road" objective cell (13,6) holds a prop',
    );
    expect(
      problems({
        objective: {
          ...OBJECTIVE,
          cells: [
            { x: 5, y: 8 },
            { x: 5, y: 8 },
          ],
        },
      }),
    ).toEqual(['encounter "enc_forest_road" lists objective cell (5,8) twice']);
    expect(
      problems({ ...at(4, 7), guests: [{ characterId: 'sura', pos: { x: 4, y: 7 } }] }),
    ).toEqual(['encounter "enc_forest_road" places an ally on its objective, so it opens won']);
  });

  it('lets an enemy start on the objective: guarding it is the point', () => {
    const enemy = BASE!.enemies[0]!;
    expect(problems({ objective: { ...OBJECTIVE, cells: [enemy.pos] } })).toEqual([]);
  });
});
