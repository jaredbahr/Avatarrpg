/**
 * Building a game, a party, and a battle.
 *
 * Party units live on `GameState.party` and are *copied* into a battle when one
 * starts, then copied back (HP, XP, cooldowns cleared) when it ends. That keeps
 * the battle free to mutate units without the between-fights party state having
 * to care, and makes a save taken mid-battle and a save taken in the village
 * exactly the same shape.
 */

import { seedFromString } from '../rng';
import type { RngState, RngCursor } from '../rng';
import type {
  BattleState,
  CharacterDef,
  ContentIndex,
  EncounterDef,
  EncounterPlacement,
  FlagValue,
  GameState,
  Grid,
  Unit,
  Vec2,
} from '../types';
import { buildGrid, enterCost, occupiedCells, posKey } from '../rules/grid';
import { enemiesToDrop, scaleForTable } from '../rules/difficulty';
import { grantedUpTo, scaleStats, statsAtLevel } from '../rules/leveling';
import { rollInitiative } from '../rules/turnOrder';

export const SAVE_VERSION = 1;

export interface PartySlot {
  readonly characterId: string;
  /** Overrides the character's own name. Unused today; here for renaming. */
  readonly displayName?: string;
  readonly level?: number;
  /**
   * Abilities already picked for the level 3 and 7 choices. Real play collects
   * these through the level-up dialog; the simulator and tests pass them in so
   * a level 4 party is not fighting with two abilities.
   */
  readonly chosen?: readonly string[];
  /**
   * Takes the first option of every unresolved choice at or below this level.
   * Only the simulator uses this — a player always chooses for themselves.
   */
  readonly autoChoose?: boolean;
}

export interface NewGameOptions {
  readonly seed: number | string;
  readonly party: readonly PartySlot[];
  readonly startNode: string;
  readonly flags?: Readonly<Record<string, FlagValue>>;
}

/** Builds one level-1 (or `level`) party member from a character definition. */
export function createPartyUnit(
  content: ContentIndex,
  character: CharacterDef,
  index: number,
  level = 1,
  displayName?: string,
  options: { chosen?: readonly string[]; autoChoose?: boolean } = {},
): Unit {
  const base = statsAtLevel(content, character.element, level, character.statMods);

  const abilities = new Set(grantedUpTo(character.kit, level));
  for (const entry of character.kit) {
    if (entry.level > level || !('choose' in entry)) continue;
    const picked = entry.choose.find((id) => options.chosen?.includes(id));
    if (picked) abilities.add(picked);
    else if (options.autoChoose) abilities.add(entry.choose[0]);
  }

  return {
    id: `p${index}`,
    name: displayName ?? character.name,
    faction: 'party',
    element: character.element,
    characterId: character.id,
    enemyId: null,
    level,
    xp: 0,
    pos: { x: 0, y: 0 },
    size: 1,
    hp: base.maxHp,
    ap: base.maxAp,
    move: base.maxMove,
    bankedAp: 0,
    base,
    abilities: [...abilities],
    cooldowns: {},
    statuses: [],
    ai: 'none',
    temporary: false,
    sprite: character.sprite,
  };
}

export function createGame(content: ContentIndex, options: NewGameOptions): GameState {
  const seed = typeof options.seed === 'number' ? options.seed >>> 0 : seedFromString(options.seed);

  const party: Unit[] = [];
  options.party.forEach((slot, index) => {
    const character = content.characters.get(slot.characterId);
    if (!character) throw new Error(`Unknown character "${slot.characterId}"`);
    party.push(
      createPartyUnit(content, character, index, slot.level ?? 1, slot.displayName, {
        chosen: slot.chosen,
        autoChoose: slot.autoChoose,
      }),
    );
  });

  if (party.length === 0) throw new Error('A game needs at least one party member');

  return {
    version: SAVE_VERSION,
    seed,
    rng: seed as RngState,
    screen: 'dialogue',
    party,
    battle: null,
    story: { nodeId: options.startNode, deciderIndex: 0, visited: [], lineIndex: 0 },
    flags: { ...(options.flags ?? {}) },
    pendingChoices: [],
    location: { mapId: '', pos: { x: 0, y: 0 } },
    log: [],
  };
}

/* ------------------------------------------------------------------ */
/* Battles                                                             */
/* ------------------------------------------------------------------ */

/** First free cell at or near `preferred`, spiralling outward. */
function placeAt(
  content: ContentIndex,
  grid: Grid,
  taken: Set<string>,
  preferred: Vec2,
  size: 1 | 2,
): Vec2 {
  const ctx = { grid, blocked: taken, surfaces: content.surfaces, size };
  if (enterCost(ctx, preferred) !== null) return preferred;

  for (let radius = 1; radius <= 6; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const candidate = { x: preferred.x + dx, y: preferred.y + dy };
        if (enterCost(ctx, candidate) !== null) return candidate;
      }
    }
  }
  return preferred;
}

function createUnitFromPlacement(
  content: ContentIndex,
  placement: EncounterPlacement,
  faction: 'enemy' | 'ally',
  serial: number,
  pos: Vec2,
  defaultLevel: number,
  table: { baselinePartySize: number; partySize: number },
): Unit | null {
  const def = content.enemies.get(placement.enemyId);
  if (!def) return null;

  // Enemies level with the encounter unless the placement pins them, so the
  // bandits at the quarry floor are not the ones from the forest road.
  const level = placement.level ?? defaultLevel;
  const levelled = scaleStats(def.stats, def.element, level);

  // Allies are the party's problem to keep alive, so they are not scaled
  // against the party — only opposition is.
  const stats =
    faction === 'enemy'
      ? scaleForTable(levelled, {
          baselinePartySize: table.baselinePartySize,
          partySize: table.partySize,
          isBoss: def.ai === 'boss',
        })
      : levelled;

  return {
    id: `${faction === 'ally' ? 'a' : 'e'}${serial}`,
    name: placement.nameSuffix ? `${def.name} ${placement.nameSuffix}` : def.name,
    faction,
    element: def.element,
    characterId: null,
    enemyId: def.id,
    level,
    xp: 0,
    pos,
    size: def.size,
    hp: stats.maxHp,
    ap: stats.maxAp,
    move: stats.maxMove,
    bankedAp: 0,
    base: stats,
    abilities: [...def.abilities],
    cooldowns: {},
    statuses: [],
    ai: faction === 'ally' ? 'aggressive' : def.ai,
    temporary: faction === 'ally',
    sprite: def.sprite,
  };
}

/**
 * Placements an encounter contributes, given the story flags and how many
 * people are actually playing.
 *
 * Rosters are authored for `baselinePartySize`. Each player above that pulls
 * in one reinforcement, so a table of six faces roughly six enemies instead of
 * queueing up to hit three. Below the baseline nothing is removed — a small
 * party is meant to be the harder game, not a thinner one.
 */
export function encounterRoster(
  encounter: EncounterDef,
  flags: Readonly<Record<string, FlagValue>>,
  partySize: number,
): { enemies: EncounterPlacement[]; allies: EncounterPlacement[] } {
  // Story allies fight on the party's side, so they count toward the scaling.
  const friendlyCount = partySize + encounter.allies.length;
  const dropped = enemiesToDrop(encounter.baselinePartySize, friendlyCount);
  const enemies =
    dropped > 0
      ? encounter.enemies.slice(0, Math.max(1, encounter.enemies.length - dropped))
      : [...encounter.enemies];

  for (const group of encounter.conditionalEnemies) {
    const isSet = Boolean(flags[group.flag]);
    if (isSet === group.whenSet) enemies.push(...group.placements);
  }

  const extra = Math.max(0, friendlyCount - encounter.baselinePartySize);
  enemies.push(...encounter.reinforcements.slice(0, extra));

  return { enemies, allies: [...encounter.allies] };
}

/**
 * Assembles a battle: builds the grid from the map, drops the party on the
 * spawn points, places enemies (and any conditional reinforcements the story
 * flags call for), and rolls initiative once for the whole fight.
 */
export function createBattle(
  content: ContentIndex,
  state: GameState,
  encounterId: string,
  rng: RngCursor,
): BattleState {
  const encounter = content.encounters.get(encounterId);
  if (!encounter) throw new Error(`Unknown encounter "${encounterId}"`);
  const map = content.maps.get(encounter.mapId);
  if (!map) throw new Error(`Encounter "${encounterId}" uses unknown map "${encounter.mapId}"`);

  const grid = buildGrid(map);
  const taken = new Set<string>();
  const units: Unit[] = [];

  // Party first: they get the authored spawn points.
  state.party.forEach((member, index) => {
    const preferred = map.partySpawns[index] ?? map.partySpawns[0] ?? { x: 1, y: 1 };
    const pos = placeAt(content, grid, taken, preferred, member.size);
    for (const cell of occupiedCells({ pos, size: member.size })) taken.add(posKey(cell));
    units.push({
      ...member,
      pos,
      ap: member.base.maxAp,
      move: member.base.maxMove,
      bankedAp: 0,
      cooldowns: {},
      statuses: [],
    });
  });

  const roster = encounterRoster(encounter, state.flags, state.party.length);
  const level = encounter.expectedLevel;
  const table = {
    baselinePartySize: encounter.baselinePartySize,
    partySize: state.party.length + encounter.allies.length,
  };
  let serial = 1;

  for (const placement of roster.allies) {
    const def = content.enemies.get(placement.enemyId);
    const pos = placeAt(content, grid, taken, placement.pos, def?.size ?? 1);
    const unit = createUnitFromPlacement(content, placement, 'ally', serial++, pos, level, table);
    if (!unit) continue;
    for (const cell of occupiedCells(unit)) taken.add(posKey(cell));
    units.push(unit);
  }

  for (const placement of roster.enemies) {
    const def = content.enemies.get(placement.enemyId);
    const pos = placeAt(content, grid, taken, placement.pos, def?.size ?? 1);
    const unit = createUnitFromPlacement(content, placement, 'enemy', serial++, pos, level, table);
    if (!unit) continue;
    for (const cell of occupiedCells(unit)) taken.add(posKey(cell));
    units.push(unit);
  }

  const order = rollInitiative(content, units, rng);

  return {
    encounterId,
    mapId: encounter.mapId,
    grid,
    units,
    order,
    turnIndex: 0,
    round: 1,
    phase: 'active',
    temporaryWalls: [],
    nextUnitSerial: serial,
  };
}

/**
 * Copies battle results back onto the persistent party.
 *
 * Survivors keep their HP. Anyone who went down comes back at a quarter of
 * their max — the slice is four fights long and a permanent loss would end a
 * family's session, not raise the stakes. Statuses and cooldowns do not carry
 * between fights.
 */
export function absorbBattleResults(state: GameState, battle: BattleState): Unit[] {
  return state.party.map((member) => {
    const fought = battle.units.find((u) => u.id === member.id);
    if (!fought) return member;
    const hp = fought.hp > 0 ? fought.hp : Math.max(1, Math.round(fought.base.maxHp * 0.25));
    return {
      ...member,
      hp: Math.min(fought.base.maxHp, hp),
      xp: fought.xp,
      level: fought.level,
      base: fought.base,
      abilities: fought.abilities,
      statuses: [],
      cooldowns: {},
      bankedAp: 0,
      ap: fought.base.maxAp,
      move: fought.base.maxMove,
    };
  });
}

/** Full heal, used when the party is sent back to retry a lost fight. */
export function reviveParty(party: readonly Unit[]): Unit[] {
  return party.map((member) => ({
    ...member,
    hp: member.base.maxHp,
    ap: member.base.maxAp,
    move: member.base.maxMove,
    bankedAp: 0,
    statuses: [],
    cooldowns: {},
  }));
}

/** A quarter of max HP back after a won fight, so a party without a healer copes. */
export const POST_VICTORY_HEAL = 0.25;

export function restAfterVictory(party: readonly Unit[]): Unit[] {
  return party.map((member) => ({
    ...member,
    hp: Math.min(member.base.maxHp, member.hp + Math.round(member.base.maxHp * POST_VICTORY_HEAL)),
  }));
}
