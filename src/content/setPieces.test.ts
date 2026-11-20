import { describe, expect, it } from 'vitest';
import { OLD_VILLAGE_ROWS } from './maps/oldVillage.fixture';
import { BA_DAN_VILLAGE } from './maps/village';
import { LEGEND } from './maps/legend';
import { BA_DAN_DRESSING_PLAN } from './maps/oldVillage.dressing.fixture';
import { BA_DAN_TOPDOWN_OBJECTS } from './scenes/baDan.topdown';
import { BA_DAN_SET_PIECE_PLAN } from './scenes/baDan.setpieces';
import { RIVER_ROAD_SET_PIECE_PLAN } from './scenes/riverRoad.setpieces';
import { SET_PIECE_PLANS, setPiecePlanFor, type PlannedMap } from './scenes/setPiecePlans';
import {
  memberCells,
  validateDressing,
  validateSetPiecePlan,
  type DressingPlan,
  type PlanContext,
  type PlanMember,
  type PlannedSetPiece,
  type SetPiecePlan,
} from './setPieces';
import type { TopDownObject } from './topdownLayout';

const blocked = (x: number, y: number): boolean => {
  // The dressing plan was drawn to the old 24 x 16 rows; the live village is a blockout until its dressing stage.
  const ch = OLD_VILLAGE_ROWS[y]?.[x];
  if (ch === undefined) return true;
  const def = BA_DAN_VILLAGE.legend?.[ch] ?? LEGEND[ch];
  return def ? def.blocked === true : true;
};

describe('the placement grammar (ADR 0119)', () => {
  it('holds Ba Dan square to its design: purposes, hugging, clear paths, quiet ground, one focus a zone', () => {
    expect(validateDressing(BA_DAN_DRESSING_PLAN, BA_DAN_TOPDOWN_OBJECTS, blocked)).toEqual([]);
  });

  const prop = (id: string, x: number, base: number, cells: [number, number][]): TopDownObject => ({
    id,
    sprite: 'crate',
    kind: 'prop',
    x,
    base,
    footprint: cells.map(([cx, cy]) => ({ x: cx, y: cy })),
    solid: true,
    depth: { x: x / 40, y: base / 40 },
  });
  const objects = [
    prop('house', 60, 80, [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ]),
    prop('barrel', 140, 120, [[3, 2]]),
    prop('lamp-a', 20, 300, [[0, 7]]),
    prop('lamp-b', 100, 300, [[2, 7]]),
    prop('lamp-c', 220, 300, [[5, 7]]),
    prop('stray', 300, 200, [[7, 4]]),
  ];
  const plan: DressingPlan = {
    mapId: 'fixture',
    scope: { x0: 0, y0: 0, x1: 9, y1: 9 },
    setPieces: [
      {
        id: 'home',
        purpose: 'a house',
        anchor: 'house',
        satellites: ['barrel'],
        aprons: [],
        focal: true,
      },
      {
        id: 'lamps',
        purpose: 'lamps',
        anchor: 'lamp-a',
        satellites: ['lamp-b', 'lamp-c'],
        run: true,
        aprons: [],
      },
    ],
    paths: [{ id: 'lane', cells: [{ x: 7, y: 4 }] }],
    quiet: [{ x0: 6, y0: 3, x1: 8, y1: 5 }],
    zones: [
      { id: 'north', rect: { x0: 0, y0: 0, x1: 9, y1: 3 } },
      { id: 'south', rect: { x0: 0, y0: 6, x1: 9, y1: 9 } },
    ],
  };

  it('names a prop no set piece explains, one on a path or in quiet ground, and a zone without one focus', () => {
    expect(validateDressing(plan, objects, () => false)).toEqual([
      'dressing "fixture": run "lamps" is unevenly spaced (80, 120 px)',
      'dressing "fixture": prop "stray" belongs to no set piece',
      'dressing "fixture": path "lane" runs under "stray" at (7,4)',
      'dressing "fixture": "stray" stands in quiet ground (6,3)-(8,5)',
      'dressing "fixture": zone "south" has 0 focal set pieces (none), not one',
    ]);
  });

  it('names a satellite left out on the open ground, away from what it serves', () => {
    const far = objects.map((o) => (o.id === 'barrel' ? { ...o, footprint: [{ x: 6, y: 2 }] } : o));
    expect(validateDressing(plan, far, () => false)).toContain(
      'dressing "fixture": "barrel" stands 4 cells from its anchor "house" (at most 2)',
    );
  });
});

/** A planned map's live rows and its named tracks: what its stage 5 plan is held against. */
const contextFor = (planned: PlannedMap): PlanContext => {
  const { map } = planned;
  const blockedLive = (x: number, y: number): boolean => {
    const ch = map.rows[y]?.[x];
    if (ch === undefined) return true;
    const def = map.legend?.[ch] ?? LEGEND[ch];
    return def ? def.blocked === true : true;
  };
  return {
    width: map.width,
    height: map.height,
    blocked: blockedLive,
    tracks: planned.tracks(),
    disks: planned.disks(),
  };
};

const planned = (mapId: string): PlannedMap => {
  const p = setPiecePlanFor(mapId);
  if (!p) throw new Error(`no set-piece plan for ${mapId}`);
  return p;
};

/** Ba Dan's live board's rows and the ground spec's tracks. */
const liveContext = (): PlanContext => contextFor(planned(BA_DAN_VILLAGE.id));

describe('every map with a set-piece plan', () => {
  it('has one plan a map, each for a map that exists', () => {
    const ids = SET_PIECE_PLANS.map((p) => p.plan.mapId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SET_PIECE_PLANS) expect(p.map.id).toBe(p.plan.mapId);
  });
});

describe("Ba Dan's set pieces as boxes (stage 5)", () => {
  it('holds the plan to the rows, the named tracks, the quiet ground and the placement rules', () => {
    expect(validateSetPiecePlan(BA_DAN_SET_PIECE_PLAN, liveContext())).toEqual([]);
  });

  it('gives every member to one set piece and keeps the plan to the lantern limit and a focus a zone', () => {
    const members = BA_DAN_SET_PIECE_PLAN.pieces.flatMap((p) => p.members.map((m) => m.id));
    expect(new Set(members).size).toBe(members.length);
    expect(members.length).toBeGreaterThan(60);
    const lanterns = BA_DAN_SET_PIECE_PLAN.pieces
      .flatMap((p) => p.members)
      .filter((m) => m.lantern);
    expect(lanterns).toHaveLength(BA_DAN_SET_PIECE_PLAN.maxLanterns);
    expect(BA_DAN_SET_PIECE_PLAN.zones).toHaveLength(6);
  });

  it('keeps the plan to the tracks of the ground spec, not a second copy of them', () => {
    expect(liveContext().tracks.has('east_road')).toBe(true);
    expect(liveContext().tracks.has('square_table')).toBe(true);
  });

  describe('names every way a plan breaks a rule', () => {
    const box = (id: string, x: number, y: number, o: Partial<PlanMember> = {}): PlanMember => ({
      id,
      name: id,
      x,
      y,
      w: 1,
      h: 1,
      height: 0.5,
      solid: false,
      kind: 'prop',
      ...o,
    });
    const piece = (id: string, members: PlanMember[], o: Partial<PlannedSetPiece> = {}) => ({
      id,
      purpose: 'a test',
      anchor: members[0]?.id ?? '',
      members,
      ...o,
    });
    const plan = (pieces: PlannedSetPiece[], o: Partial<SetPiecePlan> = {}): SetPiecePlan => ({
      mapId: 'fixture',
      pieces,
      zones: [],
      quiet: [],
      maxLanterns: 4,
      ...o,
    });
    // an 8 x 8 board: a wall column at x 7, the lane's cells (2,3) and (3,3), a disk at (5, 5)
    const ctx: PlanContext = {
      width: 8,
      height: 8,
      blocked: (x, y) => x === 7 || y === 0,
      tracks: new Map([
        [
          'lane',
          [
            { x: 2, y: 3 },
            { x: 3, y: 3 },
          ],
        ],
        ['disk', [{ x: 5, y: 5 }]],
      ]),
      disks: new Map([['disk', { x: 5.5, y: 5.5, r: 1 }]]),
    };
    const find = (p: SetPiecePlan, text: string) =>
      validateSetPiecePlan(p, ctx).filter((s) => s.includes(text));

    it('reads a fractional footprint as the cells it overlaps', () => {
      expect(memberCells(box('post', 12.5, 8.5, { w: 0.2, h: 0.2 }))).toEqual([{ x: 12, y: 8 }]);
      expect(memberCells(box('cloth', 12.5, 8.4, { w: 3, h: 2 }))).toHaveLength(4 * 3);
    });

    it('a solid member on an open cell, and a non-solid one on a blocked cell', () => {
      const p = plan([
        piece('a', [box('a1', 4, 4), box('solid-open', 4, 5, { solid: true }), box('wall', 7, 5)]),
      ]);
      expect(find(p, 'solid "solid-open"')).toHaveLength(1);
      expect(find(p, 'non-solid "wall"')).toHaveLength(1);
    });

    it('a member on a named track, but not a flat, an overhead one, or the table on its own disk', () => {
      const p = plan([
        piece('a', [
          box('a1', 2, 2),
          box('on-lane', 2, 3),
          box('step', 3, 3, { kind: 'flat', height: 0 }),
          box('line', 3, 3, { overhead: true, kind: 'fades', height: 1.3 }),
        ]),
        piece('table', [box('t', 5, 5, { solid: false })], { ownDisk: 'disk' }),
      ]);
      expect(find(p, 'on track "lane"')).toHaveLength(1);
      expect(find(p, 'on track "disk"')).toHaveLength(0);
      const other = plan([piece('b', [box('b1', 5, 5)])]);
      expect(find(other, 'track "disk"')).toHaveLength(1);
    });

    it('a member in quiet ground, unless its piece is let in', () => {
      const quiet = [{ id: 'q', x0: 4, y0: 4, x1: 5, y1: 5 }];
      expect(
        find(plan([piece('a', [box('a1', 4, 4)])], { quiet }), 'quiet ground "q"'),
      ).toHaveLength(1);
      expect(
        find(plan([piece('a', [box('a1', 4, 4)], { quietOk: ['q'] })], { quiet }), 'quiet'),
      ).toHaveLength(0);
    });

    it('a tall non-solid member that is not a fades, and a tall prop south of a walkable cell', () => {
      const p = plan([
        piece('a', [
          box('lean', 3, 5, { height: 1.1 }),
          box('lamp', 4, 5, { height: 1.1, kind: 'fades' }),
          box('post', 5, 6, { height: 1.6, solid: true }),
        ]),
      ]);
      expect(find(p, 'is 1.1 figures tall but is a prop')).toHaveLength(1);
      expect(find(p, 'stands south of walkable cell (5,5)')).toHaveLength(1);
    });

    it('a member away from its anchor and its fellows, and a loose single', () => {
      const p = plan([piece('a', [box('a1', 1, 5), box('near', 2, 5), box('far', 5, 7)])]);
      expect(find(p, '"far" at (5,7) stands away from its anchor')).toHaveLength(1);
      expect(find(p, '"far" at (5,7) stands alone')).toHaveLength(1);
      expect(find(p, '"near"')).toHaveLength(0);
      const marker = plan([piece('a', [box('a1', 1, 5), box('far', 5, 7)], { marker: true })]);
      expect(find(marker, 'alone')).toHaveLength(0);
      const run = plan([
        piece('a', [box('a1', 7, 3, { solid: true }), box('far', 7, 6, { solid: true })], {
          run: true,
        }),
      ]);
      expect(find(run, 'stands')).toHaveLength(0);
    });

    it('too many lanterns, a doubled member id, and a zone without one focus', () => {
      const lamps = [1, 2, 3, 4, 5].map((i) =>
        box(`l${i}`, i, 2, { lantern: true, solid: false, height: 1.6, kind: 'fades' }),
      );
      const p = plan([piece('a', lamps), piece('b', [box('l1', 1, 6)])], {
        zones: [{ id: 'z', rect: { x0: 0, y0: 0, x1: 3, y1: 3 } }],
      });
      expect(find(p, '5 lanterns')).toHaveLength(1);
      expect(find(p, 'belongs to both "a" and "b"')).toHaveLength(1);
      expect(find(p, 'zone "z" has 0 focal')).toHaveLength(1);
    });
  });
});

describe("the river road's set pieces as boxes (stage 5)", () => {
  const ctx = contextFor(planned('river_road'));

  it('holds the plan to the rows, the worn paths, the quiet ground and the placement rules', () => {
    expect(validateSetPiecePlan(RIVER_ROAD_SET_PIECE_PLAN, ctx)).toEqual([]);
  });

  it('gives every member to one piece and every zone of the brief its one focus', () => {
    const members = RIVER_ROAD_SET_PIECE_PLAN.pieces.flatMap((p) => p.members.map((m) => m.id));
    expect(new Set(members).size).toBe(members.length);
    expect(RIVER_ROAD_SET_PIECE_PLAN.zones.map((z) => z.id)).toEqual([
      'from_the_coast',
      'shade_stop',
      'bridge',
      'bend',
      'lookout',
    ]);
    expect(RIVER_ROAD_SET_PIECE_PLAN.pieces.map((p) => p.id)).toEqual(
      expect.arrayContaining(['bridge', 'guards_camp', 'shade_stop', 'landing', 'ford', 'lookout']),
    );
  });

  it("names its walking paths from the board's worn paths, each cell once", () => {
    const tracks = [...ctx.tracks.entries()];
    expect(tracks.map(([id]) => id).sort()).toEqual([
      'camp_ground',
      'landing_path',
      'lookout_track',
      'road',
      'shade_pull_off',
    ]);
    const cells = tracks.flatMap(([, c]) => c.map((v) => `${v.x},${v.y}`));
    expect(new Set(cells).size).toBe(cells.length);
  });
});
