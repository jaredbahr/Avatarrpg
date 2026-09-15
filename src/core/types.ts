/**
 * The vocabulary of the game.
 *
 * Everything in here is a plain data shape — no classes, no behaviour, nothing
 * that cannot be JSON round-tripped. That is what lets a save file be a literal
 * dump of `GameState` and lets the simulator run thousands of battles in Node.
 *
 * Content (`src/content/`) *implements* these shapes. The core only ever sees
 * them through a `ContentIndex` handed in at call time, which is why the rules
 * never import content directly.
 */

import type { RngState } from './rng';

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** The five playable paths. "nonbender" is a full element slot, not a fallback. */
export type ElementId = 'fire' | 'water' | 'earth' | 'air' | 'nonbender';

export const ELEMENT_IDS: readonly ElementId[] = ['fire', 'water', 'earth', 'air', 'nonbender'];

/**
 * What a hit is *made of*. Distinct from ElementId because lightning and cold
 * are bending sub-types that interact with surfaces differently from plain
 * fire and water, and because plain physical hits belong to no element.
 */
export type DamageType =
  'fire' | 'water' | 'earth' | 'air' | 'lightning' | 'cold' | 'physical' | 'pure';

export type Faction = 'party' | 'enemy' | 'ally';

/**
 * A playable path and the level-1 archetype it starts from. Lives in core
 * because `createGame` and `leveling` both need the base stats, and core may
 * not import content values — it reaches them through `ContentIndex.elements`.
 */
export interface ElementDef {
  readonly id: ElementId;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly playstyle: string;
  readonly base: UnitStats;
  /** CSS custom-property suffix: --c-fire, --c-water, ... */
  readonly palette: string;
}

/* ------------------------------------------------------------------ */
/* Terrain and surfaces                                                */
/* ------------------------------------------------------------------ */

export type TerrainId =
  'grass' | 'dirt' | 'road' | 'stone' | 'sand' | 'wood' | 'water_deep' | 'wall' | 'pit';

/** A surface sits *on top of* terrain. One per tile — the combo table decides
 *  what happens when a second one is applied. */
export type SurfaceId = 'water' | 'ice' | 'fire' | 'mud' | 'steam' | 'oil' | 'rubble';

export interface SurfaceInstance {
  readonly id: SurfaceId;
  /** Rounds remaining. -1 means permanent (map-authored water, for example). */
  readonly duration: number;
  /** Fire spreads outward once per round while this is above zero. */
  readonly spread: number;
}

export interface SurfaceDef {
  readonly id: SurfaceId;
  readonly name: string;
  readonly description: string;
  /** Extra move points to enter a tile carrying this surface. */
  readonly moveCost: number;
  /** Damage dealt on entering, and at the start of a turn spent standing in it. */
  readonly enterDamage: number;
  readonly enterDamageType: DamageType;
  /** Status forced on anything that enters or starts its turn here. */
  readonly enterStatus: StatusId | null;
  readonly enterStatusChance: number;
  readonly blocksSight: boolean;
  /** Gives the occupant cover against ranged attacks. */
  readonly grantsCover: boolean;
  readonly defaultDuration: number;
}

/* ------------------------------------------------------------------ */
/* Statuses                                                            */
/* ------------------------------------------------------------------ */

export type StatusId =
  | 'burning'
  | 'wet'
  | 'chilled'
  | 'frozen'
  | 'shocked'
  | 'stunned'
  | 'slowed'
  | 'blinded'
  | 'rooted'
  | 'chiBlocked'
  | 'guarded'
  | 'inspired';

export interface StatusInstance {
  readonly id: StatusId;
  /** Rounds remaining, ticked at the owner's turn start. */
  readonly duration: number;
  readonly stacks: number;
}

export interface StatusDef {
  readonly id: StatusId;
  readonly name: string;
  readonly description: string;
  readonly kind: 'buff' | 'debuff';
  readonly defaultDuration: number;
  readonly maxStacks: number;
  /** Damage at the owner's turn start (Burning). */
  readonly tickDamage: number;
  readonly tickDamageType: DamageType;
  /** The owner may not act at all this turn. */
  readonly skipsTurn: boolean;
  /** The owner may not move (but may still act). */
  readonly preventsMove: boolean;
  /** The owner may not use abilities (but may still move). */
  readonly preventsAbilities: boolean;
  readonly modifiers: StatusModifiers;
  /** Statuses removed when this one lands, e.g. Wet clears Burning. */
  readonly clears: readonly StatusId[];
  /** Applying this to a unit already carrying one of these upgrades instead. */
  readonly upgradeFrom: readonly StatusId[] | null;
}

export interface StatusModifiers {
  readonly power: number;
  readonly defense: number;
  readonly speed: number;
  readonly focus: number;
  readonly move: number;
  readonly ap: number;
  /** Additive percentage points on this unit's chance to hit. */
  readonly accuracy: number;
  /** Multiplier applied to incoming damage of a given type. */
  readonly incomingMultiplier: Partial<Record<DamageType, number>>;
}

/* ------------------------------------------------------------------ */
/* The grid                                                            */
/* ------------------------------------------------------------------ */

export interface Tile {
  readonly terrain: TerrainId;
  /** Elevation tier 0-2. Shooting down grants +10 accuracy, up costs 10. */
  readonly elevation: number;
  readonly blocked: boolean;
  readonly blocksSight: boolean;
  readonly cover: boolean;
  readonly surface: SurfaceInstance | null;
}

/** Row-major flat array. One index means one `undefined` check, not two. */
export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
}

/* ------------------------------------------------------------------ */
/* Units                                                               */
/* ------------------------------------------------------------------ */

export interface UnitStats {
  readonly maxHp: number;
  readonly maxAp: number;
  readonly maxMove: number;
  readonly power: number;
  readonly defense: number;
  readonly speed: number;
  readonly focus: number;
}

export type AiProfile = 'aggressive' | 'cautious' | 'support' | 'boss' | 'none';

export interface Unit {
  readonly id: string;
  readonly name: string;
  readonly faction: Faction;
  readonly element: ElementId;
  /** Set for party members; indexes `ContentIndex.characters`. */
  readonly characterId: string | null;
  /** Set for enemies and story allies; indexes `ContentIndex.enemies`. */
  readonly enemyId: string | null;
  /** The path taken at the discipline gate; null until then, and for enemies. */
  readonly disciplineId: string | null;

  readonly level: number;
  readonly xp: number;

  readonly pos: Vec2;
  /** 2 means the unit also occupies the tile to its right (the boss driller). */
  readonly size: 1 | 2;

  readonly hp: number;
  readonly ap: number;
  readonly move: number;
  /** Unused AP carried into the next turn: 1 per turn, capped at 6 total AP. */
  readonly bankedAp: number;

  readonly base: UnitStats;
  readonly abilities: readonly string[];
  readonly cooldowns: Readonly<Record<string, number>>;
  readonly statuses: readonly StatusInstance[];

  readonly ai: AiProfile;
  /** Story allies (Ruon) leave the party when the battle ends. */
  readonly temporary: boolean;
  /** Asset manifest key for the unit's painter. */
  readonly sprite: string;
}

/* ------------------------------------------------------------------ */
/* Abilities                                                           */
/* ------------------------------------------------------------------ */

export type Targeting =
  | { readonly shape: 'self' }
  | { readonly shape: 'unit'; readonly allow: 'enemy' | 'ally' | 'any' }
  | { readonly shape: 'tile' }
  | { readonly shape: 'blast'; readonly radius: number }
  | { readonly shape: 'line'; readonly length: number }
  | { readonly shape: 'cone'; readonly length: number };

export type AbilityEffect =
  | {
      readonly kind: 'damage';
      readonly base: number;
      readonly scale: number;
      readonly damageType: DamageType;
      readonly ignoreDefense?: boolean;
      /** Damage is dealt to the caster too (Dragon Breath has no such clause;
       *  this exists for oil-barrel style self-harm on enemies). */
      readonly includesCaster?: boolean;
    }
  | { readonly kind: 'heal'; readonly base: number; readonly scale: number }
  | {
      readonly kind: 'status';
      readonly status: StatusId;
      readonly duration: number;
      readonly chance: number;
      readonly to: 'hit' | 'self' | 'allies';
    }
  | {
      readonly kind: 'surface';
      readonly surface: SurfaceId;
      readonly duration: number;
      /** 'area' paints every affected tile; 'center' paints only the target. */
      readonly area: 'area' | 'center';
    }
  | { readonly kind: 'push'; readonly distance: number }
  | { readonly kind: 'pull'; readonly distance: number }
  | { readonly kind: 'dash' }
  | { readonly kind: 'wall'; readonly duration: number }
  | { readonly kind: 'cleanse'; readonly statuses: readonly StatusId[] }
  | { readonly kind: 'grantAp'; readonly amount: number; readonly to: 'self' | 'hit' }
  | { readonly kind: 'revealSurfaces' };

export type AbilityTag =
  'attack' | 'heal' | 'buff' | 'control' | 'surface' | 'mobility' | 'signature';

export interface Ability {
  readonly id: string;
  readonly name: string;
  readonly element: ElementId;
  readonly apCost: number;
  /** Rounds before it can be used again. 0 means every turn. */
  readonly cooldown: number;
  readonly range: number;
  readonly minRange: number;
  readonly requiresLineOfSight: boolean;
  readonly targeting: Targeting;
  readonly effects: readonly AbilityEffect[];
  readonly tags: readonly AbilityTag[];
  readonly description: string;
  /** One line of colour shown on the ability card. */
  readonly flavor: string;
  /** Asset manifest key for the ability's tile/impact painter. */
  readonly fx: string;
}

/* ------------------------------------------------------------------ */
/* Characters, enemies, encounters, maps                               */
/* ------------------------------------------------------------------ */

/**
 * One rung of a progression ladder.
 *
 *  - `ability`    handed over outright on arriving at the level.
 *  - `choose`     two techniques, one of which the player picks.
 *  - `specialize` the discipline gate: the player commits to one path, and
 *                 that path's own kit supplies every level from here on.
 *
 * A character kit and a discipline kit are both lists of these, which is what
 * lets `unlocksAtLevel` walk the two of them with one code path.
 */
export type KitEntry =
  | { readonly level: number; readonly ability: string }
  | { readonly level: number; readonly choose: readonly [string, string] }
  | { readonly level: number; readonly specialize: readonly string[] };

/**
 * A rare art a bender narrows into — metalbending, healing, lightning — or,
 * for a non-bender, a school of training. Deliberately *not* modelled as a
 * separate concept per element: a discipline is a discipline, so the core
 * never asks whether a unit bends.
 *
 * Rarity is expressed by `requiresFlag`, not by a roll. A story beat sets the
 * flag (you found someone who could teach it) and the path opens. Every
 * element must keep at least one discipline with `requiresFlag: null`, or a
 * party that skipped the optional content would arrive at the gate with
 * nothing to pick — `validateContent` enforces that.
 */
export interface DisciplineDef {
  readonly id: string;
  readonly name: string;
  readonly element: ElementId;
  /** One-line hook shown on the pick card. */
  readonly blurb: string;
  readonly description: string;
  readonly flavor: string;
  /** Story flag gating the pick. `null` means always offered. */
  readonly requiresFlag: string | null;
  /** Shown on a locked card so the path advertises how to earn it. */
  readonly lockedHint: string;
  /** Applied on top of the character's own mods once the path is taken. */
  readonly statMods: Partial<UnitStats>;
  readonly kit: readonly KitEntry[];
  /** Asset manifest key, `fx.<element>.<name>`. */
  readonly icon: string;
}

export interface CharacterDef {
  readonly id: string;
  readonly name: string;
  readonly element: ElementId;
  /** One-line hook shown on the pick card. */
  readonly blurb: string;
  /** Two lines of backstory shown once the card is selected. */
  readonly bio: string;
  readonly statMods: Partial<UnitStats>;
  readonly kit: readonly KitEntry[];
  readonly portrait: string;
  readonly sprite: string;
}

export interface EnemyDef {
  readonly id: string;
  readonly name: string;
  readonly element: ElementId;
  readonly size: 1 | 2;
  readonly stats: UnitStats;
  readonly abilities: readonly string[];
  readonly ai: AiProfile;
  readonly xp: number;
  readonly sprite: string;
  readonly description: string;
}

export interface EncounterPlacement {
  readonly enemyId: string;
  readonly pos: Vec2;
  readonly level?: number;
  readonly nameSuffix?: string;
}

export interface EncounterDef {
  readonly id: string;
  readonly name: string;
  readonly mapId: string;
  readonly enemies: readonly EncounterPlacement[];
  /** Story allies that fight alongside the party for this battle only. */
  readonly allies: readonly EncounterPlacement[];
  /** Enemies added only when a flag is set (Jin's mercenaries at the boss). */
  readonly conditionalEnemies: readonly {
    readonly flag: string;
    readonly whenSet: boolean;
    readonly placements: readonly EncounterPlacement[];
  }[];
  /**
   * Party size the authored roster is tuned for. Anything above this adds one
   * reinforcement per extra member — six players against three bandits is not
   * a fight, it is a queue.
   */
  readonly baselinePartySize: number;
  /** Consumed in order, one per party member above `baselinePartySize`. */
  readonly reinforcements: readonly EncounterPlacement[];
  readonly expectedLevel: number;
  readonly intro: string;
  /** Shown under the objective banner — a hint aimed at an 8-year-old. */
  readonly tip: string;
}

export interface TileTemplate {
  readonly terrain: TerrainId;
  readonly elevation?: number;
  readonly blocked?: boolean;
  readonly blocksSight?: boolean;
  readonly cover?: boolean;
  readonly surface?: SurfaceId;
  readonly surfaceDuration?: number;
}

export interface NpcDef {
  readonly id: string;
  readonly name: string;
  readonly pos: Vec2;
  readonly sprite: string;
  /** Story node entered when the NPC is tapped. */
  readonly node: string;
  /** Alternate node once this flag is set (the cold shopkeeper). */
  readonly altFlag?: string;
  readonly altNode?: string;
}

export interface MapDef {
  readonly id: string;
  readonly name: string;
  readonly kind: 'combat' | 'explore';
  readonly width: number;
  readonly height: number;
  /** One character per tile; keys index `legend`. */
  readonly rows: readonly string[];
  readonly legend: Readonly<Record<string, TileTemplate>>;
  readonly partySpawns: readonly Vec2[];
  readonly npcs: readonly NpcDef[];
  readonly ambience: string;
  /** Explore maps only: stepping here advances the current story node. */
  readonly exit?: { readonly pos: Vec2; readonly label: string };
}

/* ------------------------------------------------------------------ */
/* Surface combos                                                      */
/* ------------------------------------------------------------------ */

export interface ComboRule {
  readonly id: string;
  /** The surface already on the tile, or null for bare ground. */
  readonly existing: SurfaceId | null;
  /** The damage type or surface being applied. */
  readonly applied: DamageType | SurfaceId;
  /** What the tile becomes. null clears the surface. */
  readonly result: SurfaceId | null;
  readonly duration: number;
  /** Rounds of outward spread granted to the result (fire on oil). */
  readonly spread: number;
  /** Status forced on whatever stands on the tile when the combo fires. */
  readonly status: StatusId | null;
  readonly statusChance: number;
  /**
   * Chains the status to every unit standing on a connected run of the
   * existing surface — lightning into a puddle hits the whole puddle.
   */
  readonly chainThroughExisting: boolean;
  readonly chainDamage: number;
  readonly label: string;
}

/* ------------------------------------------------------------------ */
/* Story                                                               */
/* ------------------------------------------------------------------ */

export type FlagValue = boolean | number | string;

export interface StoryOption {
  readonly label: string;
  readonly detail: string;
  readonly next: string;
  readonly setFlags?: Readonly<Record<string, FlagValue>>;
}

export type StoryNode =
  | {
      readonly id: string;
      readonly kind: 'dialogue';
      readonly speaker: string;
      readonly portrait: string;
      readonly lines: readonly string[];
      readonly next: string;
    }
  | {
      readonly id: string;
      readonly kind: 'choice';
      readonly speaker: string;
      readonly portrait: string;
      readonly prompt: string;
      readonly options: readonly StoryOption[];
    }
  | {
      readonly id: string;
      readonly kind: 'battle';
      readonly encounterId: string;
      readonly next: string;
      readonly onDefeat: string;
    }
  | {
      readonly id: string;
      readonly kind: 'explore';
      readonly mapId: string;
      readonly objective: string;
      /** Entered when the player reaches the map's exit marker. */
      readonly next: string;
    }
  | {
      readonly id: string;
      readonly kind: 'flags';
      readonly set: Readonly<Record<string, FlagValue>>;
      /**
       * XP granted to every party member, for story beats that are worth
       * something without a fight — Jin paying for Ruon, say. Keeps branches
       * that skip an encounter from arriving a level behind.
       */
      readonly grantXp?: number;
      readonly next: string;
    }
  | {
      readonly id: string;
      readonly kind: 'branch';
      readonly flag: string;
      readonly ifSet: string;
      readonly ifUnset: string;
    }
  | {
      readonly id: string;
      readonly kind: 'end';
      readonly title: string;
      readonly lines: readonly string[];
      readonly teaser: string;
    };

export interface StoryState {
  readonly nodeId: string | null;
  /** Index into the app's player list; rotated after every choice. */
  readonly deciderIndex: number;
  readonly visited: readonly string[];
  /** Cursor into a dialogue node's lines. */
  readonly lineIndex: number;
}

/* ------------------------------------------------------------------ */
/* Game state                                                          */
/* ------------------------------------------------------------------ */

export type BattlePhase = 'active' | 'victory' | 'defeat';

/**
 * A tile an Earth Wall (or similar) is holding open. The tile is swapped for a
 * blocking one and restored when the round arrives. Kept on BattleState rather
 * than on Tile so a Tile stays a flat value.
 */
export interface TemporaryWall {
  readonly pos: Vec2;
  readonly untilRound: number;
  readonly previous: Tile;
}

export interface BattleState {
  readonly encounterId: string;
  readonly mapId: string;
  readonly grid: Grid;
  readonly units: readonly Unit[];
  /** Unit ids in initiative order; dead units stay listed but are skipped. */
  readonly order: readonly string[];
  readonly turnIndex: number;
  readonly round: number;
  readonly phase: BattlePhase;
  readonly temporaryWalls: readonly TemporaryWall[];
  /** Incremented for every unit created, so ids never collide across a battle. */
  readonly nextUnitSerial: number;
}

/**
 * A level-up waiting on a player.
 *
 * `kind: 'ability'` offers two techniques; `kind: 'discipline'` offers the
 * paths at the specialization gate. A discipline choice lists *every* path its
 * element has, locked ones included — the dialog shows those greyed out with
 * their hint, so a table can see what is out there and go looking for it. The
 * reducer re-checks `requiresFlag` when the pick comes back, so listing a
 * locked option here never makes it selectable.
 */
export interface PendingChoice {
  readonly unitId: string;
  readonly level: number;
  readonly kind: 'ability' | 'discipline';
  readonly options: readonly string[];
}

export type Screen = 'title' | 'setup' | 'explore' | 'dialogue' | 'combat' | 'ended';

export interface GameState {
  /** Bumped when the save shape changes; `core/save` migrates on load. */
  readonly version: number;
  readonly seed: number;
  readonly rng: RngState;
  readonly screen: Screen;
  /** The canonical party. HP and XP persist between battles. */
  readonly party: readonly Unit[];
  readonly battle: BattleState | null;
  readonly story: StoryState;
  readonly flags: Readonly<Record<string, FlagValue>>;
  readonly pendingChoices: readonly PendingChoice[];
  readonly location: { readonly mapId: string; readonly pos: Vec2 };
  /** Human-readable combat log, newest last. Capped by the reducer. */
  readonly log: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Commands and events                                                 */
/* ------------------------------------------------------------------ */

export type Command =
  | { readonly type: 'enterNode'; readonly nodeId: string }
  | { readonly type: 'advanceDialogue' }
  | { readonly type: 'chooseOption'; readonly optionIndex: number }
  | { readonly type: 'walkTo'; readonly pos: Vec2 }
  | { readonly type: 'startBattle'; readonly encounterId: string }
  | { readonly type: 'move'; readonly unitId: string; readonly path: readonly Vec2[] }
  | {
      readonly type: 'useAbility';
      readonly unitId: string;
      readonly abilityId: string;
      readonly target: Vec2;
    }
  | { readonly type: 'endTurn'; readonly unitId: string }
  | { readonly type: 'runAiTurn' }
  | { readonly type: 'resolveBattle' }
  | { readonly type: 'chooseLevelUp'; readonly unitId: string; readonly abilityId: string }
  | { readonly type: 'chooseDiscipline'; readonly unitId: string; readonly disciplineId: string }
  | { readonly type: 'setFlags'; readonly flags: Readonly<Record<string, FlagValue>> };

export type GameEvent =
  | { readonly type: 'message'; readonly text: string }
  | { readonly type: 'storyNodeEntered'; readonly nodeId: string }
  | { readonly type: 'dialogueAdvanced'; readonly lineIndex: number }
  | { readonly type: 'flagSet'; readonly key: string; readonly value: FlagValue }
  | { readonly type: 'battleStarted'; readonly encounterId: string }
  | { readonly type: 'roundStarted'; readonly round: number }
  | { readonly type: 'turnStarted'; readonly unitId: string; readonly round: number }
  | { readonly type: 'turnEnded'; readonly unitId: string }
  | {
      readonly type: 'unitMoved';
      readonly unitId: string;
      readonly path: readonly Vec2[];
      readonly cost: number;
    }
  | {
      readonly type: 'abilityUsed';
      readonly unitId: string;
      readonly abilityId: string;
      readonly target: Vec2;
      readonly tiles: readonly Vec2[];
    }
  | { readonly type: 'attackMissed'; readonly unitId: string; readonly targetId: string }
  | {
      readonly type: 'damaged';
      readonly unitId: string;
      readonly amount: number;
      readonly crit: boolean;
      readonly damageType: DamageType;
      readonly sourceId: string | null;
    }
  | { readonly type: 'healed'; readonly unitId: string; readonly amount: number }
  | {
      readonly type: 'statusApplied';
      readonly unitId: string;
      readonly status: StatusId;
      readonly duration: number;
    }
  | { readonly type: 'statusExpired'; readonly unitId: string; readonly status: StatusId }
  | {
      readonly type: 'surfaceChanged';
      readonly pos: Vec2;
      readonly from: SurfaceId | null;
      readonly to: SurfaceId | null;
      readonly label: string;
    }
  | { readonly type: 'unitPushed'; readonly unitId: string; readonly to: Vec2 }
  | { readonly type: 'unitDied'; readonly unitId: string }
  | { readonly type: 'xpGained'; readonly unitId: string; readonly amount: number }
  | {
      readonly type: 'leveledUp';
      readonly unitId: string;
      readonly level: number;
      readonly unlocked: readonly string[];
    }
  | {
      readonly type: 'levelChoiceOffered';
      readonly unitId: string;
      readonly options: readonly string[];
    }
  | {
      readonly type: 'disciplineOffered';
      readonly unitId: string;
      readonly options: readonly string[];
    }
  | {
      readonly type: 'disciplineChosen';
      readonly unitId: string;
      readonly disciplineId: string;
      readonly unlocked: readonly string[];
    }
  | { readonly type: 'battleEnded'; readonly outcome: 'victory' | 'defeat' }
  | { readonly type: 'screenChanged'; readonly screen: Screen };

/** Every reducer step returns the next state plus what the UI should play. */
export interface StepResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/* ------------------------------------------------------------------ */
/* Content access                                                      */
/* ------------------------------------------------------------------ */

/**
 * The only way core code reaches content. Built once in `src/content/index.ts`
 * and threaded through every rules call, which keeps `src/core` importable
 * from a test that supplies its own tiny fixture content instead.
 */
export interface ContentIndex {
  readonly elements: ReadonlyMap<ElementId, ElementDef>;
  readonly abilities: ReadonlyMap<string, Ability>;
  readonly characters: ReadonlyMap<string, CharacterDef>;
  readonly disciplines: ReadonlyMap<string, DisciplineDef>;
  readonly enemies: ReadonlyMap<string, EnemyDef>;
  readonly maps: ReadonlyMap<string, MapDef>;
  readonly encounters: ReadonlyMap<string, EncounterDef>;
  readonly statuses: ReadonlyMap<StatusId, StatusDef>;
  readonly surfaces: ReadonlyMap<SurfaceId, SurfaceDef>;
  readonly combos: readonly ComboRule[];
  readonly story: ReadonlyMap<string, StoryNode>;
}
