import { describe, expect, it } from 'vitest';
import { CONTENT, STORY_ENTRY } from './index';
import type { TopDownPresentation } from './topdown';
import { withTopDownMaps } from './topdown';
import { createGame } from '../core/state/createGame';
import { apply } from '../core/state/reducer';
import {
  reconcileBattleResult,
  reconcileDisciplines,
  reconcileWorld,
} from '../core/save/reconcile';
import { deserialize, serialize, stateFromBlob, type SessionMeta } from '../core/save/serialize';
import { battleReturnTile } from '../core/story/battleReturn';
import { currentNode } from '../core/story/storyEngine';
import { distance, samePos } from '../core/rules/grid';
import { exitCells } from '../core/story/world';
import { partyOfSize } from '../core/sim/balance';
import { runCombat } from '../core/sim/runCombat';
import type { Command, ContentIndex, GameEvent, GameState, Vec2 } from '../core/types';

const SEEDS = ['style-parity-forest-01', 'style-parity-forest-02', 'style-parity-forest-03'];
const ENCOUNTERS = ['enc_forest_road', 'enc_quarry_gate', 'enc_ambush', 'enc_grumbler'];
const SAVE_META = {
  label: 'Style parity',
  summary: 'Cross-style active battle continuation',
  savedAt: 1_800_000_000_000,
};

const SOURCE_MAP_ENTRIES = [...CONTENT.maps];
const SOURCE_MAP_SNAPSHOT = structuredClone(SOURCE_MAP_ENTRIES);

function syntheticPresentations(content: ContentIndex, breakRubble = false) {
  return new Map<string, TopDownPresentation>(
    [...content.maps].map(([id]) => [
      id,
      {
        projection: 'topdown',
        scene: { ground: [], scenery: [], ...(breakRubble ? { paintedRubble: [] } : {}) },
      },
    ]),
  );
}

function aiProfile(unit: GameState['party'][number]): NonNullable<typeof unit.ai> {
  switch (unit.element) {
    case 'water':
      return 'support';
    case 'earth':
    case 'air':
      return 'cautious';
    default:
      return 'aggressive';
  }
}

function createPair(seed: string, swapped: ContentIndex, custody: 'trade' | 'escort') {
  const party =
    custody === 'escort'
      ? ['kaya', 'nilak', 'bo', 'tenzo', 'lin_mei', 'nima']
      : ['kaya', 'nilak', 'bo'];
  return {
    base: createGame(CONTENT, {
      seed,
      party: party.map((characterId) => ({ characterId, autoChoose: true })),
      startNode: STORY_ENTRY,
    }),
    swapped: createGame(swapped, {
      seed,
      party: party.map((characterId) => ({ characterId, autoChoose: true })),
      startNode: STORY_ENTRY,
    }),
  };
}

/** Drives the actual story graph in lockstep, applying each legal command to both indexes. */
function runCampaign(
  swappedContent: ContentIndex,
  seed: string,
  custody: 'trade' | 'escort',
  saveAuthor: 'base' | 'swapped',
): { events: GameEvent[]; state: GameState; encounters: Set<string>; crossings: number } {
  const pair = createPair(seed, swappedContent, custody);
  let base = pair.base;
  let swapped = pair.swapped;
  const events: GameEvent[] = [];
  const swappedEvents: GameEvent[] = [];
  const encounters = new Set<string>();
  let crossings = 0;
  let saveChecked = false;

  const assertParity = (context: string) => {
    expect(swapped, `${context}: full GameState and RngState`).toEqual(base);
  };
  assertParity('identical initial state');

  const issue = (command: Command) => {
    const baseBefore = base;
    const baseStep = apply(CONTENT, base, command);
    const swappedStep = apply(swappedContent, swapped, command);
    expect(swappedStep.events, `${contextFor(command)}: event parity`).toEqual(baseStep.events);
    if (baseStep.state === baseBefore)
      throw new Error(
        `${contextFor(command)} was not accepted: ${JSON.stringify(baseStep.events)}`,
      );
    expect(swappedStep.state, `${contextFor(command)}: swapped command must advance`).not.toBe(
      swapped,
    );
    base = baseStep.state;
    swapped = swappedStep.state;
    events.push(...baseStep.events);
    swappedEvents.push(...swappedStep.events);
    assertParity(contextFor(command));
  };

  const story = (ruonRoute: 'trade' | 'escort' = custody) => {
    for (let guard = 0; guard < 200 && base.screen === 'dialogue'; guard++) {
      const node = currentNode(CONTENT, base);
      if (!node) throw new Error(`Missing story node ${base.story.nodeId}`);
      if (node.kind === 'choice') {
        const optionIndex =
          node.id === 'gate_parley'
            ? 0
            : node.id === 'ruon_choice'
              ? ruonRoute === 'escort'
                ? 0
                : 1
              : 0;
        issue({ type: 'chooseOption', optionIndex });
      } else if (node.kind === 'dialogue') {
        issue({ type: 'advanceDialogue' });
      } else {
        throw new Error(`Unexpected dialogue node ${node.id}: ${node.kind}`);
      }
    }
    if (base.screen === 'dialogue') throw new Error(`Story did not leave ${base.story.nodeId}`);
  };

  const finishBattle = () => {
    const encounterId = base.battle?.encounterId;
    if (!encounterId || swapped.battle?.encounterId !== encounterId)
      throw new Error(
        `Expected matching active battle, got ${encounterId}/${swapped.battle?.encounterId}`,
      );
    encounters.add(encounterId);
    const mapId = base.battle?.mapId;
    const crossing = mapId ? base.world.returnPos[mapId] : undefined;
    expect(crossing, `${encounterId} must start from an actual story crossing`).toBeDefined();
    if (crossing) crossings++;

    // Match runCombat's established party autopilot profiles without changing authored HP or rules.
    const givePartyAi = (state: GameState): GameState => ({
      ...state,
      battle: state.battle
        ? {
            ...state.battle,
            units: state.battle.units.map((unit) =>
              unit.faction === 'party' ? { ...unit, ai: aiProfile(unit) } : unit,
            ),
          }
        : null,
    });
    base = givePartyAi(base);
    swapped = givePartyAi(swapped);
    assertParity('party AI profile setup');
    const initialBattle = structuredClone(base.battle);
    const initialRng = structuredClone(base.rng);

    for (let turn = 0; turn < 180 && base.battle?.phase === 'active'; turn++) {
      issue({ type: 'runAiTurn' });
      if (encounterId !== 'enc_grumbler' || turn !== 1 || saveChecked) continue;

      expect(base.battle?.phase, 'save checkpoint must remain in an active battle').toBe('active');
      expect(base.battle, 'save checkpoint must follow actual combat turns').not.toEqual(
        initialBattle,
      );
      expect(base.rng, 'save checkpoint RNG must have advanced').not.toEqual(initialRng);

      const source = saveAuthor === 'base' ? base : swapped;
      const targetContent = saveAuthor === 'base' ? swappedContent : CONTENT;
      const session: SessionMeta = {
        players: source.party.map((unit) => ({ name: unit.name, unitId: unit.id })),
        soloPlay: false,
      };
      const encoded = serialize(source, { ...SAVE_META, session });
      const loaded = deserialize(encoded);
      expect(loaded.ok, 'active battle save must deserialize').toBe(true);
      if (!loaded.ok) throw new Error(loaded.error);
      expect(loaded.blob.session, 'saved hot-seat roster must round-trip').toEqual(session);
      const restored = stateFromBlob(loaded.blob);
      const reconciledBattle = reconcileBattleResult(targetContent, restored);
      expect(reconciledBattle.warnings, 'cross-style battle reconciliation must be clean').toEqual(
        [],
      );
      const loadedState = reconcileWorld(
        targetContent,
        reconcileDisciplines(targetContent, reconciledBattle.state),
      );
      expect(
        loadedState,
        'cross-style load and normal reconciliation must preserve checkpoint',
      ).toEqual(source);
      if (saveAuthor === 'base') swapped = loadedState;
      else base = loadedState;
      assertParity('active noninitial battle cross-style save/load');
      saveChecked = true;
    }

    expect(base.battle?.phase, `${encounterId} should win with unmodified HP`).toBe('victory');
    const baseMap = mapId ? CONTENT.maps.get(mapId) : undefined;
    const swappedMap = mapId ? swappedContent.maps.get(mapId) : undefined;
    const expectedBase = baseMap && crossing ? battleReturnTile(CONTENT, baseMap, crossing) : null;
    const expectedSwapped =
      swappedMap && crossing ? battleReturnTile(swappedContent, swappedMap, crossing) : null;
    issue({ type: 'resolveBattle' });
    if (crossing) {
      expect(base.location.pos, `${encounterId} actual return position`).toEqual(
        expectedBase ?? crossing,
      );
      expect(swapped.location.pos, `${encounterId} swapped return position`).toEqual(
        expectedSwapped ?? crossing,
      );
    }
    story();
  };

  const walk = (pos: Vec2) => issue({ type: 'walkTo', pos });
  const travel = (destination: string) => {
    const map = CONTENT.maps.get(base.location.mapId);
    const exit = map?.exits?.find((candidate) => candidate.toMapId === destination);
    if (!exit) throw new Error(`No exit from ${base.location.mapId} to ${destination}`);
    const cells = [...(exit.area ?? exitCells(exit))].sort(
      (a, b) => distance(base.location.pos, a) - distance(base.location.pos, b),
    );
    for (const cell of cells) {
      if (samePos(base.location.pos, cell)) continue;
      const command: Command = { type: 'walkTo', pos: cell };
      if (apply(CONTENT, base, command).state === base) continue;
      const before = base.location.mapId;
      issue(command);
      if (base.location.mapId === destination) {
        story();
        return;
      }
      if (base.location.mapId !== before)
        throw new Error(`Unexpected travel from ${before} to ${base.location.mapId}`);
      if (base.screen === 'dialogue') {
        story();
        if (base.location.mapId === destination) return;
      } else if (base.screen === 'combat') finishBattle();
      if (base.screen !== 'explore') break;
    }
    throw new Error(`Could not travel ${base.location.mapId} → ${destination}`);
  };

  issue({ type: 'enterNode', nodeId: STORY_ENTRY });
  story();
  walk({ x: 11, y: 5 });
  story();
  travel('forest_road');
  walk({ x: 19, y: 4 });
  story();
  walk({ x: 19, y: 4 });
  finishBattle();
  travel('quarry_gate');
  walk({ x: 19, y: 5 });
  story();
  finishBattle();
  story();
  travel('ambush_road');
  if (custody === 'escort') {
    walk({ x: 19, y: 4 });
    story();
    finishBattle();
  }
  travel('quarry_floor');
  walk({ x: 17, y: 5 });
  story();
  finishBattle();
  if (base.screen === 'ended') issue({ type: 'enterNode', nodeId: 'quarry_after_explore' });
  story();
  travel('ambush_road');
  travel('quarry_gate');
  travel('forest_road');
  travel('ba_dan_village');
  expect(base.location.mapId, 'the route returns to Ba Dan').toBe('ba_dan_village');
  expect(base.screen, 'the route returns to exploration').toBe('explore');
  expect(saveChecked, 'the campaign crossed an active-battle save checkpoint').toBe(true);
  expect(swappedEvents, 'complete campaign event log parity').toEqual(events);
  return { events, state: base, encounters, crossings };
}

function contextFor(command: Command): string {
  return `${command.type}${command.type === 'walkTo' ? ` ${command.pos.x},${command.pos.y}` : ''}`;
}

const presentations = syntheticPresentations(CONTENT);
const TOPDOWN = withTopDownMaps(CONTENT, presentations);

describe('top-down style whole-run parity', () => {
  it.each(SEEDS)(
    'keeps the trade and escort campaigns identical for seed %s',
    (seed) => {
      const observedEncounters = new Set<string>();
      const seedIndex = SEEDS.indexOf(seed);
      for (const custody of ['trade', 'escort'] as const) {
        const result = runCampaign(
          TOPDOWN,
          `${seed}:${custody}`,
          custody,
          seedIndex % 2 === 0 ? 'base' : 'swapped',
        );
        result.encounters.forEach((id) => observedEncounters.add(id));
        expect(
          result.crossings,
          `${custody} must exercise battle return crossings`,
        ).toBeGreaterThan(0);
        expect(
          result.events.length,
          `${custody} campaign should produce a real event log`,
        ).toBeGreaterThan(0);
      }
      expect(observedEncounters).toEqual(new Set(ENCOUNTERS));
      expect([...CONTENT.maps]).toEqual(SOURCE_MAP_SNAPSHOT);
      for (const [id, map] of SOURCE_MAP_ENTRIES) expect(CONTENT.maps.get(id)).toBe(map);

      const party = partyOfSize(3);
      for (const encounterId of ENCOUNTERS) {
        const options = {
          seed: `${seed}:headless:${encounterId}`,
          encounterId,
          party,
          recordEvents: true,
        } as const;
        const baseResult = runCombat(CONTENT, options);
        const swappedResult = runCombat(TOPDOWN, options);
        expect(swappedResult, `${encounterId}: complete headless result/event parity`).toEqual(
          baseResult,
        );
        expect(baseResult.anomalies, `${encounterId}: headless runner anomalies`).toEqual([]);
      }
    },
    120_000,
  );

  it('detects a broken empty-rubble presentation at a real campaign crossing', () => {
    const broken = withTopDownMaps(CONTENT, syntheticPresentations(CONTENT, true));
    expect(() => runCampaign(broken, 'style-parity-broken-rubble', 'trade', 'base')).toThrow(
      /return position|full GameState and RngState/,
    );
  }, 120_000);
});
