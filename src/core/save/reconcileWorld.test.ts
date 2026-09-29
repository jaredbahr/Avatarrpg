/**
 * `reconcileWorld` — the load-time world repair (ADR 0047 §5).
 *
 * It is `settle`'s clear half plus its move half, run on a loaded save with
 * no events (there is nothing to animate on a load). These tests pin both
 * halves directly, the pin's survival through a full save round trip, and
 * the idempotence the `continuity.test` load-settles promise depends on.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { buildGrid, tileAt } from '../rules/grid';
import { createBattle, createGame } from '../state/createGame';
import type { ContentIndex, GameState, MapDef, Vec2 } from '../types';
import { resolveResidents } from '../story/residents';
import { reconcileWorld } from './reconcile';
import { deserialize, serialize, stateFromBlob } from './serialize';
import { TEST_ANCHOR, TEST_RESIDENT, withBoundNpc } from '../story/residents.fixture';

/** Elder Mira bound to a synthetic resident on her tile, apart from her real schedule. */
const BOUND = withBoundNpc(CONTENT, 'ba_dan_village', 'elder_mira');

/** `BOUND` with Elder Mira's NpcDef unbound again. */
const UNBOUND = {
  ...BOUND,
  maps: new Map(
    [...BOUND.maps].map(([id, map]) => [
      id,
      {
        ...map,
        npcs: map.npcs.map((n) =>
          n.id === 'elder_mira' ? { ...n, resident: undefined, pos: { x: 11, y: 5 } } : n,
        ),
      },
    ]),
  ),
};

const META = {
  label: 'Slot 1',
  summary: 'Reconcile save',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

function village(): GameState {
  return createGame(CONTENT, {
    seed: 'reconcile-world',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
}

/** Explorer on an open village tile, with the given overrides written in. */
function exploring(overrides: Partial<GameState> = {}): GameState {
  const base = village();
  return {
    ...base,
    screen: 'explore',
    location: { mapId: 'ba_dan_village', pos: { x: 3, y: 7 } },
    story: { ...base.story, nodeId: 'village_explore' },
    ...overrides,
  };
}

/** A live pin on the bound Elder Mira: her NpcDef id and her resident's anchor id. */
const MIRA = { npcId: 'elder_mira', mapId: 'ba_dan_village', anchor: TEST_ANCHOR };

const withTalk = (state: GameState, talk: GameState['world']['talk']): GameState => ({
  ...state,
  world: { ...state.world, talk },
});

suite('reconcileWorld: the conversation pin (clear half)', () => {
  it('clears a stale pin when the screen is no longer dialogue', () => {
    const state = withTalk(exploring(), MIRA);
    expect(state.screen).toBe('explore');

    expect(reconcileWorld(BOUND, state).world.talk).toBeNull();
  });

  it('clears a stale pin when the map no longer matches talk.mapId', () => {
    const state = withTalk(
      exploring({
        screen: 'dialogue',
        location: { mapId: 'ba_dan_riverside', pos: { x: 3, y: 7 } },
      }),
      MIRA,
    );

    expect(reconcileWorld(BOUND, state).world.talk).toBeNull();
  });

  it('clears a pin whose NpcDef no longer exists on talk.mapId', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), {
      ...MIRA,
      npcId: 'nobody',
    });

    expect(reconcileWorld(BOUND, state).world.talk).toBeNull();
  });

  it('clears a pin whose anchor no longer exists in content', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), { ...MIRA, anchor: 'gone.anchor' });

    expect(reconcileWorld(BOUND, state).world.talk).toBeNull();
  });

  it('clears a pin whose anchor is on another map', () => {
    const elsewhere = {
      ...BOUND,
      anchors: new Map([
        ...BOUND.anchors,
        [
          TEST_ANCHOR,
          {
            id: TEST_ANCHOR,
            place: 'TEST',
            site: { kind: 'map' as const, mapId: 'ba_dan_riverside', pos: { x: 15, y: 9 } },
          },
        ],
      ]),
    };
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);

    expect(reconcileWorld(elsewhere, state).world.talk).toBeNull();
  });

  it('clears a pin whose NpcDef is no longer bound to a resident', () => {
    // The same live pin, loaded against content where Elder Mira is
    // unbound: the binding is gone, so nobody is held.
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);
    expect(reconcileWorld(BOUND, state).world.talk).toEqual(MIRA);

    expect(reconcileWorld(UNBOUND, state).world.talk).toBeNull();
  });

  it('clears a pin whose resident record no longer exists', () => {
    const orphaned = { ...BOUND, residents: new Map() };
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);
    expect(BOUND.residents.has(TEST_RESIDENT)).toBe(true);

    expect(reconcileWorld(orphaned, state).world.talk).toBeNull();
  });

  it("clears a same-map anchor owned by another resident and resumes the speaker's schedule", () => {
    const ordinary = exploring();
    const base = exploring({
      screen: 'dialogue',
      story: { ...ordinary.story, visited: ['mira_intro', 'dorin_home'] },
      world: { ...ordinary.world, clock: { day: 1, phase: 'morning' }, talk: null },
    });
    const state = withTalk(base, {
      npcId: 'guard_dorin',
      mapId: 'ba_dan_village',
      // Mira owns this valid village anchor; it has never been one of Dorin's slots.
      anchor: 'bd01.table',
    });

    const reconciled = reconcileWorld(CONTENT, state);
    expect(reconciled.world.talk).toBeNull();
    expect(
      resolveResidents(CONTENT, reconciled).placements.find((p) => p.id === 'lw.npc.dorin')?.anchor,
    ).toBe('bd03.post');
  });

  it('keeps an old pinless save on the ordinary resident schedule', () => {
    const ordinary = exploring();
    const old = exploring({
      screen: 'dialogue',
      story: { ...ordinary.story, visited: ['mira_intro', 'dorin_home'] },
      world: { ...ordinary.world, clock: { day: 1, phase: 'morning' }, talk: null },
    });

    const reconciled = reconcileWorld(CONTENT, old);
    expect(reconciled.world.talk).toBeNull();
    expect(
      resolveResidents(CONTENT, reconciled).placements.find((p) => p.id === 'lw.npc.dorin')?.anchor,
    ).toBe('bd03.post');
  });

  it('keeps a valid, live pin unchanged: dialogue on the pinned map, bound, anchor known', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);

    expect(reconcileWorld(BOUND, state).world.talk).toEqual(MIRA);
  });
});

suite('reconcileWorld: the leader step (move half)', () => {
  it('moves the leader off a visible NPC tile in explore, without events', () => {
    // Elder Mira's real anchor, `bd01.table`: held there before `mira_intro`.
    const state = exploring({ location: { mapId: 'ba_dan_village', pos: { x: 11, y: 5 } } });

    // `reconcileWorld` returns a `GameState`, not a `StepResult`: there is
    // nothing to animate on a load, so only the position is asserted.
    expect(reconcileWorld(CONTENT, state).location.pos).not.toEqual({ x: 11, y: 5 });
  });
});

suite('reconcileWorld: idempotence and the round trip', () => {
  it('is idempotent for a pin-bearing state and a leader-on-NPC-tile state', () => {
    const pinned = withTalk(exploring({ screen: 'dialogue' }), MIRA);
    const onNpc = exploring({ location: { mapId: 'ba_dan_village', pos: { x: 11, y: 5 } } });

    for (const state of [pinned, onNpc]) {
      const once = reconcileWorld(BOUND, state);
      expect(reconcileWorld(BOUND, once)).toEqual(once);
    }
  });

  it('survives a full save round trip: a live pin reloads intact', () => {
    const state = withTalk(exploring({ screen: 'dialogue' }), MIRA);

    const result = deserialize(serialize(state, META));
    if (!result.ok) throw new Error(result.error);
    const reloaded = reconcileWorld(BOUND, stateFromBlob(result.blob));

    expect(reloaded.world.talk).toEqual(MIRA);
  });
});

/**
 * The M9 explore snap: a map edit can leave a saved position off the grid or
 * inside new terrain, so the load repairs it. The fixture is one fabricated
 * explore map, `m9_snap`, with a dead-end pocket, a solid 3x3 wall block and a
 * two-way tie:
 *
 *   y2 '...###....'   the block: (4,3) is wall inside a wall ring
 *   y3 '...###....'
 *   y4 '...###....'
 *   y5 '......###.'   the tie: (7,6) is wall
 *   y6 '.......#..'     (6,6) and (8,6) are one walkable step away
 *   y7 '###...###.'
 *   y8 '##........'   the pocket: (1,8) is wall; (2,8) alone is walkable beside it
 *   y9 '###.......'
 */
const SNAP_ROWS = [
  '..........',
  '..........',
  '...###....',
  '...###....',
  '...###....',
  '......###.',
  '.......#..',
  '###...###.',
  '##........',
  '###.......',
];

/**
 * A 15x15 chamber: a walkable rim around a blocked core, so the rim is seven
 * Chebyshev steps from the centre — one past the snap radius. The enclosed
 * case needs a pocket this deep: a merely one-step ring no longer defeats a
 * geometric search.
 */
const POCKET_ROWS = [
  '...............',
  '.#############.',
  '.#############.',
  '.#############.',
  '.#############.',
  '.#############.',
  '.#############.',
  '.#############.',
  '.#############.',
  '.#############.',
  '.#############.',
  '.#############.',
  '.#############.',
  '.#############.',
  '...............',
];

/** A fabricated explore map added to the real content, keyed by its own id. */
function snapFixture(
  id: string,
  rows: readonly string[],
  spawn: Vec2,
): { content: ContentIndex; map: MapDef; mapId: string } {
  const map: MapDef = {
    id,
    name: id,
    kind: 'explore',
    width: rows[0]?.length ?? 0,
    height: rows.length,
    rows,
    legend: { '.': { terrain: 'dirt' }, '#': { terrain: 'wall' } },
    partySpawns: [spawn],
    npcs: [],
    props: [],
    ambience: '',
  };
  const content: ContentIndex = { ...CONTENT, maps: new Map([...CONTENT.maps, [id, map]]) };
  return { content, map, mapId: id };
}

/** A game paused mid-fight, with a real battle so its own grid is carried. */
function midBattle(overrides: Partial<GameState> = {}): GameState {
  const seeded = createGame(CONTENT, {
    seed: 'reconcile-battle',
    party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
    startNode: 'battle_quarry_gate',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', rng);
  return { ...seeded, screen: 'combat', rng: rng.state, battle, ...overrides };
}

suite('reconcileWorld: the explore snap (M9)', () => {
  const { content, map, mapId } = snapFixture('m9_snap', SNAP_ROWS, { x: 8, y: 8 });

  /** The app's real load path over a fabricated old save: write, read, reconcile. */
  function loadOldSave(state: GameState): GameState {
    const result = deserialize(serialize(state, META));
    if (!result.ok) throw new Error(result.error);
    return reconcileWorld(content, stateFromBlob(result.blob));
  }

  it('snaps a saved position on a cell the map edit blocked to the nearest walkable cell', () => {
    const reconciled = loadOldSave(exploring({ location: { mapId, pos: { x: 1, y: 8 } } }));

    expect(reconciled.location.pos).toEqual({ x: 2, y: 8 });
    expect(tileAt(buildGrid(map), reconciled.location.pos)?.blocked).toBe(false);
  });

  it('snaps a position three cells off the map edge onto the map', () => {
    // (12,5) is three cells past the right edge (width 10). Off-grid cells are
    // not candidates, so the third ring is the first with any, and row-major
    // picks the topmost of the equidistant cells in column x=9.
    const reconciled = loadOldSave(exploring({ location: { mapId, pos: { x: 12, y: 5 } } }));

    expect(reconciled.location.pos).toEqual({ x: 9, y: 2 });
    expect(tileAt(buildGrid(map), reconciled.location.pos)?.blocked).toBe(false);
  });

  it('leaves an already-walkable position byte-identical', () => {
    const state = exploring({ location: { mapId, pos: { x: 5, y: 6 } } });

    expect(reconcileWorld(content, state).location.pos).toEqual({ x: 5, y: 6 });
    expect(serialize(reconcileWorld(content, state), META)).toBe(serialize(state, META));
  });

  it('snaps the centre of a 3x3 wall block to the nearest walkable cell outside it', () => {
    // (4,3) is the centre of the block at x 3..5, y 2..4: the whole first ring
    // is wall, so the search reaches the second ring and takes its (2,1) corner.
    const reconciled = loadOldSave(exploring({ location: { mapId, pos: { x: 4, y: 3 } } }));

    expect(reconciled.location.pos).toEqual({ x: 2, y: 1 });
    expect(tileAt(buildGrid(map), reconciled.location.pos)?.blocked).toBe(false);
  });

  it('falls back to the map entry when no walkable cell is within the snap radius', () => {
    // The chamber's centre is seven steps from the walkable rim, one past the
    // radius, so the search finds nothing and the entry wins.
    const pocket = snapFixture('m9_pocket', POCKET_ROWS, { x: 0, y: 0 });
    const reconciled = reconcileWorld(
      pocket.content,
      exploring({ location: { mapId: pocket.mapId, pos: { x: 7, y: 7 } } }),
    );

    // The entry is `partySpawns[0]`, the same cell `enterStoryNode` starts the party on.
    expect(reconciled.location.pos).toEqual(pocket.map.partySpawns[0]);
    expect(reconciled.location.pos).toEqual({ x: 0, y: 0 });
  });

  it('falls back to the entry when the map has no walkable cells at all', () => {
    const bare = snapFixture('m9_bare', ['####', '####', '####'], { x: 2, y: 2 });
    const reconciled = reconcileWorld(
      bare.content,
      exploring({ location: { mapId: bare.mapId, pos: { x: 0, y: 0 } } }),
    );

    expect(reconciled.location.pos).toEqual({ x: 2, y: 2 });
  });

  it('breaks ties row-major — smallest y, then smallest x — and repeats exactly', () => {
    // (7,6) is wall with (6,6) and (8,6) one step away; y matches, so x decides.
    const state = exploring({ location: { mapId, pos: { x: 7, y: 6 } } });
    const first = reconcileWorld(content, state).location.pos;
    expect(first).toEqual({ x: 6, y: 6 });

    for (let attempt = 0; attempt < 3; attempt++) {
      expect(reconcileWorld(content, state).location.pos).toEqual(first);
    }
  });

  it('reconciles to a fixed point: a second pass leaves the snapped position alone', () => {
    const once = reconcileWorld(content, exploring({ location: { mapId, pos: { x: 1, y: 8 } } }));

    expect(reconcileWorld(content, once).location.pos).toEqual(once.location.pos);
  });

  it('leaves a mid-battle save untouched, even sitting on a cell the map edit blocked', () => {
    const state = midBattle({ location: { mapId, pos: { x: 1, y: 8 } } });
    const reconciled = reconcileWorld(content, state);

    expect(reconciled).toEqual(state);
    expect(reconciled.location).toEqual(state.location);
    expect(reconciled.battle).toEqual(state.battle);
  });
});

suite('reconcileWorld: the Ba Dan edge rebuild (A5)', () => {
  const map = CONTENT.maps.get('ba_dan_village');
  if (!map) throw new Error('Missing Ba Dan village');
  const grid = buildGrid(map);

  /** A save written before the rebuild, loaded through the app's real path. */
  function loadOldVillageSave(pos: Vec2): GameState {
    const saved = exploring({ location: { mapId: 'ba_dan_village', pos } });
    const result = deserialize(serialize(saved, META));
    if (!result.ok) throw new Error(result.error);
    return reconcileWorld(CONTENT, stateFromBlob(result.blob));
  }

  it('moves a party saved on the old west road end off the flooded ford', () => {
    // (0,7) was the road's last cell and is the ford now. Its first ring
    // holds (1,6) grass and (1,7), (1,8) road; row-major takes the topmost.
    expect(tileAt(grid, { x: 0, y: 7 })?.blocked).toBe(true);
    const reconciled = loadOldVillageSave({ x: 0, y: 7 });

    expect(reconciled.location).toEqual({ mapId: 'ba_dan_village', pos: { x: 1, y: 6 } });
    expect(tileAt(grid, reconciled.location.pos)?.blocked).toBe(false);
    expect(reconcileWorld(CONTENT, reconciled).location).toEqual(reconciled.location);
  });

  it('moves a party saved on a house floor out to open ground', () => {
    // (7,11) was the south-west dwelling's plank floor.
    const reconciled = loadOldVillageSave({ x: 7, y: 11 });

    expect(reconciled.location.pos).not.toEqual({ x: 7, y: 11 });
    expect(tileAt(grid, reconciled.location.pos)?.blocked).toBe(false);
  });
});
