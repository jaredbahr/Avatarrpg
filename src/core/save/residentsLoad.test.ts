/**
 * Format-3 saves, loaded into format 4 with the new Ba Dan residents
 * (ADR 0047 §2/§4, W5a/W5c).
 *
 * Ba Dan's residents arrived after save format 4: a format-3 blob has no
 * `world.clock` and no `world.talk`, and `migrate` keys the phase off the old
 * save's map. Placements are derived, never saved, so what a save written
 * before the residents resolves to is a property of the loaded state: no
 * diagnostics, and every conversation §4 holds for that state class still
 * standing on its map.
 *
 * The state classes and the held conversations are baDan.test.ts's (its list
 * is not exported, so it is reproduced here). Each class loads three times:
 * on the village map in explore, on the riverside in explore — whose format-3
 * saves migrate to the afternoon rather than the evening — and mid-conversation
 * on the village map.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import { resolveResidents } from '../story/residents';
import { npcNode } from '../story/storyEngine';
import { visibleNpcs } from '../story/world';
import type { FlagValue, GameState, MapDef } from '../types';
import { reconcileDisciplines, reconcileWorld } from './reconcile';
import { SAVE_MAGIC, deserialize, stateFromBlob } from './serialize';

const META = {
  label: 'Slot 1',
  summary: 'Format 3 residents load',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

const VILLAGE = 'ba_dan_village';
const RIVERSIDE = 'ba_dan_riverside';
const HOMECOMINGS = ['mira_epilogue', 'pella_home', 'gao_home', 'dorin_home'];

/** A resident-bound conversation §4 requires: the NpcDef, its node, its map. */
interface Held {
  readonly npc: string;
  readonly node: string;
  readonly mapId: string;
}

const miraIntro: Held = { npc: 'elder_mira', node: 'mira_intro', mapId: VILLAGE };
const miraEpilogue: Held = { npc: 'elder_mira', node: 'mira_epilogue', mapId: VILLAGE };
const gaoHome: Held = { npc: 'shopkeeper_gao', node: 'gao_home', mapId: VILLAGE };
const pellaHome: Held = { npc: 'kid_pella', node: 'pella_home', mapId: VILLAGE };
const dorinHome: Held = { npc: 'guard_dorin', node: 'dorin_home', mapId: VILLAGE };

interface StateClass {
  readonly name: string;
  readonly flags?: Readonly<Record<string, FlagValue>>;
  readonly visited?: readonly string[];
  /** The holds still pending in this class: what a load of it must preserve. */
  readonly held: readonly Held[];
}

/** baDan.test.ts's state classes, each with the §4 holds it leaves pending. */
const CLASSES: readonly StateClass[] = [
  { name: 'new game', held: [miraIntro] },
  { name: 'mira_intro visited', visited: ['mira_intro'], held: [] },
  {
    name: 'act1_lost',
    flags: { act1_lost: true },
    visited: ['mira_intro'],
    held: [],
  },
  {
    name: 'act1_complete before the homecomings',
    flags: { act1_complete: true },
    visited: ['mira_intro'],
    held: [miraEpilogue, gaoHome, pellaHome, dorinHome],
  },
  {
    name: 'act1_complete, some homecomings heard',
    flags: { act1_complete: true, ruon_traded: true },
    visited: ['mira_intro', 'mira_epilogue', 'gao_home_cold'],
    held: [pellaHome, dorinHome],
  },
  {
    name: 'act1_complete, pella_home heard before mira_epilogue',
    flags: { act1_complete: true },
    visited: ['mira_intro', 'pella_home'],
    held: [miraEpilogue, gaoHome, dorinHome],
  },
  {
    name: 'homecomings complete',
    flags: { act1_complete: true },
    visited: ['mira_intro', ...HOMECOMINGS],
    held: [],
  },
  {
    name: 'ruon_traded',
    flags: { ruon_traded: true },
    visited: ['mira_intro', 'gao_cold'],
    held: [],
  },
  { name: 'ruon_spared', flags: { ruon_spared: true }, visited: ['mira_intro'], held: [] },
  {
    name: 'lost_ambush',
    flags: { lost_ambush: true, ruon_carried_you: true, ruon_spared: true },
    visited: ['mira_intro'],
    held: [],
  },
];

interface Scenario {
  readonly name: string;
  readonly mapId: string;
  readonly screen: 'explore' | 'dialogue';
  /** The phase `migrate` gives a format-3 save taken on this map. */
  readonly phase: 'afternoon' | 'evening';
}

const SCENARIOS: readonly Scenario[] = [
  { name: 'village, explore', mapId: VILLAGE, screen: 'explore', phase: 'evening' },
  { name: 'riverside, explore', mapId: RIVERSIDE, screen: 'explore', phase: 'afternoon' },
  { name: 'village, mid-conversation', mapId: VILLAGE, screen: 'dialogue', phase: 'evening' },
];

const map = (id: string): MapDef => {
  const found = CONTENT.maps.get(id);
  if (!found) throw new Error(`Missing map ${id}`);
  return found;
};

/** The class's state as the app holds it before saving. */
function classState(cls: StateClass, mapId: string): GameState {
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
    location: { mapId, pos: { x: 1, y: 1 } },
  };
}

interface Fixture {
  readonly json: string;
  /** The conversations this load must still offer, where each stands. */
  readonly held: readonly Held[];
}

/**
 * A format-3 blob for one class and scenario — `version: 3` and the format-3
 * `world` (returnPos, fired, cleared), the shape clockMigration.test.ts
 * writes — plus what the load must preserve. The mid-conversation save opens
 * the class's first held conversation or, with none pending, Mira's, and the
 * node joins `visited`, since the log is written on entry (ADR 0047 §4
 * amendment). Format 3 cannot carry the pin, so `talk` migrates to null.
 */
function format3(cls: StateClass, scenario: Scenario): Fixture {
  const state = classState(cls, scenario.mapId);
  let nodeId = 'village_explore';
  let visited = [...(cls.visited ?? [])];
  let held = [...cls.held];
  if (scenario.screen === 'dialogue') {
    const opened = cls.held[0];
    const npc = opened?.npc ?? 'elder_mira';
    const node = npcNode(CONTENT, state, VILLAGE, npc);
    if (!node) throw new Error(`${npc} opens no conversation`);
    nodeId = node;
    visited = [...visited, node];
    // With nothing held, a conversation with Mira is all the village offers.
    if (!opened) held = [...held, { npc, node, mapId: VILLAGE }];
  }
  const blob = {
    magic: SAVE_MAGIC,
    format: 3,
    savedAt: META.savedAt,
    label: META.label,
    summary: META.summary,
    state: {
      ...state,
      version: 3,
      screen: scenario.screen,
      story: { ...state.story, nodeId, visited },
      world: { returnPos: {}, fired: [], cleared: [] },
    },
    session: META.session,
  };
  return { json: JSON.stringify(blob), held };
}

/** The app's real load path, as continuity.test.ts takes it. */
function load(json: string): GameState {
  const result = deserialize(json);
  if (!result.ok) throw new Error(result.error);
  return reconcileWorld(CONTENT, reconcileDisciplines(CONTENT, stateFromBlob(result.blob)));
}

describe('a format-3 save loads into format 4 with Ba Dan’s residents', () => {
  for (const cls of CLASSES) {
    it(cls.name, () => {
      for (const scenario of SCENARIOS) {
        const label = `${cls.name} — ${scenario.name}`;
        const fixture = format3(cls, scenario);
        const loaded = load(fixture.json);

        expect(loaded.version, label).toBe(4);
        expect(loaded.world.clock.phase, label).toBe(scenario.phase);
        expect(loaded.world.talk, label).toBeNull();
        expect(resolveResidents(CONTENT, loaded).diagnostics, label).toEqual([]);

        for (const want of fixture.held) {
          const at = `${label} — ${want.npc}`;
          // The held conversation is the node this NPC opens from here (§4)…
          expect(npcNode(CONTENT, loaded, want.mapId, want.npc), at).toBe(want.node);
          // …and the resident stands on its map, visible to the player.
          const placement = resolveResidents(CONTENT, loaded).placements.find(
            (p) => p.slot?.npc === want.npc,
          );
          expect(placement?.mapId, at).toBe(want.mapId);
          expect(
            visibleNpcs(CONTENT, map(want.mapId), loaded).map((npc) => npc.id),
            at,
          ).toContain(want.npc);
        }
      }
    });
  }
});
