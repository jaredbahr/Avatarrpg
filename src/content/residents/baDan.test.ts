/**
 * Ba Dan's real resident records (ADR 0047 W5a/W5c) resolved over every state
 * class and all six phases. The first suite is the CI gate the W4a review
 * asked for: shipped content must resolve with no diagnostics at all, with
 * or without a conversation pin. The rest pin the §8 schedule, the §4 holds,
 * the guard rota, supervision, and the W5c tile rules to the real maps. W5b
 * turns the general rules into validators; these are the Ba Dan facts.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { EXCLUDED_RESIDENTS } from '../identity';
import { villagePreviewState } from '../../app/village/previewState';
import { createGame } from '../../core/state/createGame';
import { buildGrid, findPath, posKey, tileAt } from '../../core/rules/grid';
import { RANK_CONVERSATION, resolveResidents } from '../../core/story/residents';
import { npcNode } from '../../core/story/storyEngine';
import type { Placement } from '../../core/story/residents';
import { activeTriggers, visibleNpcs } from '../../core/story/world';
import { DAY_PHASES } from '../../core/types';
import type { DayPhase, FlagValue, GameState, MapDef, Vec2 } from '../../core/types';

const VILLAGE = 'ba_dan_village';
const RIVERSIDE = 'ba_dan_riverside';
const HOMECOMINGS = ['mira_epilogue', 'pella_home', 'gao_home', 'dorin_home'];

interface StateClass {
  readonly flags?: Readonly<Record<string, FlagValue>>;
  readonly visited?: readonly string[];
}

/** The ADR's state classes (Tests section), plus three partial return states. */
const CLASSES: Readonly<Record<string, StateClass>> = {
  'new game': {},
  'mira_intro visited': { visited: ['mira_intro'] },
  act1_lost: { flags: { act1_lost: true }, visited: ['mira_intro'] },
  'act1_complete before the homecomings': {
    flags: { act1_complete: true },
    visited: ['mira_intro'],
  },
  'act1_complete, some homecomings heard': {
    flags: { act1_complete: true, ruon_traded: true },
    visited: ['mira_intro', 'mira_epilogue', 'gao_home_cold'],
  },
  'act1_complete, pella_home heard before mira_epilogue': {
    flags: { act1_complete: true },
    visited: ['mira_intro', 'pella_home'],
  },
  'homecomings complete': {
    flags: { act1_complete: true },
    visited: ['mira_intro', ...HOMECOMINGS],
  },
  ruon_traded: { flags: { ruon_traded: true }, visited: ['mira_intro', 'gao_cold'] },
  ruon_spared: { flags: { ruon_spared: true }, visited: ['mira_intro'] },
  lost_ambush: {
    flags: { lost_ambush: true, ruon_carried_you: true, ruon_spared: true },
    visited: ['mira_intro'],
  },
};

function at(phase: DayPhase, cls: StateClass = {}, mapId = VILLAGE): GameState {
  const base = createGame(CONTENT, {
    seed: 'ba-dan-residents',
    party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    flags: { ...base.flags, ...cls.flags },
    story: { ...base.story, nodeId: 'village_explore', visited: [...(cls.visited ?? [])] },
    location: { mapId, pos: { x: 3, y: 7 } },
    world: { ...base.world, clock: { day: 1, phase } },
  };
}

const map = (id: string): MapDef => {
  const found = CONTENT.maps.get(id);
  if (!found) throw new Error(`Missing map ${id}`);
  return found;
};

/** Every visible NpcDef, across both Ba Dan maps. */
const everyVisible = (state: GameState) =>
  [VILLAGE, RIVERSIDE].flatMap((id) =>
    visibleNpcs(CONTENT, map(id), state).map((npc) => ({ ...npc, mapId: id })),
  );

const placementOf = (state: GameState, id: string): Placement => {
  const found = resolveResidents(CONTENT, state).placements.find((p) => p.id === id);
  if (!found) throw new Error(`No placement for ${id}`);
  return found;
};

const where = (state: GameState, id: string): string | null =>
  resolveResidents(CONTENT, state).placements.find((p) => p.id === id)?.anchor ?? null;

/**
 * `state` with each visible resident in turn pinned mid-conversation, as
 * `handleWalkTo` leaves it: the entered node is already in `visited`, since
 * the log is written on entry (ADR 0047 §4 amendment, W5).
 */
const pinnedStates = (state: GameState) =>
  everyVisible(state).flatMap((npc) => {
    if (!npc.resident) return [];
    const anchor = placementOf(state, npc.resident).anchor;
    if (!anchor) throw new Error(`${npc.id} is visible without an anchor`);
    const node = npcNode(CONTENT, state, npc.mapId, npc.id);
    if (!node) throw new Error(`${npc.id} opens no conversation`);
    const pinned: GameState = {
      ...state,
      screen: 'dialogue',
      location: { ...state.location, mapId: npc.mapId },
      story: {
        ...state.story,
        visited: [...state.story.visited, node],
      },
      world: { ...state.world, talk: { npcId: npc.id, mapId: npc.mapId, anchor } },
    };
    return [{ npc, anchor, resident: npc.resident, pinned }];
  });

const each = (fn: (name: string, cls: StateClass, phase: DayPhase) => void): void => {
  for (const [name, cls] of Object.entries(CLASSES))
    for (const phase of DAY_PHASES) fn(name, cls, phase);
};

suite('Ba Dan residents: no diagnostics in any state class or phase (CI gate)', () => {
  it('resolves every state class x every phase with no diagnostic', () => {
    each((name, cls, phase) => {
      expect(resolveResidents(CONTENT, at(phase, cls)).diagnostics, `${name}, ${phase}`).toEqual(
        [],
      );
    });
  });

  it('resolves with no diagnostic while any visible resident is pinned in conversation', () => {
    each((name, cls, phase) => {
      for (const { npc, anchor, resident, pinned } of pinnedStates(at(phase, cls))) {
        const resolution = resolveResidents(CONTENT, pinned);
        expect(resolution.diagnostics, `${name}, ${phase}, ${npc.id}`).toEqual([]);
        expect(placementOf(pinned, resident).anchor).toBe(anchor);
      }
    });
  });
});

suite('Ba Dan residents: the §8 schedule and the §4 holds', () => {
  const cast = ['lw.npc.mira', 'lw.npc.gao', 'lw.npc.pella', 'lw.npc.dorin', 'lw.npc.hanru'];
  const roles = ['bg.relief_watch', 'bg.pella_household'];
  const table = (cls: StateClass) =>
    Object.fromEntries(
      DAY_PHASES.map((phase) => [
        phase,
        [...cast, ...roles].map((id) => where(at(phase, cls), id) ?? '-').join(' | '),
      ]),
    );

  it('runs the ordinary day once Mira has met the party, before victory', () => {
    expect(table(CLASSES['mira_intro visited'] ?? {})).toEqual({
      dawn: 'bd01.table | bd02.shopfront | bd04.court | bd03.post | bd03.handover | - | bd04.yard',
      morning: 'bd01.table | bd02.shopfront | bd05.school | bd03.post | home.hanru | - | -',
      midday:
        'bd01.table | bd02.shopfront | bd04.court | rv.practice | home.hanru | bd03.post | bd04.yard',
      afternoon: 'bd06.bank | bd02.shopfront | bd06.watch | bd03.post | home.hanru | - | -',
      evening:
        'bd01.table | bd02.shopfront | bd04.court | bd03.handover | bd03.post | - | bd04.yard',
      night: 'home.mira | home.gao | home.pella | home.dorin | bd03.post | - | -',
    });
  });

  it('holds Mira at her table before mira_intro, and Pella at home court without her', () => {
    const fresh = table(CLASSES['new game'] ?? {});
    for (const phase of DAY_PHASES) expect(fresh[phase]?.split(' | ')[0], phase).toBe('bd01.table');
    expect(fresh.afternoon?.split(' | ')[2]).toBe('bd04.court');
  });

  it('holds every homecoming owner in public in every phase after victory', () => {
    expect(table(CLASSES['act1_complete before the homecomings'] ?? {})).toEqual({
      dawn: 'bd01.table | bd02.shopfront | bd04.court | bd03.post | bd03.handover | - | bd04.yard',
      morning: 'bd01.table | bd02.shopfront | bd04.court | bd03.post | home.hanru | - | bd04.yard',
      midday: 'bd01.table | bd02.shopfront | bd04.court | bd03.post | home.hanru | - | bd04.yard',
      afternoon:
        'bd01.table | bd02.shopfront | bd04.court | bd03.post | home.hanru | - | bd04.yard',
      evening:
        'bd01.table | bd02.shopfront | bd04.court | bd03.handover | bd03.post | - | bd04.yard',
      night: 'bd01.table | bd02.shopfront | bd04.court | bd03.handover | bd03.post | - | bd04.yard',
    });
  });

  it('returns to the ordinary day once every homecoming is heard', () => {
    expect(table(CLASSES['homecomings complete'] ?? {})).toEqual(
      table(CLASSES['mira_intro visited'] ?? {}),
    );
  });

  it('keeps each required conversation visible and talkable in every phase until visited', () => {
    const holds: [StateClass, string, string][] = [
      [CLASSES['new game'] ?? {}, 'elder_mira', 'mira_intro'],
      [CLASSES['act1_complete before the homecomings'] ?? {}, 'elder_mira', 'mira_epilogue'],
      [CLASSES['act1_complete before the homecomings'] ?? {}, 'shopkeeper_gao', 'gao_home'],
      [CLASSES['act1_complete before the homecomings'] ?? {}, 'kid_pella', 'pella_home'],
      [CLASSES['act1_complete before the homecomings'] ?? {}, 'guard_dorin', 'dorin_home'],
    ];
    for (const [cls, npcId, node] of holds)
      for (const phase of DAY_PHASES) {
        const npc = visibleNpcs(CONTENT, map(VILLAGE), at(phase, cls)).find((n) => n.id === npcId);
        expect(npc, `${npcId} for ${node}, ${phase}`).toBeDefined();
      }
  });

  it('shows each §05.2 state as visible evidence, not a change of place', () => {
    const activity = (cls: StateClass, phase: DayPhase, id: string) =>
      placementOf(at(phase, cls), id).activity;
    const occupied = CLASSES['mira_intro visited'] ?? {};
    expect(activity(occupied, 'morning', 'lw.npc.gao')).toBe('short_stock_service');
    expect(activity(CLASSES.act1_lost ?? {}, 'morning', 'lw.npc.gao')).toBe('honest_stock_check');
    expect(activity(occupied, 'morning', 'lw.npc.dorin')).toBe('watch_for_returnees');
    expect(activity(CLASSES['homecomings complete'] ?? {}, 'morning', 'lw.npc.dorin')).toBe(
      'watch_arrivals',
    );
    // The first safe night: the evening table is the returnees' supper.
    const back = CLASSES['act1_complete, some homecomings heard'] ?? {};
    expect(activity(back, 'evening', 'lw.npc.mira')).toBe('returnee_supper');
    expect(activity(CLASSES['homecomings complete'] ?? {}, 'evening', 'lw.npc.mira')).toBe(
      'table_company',
    );
  });
});

suite('Ba Dan residents: guards, supervision and the five missing', () => {
  it('keeps exactly one gate watch; Dorin and Hanru meet only at post and handover', () => {
    each((name, cls, phase) => {
      const state = at(phase, cls);
      const watch = resolveResidents(CONTENT, state).placements.filter(
        (p) => p.slot?.service === 'gate_watch',
      );
      expect(watch, `${name}, ${phase}`).toHaveLength(1);
      expect(watch[0]?.anchor).toBe('bd03.post');
      const dorin = placementOf(state, 'lw.npc.dorin');
      const hanru = placementOf(state, 'lw.npc.hanru');
      if (dorin.mapId === VILLAGE && hanru.mapId === VILLAGE)
        expect([dorin.anchor, hanru.anchor].sort(), `${name}, ${phase}`).toEqual([
          'bd03.handover',
          'bd03.post',
        ]);
      if (['morning', 'midday', 'afternoon'].includes(phase))
        expect(hanru.anchor, `${name}, ${phase}`).toBe('home.hanru');
    });
  });

  it('puts Pella at the river only with Mira there, and never alone at the court', () => {
    // The one exception (ADR 0047 §4 amendment, W5): opening `mira_intro`,
    // or `mira_epilogue` once `pella_home` is heard, visits it at once and
    // lifts Mira's hold, so Pella resolves to the river while Mira is pinned
    // at her table. Pella is off the player's map, and only for that talk.
    let exceptions = 0;
    each((name, cls, phase) => {
      const state = at(phase, cls);
      const cases = [
        { label: `${name}, ${phase}`, s: state },
        ...pinnedStates(state).map(({ npc, pinned }) => ({
          label: `${name}, ${phase}, ${npc.id} pinned`,
          s: pinned,
        })),
      ];
      for (const { label, s } of cases) {
        const pella = placementOf(s, 'lw.npc.pella');
        const mira = placementOf(s, 'lw.npc.mira');
        if (pella.anchor?.startsWith('bd06.') && !mira.anchor?.startsWith('bd06.')) {
          expect(
            mira.rank === RANK_CONVERSATION &&
              mira.anchor === 'bd01.table' &&
              pella.mapId !== VILLAGE,
            label,
          ).toBe(true);
          exceptions++;
        }
        if (pella.anchor === 'bd04.court')
          expect(where(s, 'bg.pella_household'), label).toBe('bd04.yard');
        expect([null, 'home.pella', 'bd05.school', 'bd04.court', 'bd06.watch'], label).toContain(
          pella.anchor,
        );
      }
    });
    // The exception is real, and the test sees it.
    expect(exceptions).toBeGreaterThan(0);
  });

  it('shows each person on at most one map, and never one of the five missing', () => {
    const excluded = new Set(EXCLUDED_RESIDENTS.map((e) => e.id));
    each((name, cls, phase) => {
      const state = at(phase, cls);
      const seen = everyVisible(state).filter((npc) => npc.resident);
      const byResident = new Map<string, string[]>();
      for (const npc of seen)
        byResident.set(npc.resident ?? '', [...(byResident.get(npc.resident ?? '') ?? []), npc.id]);
      for (const [resident, ids] of byResident)
        expect(ids, `${name}, ${phase}, ${resident}`).toHaveLength(1);
      for (const p of resolveResidents(CONTENT, state).placements)
        expect(excluded.has(p.id), `${name}, ${phase}`).toBe(false);
    });
  });

  it('lets no plain village NPC wear a resident’s figure or speak in a resident’s name (W7)', () => {
    // The riverside sign drew Pella's figure and spoke as her, so a second
    // Pella stood at the lane while she was at the court.
    const village = CONTENT.maps.get(VILLAGE);
    const bound = village?.npcs.filter((npc) => npc.resident) ?? [];
    const figures = new Set(bound.map((npc) => npc.sprite));
    const names = [...CONTENT.residents.values()].map((resident) => resident.name);
    const plain = village?.npcs.filter((npc) => !npc.resident) ?? [];
    expect(plain.map((npc) => npc.id)).toContain('riverside_sign');
    for (const npc of plain) {
      expect(figures.has(npc.sprite), npc.id).toBe(false);
      for (const id of [npc.node, ...(npc.routes ?? []).map((route) => route.node)]) {
        const node = CONTENT.story.get(id);
        const speaker = node && 'speaker' in node ? node.speaker : '';
        for (const name of names) expect(speaker, `${npc.id} → ${id}`).not.toContain(name);
      }
    }
  });
});

suite('Ba Dan residents: anchor tiles (W5c)', () => {
  const arrivals = (id: string): Vec2[] =>
    [...CONTENT.maps.values()].flatMap((m) =>
      (m.exits ?? []).filter((e) => e.toMapId === id).map((e) => e.toPos),
    );

  /** Tiles no anchor may use (§3), keyed by map. */
  const forbidden = (m: MapDef): Set<string> =>
    new Set(
      [
        ...(m.exits ?? []).map((e) => e.pos),
        ...(m.exit ? [m.exit.pos] : []),
        ...arrivals(m.id),
        ...m.partySpawns,
        ...(m.restSpots ?? []).map((s) => s.pos),
        ...(m.triggers ?? []).flatMap((t) => t.area),
        ...m.npcs.flatMap((n) => (n.resident || !n.pos ? [] : [n.pos])),
      ].map(posKey),
    );

  const sites = [...CONTENT.anchors.values()].map((anchor) =>
    anchor.site.kind === 'map'
      ? { id: anchor.id, mapId: anchor.site.mapId, pos: anchor.site.pos, door: false }
      : { id: anchor.id, mapId: anchor.site.door.mapId, pos: anchor.site.door.pos, door: true },
  );

  it('stands every anchor, and every door, on a walkable tile reachable from every arrival', () => {
    for (const site of sites) {
      const m = map(site.mapId);
      const grid = buildGrid(m);
      expect(tileAt(grid, site.pos)?.blocked, site.id).toBe(false);
      for (const from of arrivals(m.id))
        expect(
          findPath(
            { grid, blocked: new Set(), surfaces: CONTENT.surfaces, size: 1 },
            from,
            site.pos,
            grid.width * grid.height,
          ),
          `${site.id} from ${posKey(from)}`,
        ).not.toBeNull();
    }
  });

  it('keeps anchors and doors off exits, arrivals, spawns, rest spots, triggers and plain NPCs', () => {
    for (const site of sites)
      expect(forbidden(map(site.mapId)).has(posKey(site.pos)), site.id).toBe(false);
  });

  it('shares only the declared BD04 household door', () => {
    const byTile = new Map<string, string[]>();
    for (const site of sites) {
      const key = `${site.mapId}:${posKey(site.pos)}`;
      byTile.set(key, [...(byTile.get(key) ?? []), site.id]);
    }
    expect(
      [...byTile.values()].filter((ids) => ids.length > 1).map((ids) => [...ids].sort()),
    ).toEqual([['home.bo_shan', 'home.pella']]);
  });

  it('leaves every visible NPC a free neighbour to be approached from', () => {
    each((name, cls, phase) => {
      for (const id of [VILLAGE, RIVERSIDE]) {
        const state = at(phase, cls, id);
        const m = map(id);
        const grid = buildGrid(m);
        const npcs = visibleNpcs(CONTENT, m, state);
        const taken = new Set([
          ...forbidden(m),
          ...npcs.map((n) => posKey(n.pos)),
          ...activeTriggers(m, state).flatMap((t) => t.area.map(posKey)),
        ]);
        for (const npc of npcs) {
          const free = [-1, 0, 1].some((dx) =>
            [-1, 0, 1].some((dy) => {
              const next = { x: npc.pos.x + dx, y: npc.pos.y + dy };
              return (
                (dx || dy) && tileAt(grid, next)?.blocked === false && !taken.has(posKey(next))
              );
            }),
          );
          expect(free, `${name}, ${phase}, ${npc.id}`).toBe(true);
        }
      }
    });
  });
});

suite('the title preview (ADR 0047 §1)', () => {
  it('starts in the afternoon after Mira’s briefing, with Mira and Pella at the river', () => {
    const preview = villagePreviewState(CONTENT);
    expect(preview.story.visited).toContain('mira_intro');
    expect(preview.world.clock).toEqual({ day: 1, phase: 'afternoon' });
    expect(where(preview, 'lw.npc.mira')).toBe('bd06.bank');
    expect(where(preview, 'lw.npc.pella')).toBe('bd06.watch');
    const river = visibleNpcs(CONTENT, map(RIVERSIDE), preview).map((n) => n.id);
    expect(river).toEqual(expect.arrayContaining(['riverside_mira', 'riverside_pella']));
    expect(river).not.toContain('riverside_dorin');
  });
});
