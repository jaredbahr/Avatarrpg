/**
 * A Ba Dan day's conversations (ADR 0047 §8, W6; tests 12 and 13).
 *
 * The first suite is the reachability table: for each new conversation, the
 * phases in which tapping its NpcDef opens it, in every state class. It is
 * written out literally, so a node reachable in a wrong state or phase fails
 * as surely as one that is unreachable. The rest play the scenes through the
 * reducer, by walking up and tapping, as a player would.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { deserialize, serialize, stateFromBlob } from '../../core/save/serialize';
import { resolveResidents } from '../../core/story/residents';
import { npcNode, resolveDialogue } from '../../core/story/storyEngine';
import { visibleNpcs } from '../../core/story/world';
import { DAY_PHASES } from '../../core/types';
import type { DayPhase, FlagValue, GameState, MapDef, StoryNode } from '../../core/types';
import { STORY_PRESENTATIONS } from './presentations';

const VILLAGE = 'ba_dan_village';
const RIVERSIDE = 'ba_dan_riverside';
const HOMECOMINGS = ['mira_epilogue', 'pella_home', 'gao_home', 'dorin_home'];
const PLANT = 'scene.bd01_plant_chair';
const HANDOVER = 'scene.bd03_handover';

interface StateClass {
  readonly flags?: Readonly<Record<string, FlagValue>>;
  readonly visited?: readonly string[];
}

const CLASSES = {
  'new game': {},
  'mira_intro visited': { visited: ['mira_intro'] },
  'traded, gao_cold unheard': { flags: { ruon_traded: true }, visited: ['mira_intro'] },
  'traded, gao_cold heard': { flags: { ruon_traded: true }, visited: ['mira_intro', 'gao_cold'] },
  'victory, no homecoming heard': { flags: { act1_complete: true }, visited: ['mira_intro'] },
  'victory, traded, gao_cold never heard': {
    flags: { act1_complete: true, ruon_traded: true },
    visited: ['mira_intro'],
  },
  'victory, traded, gao_home_cold heard': {
    flags: { act1_complete: true, ruon_traded: true },
    visited: ['mira_intro', 'gao_home_cold'],
  },
  'homecomings complete': {
    flags: { act1_complete: true, ruon_spared: true },
    visited: ['mira_intro', ...HOMECOMINGS],
  },
  'plant scene done': { flags: { [PLANT]: 'completed' }, visited: ['mira_intro'] },
  'handover done': { flags: { [HANDOVER]: 'completed' }, visited: ['mira_intro'] },
  'homecomings complete, both scenes done': {
    flags: { act1_complete: true, [PLANT]: 'completed', [HANDOVER]: 'completed' },
    visited: ['mira_intro', ...HOMECOMINGS],
  },
} satisfies Record<string, StateClass>;

type ClassName = keyof typeof CLASSES;

function at(phase: DayPhase, cls: StateClass = {}, mapId = VILLAGE): GameState {
  const base = createGame(CONTENT, {
    seed: 'ba-dan-day',
    party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
    startNode: 'village_explore',
  });
  const map = CONTENT.maps.get(mapId);
  const hub =
    mapId === RIVERSIDE
      ? 'riverside_explore'
      : cls.flags?.act1_complete
        ? 'village_return_explore'
        : 'village_explore';
  return {
    ...base,
    screen: 'explore',
    flags: { ...base.flags, ...cls.flags },
    story: { ...base.story, nodeId: hub, visited: [...(cls.visited ?? [])] },
    location: { mapId, pos: map?.partySpawns[0] ?? { x: 0, y: 0 } },
    world: { ...base.world, clock: { day: 1, phase } },
  };
}

const map = (id: string): MapDef => {
  const found = CONTENT.maps.get(id);
  if (!found) throw new Error(`Missing map ${id}`);
  return found;
};

const npcAt = (state: GameState, mapId: string, npcId: string) =>
  visibleNpcs(CONTENT, map(mapId), state).find((npc) => npc.id === npcId);

/** Tapping this NpcDef in this state opens this node. */
const opens = (state: GameState, mapId: string, npcId: string, node: string): boolean =>
  npcAt(state, mapId, npcId) !== undefined && npcNode(CONTENT, state, mapId, npcId) === node;

/* ------------------------------------------------------------------ */
/* The reachability table                                              */
/* ------------------------------------------------------------------ */

const TARGETS = {
  plant_chair: [VILLAGE, 'shopkeeper_gao'],
  handover_scene: [VILLAGE, 'guard_hanru'],
  hanru_watch: [VILLAGE, 'guard_hanru'],
  school_notice: [VILLAGE, 'school_notice'],
  riverside_pella: [RIVERSIDE, 'riverside_pella'],
} as const;

type Target = keyof typeof TARGETS;

const none: DayPhase[] = [];
const PM: DayPhase[] = ['afternoon'];
const CHANGE: DayPhase[] = ['dawn', 'evening'];

/** Node x state class -> the phases it can be opened in. The report's table. */
const REACHABLE: Record<Target, Record<ClassName, DayPhase[]>> = {
  plant_chair: {
    'new game': PM,
    'mira_intro visited': PM,
    'traded, gao_cold unheard': none,
    'traded, gao_cold heard': PM,
    'victory, no homecoming heard': none,
    'victory, traded, gao_cold never heard': none,
    'victory, traded, gao_home_cold heard': PM,
    'homecomings complete': PM,
    'plant scene done': none,
    'handover done': PM,
    'homecomings complete, both scenes done': none,
  },
  handover_scene: {
    'new game': CHANGE,
    'mira_intro visited': CHANGE,
    'traded, gao_cold unheard': CHANGE,
    'traded, gao_cold heard': CHANGE,
    'victory, no homecoming heard': CHANGE,
    'victory, traded, gao_cold never heard': CHANGE,
    'victory, traded, gao_home_cold heard': CHANGE,
    'homecomings complete': CHANGE,
    'plant scene done': CHANGE,
    'handover done': none,
    'homecomings complete, both scenes done': none,
  },
  hanru_watch: {
    'new game': ['night'],
    'mira_intro visited': ['night'],
    'traded, gao_cold unheard': ['night'],
    'traded, gao_cold heard': ['night'],
    'victory, no homecoming heard': ['night'],
    'victory, traded, gao_cold never heard': ['night'],
    'victory, traded, gao_home_cold heard': ['night'],
    'homecomings complete': ['night'],
    'plant scene done': ['night'],
    'handover done': ['dawn', 'evening', 'night'],
    'homecomings complete, both scenes done': ['dawn', 'evening', 'night'],
  },
  school_notice: {
    'new game': ['morning'],
    'mira_intro visited': ['morning'],
    'traded, gao_cold unheard': ['morning'],
    'traded, gao_cold heard': ['morning'],
    'victory, no homecoming heard': ['morning'],
    'victory, traded, gao_cold never heard': ['morning'],
    'victory, traded, gao_home_cold heard': ['morning'],
    'homecomings complete': ['morning'],
    'plant scene done': ['morning'],
    'handover done': ['morning'],
    'homecomings complete, both scenes done': ['morning'],
  },
  riverside_pella: {
    // Only with Mira on the bank: not before her briefing, nor after victory
    // until both Mira and Pella have been heard at home (§4).
    'new game': none,
    'mira_intro visited': PM,
    'traded, gao_cold unheard': PM,
    'traded, gao_cold heard': PM,
    'victory, no homecoming heard': none,
    'victory, traded, gao_cold never heard': none,
    'victory, traded, gao_home_cold heard': none,
    'homecomings complete': PM,
    'plant scene done': PM,
    'handover done': PM,
    'homecomings complete, both scenes done': PM,
  },
};

describe('a Ba Dan day: where and when each new conversation opens', () => {
  for (const [target, [mapId, npcId]] of Object.entries(TARGETS) as [
    Target,
    readonly [string, string],
  ][])
    it(`opens ${target} from ${npcId} in exactly its phases and states`, () => {
      for (const [name, cls] of Object.entries(CLASSES) as [ClassName, StateClass][]) {
        const phases = DAY_PHASES.filter((phase) =>
          opens(at(phase, cls, mapId), mapId, npcId, target),
        );
        expect(phases, `${target}, ${name}`).toEqual(REACHABLE[target][name]);
      }
    });

  it('opens each new conversation from its own NpcDef and no other', () => {
    const roots = [...CONTENT.maps.values()].flatMap((m) =>
      m.npcs.flatMap((npc) =>
        [npc.node, ...(npc.routes ?? []).map((route) => route.node)].map((node) => ({
          node,
          npc: npc.id,
        })),
      ),
    );
    for (const [target, [, npcId]] of Object.entries(TARGETS))
      expect(
        roots.filter((root) => root.node === target).map((root) => root.npc),
        target,
      ).toEqual([npcId]);
  });

  it('keeps Dorin at the gate for every handover the table allows', () => {
    for (const [name, cls] of Object.entries(CLASSES))
      for (const phase of CHANGE) {
        const state = at(phase, cls);
        if (!opens(state, VILLAGE, 'guard_hanru', 'handover_scene')) continue;
        const dorin = resolveResidents(CONTENT, state).placements.find(
          (p) => p.id === 'lw.npc.dorin',
        );
        expect(dorin?.mapId, `${name}, ${phase}`).toBe(VILLAGE);
        expect(dorin?.anchor?.startsWith('bd03.'), `${name}, ${phase}`).toBe(true);
      }
  });

  it('presents every conversation node a Ba Dan NpcDef can reach on that NpcDef’s map', () => {
    const next = (node: StoryNode | undefined): string[] => {
      switch (node?.kind) {
        case 'dialogue':
        case 'flags':
          return [node.next];
        case 'choice':
          return node.options.map((option) => option.next);
        case 'branch':
          return [node.ifSet, node.ifUnset];
        default:
          return [];
      }
    };
    for (const mapId of [VILLAGE, RIVERSIDE])
      for (const npc of map(mapId).npcs) {
        const queue = [npc.node, ...(npc.routes ?? []).map((route) => route.node)];
        const seen = new Set<string>();
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
          if (seen.has(id)) continue;
          seen.add(id);
          const node = CONTENT.story.get(id);
          if (node?.kind === 'dialogue' || node?.kind === 'choice')
            expect(STORY_PRESENTATIONS[id]?.mapId, `${npc.id} -> ${id}`).toBe(mapId);
          queue.push(...next(node));
        }
      }
  });
});

/* ------------------------------------------------------------------ */
/* Playing the scenes                                                  */
/* ------------------------------------------------------------------ */

/** Walk up to the NpcDef and tap it. */
function tap(state: GameState, npcId: string): GameState {
  const npc = npcAt(state, state.location.mapId, npcId);
  if (!npc) throw new Error(`${npcId} is not here`);
  const opened = apply(CONTENT, state, { type: 'walkTo', pos: npc.pos }).state;
  expect(opened.screen).toBe('dialogue');
  return opened;
}

/**
 * Plays the open conversation to its end, taking `picks` at its choices in
 * order, and checks `still` (the pinned speaker's tile, say) at every line.
 */
function play(state: GameState, picks: number[] = [], still?: (s: GameState) => void): GameState {
  const queue = [...picks];
  for (let count = 0; state.screen === 'dialogue'; count++) {
    if (count > 40) throw new Error('Conversation never ended');
    still?.(state);
    const node = state.story.nodeId ? CONTENT.story.get(state.story.nodeId) : undefined;
    const pick = node?.kind === 'choice' ? queue.shift() : undefined;
    if (node?.kind === 'choice' && pick === undefined) throw new Error(`No pick for ${node.id}`);
    state =
      pick === undefined
        ? apply(CONTENT, state, { type: 'advanceDialogue' }).state
        : apply(CONTENT, state, { type: 'chooseOption', optionIndex: pick }).state;
  }
  expect(queue, 'unused picks').toEqual([]);
  expect(state.screen).toBe('explore');
  return state;
}

const without = (flags: GameState['flags'], key: string) =>
  Object.fromEntries(Object.entries(flags).filter(([k]) => k !== key));

const gaoTile = (state: GameState) => npcAt(state, VILLAGE, 'shopkeeper_gao')?.pos;

const activityOf = (state: GameState, id: string) =>
  resolveResidents(CONTENT, state).placements.find((p) => p.id === id)?.activity;

describe('LW-S-BD-01: the plant’s chair (test 12)', () => {
  const cases: [string, StateClass, string, string][] = [
    ['before victory', CLASSES['mira_intro visited'], 'village_explore', 'gao_friendly'],
    ['after victory', CLASSES['homecomings complete'], 'village_return_explore', 'gao_home'],
    [
      'after victory, traded',
      CLASSES['victory, traded, gao_home_cold heard'],
      'village_return_explore',
      'gao_home_cold',
    ],
  ];

  for (const [label, cls, hub, after] of cases)
    for (const topic of [0, 1, 2])
      it(`plays through ${label}, topic ${topic}, and remembers it`, () => {
        const before = at('afternoon', cls);
        const opened = tap(before, 'shopkeeper_gao');
        expect(opened.story.nodeId).toBe('plant_chair');
        expect(opened.world.talk?.npcId).toBe('shopkeeper_gao');
        const tile = gaoTile(before);
        const done = play(opened, [0, topic], (s) => expect(gaoTile(s)).toEqual(tile));
        expect(done.story.nodeId).toBe(hub);
        expect(done.flags[PLANT]).toBe('completed');
        // Nothing else changes: no custody flag, no other flag.
        expect(without(done.flags, PLANT)).toEqual(before.flags);
        expect(done.world.clock).toEqual(before.world.clock);
        expect(activityOf(done, 'lw.npc.gao')).toBe('plant_on_chair_idle');
        expect(npcNode(CONTENT, done, VILLAGE, 'shopkeeper_gao')).toBe(after);
      });

  it('grants nothing and asks again when the party says another time', () => {
    const before = at('afternoon', CLASSES['mira_intro visited']);
    const left = play(tap(before, 'shopkeeper_gao'), [1]);
    expect(left.story.nodeId).toBe('village_explore');
    expect(left.flags).toEqual(before.flags);
    expect(npcNode(CONTENT, left, VILLAGE, 'shopkeeper_gao')).toBe('plant_chair');
  });

  it('waits for the objection to the trade before victory, then offers the chair', () => {
    let state = at('afternoon', CLASSES['traded, gao_cold unheard']);
    state = play(tap(state, 'shopkeeper_gao'));
    expect(state.story.visited).toContain('gao_cold');
    expect(state.flags[PLANT]).toBeUndefined();
    expect(npcNode(CONTENT, state, VILLAGE, 'shopkeeper_gao')).toBe('plant_chair');
  });

  it('is still reachable on a traded route that never heard gao_cold before victory', () => {
    let state = at('afternoon', CLASSES['victory, traded, gao_cold never heard']);
    state = play(tap(state, 'shopkeeper_gao'));
    expect(state.story.visited).toContain('gao_home_cold');
    state = play(tap(state, 'shopkeeper_gao'), [0, 2]);
    expect(state.flags[PLANT]).toBe('completed');
    expect(state.flags.ruon_traded).toBe(true);
    expect(state.flags.ruon_spared).toBeUndefined();
  });

  it('keeps Gao’s side of the custody disagreement in the invitation', () => {
    const node = CONTENT.story.get('plant_chair');
    if (node?.kind !== 'choice') throw new Error('Missing plant_chair');
    const traded = resolveDialogue(at('afternoon', CLASSES['traded, gao_cold heard']), node);
    const spared = resolveDialogue(at('afternoon', CLASSES['homecomings complete']), node);
    expect(traded.lines.join(' ')).toContain('Ruon');
    expect(spared.lines.join(' ')).not.toContain('Ruon');
  });
});

describe('LW-S-BD-03: the handover (test 13)', () => {
  for (const phase of CHANGE)
    for (const [label, cls, hub] of [
      ['before victory', CLASSES['mira_intro visited'], 'village_explore'],
      ['after victory', CLASSES['victory, no homecoming heard'], 'village_return_explore'],
    ] as const)
      it(`plays at ${phase} ${label}, and the memory survives a save`, () => {
        const before = at(phase, cls);
        const opened = tap(before, 'guard_hanru');
        expect(opened.story.nodeId).toBe('handover_scene');
        const hanru = npcAt(before, VILLAGE, 'guard_hanru')?.pos;
        const done = play(opened, [], (s) => {
          expect(npcAt(s, VILLAGE, 'guard_hanru')?.pos).toEqual(hanru);
          expect(npcAt(s, VILLAGE, 'guard_dorin')).toBeDefined();
        });
        expect(done.flags[HANDOVER]).toBe('completed');
        expect(without(done.flags, HANDOVER)).toEqual(before.flags);
        expect(done.story.nodeId).toBe(hub);
        const loaded = deserialize(
          serialize(done, {
            label: 'Slot 1',
            summary: 'handover',
            savedAt: 0,
            session: { players: [{ name: 'P', unitId: 'p0' }], soloPlay: true },
          }),
        );
        if (!loaded.ok) throw new Error(loaded.error);
        const reloaded = stateFromBlob(loaded.blob);
        expect(reloaded.flags[HANDOVER]).toBe('completed');
        expect(npcNode(CONTENT, reloaded, VILLAGE, 'guard_hanru')).toBe('hanru_watch');
      });

  it('has the outgoing guard report: Hanru at dawn, Dorin in the evening', () => {
    const node = CONTENT.story.get('handover_scene');
    if (node?.kind !== 'dialogue') throw new Error('Missing handover_scene');
    for (const cls of [CLASSES['new game'], CLASSES['victory, no homecoming heard']]) {
      expect(resolveDialogue(at('dawn', cls), node).speaker).toBe('Hanru');
      expect(resolveDialogue(at('evening', cls), node).speaker).toBe('Gate Guard Dorin');
    }
  });
});

describe('Hanru’s watch, the school notice and Pella at the river', () => {
  const lines = (id: string, state: GameState) => {
    const node = CONTENT.story.get(id);
    if (node?.kind !== 'dialogue') throw new Error(`Missing ${id}`);
    return resolveDialogue(state, node).lines;
  };

  it('returns from Hanru to whichever village hub is current', () => {
    for (const [cls, hub] of [
      [CLASSES['handover done'], 'village_explore'],
      [CLASSES['homecomings complete, both scenes done'], 'village_return_explore'],
    ] as const)
      for (const phase of ['dawn', 'evening', 'night'] as const) {
        const done = play(tap(at(phase, cls), 'guard_hanru'));
        expect(done.story.nodeId, phase).toBe(hub);
      }
  });

  it('gives Hanru different words off watch at dawn, on watch, and after the return', () => {
    const occupied = CLASSES['handover done'];
    const dawn = lines('hanru_watch', at('dawn', occupied));
    const night = lines('hanru_watch', at('night', occupied));
    const home = lines('hanru_watch', at('night', CLASSES['homecomings complete']));
    expect(dawn).not.toEqual(night);
    expect(home).not.toEqual(night);
    expect(lines('hanru_watch', at('evening', occupied))).toEqual(night);
  });

  it('reads the school notice in the morning and returns to the current hub', () => {
    for (const [cls, hub] of [
      [CLASSES['new game'], 'village_explore'],
      [CLASSES['victory, no homecoming heard'], 'village_return_explore'],
    ] as const) {
      const done = play(tap(at('morning', cls), 'school_notice'));
      expect(done.story.nodeId).toBe(hub);
      expect(done.flags).toEqual(at('morning', cls).flags);
    }
  });

  it('rubs out Pella’s chalk line while she is held at home, and she is there to see', () => {
    const held = at('morning', CLASSES['victory, no homecoming heard']);
    expect(npcAt(held, VILLAGE, 'kid_pella')).toBeDefined();
    const inClass = at('morning', CLASSES['homecomings complete']);
    expect(npcAt(inClass, VILLAGE, 'kid_pella')).toBeUndefined();
    expect(lines('school_notice', held)).not.toEqual(lines('school_notice', inClass));
    expect(lines('school_notice', inClass)).not.toEqual(
      lines('school_notice', at('morning', CLASSES['mira_intro visited'])),
    );
  });

  it('plays Pella at the river before and after victory, back to the riverside', () => {
    const before = at('afternoon', CLASSES['mira_intro visited'], RIVERSIDE);
    const after = at('afternoon', CLASSES['homecomings complete'], RIVERSIDE);
    for (const state of [before, after]) {
      const opened = tap(state, 'riverside_pella');
      expect(opened.story.nodeId).toBe('riverside_pella');
      const done = play(opened);
      expect(done.story.nodeId).toBe('riverside_explore');
      expect(done.location.mapId).toBe(RIVERSIDE);
    }
    expect(lines('riverside_pella', before)).not.toEqual(lines('riverside_pella', after));
  });
});

describe('existing lines that name the time of day', () => {
  const lines = (id: string, phase: DayPhase, flags: GameState['flags']) => {
    const node = CONTENT.story.get(id);
    if (node?.kind !== 'dialogue') throw new Error(`Missing ${id}`);
    return resolveDialogue(at(phase, { flags }), node).lines.join(' ');
  };

  it('has Bo-shan asleep for the night only in the evening and at night', () => {
    const flags = { act1_complete: true, pella_asked: true };
    for (const phase of DAY_PHASES)
      expect(lines('pella_home', phase, flags).includes('tomorrow'), phase).toBe(
        phase === 'evening' || phase === 'night',
      );
  });

  it('has Dorin keep the watch only in the phases he holds the post', () => {
    for (const phase of DAY_PHASES)
      expect(
        lines('dorin_home', phase, { act1_complete: true }).includes('keep watch'),
        phase,
      ).toBe(phase !== 'evening' && phase !== 'night');
  });
});
