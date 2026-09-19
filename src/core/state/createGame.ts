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
  EncounterVariant,
  FlagValue,
  GameState,
  Grid,
  PropInstance,
  PropPlacement,
  Unit,
  Vec2,
} from '../types';
import { evaluate } from '../story/conditions';
import { buildGrid, enterCost, occupiedCells, posKey, tileAt, withTile } from '../rules/grid';
import { enemiesToDrop, scaleForTable } from '../rules/difficulty';
import {
  combinedKit,
  grantedUpTo,
  mergedStatMods,
  scaleStats,
  specializationsUpTo,
  statsAtLevel,
} from '../rules/leveling';
import { rollInitiative } from '../rules/turnOrder';

/** 2 added `Unit.disciplineId` and widened `PendingChoice`. */
export const SAVE_VERSION = 3;

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
   * The discipline this member has committed to, if they are past the gate.
   * Real play collects it through the pick dialog; the simulator and the
   * balance sweep pass it in so a level 5+ party is not fighting without the
   * half of its kit that the path supplies.
   */
  readonly discipline?: string;
  /**
   * Takes the first option of every unresolved choice at or below this level,
   * and the first discipline the gate offers. Only the simulator uses this — a
   * player always chooses for themselves.
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
  options: { chosen?: readonly string[]; discipline?: string; autoChoose?: boolean } = {},
): Unit {
  /*
   * Resolve the discipline first: it contributes stat mods and half the kit
   * from the gate onward, so everything below has to see it. `autoChoose`
   * takes the first path the gate offers *regardless of its flag* — the
   * simulator has no story state to have set one, and a balance run that
   * silently fell back to no discipline would measure the wrong party.
   */
  const gateOptions = specializationsUpTo(character.kit, level);
  const pickedDisciplineId =
    gateOptions.find((id) => id === options.discipline) ??
    (options.autoChoose ? gateOptions[0] : undefined);
  const discipline = pickedDisciplineId ? content.disciplines.get(pickedDisciplineId) : undefined;

  const base = statsAtLevel(
    content,
    character.element,
    level,
    mergedStatMods(character, discipline),
  );

  const kit = combinedKit(character, discipline);
  const abilities = new Set(grantedUpTo(kit, level));
  for (const entry of kit) {
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
    disciplineId: discipline?.id ?? null,
    level,
    xp: 0,
    pos: { x: 0, y: 0 },
    size: 1,
    hp: base.maxHp,
    ap: base.maxAp,
    move: base.maxMove,
    bankedAp: 0,
    pendingAp: 0,
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
        discipline: slot.discipline,
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
    world: { returnPos: {}, fired: [], cleared: [] },
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
    disciplineId: null,
    level,
    xp: 0,
    pos,
    size: def.size,
    hp: stats.maxHp,
    ap: stats.maxAp,
    move: stats.maxMove,
    bankedAp: 0,
    pendingAp: 0,
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
  variant: EncounterVariant | null = null,
): { enemies: EncounterPlacement[]; allies: EncounterPlacement[] } {
  // Story allies fight on the party's side, so they count toward the scaling.
  const friendlyCount = partySize + encounter.allies.length;
  // A variant swaps the authored roster; everything after it — under-strength
  // trimming, flag-gated additions, reinforcements — still layers on top, so
  // CLAUDE.md's "difficulty scales in two places and only those two" holds.
  const authored = variant?.enemies ?? encounter.enemies;
  const dropped = enemiesToDrop(encounter.baselinePartySize, friendlyCount);
  const enemies =
    dropped > 0 ? authored.slice(0, Math.max(1, authored.length - dropped)) : [...authored];

  for (const group of encounter.conditionalEnemies) {
    const isSet = Boolean(flags[group.flag]);
    if (isSet === group.whenSet) enemies.push(...group.placements);
  }

  const extra = Math.max(0, friendlyCount - encounter.baselinePartySize);
  enemies.push(...encounter.reinforcements.slice(0, extra));

  return { enemies, allies: [...encounter.allies] };
}

/**
 * The roster XP is calculated against: the authored enemies plus any
 * flag-gated additions that are actually present.
 *
 * Deliberately *not* the roster the table will face. Reinforcements exist to
 * keep a fight fair for a bigger group, not to pay it more, and a story ally
 * pulling in an extra body should not quietly hand the party a level over the
 * branch that skipped that fight. Every table earns the same, so every table
 * meets each encounter at the level it was tuned for.
 */
export function xpRoster(
  encounter: EncounterDef,
  flags: Readonly<Record<string, FlagValue>>,
): EncounterPlacement[] {
  const enemies = [...encounter.enemies];
  for (const group of encounter.conditionalEnemies) {
    if (Boolean(flags[group.flag]) === group.whenSet) enemies.push(...group.placements);
  }
  return enemies;
}

/**
 * Draws one of an encounter's roster variants.
 *
 * Eligible variants are filtered by condition, then drawn by weight from the
 * cursor `createBattle` was handed — so the choice is part of the same seeded
 * stream as everything else and a run stays perfectly reproducible. An encounter
 * with no variants, or none eligible, keeps its authored roster and returns null.
 *
 * The RNG is consumed *only* when there is a real choice to make, so adding a
 * variant to one encounter cannot shift the dice for every fight after it.
 */
export function pickVariant(
  encounter: EncounterDef,
  state: GameState,
  rng: RngCursor,
): EncounterVariant | null {
  const eligible = encounter.variants.filter(
    (v) => v.weight > 0 && (!v.when || evaluate(state, v.when)),
  );
  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0] ?? null;

  const total = eligible.reduce((sum, v) => sum + v.weight, 0);
  let roll = rng.float() * total;
  for (const variant of eligible) {
    roll -= variant.weight;
    if (roll < 0) return variant;
  }
  return eligible[eligible.length - 1] ?? null;
}

/**
 * Instantiates a map's authored props, baking each one's spatial flags into the
 * tile it stands on and journalling the tile it replaced.
 *
 * This is the same trick `BattleDraft.raiseWall` uses, and it is why props cost
 * almost nothing to integrate: movement, line of sight, cover and the AI's
 * positional scoring all read `Tile`, so a prop that writes itself into the tile
 * is visible to every one of them with no call site changed. Breaking it puts
 * `previous` back.
 */
function placeMapProps(
  content: ContentIndex,
  placements: readonly PropPlacement[],
  grid: Grid,
  state: GameState,
  startSerial: number,
): { grid: Grid; props: PropInstance[]; serial: number } {
  const props: PropInstance[] = [];
  const used = new Set<string>();
  let serial = startSerial;
  let current = grid;

  for (const placement of placements) {
    // A variant's extras are appended after the map's own, so a variant cannot
    // silently stack a second barrel on an existing one.
    const key = posKey(placement.pos);
    if (used.has(key)) continue;
    used.add(key);

    if (placement.when && !evaluate(state, placement.when)) continue;

    const def = content.props.get(placement.propId);
    const tile = tileAt(current, placement.pos);
    if (!def || !tile) continue;

    props.push({
      id: `prop${serial++}`,
      propId: placement.propId,
      pos: placement.pos,
      hp: def.hp,
      previous: tile,
    });

    if (def.blocksMove || def.blocksSight || def.grantsCover) {
      current = withTile(current, placement.pos, {
        ...tile,
        blocked: tile.blocked || def.blocksMove,
        blocksSight: tile.blocksSight || def.blocksSight,
        cover: tile.cover || def.grantsCover,
      });
    }
  }

  return { grid: current, props, serial };
}

export interface BattleOptions {
  /** Force a specific roster variant. The balance report pins one per run. */
  readonly variantId?: string;
  /**
   * Levels the opposition against this instead of the encounter's own
   * `expectedLevel`. Only the simulator passes it: comparing two disciplines
   * means running them above the level gate, and Act 1's fights are all tuned
   * for level 3 or below, so without this every path wins every time and the
   * comparison measures nothing. Real play never sets it — an encounter's
   * tuning is the encounter's business.
   */
  readonly enemyLevel?: number;
}

export function createBattle(
  content: ContentIndex,
  state: GameState,
  encounterId: string,
  rng: RngCursor,
  options: BattleOptions = {},
): BattleState {
  const encounter = content.encounters.get(encounterId);
  if (!encounter) throw new Error(`Unknown encounter "${encounterId}"`);
  const map = content.maps.get(encounter.mapId);
  if (!map) throw new Error(`Encounter "${encounterId}" uses unknown map "${encounter.mapId}"`);

  const variant = options.variantId
    ? (encounter.variants.find((v) => v.id === options.variantId) ?? null)
    : pickVariant(encounter, state, rng);

  const taken = new Set<string>();
  const units: Unit[] = [];
  let serial = 1;

  /*
   * Props go down before anybody stands anywhere.
   *
   * A blocking prop bakes itself into the tile, so placing it first is what makes
   * `placeAt` and every later pathing call see it without being told. It also
   * means a barrel can never end up underneath a party member — `validateContent`
   * rejects a prop on a spawn point, but reserving the cell here keeps the
   * enemy spiral honest too.
   */
  const placed = placeMapProps(
    content,
    [...map.props, ...(variant?.extraProps ?? [])],
    buildGrid(map),
    state,
    serial,
  );
  const grid = placed.grid;
  const props = placed.props;
  serial = placed.serial;
  for (const prop of props) taken.add(posKey(prop.pos));

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
      pendingAp: 0,
      cooldowns: {},
      statuses: [],
    });
  });

  const roster = encounterRoster(encounter, state.flags, state.party.length, variant);
  const level = options.enemyLevel ?? encounter.expectedLevel;
  const table = {
    baselinePartySize: encounter.baselinePartySize,
    partySize: state.party.length + encounter.allies.length,
  };

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
    variantId: variant?.id ?? null,
    mapId: encounter.mapId,
    grid,
    units,
    order,
    turnIndex: 0,
    round: 1,
    phase: 'active',
    temporaryWalls: [],
    props,
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
      pendingAp: 0,
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
    pendingAp: 0,
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
