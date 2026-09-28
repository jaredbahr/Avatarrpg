import { describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE } from './index';
import { validateContent, validateMapContracts } from './schemas';
import type { MapContractIssue } from './schemas';
import { LEGEND } from './maps/legend';
import type { MapDef, TileTemplate } from '../core/types';

/**
 * The M1 map contracts, report-only until a map sets `edgeContract: 'enforce'`.
 * These fixtures are deliberately small: four rows is enough to hold an open
 * border, a two-tier step and a split footprint apart from each other.
 */
function fixture(rows: readonly string[], extra: Partial<MapDef> = {}): MapDef {
  const [first = ''] = rows;
  return {
    id: 'fixture',
    name: 'Fixture',
    kind: 'combat',
    width: first.length,
    height: rows.length,
    rows,
    legend: LEGEND,
    partySpawns: [{ x: 1, y: 1 }],
    npcs: [],
    props: [],
    ambience: 'none',
    ...extra,
  };
}

const openRows = ['.....', '.....', '.....', '.....'];

/** The shared legend plus a tier-3 bench: elevations run 0..3. */
const TIER3: Readonly<Record<string, TileTemplate>> = {
  ...LEGEND,
  '3': { terrain: 'stone', elevation: 3 },
};

const strip = (issues: readonly MapContractIssue[], kind: string) =>
  issues.filter((issue) => issue.message.includes(kind));

describe('map edge contract', () => {
  it('warns on every walkable border cell with no exit or declared edge', () => {
    const issues = validateMapContracts([fixture(openRows)]);
    // 2 * (5 + 4) - 4 corners = 14 border cells, all walkable.
    expect(issues).toHaveLength(14);
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(issues[0]?.message).toBe(
      'map "fixture" edge contract: walkable border (0,0) has no exit or declared edge',
    );
  });

  it('passes a map whose whole border is declared', () => {
    const closed = fixture(openRows, {
      edges: [
        { side: 'north', span: [0, 4], treatment: 'barrier' },
        { side: 'south', span: [0, 4], treatment: 'barrier' },
        { side: 'west', span: [0, 3], treatment: 'barrier' },
        { side: 'east', span: [0, 3], treatment: 'barrier' },
      ],
    });
    expect(validateMapContracts([closed])).toEqual([]);
  });

  it('exempts an exit tile from the edge contract', () => {
    const withExit = fixture(openRows, { exit: { pos: { x: 0, y: 0 }, label: 'West gate' } });
    const issues = validateMapContracts([withExit]);
    expect(issues).toHaveLength(13);
    expect(issues.some((issue) => issue.message.includes('(0,0)'))).toBe(false);
  });

  it('exempts every cell of a multi-tile exit area from the edge contract', () => {
    // A widened west gate (M2): `pos` at (0,0) plus (0,1). Both border cells
    // are covered by the one exit, so neither may warn.
    const withMouth = fixture(openRows, {
      exits: [
        {
          pos: { x: 0, y: 0 },
          area: [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
          ],
          toMapId: 'fixture_elsewhere',
          toPos: { x: 1, y: 1 },
          label: 'Widened west gate',
        },
      ],
    });
    const issues = validateMapContracts([withMouth]);
    // 14 border cells, two covered by the exit area: the other 12 warn.
    expect(issues).toHaveLength(12);
    for (const cell of [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]) {
      expect(
        issues.some((issue) => issue.message.includes(`walkable border (${cell.x},${cell.y}) `)),
        `area cell ${cell.x},${cell.y} warned`,
      ).toBe(false);
    }
  });

  it('errors on a span that starts before its side, enforced or not', () => {
    const negative = fixture(openRows, {
      id: 'fixture_edge_negative',
      edges: [{ side: 'north', span: [-1, 2], treatment: 'barrier' }],
    });
    const errors = validateMapContracts([negative]).filter((issue) => issue.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe(
      'map "fixture_edge_negative" edge contract: north span (-1,2) is outside 0..4',
    );
    // Malformed data fails content even though the map does not enforce.
    expect(validateContent({ ...CONTENT_BUNDLE, maps: [negative] })).toContain(
      'map "fixture_edge_negative" edge contract: north span (-1,2) is outside 0..4',
    );
  });

  it('errors on a span that runs past the end of its side', () => {
    const past = fixture(openRows, {
      id: 'fixture_edge_past',
      edges: [
        { side: 'north', span: [0, 5], treatment: 'barrier' },
        // East spans measure y, so they are bounded by the height, not the width.
        { side: 'east', span: [0, 4], treatment: 'barrier' },
      ],
    });
    const errors = validateMapContracts([past]).filter((issue) => issue.severity === 'error');
    expect(errors.map((issue) => issue.message)).toEqual([
      'map "fixture_edge_past" edge contract: north span (0,5) is outside 0..4',
      'map "fixture_edge_past" edge contract: east span (0,4) is outside 0..3',
    ]);
  });

  it('errors on an inverted span', () => {
    const inverted = fixture(openRows, {
      id: 'fixture_edge_inverted',
      edges: [{ side: 'west', span: [3, 1], treatment: 'band' }],
    });
    const errors = validateMapContracts([inverted]).filter((issue) => issue.severity === 'error');
    expect(errors.map((issue) => issue.message)).toEqual([
      'map "fixture_edge_inverted" edge contract: west span (3,1) is inverted',
    ]);
  });

  it('errors on a fractional span', () => {
    const fractional = fixture(openRows, {
      id: 'fixture_edge_fractional',
      edges: [{ side: 'south', span: [0.5, 2], treatment: 'barrier' }],
    });
    const errors = validateMapContracts([fractional]).filter((issue) => issue.severity === 'error');
    expect(errors.map((issue) => issue.message)).toEqual([
      'map "fixture_edge_fractional" edge contract: south span (0.5,2) is not a pair of integers',
    ]);
  });

  it('accepts a valid span that covers its whole side', () => {
    const north = fixture(openRows, {
      id: 'fixture_edge_full',
      edges: [{ side: 'north', span: [0, 4], treatment: 'barrier' }],
    });
    const issues = validateMapContracts([north]);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    // The sides it does not declare are still open, but only as warnings.
    expect(issues.some((issue) => issue.message.includes('(0,3)'))).toBe(true);
  });

  it('keeps warnings out of content validation and only errors in enforce mode', () => {
    const warned = fixture(openRows, { id: 'fixture_open_edge' });
    const warnedProblems = validateContent({ ...CONTENT_BUNDLE, maps: [warned] });
    expect(warnedProblems.some((problem) => problem.includes('edge contract'))).toBe(false);

    const enforced = fixture(openRows, { id: 'fixture_open_edge', edgeContract: 'enforce' });
    const enforcedIssues = validateMapContracts([enforced]);
    expect(enforcedIssues.length).toBeGreaterThan(0);
    expect(enforcedIssues.every((issue) => issue.severity === 'error')).toBe(true);
    const enforcedProblems = validateContent({ ...CONTENT_BUNDLE, maps: [enforced] });
    expect(enforcedProblems).toContain(
      'map "fixture_open_edge" edge contract: walkable border (0,0) has no exit or declared edge',
    );
  });
});

describe('map step contract', () => {
  it('flags adjacent walkable cells two elevation tiers apart', () => {
    // `.` is tier 0, `A` is tier 2; the walls stop the comparison on every
    // other side, so exactly one offending step is left.
    const step = fixture(['..A#.', '..#..', '.....', '.....'], { id: 'fixture_step' });
    const steps = strip(validateMapContracts([step]), 'step contract');
    expect(steps).toHaveLength(1);
    expect(steps[0]?.message).toBe(
      'map "fixture_step" step contract: walkable (1,0) tier 0 meets (2,0) tier 2',
    );
  });

  it('allows a single-tier step', () => {
    // `^` is tier 1, so 0 <-> 1 is a legal climb.
    const ramp = fixture(['..^#.', '.....', '.....', '.....'], { id: 'fixture_ramp' });
    expect(strip(validateMapContracts([ramp]), 'step contract')).toEqual([]);
  });

  it('flags a three-tier step', () => {
    const cliff = fixture(['..3#.', '..#..', '.....', '.....'], {
      id: 'fixture_cliff',
      legend: TIER3,
    });
    const steps = strip(validateMapContracts([cliff]), 'step contract');
    expect(steps).toHaveLength(1);
    expect(steps[0]?.message).toBe(
      'map "fixture_cliff" step contract: walkable (1,0) tier 0 meets (2,0) tier 3',
    );
  });

  it('flags a two-tier step between tiers 1 and 3', () => {
    const cliff = fixture(['.^3#.', '..#..', '.....', '.....'], {
      id: 'fixture_cliff_low',
      legend: TIER3,
    });
    const steps = strip(validateMapContracts([cliff]), 'step contract');
    expect(steps).toHaveLength(1);
    expect(steps[0]?.message).toBe(
      'map "fixture_cliff_low" step contract: walkable (1,0) tier 1 meets (2,0) tier 3',
    );
  });

  it('allows one-tier steps in either direction', () => {
    // 0 <-> 1 and 2 <-> 3 are both one tier: a ramp either way.
    const ramps = fixture(['.^A3#', '..##.', '.....', '.....'], {
      id: 'fixture_ramps',
      legend: TIER3,
    });
    expect(strip(validateMapContracts([ramps]), 'step contract')).toEqual([]);
  });
});

describe('map footprint contract', () => {
  it('flags walkable cells the first spawn cannot reach', () => {
    const split = fixture(['..#..', '..#..', '..#..', '..#..'], { id: 'fixture_split' });
    const issues = strip(validateMapContracts([split]), 'footprint contract');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toBe(
      'map "fixture_split" footprint contract: 8 walkable cell(s) unreachable from the first party spawn (first at 3,0)',
    );
  });

  it('passes a connected footprint', () => {
    const joined = fixture(openRows, { id: 'fixture_joined' });
    expect(strip(validateMapContracts([joined]), 'footprint contract')).toEqual([]);
  });
});

describe('shipped content', () => {
  it('still validates with zero errors and reports no contract errors', () => {
    const problems = validateContent(CONTENT_BUNDLE);
    expect(problems, `\n${problems.join('\n')}\n`).toEqual([]);
    const contractErrors = validateMapContracts(CONTENT_BUNDLE.maps).filter(
      (issue) => issue.severity === 'error',
    );
    expect(contractErrors).toEqual([]);
  });
});
