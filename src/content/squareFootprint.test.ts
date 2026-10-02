import { describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE } from './index';
import { validateContent } from './schemas';
import type { ContentBundle } from './schemas';
import { LEGEND } from './maps/legend';
import type { EncounterDef, MapDef, Vec2 } from '../core/types';
import { SQUARE_FOOTPRINTS } from '../core/rules/footprint';
import { SQUARE_FOOTPRINT_CONTENT_DEFAULT } from './footprint';

/**
 * A-3: size-2 encounter placements validated as whole 2x2 squares. The rule is
 * shipped by the A-6 footprint gate. Fixtures assert the default square path
 * and retain explicit gate-off coverage for the injectable compatibility path.
 */

function fixtureMap(rows: readonly string[], partySpawns: readonly Vec2[]): MapDef {
  const [first = ''] = rows;
  return {
    id: 'square_fixture',
    name: 'Square fixture',
    kind: 'combat',
    width: first.length,
    height: rows.length,
    rows,
    legend: LEGEND,
    partySpawns,
    npcs: [],
    props: [],
    ambience: 'none',
  };
}

/** Where the fixture puts the extra size-2 placements a case wants to probe. */
type ExtraPlacements = { variant?: Vec2; reinforcement?: Vec2 };

function fixtureEncounter(mapId: string, pos: Vec2, extra: ExtraPlacements = {}): EncounterDef {
  const placement = (at: Vec2) => ({ enemyId: 'grumbler', pos: at });
  const variant = extra.variant;
  const reinforcement = extra.reinforcement;
  const variants = variant
    ? [{ id: 'fixture_variant', weight: 1, enemies: [placement(variant)] }]
    : [];
  const reinforcements = reinforcement ? [placement(reinforcement)] : [];
  return {
    id: 'square_fixture_encounter',
    name: 'Square fixture',
    mapId,
    enemies: [placement(pos)],
    allies: [],
    conditionalEnemies: [],
    baselinePartySize: 1,
    variants,
    reinforcements,
    expectedLevel: 1,
    intro: 'A fixture fight.',
    tip: 'A fixture tip.',
  };
}

/** Six walkable spawns in a corner, so a combat map clears the six-player rule. */
const SIX_SPAWNS: readonly Vec2[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 4, y: 0 },
  { x: 0, y: 1 },
];

const LEFT_SIX_SPAWNS: readonly Vec2[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
];

/** The real bundle plus one tiny map/encounter pair to place the Grumbler on. */
function withFixture(
  rows: readonly string[],
  partySpawns: readonly Vec2[],
  pos: Vec2,
  extra: ExtraPlacements = {},
): ContentBundle {
  const map = fixtureMap(rows, partySpawns);
  return {
    ...CONTENT_BUNDLE,
    maps: [...CONTENT_BUNDLE.maps, map],
    encounters: [...CONTENT_BUNDLE.encounters, fixtureEncounter(map.id, pos, extra)],
  };
}

describe('size-2 square footprints', () => {
  it('keeps the content validator default aligned with the core gate', () => {
    expect(SQUARE_FOOTPRINT_CONTENT_DEFAULT).toBe(SQUARE_FOOTPRINTS);
  });

  it('leaves the shipped content clean by default and under explicit legacy geometry', () => {
    expect(validateContent(CONTENT_BUNDLE)).toEqual([]);
    expect(validateContent(CONTENT_BUNDLE, { squareFootprints: false })).toEqual([]);
  });

  it('reports a square whose lower row is blocked only with the gate on', () => {
    // The legacy 2x1 sits on (1,2)-(2,2); the 2x2's lower row hits the (1,3) wall.
    const bundle = withFixture(['.....', '.....', '.....', '.#...'], SIX_SPAWNS, { x: 1, y: 2 });
    expect(validateContent(bundle, { squareFootprints: false })).toEqual([]);
    expect(validateContent(bundle)).toContain(
      'encounter "square_fixture_encounter" places "grumbler" on a blocked tile (1,3) of "square_fixture"',
    );
  });

  it('reports a square that straddles a tier only with the gate on', () => {
    const bundle = withFixture(['.....', '.....', '.^...', '.....'], SIX_SPAWNS, { x: 1, y: 1 });
    expect(validateContent(bundle, { squareFootprints: false })).toEqual([]);
    expect(validateContent(bundle)).toContain(
      'encounter "square_fixture_encounter" places "grumbler" on a square footprint that is not flat ground — all four cells must share one tier',
    );
  });

  it('reports a square cut off from the party only with the gate on', () => {
    // A wall column splits the room; the 2x1 is fine, the 2x2 can never join.
    const bundle = withFixture(
      ['..#..', '..#..', '..#..', '..#..'],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
      ],
      { x: 3, y: 0 },
    );
    expect(validateContent(bundle, { squareFootprints: false })).toEqual([]);
    expect(validateContent(bundle)).toContain(
      'encounter "square_fixture_encounter" places "grumbler" on a square footprint cut off from the party spawns',
    );
  });

  it('reports a 2x2 behind a one-cell corridor, but accepts a two-cell corridor', () => {
    const oneCellCorridor = withFixture(
      ['...#....', '...#....', '........', '...#....', '...#....'],
      LEFT_SIX_SPAWNS,
      { x: 5, y: 1 },
    );
    expect(validateContent(oneCellCorridor, { squareFootprints: false })).toEqual([]);
    expect(validateContent(oneCellCorridor)).toContain(
      'encounter "square_fixture_encounter" places "grumbler" on a square footprint cut off from the party spawns',
    );

    const twoCellCorridor = withFixture(
      ['...#....', '........', '........', '...#....', '...#....'],
      LEFT_SIX_SPAWNS,
      { x: 5, y: 1 },
    );
    expect(validateContent(twoCellCorridor)).not.toContain(
      'encounter "square_fixture_encounter" places "grumbler" on a square footprint cut off from the party spawns',
    );
  });

  it('reports a 2x2 separated by a two-tier cliff', () => {
    const bundle = withFixture(['....AAA', '....AAA', '....AAA', '....AAA'], LEFT_SIX_SPAWNS, {
      x: 4,
      y: 1,
    });
    expect(validateContent(bundle)).toContain(
      'encounter "square_fixture_encounter" places "grumbler" on a square footprint cut off from the party spawns',
    );
  });

  it('holds a size-2 variant square to the same rule', () => {
    const bundle = withFixture(
      ['.....', '.....', '.....', '.#...'],
      SIX_SPAWNS,
      { x: 3, y: 1 },
      { variant: { x: 1, y: 2 } },
    );
    expect(validateContent(bundle, { squareFootprints: false })).toEqual([]);
    expect(validateContent(bundle)).toContain(
      'encounter "square_fixture_encounter" variant "fixture_variant" places "grumbler" on a blocked tile (1,3)',
    );
  });

  it('holds a size-2 reinforcement square to the same rule', () => {
    const bundle = withFixture(
      ['.....', '.....', '.....', '.#...'],
      SIX_SPAWNS,
      { x: 3, y: 1 },
      { reinforcement: { x: 1, y: 2 } },
    );
    expect(validateContent(bundle, { squareFootprints: false })).toEqual([]);
    expect(validateContent(bundle)).toContain(
      'encounter "square_fixture_encounter" places "grumbler" on a blocked tile (1,3) of "square_fixture"',
    );
  });
});
