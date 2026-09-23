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
  /** Off-turn support bonus, consumed at the next activation (including a skip). */
  readonly pendingAp: number;

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

/**
 * An alternative roster for an encounter.
 *
 * The point is that the fight you remember is not quite the fight you get: three
 * slingers play nothing like two bruisers, even though both cost the same. The
 * seed picks between eligible variants, so a run is still perfectly
 * reproducible — what changes between runs is which one the seed drew, and what
 * changes between *playthroughs* is mostly what you did, which is where the
 * replay value is meant to come from.
 *
 * `validateContent` enforces that every variant costs within 10% of the base
 * roster in summed enemy XP. That is not bookkeeping: XP is the designer's own
 * declared danger number, and because `xpRoster` always scores the base roster
 * whatever spawned, budget-matched variants are XP-identical *by construction* —
 * so the level-on-arrival guarantee in progression.test.ts is untouched.
 */
export interface EncounterVariant {
  readonly id: string;
  /** Relative weight in the seeded draw among eligible variants. */
  readonly weight: number;
  /** Only eligible when this passes. Absent means always eligible. */
  readonly when?: Condition;
  /** Replaces the authored roster. Omit to keep it and only change the trimmings. */
  readonly enemies?: readonly EncounterPlacement[];
  /** Props added on top of the map's own, for this variant only. */
  readonly extraProps?: readonly PropPlacement[];
  readonly intro?: string;
  readonly tip?: string;
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
  /** Alternative rosters, drawn by seed. Empty means this fight is always the same. */
  readonly variants: readonly EncounterVariant[];
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

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

/**
 * What a prop does when it breaks.
 *
 * Deliberately a *separate* union from `AbilityEffect`. A prop is not a caster —
 * it has no power stat to scale from, no accuracy, and nothing to aim — so the
 * shapes that make sense here are the ones with a blast radius and a flat number.
 */
export type PropEffect =
  | {
      readonly kind: 'surface';
      readonly surface: SurfaceId;
      readonly duration: number;
      /** 0 paints the prop's own tile only. */
      readonly radius: number;
    }
  | {
      readonly kind: 'damage';
      readonly base: number;
      readonly damageType: DamageType;
      readonly radius: number;
    }
  | {
      readonly kind: 'status';
      readonly status: StatusId;
      readonly duration: number;
      readonly chance: number;
      readonly radius: number;
    }
  | { readonly kind: 'push'; readonly distance: number; readonly radius: number };

/**
 * Something on the battlefield you can shove, break, or set on fire.
 *
 * Props are the delivery mechanism for the reaction table in
 * `src/content/combos.ts` — the chemistry was already written, it just had
 * nothing to react to. A water barrel is one `surface` effect; the Wet status,
 * the freezing, and the lightning chaining through the puddle all follow from
 * rules that already existed.
 */
export interface PropDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly sprite: string;
  readonly hp: number;
  /** Solid enough to stand behind. Baked into the tile while the prop lives. */
  readonly blocksMove: boolean;
  readonly blocksSight: boolean;
  readonly grantsCover: boolean;
  readonly pushable: boolean;
  /** Takes double damage from these — an oil flask is not fireproof. */
  readonly vulnerableTo: readonly DamageType[];
  /** Takes none from these — a stone block does not care about fire. */
  readonly immuneTo: readonly DamageType[];
  readonly onBreak: readonly PropEffect[];
  /** Plain words for the combat log, exactly like a combo rule's label. */
  readonly breakLabel: string;
}

/** A prop authored onto a map, optionally only on some routes. */
export interface PropPlacement {
  readonly propId: string;
  readonly pos: Vec2;
  readonly when?: Condition;
}

/**
 * A live prop.
 *
 * `previous` is a restore journal, exactly as `TemporaryWall` uses it: a prop
 * that blocks bakes its flags into the `Tile` when it is placed, so every
 * existing consumer of blocking, sight and cover keeps working untouched, and
 * breaking it puts the original tile back.
 */
export interface PropInstance {
  readonly id: string;
  readonly propId: string;
  readonly pos: Vec2;
  readonly hp: number;
  readonly previous: Tile;
}

export interface NpcDef {
  readonly id: string;
  readonly name: string;
  readonly pos: Vec2;
  readonly sprite: string;
  /** Optional map guidance semantic for a non-person route marker. */
  readonly interaction?: 'route-sign';
  /** Optional story condition for maps that reveal a person or landmark later. */
  readonly when?: Condition;
  /** Story node entered when the NPC is tapped, if no route matches. */
  readonly node: string;
  /**
   * Conditional conversations, first match wins.
   *
   * This replaces the single `altFlag`/`altNode` pair, which could only ever
   * express one binary swap. An NPC who greets a waterbender differently from a
   * firebender, and differently again once you have spared somebody, needs more
   * than one alternative.
   */
  readonly routes?: readonly { readonly when: Condition; readonly node: string }[];
  /**
   * The resident (ADR 0047 §2) this NpcDef speaks for. A bound NpcDef is
   * present only where its resident's placement puts it; `pos` becomes
   * optional for bound NpcDefs in W4b, when every reader switches to the
   * resolved anchor tile.
   */
  readonly resident?: string;
}

/* ------------------------------------------------------------------ */
/* Residents (ADR 0047 §2)                                             */
/* ------------------------------------------------------------------ */

/** A place a resident can be. Codes are narrative ('bd02.shopfront'), never tiles. */
export interface WorldAnchor {
  readonly id: string;
  /** Narrative place code, 'BD02'. */
  readonly place: string;
  readonly site:
    | {
        readonly kind: 'map';
        readonly mapId: string;
        readonly pos: Vec2;
        /** A claim shared by several anchors: only one placement may hold it. */
        readonly reserve?: string;
      }
    | { readonly kind: 'private'; readonly door: { readonly mapId: string; readonly pos: Vec2 } };
}

export interface ResidentSlot {
  readonly anchor: string;
  /** Pose/prop/bark key for presentation; never evaluated. */
  readonly activity: string;
  /** First match replaces `activity`. */
  readonly variants?: readonly { readonly when: Condition; readonly activity: string }[];
  /** NpcDef on the anchor's map that owns conversation here. */
  readonly npc?: string;
  /** `npc` set means not 'observe'. */
  readonly interrupt: 'talk' | 'finish-then-talk' | 'observe';
  readonly service?: 'gate_watch';
  /** Waypoints for the walk into this slot. */
  readonly via?: readonly Vec2[];
  /** Presentation-only wander points, at most 2 tiles from the anchor. */
  readonly loop?: readonly Vec2[];
}

/** Override tiers in precedence order; the resolver ranks them 1-5 (§2). */
export const RESIDENT_TIERS = ['mission', 'hazard', 'presence', 'care', 'appointment'] as const;

export type ResidentTier = (typeof RESIDENT_TIERS)[number];

export type ResidentSlotValue = ResidentSlot | 'home' | 'absent';

export interface ResidentOverride {
  readonly id: string;
  readonly tier: ResidentTier;
  readonly when: Condition;
  /** Per-phase slots; a missing phase uses `all`, and with no `all` the override skips it. */
  readonly slots: Partial<Readonly<Record<DayPhase, ResidentSlotValue>>>;
  readonly all?: ResidentSlotValue;
}

export interface ResidentDef {
  /** Design key, 'lw.npc.gao'. */
  readonly id: string;
  readonly name: string;
  readonly source: { readonly established?: string; readonly runtimeNpcIds: readonly string[] };
  /** A private anchor. */
  readonly home: string;
  /** Public; must have `npc` and interrupt 'talk'. */
  readonly fallback: ResidentSlot;
  readonly schedule: Readonly<Record<DayPhase, ResidentSlot | 'home'>>;
  readonly overrides?: readonly ResidentOverride[];
}

/** Unnamed background people: never in the identity register, never interactive. */
export interface BackgroundRole {
  readonly id: string;
  readonly label: string;
  readonly sprite: string;
  /** Interrupt 'observe'. */
  readonly slots: Partial<Readonly<Record<DayPhase, ResidentSlot>>>;
  /** Present when `resident` resolved to one of `anchors`. */
  readonly accompanies?: {
    readonly resident: string;
    readonly anchors: readonly string[];
    readonly slot: ResidentSlot;
  };
}

export interface MapExit {
  readonly pos: Vec2;
  readonly toMapId: string;
  readonly toPos: Vec2;
  readonly label: string;
  readonly requires?: Condition;
  readonly lockedHint?: string;
}

export interface MapTrigger {
  readonly id: string;
  readonly area: readonly Vec2[];
  readonly label: string;
  readonly sprite: string;
  readonly node: string;
  readonly when?: Condition;
  readonly once: boolean;
}

export interface MapDef {
  /** Draw-time projection; rule coordinates and saves stay on the logical grid. */
  readonly projection?: 'oblique';
  readonly scene?: MapScene;
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
  /** Barrels, flasks, carts. Instantiated into `BattleState.props` per battle. */
  readonly props: readonly PropPlacement[];
  readonly ambience: string;
  /** Map-owned routes and walk-over events; independent of the story cursor. */
  readonly exits?: readonly MapExit[];
  readonly triggers?: readonly MapTrigger[];
  /** Where `wait` is allowed (ADR 0047 §1, D8): the leader must be within one tile of one of these. */
  readonly restSpots?: readonly { readonly pos: Vec2; readonly label: string }[];
  readonly objective?: string;
  /** First matching objective wins; the plain objective is the fallback. */
  readonly objectiveVariants?: readonly { readonly when: Condition; readonly text: string }[];
  /** Explore maps only: stepping here advances the current story node. */
  readonly exit?: { readonly pos: Vec2; readonly label: string };
  /**
   * A painting drawn under the rules grid in place of the procedural ground,
   * once one exists for the map (ADR 0009). Presentation only, like
   * `ambience`: nothing in the rules reads it.
   */
  readonly backdrop?: MapBackdrop;
}

/**
 * A map painting: a site-relative URL and how many of its pixels span one
 * tile, so the image is `width * pixelsPerTile` by `height * pixelsPerTile`.
 */
export interface MapBackdrop {
  readonly url: string;
  readonly pixelsPerTile: number;
  /** Tagged oblique paintings are already projected, including upright scenery. */
  readonly projection?: 'oblique';
  readonly padding?: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
}

/** Calibrated projected pixel rectangles: upright art is never ground-skewed. */
export interface SceneImage {
  readonly url: string;
  /** Optional atlas crop in source-image pixels; excludes packing gutters. */
  readonly sourceRect?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneScenery extends SceneImage {
  readonly id: string;
  readonly footprint: readonly Vec2[];
  readonly depth: Vec2;
  /** True for decorative rim pieces whose logical footprint sits outside the map. */
  readonly exterior?: boolean;
  /**
   * When set, render only while every footprint tile is an authored wall in
   * the loaded battle grid. This keeps newer scenery out of older saves.
   */
  readonly wall?: boolean;
  readonly fadeWhenOccluding?: boolean;
  /** Connected depth slices share the lowest cutaway opacity within this scene. */
  readonly fadeGroup?: string;
}

export interface MapScene {
  /** Ground art includes the permanent water cells and their banks. Dynamic surfaces still draw. */
  readonly paintedWater?: boolean;
  /** Partial ground art does not claim coverage of any permanent surface. */
  readonly groundMode?: 'partial';
  /** Exact cells whose permanent rubble is already represented by registered art. */
  readonly paintedRubble?: readonly Vec2[];
  readonly ground: readonly SceneImage[];
  readonly scenery: readonly SceneScenery[];
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

/**
 * A serialisable predicate over the current game.
 *
 * Content asks questions — "does the party have a firebender?", "has the Fire
 * Nation forgiven us yet?" — and this is the only vocabulary it may ask them in.
 * Plain data, no functions, so a condition round-trips through a save, validates
 * with zod, and can be *described* back to the player in words. That last part
 * is not a nicety: a greyed-out dialogue option that does not say why it is
 * greyed out is just a locked door to an eight-year-old.
 *
 * Evaluated by `src/core/story/conditions.ts`.
 */
export type Condition =
  /**
   * `set`/`unset` are deliberately truthiness, matching every flag reader that
   * came before them (`branch` nodes, `conditionalEnemies`). That makes them the
   * wrong tool for a number: a standing of 0 is falsy. Use `eq`/`gte`/`lte`, or
   * the `standing` kind, for anything numeric.
   */
  | {
      readonly kind: 'flag';
      readonly key: string;
      readonly op: 'set' | 'unset' | 'eq' | 'gte' | 'lte';
      readonly value?: FlagValue;
    }
  /** At least `min` (default 1) living party members matching the filter. */
  | {
      readonly kind: 'partyHas';
      readonly element?: ElementId;
      readonly characterId?: string;
      readonly min?: number;
    }
  /** How a nation currently feels about the party. Neutral is 0. */
  | {
      readonly kind: 'standing';
      readonly nation: ElementId;
      readonly op: 'gte' | 'lte';
      readonly value: number;
    }
  | { readonly kind: 'visited'; readonly nodeId: string }
  | { readonly kind: 'partySize'; readonly op: 'gte' | 'lte'; readonly value: number }
  | { readonly kind: 'all'; readonly of: readonly Condition[] }
  | { readonly kind: 'any'; readonly of: readonly Condition[] }
  | { readonly kind: 'not'; readonly of: Condition }
  | { readonly kind: 'phase'; readonly in: readonly DayPhase[] };

export interface StoryOption {
  readonly label: string;
  readonly detail: string;
  readonly next: string;
  readonly setFlags?: Readonly<Record<string, FlagValue>>;
  /** Unavailable until this passes. An absent condition is always available. */
  readonly requires?: Condition;
  /**
   * Who in the party would say this.
   *
   * The UI resolves it against the real party and tags the option with their
   * name, so choosing a fire-tagged line *is* choosing who walks up — the
   * Speaker Choice needs no separate step. Purely presentational: gating is
   * `requires`, and an option that only a firebender could say should say so in
   * both places.
   */
  readonly speaker?: { readonly element?: ElementId; readonly characterId?: string };
  /**
   * Why this option is unavailable, in the author's own words.
   *
   * Every option is shown whether or not it can be taken, because seeing what
   * you are missing is what makes a second playthrough interesting — but a
   * greyed-out line with no reason is just a locked door. `describe()` generates
   * a fallback; this is the better sentence.
   */
  readonly lockedHint?: string;
  /** Signed nation-standing deltas applied when this option is taken. */
  readonly adjust?: Partial<Record<ElementId, number>>;
}

/**
 * An alternative reading of a dialogue node, chosen by the first matching
 * condition.
 *
 * A fallback chain rather than a matrix, because five elements times ten
 * characters times a growing pile of flags is not writable by hand. Authors
 * write the line once and add a variant only where somebody would genuinely say
 * something different.
 */
export interface DialogueVariant {
  readonly when: Condition;
  readonly speaker?: string;
  readonly portrait?: string;
  readonly lines: readonly string[];
}

export type StoryNode =
  | {
      readonly id: string;
      readonly kind: 'dialogue';
      readonly speaker: string;
      readonly portrait: string;
      readonly lines: readonly string[];
      readonly next: string;
      /** First match wins; falls back to `lines` when none do. */
      readonly variants?: readonly DialogueVariant[];
    }
  | {
      readonly id: string;
      readonly kind: 'choice';
      readonly speaker: string;
      readonly portrait: string;
      readonly prompt: string;
      readonly options: readonly StoryOption[];
      readonly variants?: readonly DialogueVariant[];
      /** Line under the options. Act-specific colour, so it lives in the data. */
      readonly footer?: string;
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
      /** Optional structured target for objective-aware map guidance. */
      readonly objectiveNpcId?: string;
      /** First matching objective text/target wins after the node is revisited. */
      readonly objectiveVariants?: readonly {
        readonly when: Condition;
        readonly text: string;
        readonly objectiveNpcId?: string | null;
      }[];
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
      /** Advance to the next occurrence of this phase; a no-op if already there (ADR 0047 §1). */
      readonly phase?: DayPhase;
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
      /** Explore node offered after this chapter's summary; absent for a terminal ending. */
      readonly next?: string;
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
  /** Which roster variant the seed drew, or null for the authored one. */
  readonly variantId: string | null;
  readonly mapId: string;
  readonly grid: Grid;
  readonly units: readonly Unit[];
  /** Unit ids in initiative order; dead units stay listed but are skipped. */
  readonly order: readonly string[];
  readonly turnIndex: number;
  readonly round: number;
  readonly phase: BattlePhase;
  readonly temporaryWalls: readonly TemporaryWall[];
  readonly props: readonly PropInstance[];
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

/**
 * The one list of phases, in clock order. `clock.ts`'s `PHASE_ORDER`, the
 * `serialize.ts`/`schemas.ts` zod enums, and the `DayPhase` type itself all
 * derive from this rather than repeating the six names.
 */
export const DAY_PHASES = ['dawn', 'morning', 'midday', 'afternoon', 'evening', 'night'] as const;

export type DayPhase = (typeof DAY_PHASES)[number];

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
  readonly world: {
    readonly returnPos: Readonly<Record<string, Vec2>>;
    readonly fired: readonly string[];
    readonly cleared: readonly string[];
    /** One clock for the whole world (ADR 0047 §1). */
    readonly clock: { readonly day: number; readonly phase: DayPhase };
    /** The conversation pin (ADR 0047 §4); null when nobody is pinned. */
    readonly talk: {
      readonly npcId: string;
      readonly mapId: string;
      readonly anchor: string;
    } | null;
  };
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
  | { readonly type: 'setFlags'; readonly flags: Readonly<Record<string, FlagValue>> }
  | { readonly type: 'wait'; readonly until: DayPhase };

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
      /**
       * The party crossed tiles on an explore map: the leader's id, the tile
       * it stood on and the route it walked, so the walk can be seen rather
       * than the party appearing at the far end. Nothing in the rules reads it.
       */
      readonly type: 'partyWalked';
      readonly unitId: string;
      readonly from: Vec2;
      readonly path: readonly Vec2[];
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
  | {
      readonly type: 'propDamaged';
      readonly propId: string;
      readonly name: string;
      readonly amount: number;
      readonly pos: Vec2;
    }
  | {
      readonly type: 'propDestroyed';
      readonly propId: string;
      readonly pos: Vec2;
      /** The prop's own plain-words line, printed straight into the log. */
      readonly label: string;
    }
  | { readonly type: 'propPushed'; readonly propId: string; readonly to: Vec2 }
  | {
      readonly type: 'standingChanged';
      readonly nation: ElementId;
      readonly value: number;
      readonly delta: number;
    }
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
  | { readonly type: 'screenChanged'; readonly screen: Screen }
  | {
      readonly type: 'phaseChanged';
      readonly from: DayPhase;
      readonly to: DayPhase;
      readonly day: number;
    };

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
  readonly props: ReadonlyMap<string, PropDef>;
  readonly combos: readonly ComboRule[];
  readonly story: ReadonlyMap<string, StoryNode>;
  /** Living-world records (ADR 0047 §2). Map order is declaration order, which ranks ties. */
  readonly anchors: ReadonlyMap<string, WorldAnchor>;
  readonly residents: ReadonlyMap<string, ResidentDef>;
  readonly backgroundRoles: ReadonlyMap<string, BackgroundRole>;
  /**
   * Abilities every party member has without spending a kit slot on them — the
   * Shove that lets anybody push a barrel. Reached through the index because
   * core may not import content values.
   */
  readonly universalAbilities: readonly string[];
}
