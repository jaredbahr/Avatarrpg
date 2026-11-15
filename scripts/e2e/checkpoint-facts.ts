/** The readable facts the quarry checkpoints are pinned by, and a field-level diff of them.
 *
 * These replace whole-save SHA-256 pins (#795). A digest says only "something
 * changed"; nobody can review one, and every AI or content change moved it, so
 * every such pull request conflicted with every other in the pin table.
 *
 * What is pinned is what an AI retune must NOT move, in words a reviewer can
 * read: where the story stands, who is in the party and what they have earned,
 * the flags, the world, and the shape of the save. What an AI retune moves by
 * design (the command transcript, the RNG cursor, the combat log, hit points
 * mid-fight) is not pinned by equality. `npm run checkpoints -- --dump` and
 * `--diff` compare that behaviour on demand, field by field.
 */
import { CONTENT, STORY_ENTRY } from '../../src/content';
import { serialize } from '../../src/core/save/serialize';
import { createGame } from '../../src/core/state/createGame';
import { apply } from '../../src/core/state/reducer';
import type { Command, GameState } from '../../src/core/types';
import {
  QUARRY_ROUTES,
  generateQuarryCheckpoints,
  type QuarryCheckpoint,
  type QuarryCheckpoints,
  type QuarryCustody,
} from './quarry-checkpoints';

export type Fact =
  string | number | boolean | null | readonly Fact[] | { readonly [key: string]: Fact };

export const CUSTODIES = ['trade', 'escort'] as const;
export const STAGES = ['gate', 'afterDriller'] as const;

/** Maps whose keys are content ids or unit ids: the shape names the map, the facts name the keys. */
const ID_KEYED = /(^|\.)(flags|returnPos|residentProfiles|cooldowns|discoveredCombos)$/;

function sortKeys(record: Readonly<Record<string, Fact>>): Record<string, Fact> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/**
 * Every key path in a save with the type of its value, sorted. Array indices
 * collapse to `[]` and id-keyed maps to `*`, so the list moves when the save
 * FORMAT moves (a field added, removed or retyped) and not when a fight ran
 * longer. A new field is one readable line: `+ state.battle.openingRng: number`.
 */
export function saveShape(json: string): string[] {
  const lines = new Set<string>();
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      if (value.length === 0) lines.add(`${path}: []`);
      for (const item of value) walk(item, `${path}[]`);
    } else if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) lines.add(`${path}: {}`);
      const wildcard = ID_KEYED.test(path);
      for (const [key, item] of entries) walk(item, `${path}.${wildcard ? '*' : key}`);
    } else {
      lines.add(`${path}: ${value === null ? 'null' : typeof value}`);
    }
  };
  walk(JSON.parse(json), 'save');
  return [...lines].sort();
}

function partyFacts(state: GameState): Fact[] {
  return state.party.map((unit) => ({
    id: unit.id,
    name: unit.name,
    characterId: unit.characterId,
    disciplineId: unit.disciplineId,
    level: unit.level,
    xp: unit.xp,
    base: { ...unit.base },
    abilities: [...unit.abilities],
  }));
}

/** The facts of one route boundary: none of them depends on how a fight was played. */
export function boundaryFacts(checkpoint: QuarryCheckpoint): Fact {
  const { state } = checkpoint;
  return {
    screen: state.screen,
    difficulty: state.difficulty,
    story: {
      nodeId: state.story.nodeId,
      deciderIndex: state.story.deciderIndex,
      visited: [...state.story.visited],
    },
    location: { mapId: state.location.mapId, pos: { ...state.location.pos } },
    party: partyFacts(state),
    // `guidance.` flags are the App's, never the reducer's; the projection drops them.
    flags: sortKeys(checkpoint.projection.flags),
    world: {
      cleared: [...state.world.cleared],
      fired: [...state.world.fired],
      clock: { ...state.world.clock },
      returnPos: sortKeys(
        Object.fromEntries(
          Object.entries(state.world.returnPos).map(([mapId, pos]) => [mapId, { ...pos }]),
        ),
      ),
      residentProfiles: sortKeys({ ...state.world.residentProfiles }),
      runoff: state.world.runoff,
    },
  };
}

export interface BattleOpening {
  readonly state: GameState;
  readonly json: string;
}

/**
 * The first fight of a route at the moment it opens. No fight has been played
 * yet, so the roster, the turn order and the mid-battle save shape here depend
 * on content and the seed alone, never on what the AI chose.
 */
export function firstBattleOpening(
  custody: QuarryCustody,
  transcript: readonly Command[],
): BattleOpening {
  const route = QUARRY_ROUTES[custody];
  let state = createGame(CONTENT, {
    seed: route.seed,
    party: route.characters.map((characterId) => ({ characterId })),
    startNode: STORY_ENTRY,
  });
  for (const command of transcript) {
    if (state.battle) break;
    state = apply(CONTENT, state, command).state;
  }
  if (!state.battle) throw new Error(`The ${custody} route never opens a fight`);
  const json = serialize(state, {
    label: 'Slot 1',
    summary: 'First fight, opening',
    savedAt: 1_700_000_000_000,
    session: {
      players: route.names.map((name, index) => ({ name, unitId: `p${index}` })),
      soloPlay: false,
    },
  });
  return { state, json };
}

export function battleOpeningFacts(opening: BattleOpening): Fact {
  const battle = opening.state.battle;
  if (!battle) throw new Error('Not a battle opening');
  return {
    encounterId: battle.encounterId,
    variantId: battle.variantId ?? null,
    phase: battle.phase,
    round: battle.round,
    order: [...battle.order],
    units: battle.units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      faction: unit.faction,
      kind: unit.characterId ?? unit.enemyId,
      level: unit.level,
      hp: unit.hp,
      pos: { ...unit.pos },
    })),
  };
}

export interface QuarryCheckpointFacts {
  /**
   * The save format as these checkpoints see it: one list for the route
   * boundaries (exploring, no fight) and one for a fight that has just opened.
   * Each is the union over both routes, so a format change is one line, once.
   */
  readonly saveShape: {
    readonly exploring: readonly string[];
    readonly battleOpening: readonly string[];
  };
  readonly trade: Readonly<Record<string, Fact>>;
  readonly escort: Readonly<Record<string, Fact>>;
}

/** Every pinned fact, in the layout of `quarry-checkpoints.facts.json`. */
export function quarryCheckpointFacts(
  checkpointsFor: (custody: QuarryCustody) => QuarryCheckpoints = generateQuarryCheckpoints,
): QuarryCheckpointFacts {
  const exploring = new Set<string>();
  const battleOpening = new Set<string>();
  const routes = {} as Record<QuarryCustody, Record<string, Fact>>;
  for (const custody of CUSTODIES) {
    const checkpoints = checkpointsFor(custody);
    const opening = firstBattleOpening(custody, checkpoints.gate.transcript);
    for (const line of saveShape(opening.json)) battleOpening.add(line);
    for (const stage of STAGES)
      for (const line of saveShape(checkpoints[stage].json)) exploring.add(line);
    routes[custody] = {
      firstBattleOpening: battleOpeningFacts(opening),
      gate: boundaryFacts(checkpoints.gate),
      afterDriller: boundaryFacts(checkpoints.afterDriller),
    };
  }
  return {
    saveShape: { exploring: [...exploring].sort(), battleOpening: [...battleOpening].sort() },
    trade: routes.trade,
    escort: routes.escort,
  };
}

/* ------------------------------------------------------------------ */
/* Field-level diff                                                     */
/* ------------------------------------------------------------------ */

/** The whole value as text: what two values are compared by. */
const whole = (value: unknown): string => JSON.stringify(value) ?? 'undefined';

/** A value as a failure prints it: cut for the eye, never for the comparison. */
const show = (value: unknown): string => {
  const text = whole(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isLeaf = (value: unknown): boolean => value === null || typeof value !== 'object';

/** A list of leaves is read as a sequence: what joined it, what left it, where. */
function diffSequence(
  path: string,
  before: readonly unknown[],
  after: readonly unknown[],
): string[] {
  const lines: string[] = [];
  const count = (list: readonly unknown[]) => {
    const counts = new Map<string, number>();
    for (const item of list) counts.set(whole(item), (counts.get(whole(item)) ?? 0) + 1);
    return counts;
  };
  const had = count(before);
  const has = count(after);
  const seen = new Map<string, number>();
  for (const [index, item] of before.entries()) {
    const key = whole(item);
    const nth = (seen.get(key) ?? 0) + 1;
    seen.set(key, nth);
    if (nth > (has.get(key) ?? 0)) lines.push(`${path}: - ${show(item)} (was item ${index + 1})`);
  }
  seen.clear();
  for (const [index, item] of after.entries()) {
    const key = whole(item);
    const nth = (seen.get(key) ?? 0) + 1;
    seen.set(key, nth);
    if (nth > (had.get(key) ?? 0)) {
      const previous = index > 0 ? `after ${show(after[index - 1])}` : 'first';
      lines.push(`${path}: + ${show(item)} (${previous})`);
    }
  }
  if (lines.length === 0 && before.some((item, index) => whole(item) !== whole(after[index])))
    lines.push(`${path}: same items, new order: ${show(before)} -> ${show(after)}`);
  return lines;
}

/**
 * Every difference between two JSON values, one line each, by path:
 * `trade.gate.party[0].xp: 400 -> 420`, `+ path: value`, `- path: value`.
 */
export function diffFacts(before: unknown, after: unknown, path = ''): string[] {
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.every(isLeaf) && after.every(isLeaf)) return diffSequence(path, before, after);
    const lines: string[] = [];
    for (let index = 0; index < Math.max(before.length, after.length); index++) {
      const at = `${path}[${index}]`;
      if (index >= before.length) lines.push(`+ ${at}: ${show(after[index])}`);
      else if (index >= after.length) lines.push(`- ${at}: ${show(before[index])}`);
      else lines.push(...diffFacts(before[index], after[index], at));
    }
    return lines;
  }
  if (isRecord(before) && isRecord(after)) {
    const lines: string[] = [];
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const at = path ? `${path}.${key}` : key;
      if (!(key in before)) lines.push(`+ ${at}: ${show(after[key])}`);
      else if (!(key in after)) lines.push(`- ${at}: ${show(before[key])}`);
      else lines.push(...diffFacts(before[key], after[key], at));
    }
    return lines;
  }
  return whole(before) === whole(after) ? [] : [`${path}: ${show(before)} -> ${show(after)}`];
}

export const REPIN_COMMAND = 'npm run checkpoints -- --write';

/** The failure a reviewer reads: which facts moved, and the one command that re-pins them. */
export function factsReport(label: string, differences: readonly string[], limit = 40): string {
  const shown = differences.slice(0, limit).map((line) => `  ${line}`);
  if (differences.length > limit) shown.push(`  ... and ${differences.length - limit} more`);
  return [
    `${label}: ${differences.length} pinned fact${differences.length === 1 ? '' : 's'} moved.`,
    ...shown,
    `If your change means to move them, run \`${REPIN_COMMAND}\` and paste its summary into the pull request.`,
    'If it does not, the lines above are the regression.',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Behaviour: what an AI or content change is allowed to move           */
/* ------------------------------------------------------------------ */

export interface FightSummary {
  readonly encounterId: string;
  readonly commands: number;
  readonly rounds: number;
  readonly partyHpLeft: number;
  readonly partyHpTotal: number;
  readonly partyDown: number;
}

/** One line per fight on the way to a checkpoint, by replaying its transcript. */
export function fightSummaries(
  custody: QuarryCustody,
  transcript: readonly Command[],
): FightSummary[] {
  const route = QUARRY_ROUTES[custody];
  let state = createGame(CONTENT, {
    seed: route.seed,
    party: route.characters.map((characterId) => ({ characterId })),
    startNode: STORY_ENTRY,
  });
  const fights: FightSummary[] = [];
  let commands = 0;
  for (const command of transcript) {
    const battle = state.battle;
    if (battle && command.type === 'resolveBattle') {
      const party = battle.units.filter((unit) => unit.faction === 'party' && !unit.temporary);
      fights.push({
        encounterId: battle.encounterId,
        commands,
        rounds: battle.round,
        partyHpLeft: party.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0),
        partyHpTotal: party.reduce((sum, unit) => sum + unit.base.maxHp, 0),
        partyDown: party.filter((unit) => unit.hp <= 0).length,
      });
      commands = 0;
    } else if (battle) commands++;
    state = apply(CONTENT, state, command).state;
  }
  return fights;
}

export interface CheckpointBehaviour {
  readonly commands: number;
  readonly commandsByType: Readonly<Record<string, number>>;
  readonly fights: readonly FightSummary[];
  readonly save: unknown;
  readonly transcript: readonly Command[];
}

/** The whole save and transcript of every checkpoint, for `--dump` and `--diff`. */
export function quarryCheckpointBehaviour(): Record<string, CheckpointBehaviour> {
  const behaviour: Record<string, CheckpointBehaviour> = {};
  for (const custody of CUSTODIES) {
    const checkpoints = generateQuarryCheckpoints(custody);
    for (const stage of STAGES) {
      const { transcript, json } = checkpoints[stage];
      const commandsByType: Record<string, number> = {};
      for (const command of transcript)
        commandsByType[command.type] = (commandsByType[command.type] ?? 0) + 1;
      behaviour[`${custody}.${stage}`] = {
        commands: transcript.length,
        commandsByType,
        fights: fightSummaries(custody, transcript),
        save: JSON.parse(json),
        transcript,
      };
    }
  }
  return behaviour;
}

/** Where two transcripts part, in words, or null when they are the same. */
export function firstDivergence(
  before: readonly Command[],
  after: readonly Command[],
): string | null {
  const length = Math.min(before.length, after.length);
  for (let index = 0; index < length; index++) {
    if (JSON.stringify(before[index]) !== JSON.stringify(after[index]))
      return `command ${index + 1}: ${show(before[index])} -> ${show(after[index])}`;
  }
  if (before.length === after.length) return null;
  return `the first ${length} commands agree; then ${before.length} -> ${after.length} commands`;
}
