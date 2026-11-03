/** Deterministic, legally played save fixtures for the two quarry route boundaries.
 *
 * The browser campaign spec weakens enemy HP before its autopilot. These saves
 * cannot be byte-identical to that browser history: HP, RNG, log, and other
 * combat transient fields diverge. The shared boundary compares party identity,
 * level, XP and abilities, plus the full story, world, flags and location;
 * the fixture's full state and command transcript are pinned separately.
 */
import { CONTENT, STORY_ENTRY } from '../../src/content';
import { INTERLUDES } from '../../src/content/story/interludes';
import { planAiTurn } from '../../src/core/rules/ai';
import { distance } from '../../src/core/rules/grid';
import { RngCursor } from '../../src/core/rng';
import {
  reconcileBattleResult,
  reconcileDisciplines,
  reconcileWorld,
} from '../../src/core/save/reconcile';
import {
  deserialize,
  serialize,
  stateFromBlob,
  type SessionMeta,
} from '../../src/core/save/serialize';
import { BattleDraft } from '../../src/core/state/battleDraft';
import { createGame } from '../../src/core/state/createGame';
import { apply } from '../../src/core/state/reducer';
import { exitCells } from '../../src/core/story/world';
import type { BattleState, Command, GameState, Vec2 } from '../../src/core/types';

export type QuarryCustody = 'trade' | 'escort';
export const QUARRY_ROUTES = {
  trade: {
    seed: 'quarry-return-trade-route',
    names: ['Kaya', 'Nilak', 'Bo'],
    characters: ['kaya', 'nilak', 'bo'],
  },
  escort: {
    seed: 'quarry-return-escort',
    names: ['Kaya', 'Nilak', 'Bo', 'Tenzo', 'Lin Mei', 'Nima'],
    characters: ['kaya', 'nilak', 'bo', 'tenzo', 'lin_mei', 'nima'],
  },
} as const;

export interface QuarryBoundary {
  readonly stage: 'gate' | 'afterDriller';
  readonly custody: QuarryCustody;
  readonly screen: GameState['screen'];
  readonly party: readonly {
    readonly id: string;
    readonly characterId: string | null;
    readonly name: string;
    readonly level: number;
    readonly xp: number;
    readonly abilities: readonly string[];
  }[];
  readonly flags: GameState['flags'];
  readonly world: GameState['world'];
  readonly story: GameState['story'];
  readonly location: GameState['location'];
  readonly pendingChoices: GameState['pendingChoices'];
  readonly battle: GameState['battle'];
}

export function quarryRouteBoundary(state: GameState): QuarryBoundary {
  const stage = state.flags.act1_complete === true ? 'afterDriller' : 'gate';
  const custody: QuarryCustody = state.flags.ruon_traded === true ? 'trade' : 'escort';
  return {
    stage,
    custody,
    screen: state.screen,
    // HP, AP, cooldowns, statuses, RNG and log are combat-history dependent:
    // the legacy browser battle helper changes every enemy to one HP, while
    // this fixture defeats the unmodified roster with legal commands.
    party: state.party.map((unit) => ({
      id: unit.id,
      characterId: unit.characterId,
      name: unit.name,
      level: unit.level,
      xp: unit.xp,
      abilities: unit.abilities,
    })),
    flags: state.flags,
    world: state.world,
    story: state.story,
    location: state.location,
    pendingChoices: state.pendingChoices,
    battle: state.battle,
  };
}

export interface QuarryCheckpoint {
  readonly json: string;
  readonly state: GameState;
  readonly session: SessionMeta;
  readonly projection: QuarryBoundary;
  /** Commands from a fresh game to this point, including the boundary itself. */
  readonly transcript: readonly Command[];
}

export interface QuarryCheckpoints {
  readonly gate: QuarryCheckpoint;
  readonly afterDriller: QuarryCheckpoint;
}

/** Same deserialize -> battle -> discipline -> world reconciliation order as App.adoptSave. */
export function loadQuarryCheckpoint(json: string): GameState {
  const parsed = deserialize(json);
  if (!parsed.ok) throw new Error(parsed.error);
  const result = reconcileBattleResult(CONTENT, stateFromBlob(parsed.blob));
  if (result.warnings.length) throw new Error(result.warnings.join('; '));
  return reconcileWorld(CONTENT, reconcileDisciplines(CONTENT, result.state));
}

export function generateQuarryCheckpoints(custody: QuarryCustody): QuarryCheckpoints {
  const route = QUARRY_ROUTES[custody];
  const session: SessionMeta = {
    players: route.names.map((name, index) => ({ name, unitId: `p${index}` })),
    soloPlay: false,
  };
  let state = createGame(CONTENT, {
    seed: route.seed,
    party: route.characters.map((characterId) => ({ characterId })),
    startNode: STORY_ENTRY,
  });
  const transcript: Command[] = [];
  const issue = (command: Command) => {
    const before = state;
    const result = apply(CONTENT, state, command);
    state = result.state;
    transcript.push(command);
    if (
      state === before ||
      result.events.some(
        (event) =>
          event.type === 'message' &&
          /cannot|not open|unavailable|no way|not that unit|no battle|not exploring/i.test(
            event.text,
          ),
      )
    ) {
      throw new Error(
        `Refused ${JSON.stringify(command)} at ${before.story.nodeId ?? before.location.mapId}: ${JSON.stringify(result.events)}`,
      );
    }
  };
  const choosePending = () => {
    for (let guard = 0; state.pendingChoices.length && guard < 100; guard++) {
      const choice = state.pendingChoices[0];
      if (!choice) break;
      if (choice.kind === 'ability')
        issue({ type: 'chooseLevelUp', unitId: choice.unitId, abilityId: choice.options[0] ?? '' });
      else {
        const id = choice.options.find((option) => {
          const discipline = CONTENT.disciplines.get(option);
          return (
            discipline &&
            (!discipline.requiresFlag || state.flags[discipline.requiresFlag] === true)
          );
        });
        if (!id) throw new Error(`No unlocked discipline for ${choice.unitId}`);
        issue({ type: 'chooseDiscipline', unitId: choice.unitId, disciplineId: id });
      }
    }
    if (state.pendingChoices.length) throw new Error('Unresolved level choices');
  };
  const story = () => {
    for (let guard = 0; guard < 100; guard++) {
      choosePending();
      if (state.screen !== 'dialogue') return;
      const node = CONTENT.story.get(state.story.nodeId ?? '');
      if (!node) throw new Error(`Missing story node ${state.story.nodeId}`);
      if (node.kind === 'choice') {
        issue({
          type: 'chooseOption',
          optionIndex:
            node.id === 'gate_parley'
              ? 2
              : node.id === 'ruon_choice'
                ? custody === 'trade'
                  ? 1
                  : 0
                : 0,
        });
      } else if (node.kind === 'dialogue') {
        if (INTERLUDES[node.id]) issue({ type: 'enterNode', nodeId: node.next });
        else issue({ type: 'advanceDialogue' });
      } else throw new Error(`Unexpected dialogue node ${node.id}: ${node.kind}`);
    }
    throw new Error('Story did not leave dialogue');
  };
  const walk = (pos: Vec2) => issue({ type: 'walkTo', pos });
  const travel = (destination: string) => {
    const map = CONTENT.maps.get(state.location.mapId);
    const exit = map?.exits?.find((candidate) => candidate.toMapId === destination);
    if (!exit) throw new Error(`No exit from ${state.location.mapId} to ${destination}`);
    // A route button walks to the closest reachable cell of the authored mouth.
    // Its representative `exit.pos` may be blocked or farther away.
    let nearest = exit.pos;
    for (const cell of exitCells(exit))
      if (distance(state.location.pos, cell) < distance(state.location.pos, nearest))
        nearest = cell;
    const cells = [nearest];
    for (const cell of cells) {
      const before = state;
      const result = apply(CONTENT, state, { type: 'walkTo', pos: cell });
      if (result.state.location.mapId === destination) {
        state = result.state;
        transcript.push({ type: 'walkTo', pos: cell });
        return;
      }
      if (result.state !== before && result.state.screen !== 'explore') {
        state = result.state;
        transcript.push({ type: 'walkTo', pos: cell });
        throw new Error(`Interrupted while travelling to ${destination}: ${state.story.nodeId}`);
      }
    }
    throw new Error(`Could not reach ${destination} from ${map?.id}`);
  };
  const fight = (encounterId: string) => {
    if (state.battle?.encounterId !== encounterId)
      throw new Error(`Expected ${encounterId}; got ${state.battle?.encounterId}`);
    for (let turn = 0; turn < 160 && state.battle?.phase === 'active'; turn++) {
      const battle: BattleState = state.battle;
      const actor = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
      if (!actor || actor.hp <= 0 || actor.faction !== 'party') {
        issue({ type: 'runAiTurn' });
        continue;
      }
      // Ask the real AI planner to plan on a clone, then replay only its public,
      // legal move/useAbility commands against the campaign state. The planner's
      // profile change is confined to the clone and never enters a save.
      const rng = new RngCursor(state.rng);
      const draft = new BattleDraft(CONTENT, battle, rng);
      const profile =
        actor.element === 'water'
          ? 'support'
          : actor.element === 'earth' || actor.element === 'air'
            ? 'cautious'
            : 'aggressive';
      draft.replace({ ...actor, ai: profile });
      planAiTurn(draft, actor.id, rng);
      for (const event of draft.events) {
        if (state.battle?.phase !== 'active') break;
        if (event.type === 'unitMoved' && event.unitId === actor.id && event.path.length) {
          const current = state.battle.units.find((unit) => unit.id === actor.id)?.pos;
          const end = event.path.at(-1);
          if (current && end && (current.x !== end.x || current.y !== end.y))
            issue({ type: 'move', unitId: actor.id, path: event.path });
        } else if (event.type === 'abilityUsed' && event.unitId === actor.id) {
          issue({
            type: 'useAbility',
            unitId: actor.id,
            abilityId: event.abilityId,
            target: event.target,
          });
        }
      }
      if (
        state.battle?.phase === 'active' &&
        state.battle.order[state.battle.turnIndex] === actor.id
      )
        issue({ type: 'endTurn', unitId: actor.id });
    }
    if (state.battle?.phase !== 'victory')
      throw new Error(
        `${encounterId} ended ${state.battle?.phase ?? 'missing'} in round ${state.battle?.round} at ${JSON.stringify(state.battle?.units.map((u) => ({ id: u.id, hp: u.hp, pos: u.pos })))} `,
      );
    issue({ type: 'resolveBattle' });
    story();
  };
  const checkpoint = (stage: QuarryBoundary['stage']): QuarryCheckpoint => {
    choosePending();
    const projection = quarryRouteBoundary(state);
    if (
      projection.stage !== stage ||
      projection.screen !== 'explore' ||
      projection.battle ||
      projection.world.talk ||
      projection.pendingChoices.length
    )
      throw new Error(`Invalid ${stage} checkpoint: ${JSON.stringify(projection)}`);
    const json = serialize(state, {
      label: 'Slot 1',
      summary: `Quarry ${stage}`,
      savedAt: 1_700_000_000_000,
      session,
    });
    const loaded = loadQuarryCheckpoint(json);
    if (JSON.stringify(loaded) !== JSON.stringify(state))
      throw new Error(`${stage} changed on load`);
    if (
      JSON.stringify(
        loadQuarryCheckpoint(
          serialize(loaded, {
            label: 'Slot 1',
            summary: `Quarry ${stage}`,
            savedAt: 1_700_000_000_000,
            session,
          }),
        ),
      ) !== JSON.stringify(loaded)
    )
      throw new Error(`${stage} load was not idempotent`);
    return { json, state, session, projection, transcript: [...transcript] };
  };

  issue({ type: 'enterNode', nodeId: STORY_ENTRY });
  story();
  walk({ x: 11, y: 5 });
  story();
  travel('forest_road');
  walk({ x: 19, y: 4 });
  story();
  walk({ x: 19, y: 4 });
  fight('enc_forest_road');
  travel('quarry_gate');
  walk({ x: 19, y: 5 });
  story();
  const gate = checkpoint('gate');
  travel('ambush_road');
  if (custody === 'escort') {
    walk({ x: 19, y: 4 });
    story();
    fight('enc_ambush');
  }
  travel('quarry_floor');
  walk({ x: 17, y: 5 });
  story();
  fight('enc_grumbler');
  if (state.screen === 'ended' && state.story.nodeId === 'act1_epilogue') {
    // The end summary's Continue exploring control enters its authored next node.
    issue({ type: 'enterNode', nodeId: 'quarry_after_explore' });
  }
  const afterDriller = checkpoint('afterDriller');
  return { gate, afterDriller };
}
