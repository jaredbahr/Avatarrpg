/**
 * The resident resolver (ADR 0047 §2, W4a), on small synthetic worlds only.
 * Ba Dan's real records are W5a; these fixtures borrow nothing from them but
 * the shapes. The ADR tests they cover at resolver level: 1 (determinism),
 * 4 (one place per resident, never two maps), 5 (no shared tile or reserve
 * key; a losing mission placement is a hard error), 6 (guard relief), 7
 * (required conversations), 8 (the pin holds the speaker) and 10 (a captive
 * never resolves to a work loop before release).
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import { DAY_PHASES } from '../types';
import type {
  BackgroundRole,
  Condition,
  ContentIndex,
  DayPhase,
  GameState,
  MapDef,
  NpcDef,
  ResidentDef,
  ResidentSlot,
  WorldAnchor,
} from '../types';
import {
  RANK_CONVERSATION,
  RANK_DISPLACED,
  RANK_FALLBACK,
  RANK_ROLE,
  RANK_SCHEDULE,
  isHardDiagnostic,
  resolveResidents,
} from './residents';
import type { Placement, Resolution } from './residents';
import { placedNpcs } from './world';

/* --- fixture builders ----------------------------------------------- */

function map(id: string, npcs: readonly NpcDef[]): MapDef {
  return {
    id,
    name: id,
    kind: 'explore',
    width: 40,
    height: 24,
    rows: [],
    legend: {},
    partySpawns: [{ x: 0, y: 0 }],
    npcs,
    props: [],
    ambience: 'none',
  };
}

/** A bound NpcDef; its legacy `pos` is deliberately nowhere near any anchor. */
function npc(id: string, resident: string): NpcDef {
  return { id, name: id, pos: { x: 39, y: 23 }, sprite: 'npc.elder', node: 'mira_intro', resident };
}

const tile = (id: string, mapId: string, x: number, y: number, reserve?: string): WorldAnchor => ({
  id,
  place: 'TEST',
  site: { kind: 'map', mapId, pos: { x, y }, ...(reserve ? { reserve } : {}) },
});

const room = (id: string): WorldAnchor => ({
  id,
  place: 'TEST',
  site: { kind: 'private', door: { mapId: 'town', pos: { x: 1, y: 1 } } },
});

const slot = (anchor: string, extra: Partial<ResidentSlot> = {}): ResidentSlot => ({
  anchor,
  activity: 'idle',
  interrupt: 'talk',
  ...extra,
});

const every = <T>(value: T): Record<DayPhase, T> => ({
  dawn: value,
  morning: value,
  midday: value,
  afternoon: value,
  evening: value,
  night: value,
});

function resident(
  id: string,
  schedule: Record<DayPhase, ResidentSlot | 'home'>,
  extra: Partial<ResidentDef> = {},
): ResidentDef {
  return {
    id,
    name: id,
    source: { runtimeNpcIds: [] },
    home: `home.${id}`,
    fallback: slot(`fallback.${id}`),
    schedule,
    ...extra,
  };
}

function world(
  anchors: readonly WorldAnchor[],
  residents: readonly ResidentDef[],
  roles: readonly BackgroundRole[] = [],
  maps: readonly MapDef[] = [map('town', []), map('bank', [])],
): ContentIndex {
  return {
    ...CONTENT,
    maps: new Map(maps.map((m) => [m.id, m])),
    anchors: new Map(anchors.map((a) => [a.id, a])),
    residents: new Map(residents.map((r) => [r.id, r])),
    backgroundRoles: new Map(roles.map((r) => [r.id, r])),
  };
}

const BASE = createGame(CONTENT, {
  seed: 'residents',
  party: [{ characterId: 'kaya' }],
  startNode: 'village_explore',
});

function at(
  phase: DayPhase,
  extra: {
    flags?: GameState['flags'];
    visited?: readonly string[];
    screen?: GameState['screen'];
    talk?: GameState['world']['talk'];
  } = {},
): GameState {
  return {
    ...BASE,
    screen: extra.screen ?? 'explore',
    flags: extra.flags ?? {},
    story: { ...BASE.story, visited: extra.visited ?? [] },
    world: { ...BASE.world, clock: { day: 1, phase }, talk: extra.talk ?? null },
  };
}

const flag = (key: string): Condition => ({ kind: 'flag', key, op: 'set' });
const visited = (nodeId: string): Condition => ({ kind: 'visited', nodeId });
const not = (of: Condition): Condition => ({ kind: 'not', of });

function placementOf(resolution: Resolution, id: string): Placement {
  const found = resolution.placements.find((p) => p.id === id);
  if (!found) throw new Error(`No placement for "${id}"`);
  return found;
}

/** Test 4 and 5's invariants: one placement per resident, no shared tile or reserve key. */
function expectSound(content: ContentIndex, resolution: Resolution): void {
  const residentIds = [...content.residents.keys()];
  const residentPlacements = resolution.placements.filter((p) => content.residents.has(p.id));
  expect(residentPlacements.map((p) => p.id)).toEqual(residentIds);

  const tiles = new Set<string>();
  const reserves = new Set<string>();
  for (const placement of resolution.placements) {
    if (!placement.pos) continue;
    const key = `${placement.mapId}:${placement.pos.x},${placement.pos.y}`;
    expect(tiles.has(key), `two placements on ${key}`).toBe(false);
    tiles.add(key);
    const site = content.anchors.get(placement.anchor ?? '')?.site;
    const reserve = site?.kind === 'map' ? site.reserve : undefined;
    if (reserve) {
      expect(reserves.has(reserve), `reserve "${reserve}" claimed twice`).toBe(false);
      reserves.add(reserve);
    }
  }
}

/* --- precedence ------------------------------------------------------ */

suite('resolveResidents: candidate precedence', () => {
  // Overrides are declared lowest tier first, so tier order (not declaration
  // order) has to be what picks the winner.
  const tiers = ['appointment', 'care', 'presence', 'hazard', 'mission'] as const;
  const ranked = resident('ranked', every(slot('sched', { npc: 'town_ranked' })), {
    overrides: tiers.map((tier) => ({
      id: tier,
      tier,
      when: flag(`on.${tier}`),
      slots: {},
      all: slot(`at.${tier}`, { npc: 'town_ranked' }),
    })),
  });
  const content = world(
    [
      tile('sched', 'town', 1, 1),
      ...tiers.map((tier, i) => tile(`at.${tier}`, 'town', 2 + i, 1)),
      tile('fallback.ranked', 'town', 9, 9),
      room('home.ranked'),
    ],
    [ranked],
    [],
    [map('town', [npc('town_ranked', 'ranked')]), map('bank', [])],
  );

  it('takes mission, hazard, presence, care, appointment, then the schedule', () => {
    const on: Record<string, boolean> = Object.fromEntries(tiers.map((t) => [`on.${t}`, true]));
    for (const tier of [...tiers].reverse()) {
      const placement = placementOf(
        resolveResidents(content, at('midday', { flags: on })),
        'ranked',
      );
      expect(placement.anchor).toBe(`at.${tier}`);
      expect(placement.rank).toBe(
        ['mission', 'hazard', 'presence', 'care', 'appointment'].indexOf(tier) + 1,
      );
      on[`on.${tier}`] = false;
    }
    const placement = placementOf(resolveResidents(content, at('midday', { flags: on })), 'ranked');
    expect(placement).toMatchObject({ anchor: 'sched', rank: RANK_SCHEDULE });
  });

  it('puts the conversation pin ahead of every tier while in dialogue, and only then', () => {
    const flags = Object.fromEntries(tiers.map((t) => [`on.${t}`, true]));
    const talk = { npcId: 'town_ranked', mapId: 'town', anchor: 'sched' };
    const talking = at('midday', { flags, screen: 'dialogue', talk });
    expect(placementOf(resolveResidents(content, talking), 'ranked')).toMatchObject({
      anchor: 'sched',
      rank: RANK_CONVERSATION,
      slot: { npc: 'town_ranked', interrupt: 'talk' },
    });
    // The same pin outside dialogue holds nobody.
    const exploring = at('midday', { flags, talk });
    expect(placementOf(resolveResidents(content, exploring), 'ranked').anchor).toBe('at.mission');
  });

  it('within one tier, the first declared override that holds wins', () => {
    const twice = resident('twice', every(slot('sched')), {
      overrides: [
        { id: 'first', tier: 'care', when: flag('a'), slots: {}, all: slot('at.care') },
        { id: 'second', tier: 'care', when: flag('b'), slots: {}, all: slot('at.presence') },
      ],
    });
    const c = world(
      [
        tile('sched', 'town', 1, 1),
        tile('at.care', 'town', 2, 1),
        tile('at.presence', 'town', 3, 1),
      ],
      [twice],
    );
    expect(
      placementOf(resolveResidents(c, at('dawn', { flags: { a: true, b: true } })), 'twice').anchor,
    ).toBe('at.care');
    expect(
      placementOf(resolveResidents(c, at('dawn', { flags: { b: true } })), 'twice').anchor,
    ).toBe('at.presence');
  });

  it('reads an override per phase, then its `all`, and skips a phase with neither', () => {
    const shaped = resident('shaped', every(slot('sched')), {
      overrides: [
        {
          id: 'o1',
          tier: 'appointment',
          when: flag('o1'),
          slots: { night: 'home' },
          all: slot('at.care'),
        },
        { id: 'o2', tier: 'care', when: flag('o2'), slots: { evening: slot('at.presence') } },
      ],
    });
    const c = world(
      [
        tile('sched', 'town', 1, 1),
        tile('at.care', 'town', 2, 1),
        tile('at.presence', 'town', 3, 1),
        room('home.shaped'),
      ],
      [shaped],
    );
    const anchorAt = (phase: DayPhase, flags: Record<string, boolean>) =>
      placementOf(resolveResidents(c, at(phase, { flags })), 'shaped').anchor;
    expect(anchorAt('night', { o1: true })).toBe('home.shaped');
    expect(anchorAt('dawn', { o1: true })).toBe('at.care');
    expect(anchorAt('evening', { o2: true })).toBe('at.presence');
    expect(anchorAt('dawn', { o2: true })).toBe('sched');
  });

  it("resolves a slot's activity to its first matching variant", () => {
    const posed = resident(
      'posed',
      every(
        slot('sched', {
          activity: 'base',
          variants: [
            { when: flag('a'), activity: 'A' },
            { when: flag('b'), activity: 'B' },
          ],
        }),
      ),
    );
    const c = world([tile('sched', 'town', 1, 1)], [posed]);
    const activity = (flags: Record<string, boolean>) =>
      placementOf(resolveResidents(c, at('dawn', { flags })), 'posed').activity;
    expect(activity({})).toBe('base');
    expect(activity({ b: true })).toBe('B');
    expect(activity({ a: true, b: true })).toBe('A');
  });
});

/* --- ranking and the fallback chain ---------------------------------- */

suite('resolveResidents: global ranking and the fallback chain', () => {
  const anchors = [
    tile('shared', 'town', 5, 5),
    tile('fallback.low', 'town', 6, 5),
    tile('fallback.high', 'town', 7, 5),
    tile('fallback.third', 'town', 8, 5),
    room('home.low'),
    room('home.high'),
    room('home.third'),
  ];

  it('gives a shared tile to the higher tier whatever the declaration order', () => {
    const low = resident('low', every(slot('shared')));
    const high = resident('high', every(slot('fallback.high')), {
      overrides: [{ id: 'm', tier: 'mission', when: flag('hold'), slots: {}, all: slot('shared') }],
    });
    const c = world(anchors, [low, high]);
    const resolution = resolveResidents(c, at('dawn', { flags: { hold: true } }));
    expectSound(c, resolution);
    expect(placementOf(resolution, 'high')).toMatchObject({ anchor: 'shared', rank: 1 });
    expect(placementOf(resolution, 'low')).toMatchObject({
      anchor: 'fallback.low',
      rank: RANK_FALLBACK,
    });
    expect(resolution.diagnostics).toEqual([
      { id: 'low', rank: RANK_SCHEDULE, anchor: 'shared', to: 'fallback.low' },
    ]);
  });

  it('breaks a tie of equal tiers by declaration order', () => {
    const c = world(anchors, [
      resident('low', every(slot('shared'))),
      resident('high', every(slot('shared'))),
    ]);
    const resolution = resolveResidents(c, at('dawn'));
    expect(placementOf(resolution, 'low').anchor).toBe('shared');
    expect(placementOf(resolution, 'high').anchor).toBe('fallback.high');
  });

  it('lets only one placement hold a shared reserve key', () => {
    const c = world(
      [
        tile('bench.left', 'town', 1, 1, 'bench'),
        tile('bench.right', 'town', 2, 1, 'bench'),
        ...anchors,
      ],
      [resident('low', every(slot('bench.left'))), resident('high', every(slot('bench.right')))],
    );
    const resolution = resolveResidents(c, at('dawn'));
    expectSound(c, resolution);
    expect(placementOf(resolution, 'low').anchor).toBe('bench.left');
    expect(placementOf(resolution, 'high').anchor).toBe('fallback.high');
  });

  it('falls back to home when the fallback is taken too, and to absent with no home', () => {
    const blockers = [
      resident('high', every(slot('shared'))),
      resident('third', every(slot('fallback.low'))),
    ];
    const c = world(anchors, [...blockers, resident('low', every(slot('shared')))]);
    const resolution = resolveResidents(c, at('dawn'));
    expectSound(c, resolution);
    expect(placementOf(resolution, 'low')).toMatchObject({
      anchor: 'home.low',
      slot: null,
      rank: RANK_DISPLACED,
    });
    expect(resolution.diagnostics).toEqual([
      { id: 'low', rank: RANK_SCHEDULE, anchor: 'shared', to: 'home.low' },
    ]);

    const homeless = world(
      anchors.filter((a) => a.id !== 'home.low'),
      [...blockers, resident('low', every(slot('shared')))],
    );
    const lost = resolveResidents(homeless, at('dawn'));
    expectSound(homeless, lost);
    expect(placementOf(lost, 'low')).toMatchObject({ anchor: null, rank: RANK_DISPLACED });
    expect(lost.diagnostics).toEqual([
      { id: 'low', rank: RANK_SCHEDULE, anchor: 'shared', to: null },
    ]);
  });

  it('claims fallbacks only after every first candidate, so a displaced resident displaces no one', () => {
    // `low` loses `shared` to `high`; its fallback tile is `third`'s own
    // schedule slot. `third` is declared after `low` at the same rank, so a
    // single pass would hand it to `low` and cascade; it must stay `third`'s.
    const c = world(anchors, [
      resident('low', every(slot('shared'))),
      resident('high', every(slot('fallback.high')), {
        overrides: [
          { id: 'm', tier: 'mission', when: flag('hold'), slots: {}, all: slot('shared') },
        ],
      }),
      resident('third', every(slot('fallback.low'))),
    ]);
    const resolution = resolveResidents(c, at('dawn', { flags: { hold: true } }));
    expectSound(c, resolution);
    expect(placementOf(resolution, 'third')).toMatchObject({
      anchor: 'fallback.low',
      rank: RANK_SCHEDULE,
    });
    expect(placementOf(resolution, 'low').anchor).toBe('home.low');
    expect(resolution.diagnostics.map((d) => d.id)).toEqual(['low']);
  });

  it('reports a losing mission (test 5) or conversation as a hard diagnostic, a losing schedule as soft', () => {
    const mission = (id: string) =>
      resident(id, every(slot(`fallback.${id}`)), {
        overrides: [
          { id: 'm', tier: 'mission', when: flag('hold'), slots: {}, all: slot('shared') },
        ],
      });
    const twoHolds = world(anchors, [mission('high'), mission('low')]);
    const [lost] = resolveResidents(twoHolds, at('dawn', { flags: { hold: true } })).diagnostics;
    expect(lost).toMatchObject({ id: 'low', rank: 1 });
    expect(lost && isHardDiagnostic(lost)).toBe(true);

    const soft = world(anchors, [
      resident('high', every(slot('shared'))),
      resident('low', every(slot('shared'))),
    ]);
    const [displaced] = resolveResidents(soft, at('dawn')).diagnostics;
    expect(displaced && isHardDiagnostic(displaced)).toBe(false);
  });

  it('keeps a pinned speaker on its tile against a mission hold declared first', () => {
    const holder = resident('high', every(slot('fallback.high')), {
      overrides: [{ id: 'm', tier: 'mission', when: flag('hold'), slots: {}, all: slot('shared') }],
    });
    const speaker = resident('low', every(slot('shared', { npc: 'town_low' })));
    const c = world(
      anchors,
      [holder, speaker],
      [],
      [map('town', [npc('town_low', 'low')]), map('bank', [])],
    );
    const talk = { npcId: 'town_low', mapId: 'town', anchor: 'shared' };
    const resolution = resolveResidents(
      c,
      at('dawn', { flags: { hold: true }, screen: 'dialogue', talk }),
    );
    expect(placementOf(resolution, 'low')).toMatchObject({
      anchor: 'shared',
      rank: RANK_CONVERSATION,
    });
    expect(resolution.diagnostics).toEqual([
      { id: 'high', rank: 1, anchor: 'shared', to: 'fallback.high' },
    ]);
  });
});

/* --- background roles ------------------------------------------------ */

suite('resolveResidents: background roles', () => {
  const anchors = [
    tile('court', 'town', 9, 10),
    tile('yard', 'town', 10, 11),
    tile('watch', 'bank', 16, 14),
  ];
  const kid = resident('kid', { ...every(slot('court')), afternoon: slot('watch') });
  const adult: BackgroundRole = {
    id: 'bg.adult',
    label: 'An adult',
    sprite: 'npc.elder',
    slots: {},
    accompanies: {
      resident: 'kid',
      anchors: ['court'],
      slot: slot('yard', { interrupt: 'observe' }),
    },
  };

  it('accompanies its resident at the listed anchors and nowhere else', () => {
    const c = world(anchors, [kid], [adult]);
    expect(placementOf(resolveResidents(c, at('dawn')), 'bg.adult')).toMatchObject({
      anchor: 'yard',
      rank: RANK_ROLE,
    });
    const afternoon = resolveResidents(c, at('afternoon'));
    expect(afternoon.placements.some((p) => p.id === 'bg.adult')).toBe(false);
  });

  it('never displaces a resident: a role whose tile is taken is omitted without a diagnostic', () => {
    const relief: BackgroundRole = {
      id: 'bg.relief',
      label: 'Relief',
      sprite: 'npc.guard',
      slots: { dawn: slot('court', { interrupt: 'observe' }) },
    };
    // The role is resolved after residents even though nothing orders the maps.
    const c = world(anchors, [kid], [relief]);
    const resolution = resolveResidents(c, at('dawn'));
    expect(placementOf(resolution, 'kid').anchor).toBe('court');
    expect(resolution.placements.some((p) => p.id === 'bg.relief')).toBe(false);
    expect(resolution.diagnostics).toEqual([]);
  });
});

/* --- determinism and the memo (test 1) -------------------------------- */

suite('resolveResidents: determinism and the memo', () => {
  const c = world([tile('sched', 'town', 1, 1)], [resident('one', every(slot('sched')))]);

  it('returns the same object for the same state, and an equal result for an equal state', () => {
    const state = at('dawn');
    const first = resolveResidents(c, state);
    expect(resolveResidents(c, state)).toBe(first);
    const copy = structuredClone(state);
    const again = resolveResidents(c, copy);
    expect(again).not.toBe(first);
    expect(again).toEqual(first);
  });

  it('recomputes for a new state and leaves the state, and its rng, untouched', () => {
    const state = at('dawn');
    const before = structuredClone(state);
    const dawn = resolveResidents(c, state);
    const night = resolveResidents(c, at('night'));
    expect(night).not.toBe(dawn);
    expect(state).toEqual(before);
    expect(state.rng).toEqual(before.rng);
  });
});

/* --- guard relief (test 6) ------------------------------------------- */

suite('resolveResidents: guard relief', () => {
  const watch = { service: 'gate_watch' as const };
  const dayNpc = 'town_day_guard';
  const nightNpc = 'town_night_guard';
  const day = resident(
    'day_guard',
    {
      dawn: slot('post', { npc: dayNpc, ...watch }),
      morning: slot('post', { npc: dayNpc, ...watch }),
      midday: slot('practice', { npc: 'bank_day_guard' }),
      afternoon: slot('post', { npc: dayNpc, ...watch }),
      evening: slot('handover', { npc: dayNpc }),
      night: 'home',
    },
    {
      fallback: slot('handover', { npc: dayNpc }),
      // The homecoming hold (§4): the post with the watch by day, the
      // handover (no service) in the evening and at night.
      overrides: [
        {
          id: 'hold',
          tier: 'mission',
          when: { kind: 'all', of: [flag('victory'), not(visited('day_home'))] },
          slots: {
            dawn: slot('post', { npc: dayNpc, ...watch }),
            morning: slot('post', { npc: dayNpc, ...watch }),
            midday: slot('post', { npc: dayNpc, ...watch }),
            afternoon: slot('post', { npc: dayNpc, ...watch }),
          },
          all: slot('handover', { npc: dayNpc }),
        },
      ],
    },
  );
  const night = resident(
    'night_guard',
    {
      dawn: slot('handover', { npc: nightNpc }),
      morning: 'home',
      midday: 'home',
      afternoon: 'home',
      evening: slot('post', { npc: nightNpc, ...watch }),
      night: slot('post', { npc: nightNpc, ...watch }),
    },
    { fallback: slot('handover', { npc: nightNpc }) },
  );
  const relief: BackgroundRole = {
    id: 'bg.relief_watch',
    label: 'Relief watch',
    sprite: 'npc.guard',
    slots: { midday: slot('post', { interrupt: 'observe', ...watch }) },
  };
  const c = world(
    [
      tile('post', 'town', 20, 9),
      tile('handover', 'town', 21, 9),
      tile('practice', 'bank', 32, 12),
      room('home.day_guard'),
      room('home.night_guard'),
    ],
    [day, night],
    [relief],
    [
      map('town', [npc(dayNpc, 'day_guard'), npc(nightNpc, 'night_guard')]),
      map('bank', [npc('bank_day_guard', 'day_guard')]),
    ],
  );
  const classes = {
    'before victory': {},
    'held after victory': { flags: { victory: true } },
    'after the homecoming': { flags: { victory: true }, visited: ['day_home'] },
  };

  for (const [name, extra] of Object.entries(classes)) {
    it(`keeps exactly one gate watch and the relief rota in every phase, ${name}`, () => {
      for (const phase of DAY_PHASES) {
        const resolution = resolveResidents(c, at(phase, extra));
        expectSound(c, resolution);
        expect(resolution.diagnostics).toEqual([]);
        const watchers = resolution.placements.filter((p) => p.slot?.service === 'gate_watch');
        expect(watchers, `${phase}: one gate watch`).toHaveLength(1);

        const d = placementOf(resolution, 'day_guard');
        const n = placementOf(resolution, 'night_guard');
        if (d.mapId === 'town' && n.mapId === 'town') {
          expect(
            [d.anchor, n.anchor].sort(),
            `${phase}: co-present only at post and handover`,
          ).toEqual(['handover', 'post']);
        }
        if (phase === 'morning' || phase === 'midday' || phase === 'afternoon') {
          expect(n.anchor, `${phase}: the night guard sleeps`).toBe('home.night_guard');
        }
      }
    });
  }

  it("runs Dorin's rota by day and Hanru's by night (the §8 schedule)", () => {
    const watcher = (phase: DayPhase, extra = {}) =>
      resolveResidents(c, at(phase, extra)).placements.find((p) => p.slot?.service === 'gate_watch')
        ?.id;
    expect(DAY_PHASES.map((phase) => watcher(phase))).toEqual([
      'day_guard',
      'day_guard',
      'bg.relief_watch',
      'day_guard',
      'night_guard',
      'night_guard',
    ]);
    // Held after victory, the day guard's hold slot carries the midday watch
    // and the relief watch loses the tile; the night guard keeps the night.
    const held = { flags: { victory: true } };
    expect(watcher('midday', held)).toBe('day_guard');
    expect(watcher('night', held)).toBe('night_guard');
    expect(placementOf(resolveResidents(c, at('night', held)), 'day_guard').anchor).toBe(
      'handover',
    );
  });

  it('keeps the watch while the day guard is pinned mid-conversation after the hold lifts', () => {
    // The conversation opened on the hold slot at the post; it is the
    // homecoming itself, so `day_home` is visited and the hold has lifted.
    const talk = { npcId: dayNpc, mapId: 'town', anchor: 'post' };
    const state = at('midday', {
      flags: { victory: true },
      visited: ['day_home'],
      screen: 'dialogue',
      talk,
    });
    const resolution = resolveResidents(c, state);
    expect(placementOf(resolution, 'day_guard')).toMatchObject({
      anchor: 'post',
      rank: RANK_CONVERSATION,
    });
    expect(resolution.placements.filter((p) => p.slot?.service === 'gate_watch')).toHaveLength(1);
  });
});

/* --- required conversations and the pin (tests 7 and 8) --------------- */

suite('resolveResidents: required conversations', () => {
  const elderNpc = 'town_elder';
  const elder = resident(
    'elder',
    {
      ...every(slot('table', { npc: elderNpc })),
      afternoon: slot('bank.walk', { npc: 'bank_elder' }),
      night: 'home',
    },
    {
      fallback: slot('table', { npc: elderNpc }),
      overrides: [
        {
          id: 'intro',
          tier: 'mission',
          when: not(visited('elder_intro')),
          slots: {},
          all: slot('table', { npc: elderNpc }),
        },
      ],
    },
  );
  const c = world(
    [tile('table', 'town', 11, 5), tile('bank.walk', 'bank', 15, 9), room('home.elder')],
    [elder],
    [],
    [map('town', [npc(elderNpc, 'elder')]), map('bank', [npc('bank_elder', 'elder')])],
  );

  it('holds the owner at the public anchor, talkable, in every phase until visited', () => {
    for (const phase of DAY_PHASES) {
      const placement = placementOf(resolveResidents(c, at(phase)), 'elder');
      expect(placement, phase).toMatchObject({
        anchor: 'table',
        rank: 1,
        slot: { npc: elderNpc, interrupt: 'talk' },
      });
    }
    const after = DAY_PHASES.map(
      (phase) =>
        placementOf(resolveResidents(c, at(phase, { visited: ['elder_intro'] })), 'elder').anchor,
    );
    expect(after).toEqual(['table', 'table', 'table', 'bank.walk', 'table', 'home.elder']);
  });

  it('never loses a pinned conversation to a phase change, even once its hold has lifted', () => {
    const town = c.maps.get('town');
    if (!town) throw new Error('Missing town');
    const talk = { npcId: elderNpc, mapId: 'town', anchor: 'table' };
    for (const phase of DAY_PHASES) {
      const state = at(phase, { visited: ['elder_intro'], screen: 'dialogue', talk });
      expect(placementOf(resolveResidents(c, state), 'elder'), phase).toMatchObject({
        anchor: 'table',
        rank: RANK_CONVERSATION,
      });
      expect(placedNpcs(c, town, state).find((n) => n.id === elderNpc)?.pos, phase).toEqual({
        x: 11,
        y: 5,
      });
    }
  });
});

/* --- one place, never two maps (test 4) ------------------------------ */

suite('placedNpcs: bound NpcDefs follow their resident', () => {
  const walker = resident('walker', {
    ...every(slot('town.spot', { npc: 'town_walker' })),
    afternoon: slot('bank.spot', { npc: 'bank_walker' }),
    night: 'home',
  });
  const c = world(
    [tile('town.spot', 'town', 4, 4), tile('bank.spot', 'bank', 6, 6), room('home.walker')],
    [walker],
    [],
    [
      map('town', [npc('town_walker', 'walker'), { ...npc('sign', ''), resident: undefined }]),
      map('bank', [npc('bank_walker', 'walker')]),
    ],
  );

  it('shows the person on at most one map per phase, at the anchor tile, never at the legacy pos', () => {
    for (const phase of DAY_PHASES) {
      const state = at(phase);
      const placement = placementOf(resolveResidents(c, state), 'walker');
      const seen = [...c.maps.values()].flatMap((m) =>
        placedNpcs(c, m, state)
          .filter((n) => n.resident === 'walker')
          .map((n) => ({ map: m.id, pos: n.pos })),
      );
      if (placement.mapId) {
        expect(seen, phase).toEqual([{ map: placement.mapId, pos: placement.pos }]);
      } else {
        expect(seen, phase).toEqual([]);
      }
    }
  });

  it('passes unbound NpcDefs through and memoises per map and state', () => {
    const town = c.maps.get('town');
    if (!town) throw new Error('Missing town');
    const state = at('night');
    const npcs = placedNpcs(c, town, state);
    expect(npcs.map((n) => n.id)).toEqual(['sign']);
    expect(placedNpcs(c, town, state)).toBe(npcs);
  });
});

/* --- captives (test 10) ---------------------------------------------- */

suite('resolveResidents: a captive before release', () => {
  // How a released captive would be written in a later slice: a mission
  // hold keeps them absent until the release flag. The five missing have no
  // record at all in Slice A (the validator rejects one); this proves the
  // resolver can hold one off a work loop regardless.
  const captive = resident('test.captive', every(slot('workshop', { npc: 'town_captive' })), {
    overrides: [
      {
        id: 'held',
        tier: 'mission',
        when: not(flag('captive_released')),
        slots: {},
        all: 'absent',
      },
    ],
  });
  const c = world(
    [tile('workshop', 'town', 3, 3), room('home.test.captive')],
    [captive],
    [],
    [map('town', [npc('town_captive', 'test.captive')]), map('bank', [])],
  );

  it('resolves absent in every phase until the release flag, and never shows on a map', () => {
    const town = c.maps.get('town');
    if (!town) throw new Error('Missing town');
    for (const phase of DAY_PHASES) {
      const state = at(phase);
      expect(placementOf(resolveResidents(c, state), 'test.captive'), phase).toMatchObject({
        anchor: null,
        slot: null,
      });
      expect(placedNpcs(c, town, state), phase).toEqual([]);
    }
    const released = at('morning', { flags: { captive_released: true } });
    expect(placementOf(resolveResidents(c, released), 'test.captive').anchor).toBe('workshop');
  });
});
