/**
 * Runtime validation for every piece of content.
 *
 * Two layers, and both matter:
 *
 *  1. **Shape** — zod schemas below. Catches a malformed ability, a negative
 *     stat, a map row of the wrong length.
 *  2. **Cross-references** — `validateContent()`. Catches the bugs that shape
 *     checking cannot see: a kit pointing at an ability that does not exist, an
 *     enemy spawned inside a wall, and above all a story node whose `next`
 *     leads nowhere.
 *
 * The second one is the reason this file exists. A dangling story link does not
 * crash; it strands a family halfway through a session on a Saturday. CI runs
 * `validateContent()` as a test, so that failure happens on a push instead.
 */

import { z } from 'zod';
import { CLIP_FRAME_COUNTS, CLIP_NAMES, REQUIRED_CLIPS } from './assets/clips';
import type { AssetEntry } from './assets/manifest';
import { STANDING_PREFIX } from '../core/story/conditions';
import type {
  Ability,
  CharacterDef,
  ComboRule,
  Condition,
  DisciplineDef,
  EncounterDef,
  EnemyDef,
  MapDef,
  PropDef,
  StatusDef,
  StoryNode,
  SurfaceDef,
} from '../core/types';

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

const elementId = z.enum(['fire', 'water', 'earth', 'air', 'nonbender']);
const damageType = z.enum([
  'fire',
  'water',
  'earth',
  'air',
  'lightning',
  'cold',
  'physical',
  'pure',
]);
const surfaceId = z.enum(['water', 'ice', 'fire', 'mud', 'steam', 'oil', 'rubble']);
const statusId = z.enum([
  'burning',
  'wet',
  'chilled',
  'frozen',
  'shocked',
  'stunned',
  'slowed',
  'blinded',
  'rooted',
  'chiBlocked',
  'guarded',
  'inspired',
]);
const terrainId = z.enum([
  'grass',
  'dirt',
  'road',
  'stone',
  'sand',
  'wood',
  'water_deep',
  'wall',
  'pit',
]);

const vec2 = z.object({ x: z.number().int().min(0), y: z.number().int().min(0) });
const id = z.string().min(1).max(64);

const unitStats = z.object({
  maxHp: z.number().int().positive(),
  maxAp: z.number().int().min(1).max(8),
  maxMove: z.number().int().min(0).max(12),
  power: z.number().int().min(0),
  defense: z.number().int().min(0),
  speed: z.number().int().min(1),
  focus: z.number().int().min(0).max(100),
});

/**
 * Character `statMods` are signed *deltas* against the element archetype, so
 * -2 HP is legal where an absolute stat of -2 would not be. Bounds are kept
 * tight so a nudge stays a nudge: a character may not out-stat its element.
 */
const statDelta = (limit: number) => z.number().int().min(-limit).max(limit);

const unitStatMods = z
  .object({
    maxHp: statDelta(6),
    maxAp: statDelta(1),
    maxMove: statDelta(2),
    power: statDelta(3),
    defense: statDelta(2),
    speed: statDelta(3),
    focus: statDelta(10),
  })
  .partial();

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

const flagValue = z.union([z.boolean(), z.number(), z.string()]);

/**
 * Recursive, so `z.lazy` with an explicit annotation. A plain `z.union` rather
 * than `z.discriminatedUnion` because the latter cannot see through `z.lazy` to
 * find the discriminator; the error messages are a little worse and the shapes
 * are small enough that it does not matter.
 */
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal('flag'),
      key: z.string().min(1),
      op: z.enum(['set', 'unset', 'eq', 'gte', 'lte']),
      value: flagValue.optional(),
    }),
    z.object({
      kind: z.literal('partyHas'),
      element: elementId.optional(),
      characterId: id.optional(),
      min: z.number().int().min(1).max(6).optional(),
    }),
    z.object({
      kind: z.literal('standing'),
      nation: elementId,
      op: z.enum(['gte', 'lte']),
      value: z.number().int().min(-5).max(5),
    }),
    z.object({ kind: z.literal('visited'), nodeId: id }),
    z.object({
      kind: z.literal('partySize'),
      op: z.enum(['gte', 'lte']),
      value: z.number().int().min(1).max(6),
    }),
    z.object({ kind: z.literal('all'), of: z.array(conditionSchema).min(1) }),
    z.object({ kind: z.literal('any'), of: z.array(conditionSchema).min(1) }),
    z.object({ kind: z.literal('not'), of: conditionSchema }),
  ]),
);

/* ------------------------------------------------------------------ */
/* Statuses and surfaces                                               */
/* ------------------------------------------------------------------ */

export const statusSchema = z.object({
  id: statusId,
  name: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['buff', 'debuff']),
  defaultDuration: z.number().int().min(1).max(10),
  maxStacks: z.number().int().min(1).max(5),
  tickDamage: z.number().int().min(0),
  tickDamageType: damageType,
  skipsTurn: z.boolean(),
  preventsMove: z.boolean(),
  preventsAbilities: z.boolean(),
  modifiers: z.object({
    power: z.number(),
    defense: z.number(),
    speed: z.number(),
    focus: z.number(),
    move: z.number(),
    ap: z.number(),
    accuracy: z.number(),
    incomingMultiplier: z.record(z.number().positive()),
  }),
  clears: z.array(statusId),
  upgradeFrom: z.array(statusId).nullable(),
});

export const surfaceSchema = z.object({
  id: surfaceId,
  name: z.string().min(1),
  description: z.string().min(1),
  moveCost: z.number().int().min(0).max(4),
  enterDamage: z.number().int().min(0),
  enterDamageType: damageType,
  enterStatus: statusId.nullable(),
  enterStatusChance: z.number().min(0).max(1),
  blocksSight: z.boolean(),
  grantsCover: z.boolean(),
  defaultDuration: z.number().int().min(-1),
});

export const comboSchema = z.object({
  id,
  existing: surfaceId.nullable(),
  applied: z.union([damageType, surfaceId]),
  result: surfaceId.nullable(),
  duration: z.number().int().min(-1),
  spread: z.number().int().min(0).max(4),
  status: statusId.nullable(),
  statusChance: z.number().min(0).max(1),
  chainThroughExisting: z.boolean(),
  chainDamage: z.number().int().min(0),
  label: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/* Abilities                                                           */
/* ------------------------------------------------------------------ */

const targeting = z.union([
  z.object({ shape: z.literal('self') }),
  z.object({ shape: z.literal('unit'), allow: z.enum(['enemy', 'ally', 'any']) }),
  z.object({ shape: z.literal('tile') }),
  z.object({ shape: z.literal('blast'), radius: z.number().int().min(0).max(4) }),
  z.object({ shape: z.literal('line'), length: z.number().int().min(1).max(8) }),
  z.object({ shape: z.literal('cone'), length: z.number().int().min(1).max(6) }),
]);

const abilityEffect = z.union([
  z.object({
    kind: z.literal('damage'),
    base: z.number().min(0),
    scale: z.number().min(0).max(3),
    damageType,
    ignoreDefense: z.boolean().optional(),
    includesCaster: z.boolean().optional(),
  }),
  z.object({ kind: z.literal('heal'), base: z.number().min(0), scale: z.number().min(0).max(3) }),
  z.object({
    kind: z.literal('status'),
    status: statusId,
    duration: z.number().int().min(1).max(6),
    chance: z.number().min(0).max(1),
    to: z.enum(['hit', 'self', 'allies']),
  }),
  z.object({
    kind: z.literal('surface'),
    surface: surfaceId,
    duration: z.number().int().min(-1).max(8),
    area: z.enum(['area', 'center']),
  }),
  z.object({ kind: z.literal('push'), distance: z.number().int().min(1).max(4) }),
  z.object({ kind: z.literal('pull'), distance: z.number().int().min(1).max(4) }),
  z.object({ kind: z.literal('dash') }),
  z.object({ kind: z.literal('wall'), duration: z.number().int().min(1).max(6) }),
  z.object({ kind: z.literal('cleanse'), statuses: z.array(statusId).min(1) }),
  z.object({
    kind: z.literal('grantAp'),
    amount: z.number().int().min(1).max(3),
    to: z.enum(['self', 'hit']),
  }),
  z.object({ kind: z.literal('revealSurfaces') }),
]);

export const abilitySchema = z.object({
  id,
  name: z.string().min(1),
  element: elementId,
  apCost: z.number().int().min(0).max(5),
  cooldown: z.number().int().min(0).max(6),
  range: z.number().int().min(0).max(12),
  minRange: z.number().int().min(0).max(12),
  requiresLineOfSight: z.boolean(),
  targeting,
  effects: z.array(abilityEffect).min(1),
  tags: z
    .array(z.enum(['attack', 'heal', 'buff', 'control', 'surface', 'mobility', 'signature']))
    .min(1),
  description: z.string().min(1),
  flavor: z.string().min(1),
  fx: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/* Characters, enemies, maps, encounters                               */
/* ------------------------------------------------------------------ */

const kitLevel = z.number().int().min(1).max(10);

const kitEntry = z.union([
  z.object({ level: kitLevel, ability: id }),
  z.object({ level: kitLevel, choose: z.tuple([id, id]) }),
  // A gate with one option is not a choice; two is the floor.
  z.object({ level: kitLevel, specialize: z.array(id).min(2).max(4) }),
]);

export const disciplineSchema = z.object({
  id,
  name: z.string().min(1),
  element: elementId,
  blurb: z.string().min(1),
  description: z.string().min(1),
  flavor: z.string().min(1),
  requiresFlag: z.string().min(1).nullable(),
  /** Required for a gated path, and meaningless on an open one. */
  lockedHint: z.string(),
  statMods: unitStatMods,
  kit: z.array(kitEntry).min(1),
  icon: z.string().min(1),
});

export const characterSchema = z.object({
  id,
  name: z.string().min(1),
  element: elementId,
  blurb: z.string().min(1),
  bio: z.string().min(1),
  statMods: unitStatMods,
  kit: z.array(kitEntry).min(1),
  portrait: z.string().min(1),
  sprite: z.string().min(1),
});

export const enemySchema = z.object({
  id,
  name: z.string().min(1),
  element: elementId,
  size: z.union([z.literal(1), z.literal(2)]),
  stats: unitStats,
  abilities: z.array(id).min(1),
  ai: z.enum(['aggressive', 'cautious', 'support', 'boss', 'none']),
  xp: z.number().int().min(0),
  sprite: z.string().min(1),
  description: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

const propEffect = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('surface'),
    surface: surfaceId,
    duration: z.number().int().min(-1).max(8),
    radius: z.number().int().min(0).max(2),
  }),
  z.object({
    kind: z.literal('damage'),
    // Capped low on purpose: the danger of a prop is the surface it leaves,
    // not the hit. Nothing here should take a party member from healthy to down.
    base: z.number().int().min(1).max(12),
    damageType,
    radius: z.number().int().min(0).max(2),
  }),
  z.object({
    kind: z.literal('status'),
    status: statusId,
    duration: z.number().int().min(1).max(6),
    chance: z.number().min(0).max(1),
    radius: z.number().int().min(0).max(2),
  }),
  z.object({
    kind: z.literal('push'),
    distance: z.number().int().min(1).max(3),
    radius: z.number().int().min(0).max(2),
  }),
]);

export const propSchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string().min(1),
  sprite: z.string().min(1),
  // A prop should break when somebody decides to break it, not after three turns.
  hp: z.number().int().min(1).max(20),
  blocksMove: z.boolean(),
  blocksSight: z.boolean(),
  grantsCover: z.boolean(),
  pushable: z.boolean(),
  vulnerableTo: z.array(damageType),
  immuneTo: z.array(damageType),
  onBreak: z.array(propEffect).min(1),
  breakLabel: z.string().min(8),
});

const propPlacement = z.object({
  propId: id,
  pos: vec2,
  when: conditionSchema.optional(),
});

const tileTemplate = z.object({
  terrain: terrainId,
  elevation: z.number().int().min(0).max(3).optional(),
  blocked: z.boolean().optional(),
  blocksSight: z.boolean().optional(),
  cover: z.boolean().optional(),
  surface: surfaceId.optional(),
  surfaceDuration: z.number().int().min(-1).optional(),
});

export const mapSchema = z
  .object({
    id,
    name: z.string().min(1),
    kind: z.enum(['combat', 'explore']),
    width: z.number().int().min(4).max(64),
    height: z.number().int().min(4).max(64),
    rows: z.array(z.string()).min(1),
    legend: z.record(tileTemplate),
    partySpawns: z.array(vec2).min(1),
    npcs: z.array(
      z.object({
        id,
        name: z.string().min(1),
        pos: vec2,
        sprite: z.string().min(1),
        node: id,
        routes: z.array(z.object({ when: conditionSchema, node: id })).optional(),
      }),
    ),
    props: z.array(propPlacement),
    ambience: z.string().min(1),
    exit: z.object({ pos: vec2, label: z.string().min(1) }).optional(),
  })
  .superRefine((map, ctx) => {
    if (map.rows.length !== map.height) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `map "${map.id}" declares height ${map.height} but has ${map.rows.length} rows`,
      });
    }
    map.rows.forEach((row, y) => {
      if (row.length !== map.width) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `map "${map.id}" row ${y} is ${row.length} chars, expected ${map.width}`,
        });
      }
      for (const ch of row) {
        if (!(ch in map.legend)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `map "${map.id}" row ${y} uses "${ch}", which is not in the legend`,
          });
          return;
        }
      }
    });
  });

const placement = z.object({
  enemyId: id,
  pos: vec2,
  level: z.number().int().min(1).max(10).optional(),
  nameSuffix: z.string().optional(),
});

export const encounterSchema = z.object({
  id,
  name: z.string().min(1),
  mapId: id,
  enemies: z.array(placement).min(1),
  allies: z.array(placement),
  conditionalEnemies: z.array(
    z.object({
      flag: z.string().min(1),
      whenSet: z.boolean(),
      placements: z.array(placement).min(1),
    }),
  ),
  baselinePartySize: z.number().int().min(1).max(6),
  variants: z.array(
    z.object({
      id,
      weight: z.number().min(0).max(100),
      when: conditionSchema.optional(),
      enemies: z.array(placement).min(1).optional(),
      extraProps: z.array(propPlacement).optional(),
      intro: z.string().min(1).optional(),
      tip: z.string().min(1).optional(),
    }),
  ),
  reinforcements: z.array(placement),
  expectedLevel: z.number().int().min(1).max(10),
  intro: z.string().min(1),
  tip: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/* Story                                                               */
/* ------------------------------------------------------------------ */

const dialogueVariant = z.object({
  when: conditionSchema,
  speaker: z.string().min(1).optional(),
  portrait: z.string().min(1).optional(),
  lines: z.array(z.string().min(1)).min(1),
});

/** Signed nation-standing deltas. Bounded so one choice cannot swing a nation. */
const standingAdjust = z
  .object({
    fire: z.number().int().min(-3).max(3),
    water: z.number().int().min(-3).max(3),
    earth: z.number().int().min(-3).max(3),
    air: z.number().int().min(-3).max(3),
    nonbender: z.number().int().min(-3).max(3),
  })
  .partial();

export const storyNodeSchema = z.discriminatedUnion('kind', [
  z.object({
    id,
    kind: z.literal('dialogue'),
    speaker: z.string().min(1),
    portrait: z.string().min(1),
    lines: z.array(z.string().min(1)).min(1),
    next: id,
    variants: z.array(dialogueVariant).optional(),
  }),
  z.object({
    id,
    kind: z.literal('choice'),
    speaker: z.string().min(1),
    portrait: z.string().min(1),
    prompt: z.string().min(1),
    options: z
      .array(
        z.object({
          label: z.string().min(1),
          detail: z.string().min(1),
          next: id,
          setFlags: z.record(flagValue).optional(),
          requires: conditionSchema.optional(),
          speaker: z
            .object({ element: elementId.optional(), characterId: id.optional() })
            .optional(),
          lockedHint: z.string().min(1).optional(),
          adjust: standingAdjust.optional(),
        }),
      )
      .min(2),
    variants: z.array(dialogueVariant).optional(),
    footer: z.string().min(1).optional(),
  }),
  z.object({ id, kind: z.literal('battle'), encounterId: id, next: id, onDefeat: id }),
  z.object({
    id,
    kind: z.literal('explore'),
    mapId: id,
    objective: z.string().min(1),
    next: id,
  }),
  z.object({
    id,
    kind: z.literal('flags'),
    set: z.record(flagValue),
    grantXp: z.number().int().min(0).max(2000).optional(),
    next: id,
  }),
  z.object({ id, kind: z.literal('branch'), flag: z.string().min(1), ifSet: id, ifUnset: id }),
  z.object({
    id,
    kind: z.literal('end'),
    title: z.string().min(1),
    lines: z.array(z.string().min(1)).min(1),
    teaser: z.string().min(1),
  }),
]);

/* ------------------------------------------------------------------ */
/* Cross-reference validation                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

const clipDef = z.object({
  frames: z.array(z.string().min(1)).min(1),
  fps: z.number().positive().max(60),
  loop: z.boolean(),
  events: z.object({ hit: z.number().int().min(0).optional() }).optional(),
});

/** The manifest's entries (ADR 0003): a painter, a still, or a pose sheet. */
export const assetEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('painter'),
    painter: z.string().min(1),
    palette: z.string().min(1),
    variant: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal('image'),
    url: z.string().min(1),
    palette: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal('sheet'),
    atlas: z.string().regex(/\.json$/, 'must point at the atlas JSON'),
    pixelsPerTile: z.union([z.literal(128), z.literal(256)]),
    footprint: z.object({ w: z.union([z.literal(1), z.literal(2)]), h: z.literal(1) }),
    anchor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
    facing: z.enum(['mirror', 'both']),
    clips: z.object(Object.fromEntries(CLIP_NAMES.map((clip) => [clip, clipDef.optional()]))),
    palette: z.string().min(1),
  }),
]);

export interface ContentBundle {
  /** The art manifest, so every sprite key content names is checked against it. */
  readonly assets?: Readonly<Record<string, AssetEntry>>;
  readonly abilities: readonly Ability[];
  readonly characters: readonly CharacterDef[];
  readonly disciplines: readonly DisciplineDef[];
  readonly enemies: readonly EnemyDef[];
  readonly maps: readonly MapDef[];
  readonly encounters: readonly EncounterDef[];
  readonly statuses: readonly StatusDef[];
  readonly surfaces: readonly SurfaceDef[];
  readonly props: readonly PropDef[];
  readonly combos: readonly ComboRule[];
  readonly story: readonly StoryNode[];
}

/**
 * How far a roster variant may drift from the authored roster's XP cost.
 *
 * Ten percent is roughly "one thug either way on a three-bandit fight" — enough
 * slack to build a genuinely different squad out of the pieces available, tight
 * enough that no variant is secretly the easy route.
 */
export const VARIANT_BUDGET_TOLERANCE = 0.1;

/**
 * How much threat a flag-gated `conditionalEnemies` group may *add* on top of
 * the authored roster.
 *
 * Variants swap and are held to 10% either way. Conditional groups only ever
 * add, and until this rule existed they were the one roster lever with no
 * budget on them at all — which is how the quarry floor boss came to put two
 * extra mercenaries on the field for anyone who traded Ruon away. That branch
 * measured a 9% win rate against the other branch's 62%, and because the
 * balance harness set no story flags, nothing in the repo could see it.
 *
 * Twenty percent is drawn from what the simulator says extra bodies actually
 * cost, which is far more than their XP suggests: on that boss floor a *single*
 * 150-XP body (+29%) still measured 32-46% against 82%, and the pair that
 * shipped (+59%) was unwinnable. A cap this tight means anything substantial
 * has to be authored as a variant — swap the roster, do not grow it — which is
 * the lesson that fight taught.
 *
 * It is a guardrail, not a proof of balance. XP is a coarse proxy for threat: a
 * quarry bender and a mercenary cost the same 150 and do not play the same. The
 * real check is `npm run balance` with BALANCE_VARIANTS=1.
 */
export const CONDITIONAL_BUDGET_TOLERANCE = 0.2;

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of ids) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

/** Walkability check that mirrors `buildGrid` without importing core logic. */
function isWalkable(map: MapDef, x: number, y: number): boolean {
  const row = map.rows[y];
  if (!row) return false;
  const ch = row[x];
  if (!ch) return false;
  const template = map.legend[ch];
  if (!template) return false;
  return !(template.blocked ?? template.terrain === 'wall');
}

/**
 * Returns a list of human-readable problems. Empty means the content is sound.
 * Deliberately collects everything rather than throwing on the first fault, so
 * one CI run reports every broken link at once.
 */
export function validateContent(bundle: ContentBundle): string[] {
  const problems: string[] = [];

  /* --- assets ------------------------------------------------------- */
  const assets = bundle.assets ?? {};
  for (const [key, entry] of Object.entries(assets)) {
    const parsed = assetEntrySchema.safeParse(entry);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      problems.push(`asset ${key}: ${issues.join('; ')}`);
      continue;
    }
    if (entry.kind !== 'sheet') continue;
    for (const clip of REQUIRED_CLIPS) {
      if (!entry.clips[clip]) problems.push(`asset ${key}: sheet has no ${clip} clip`);
    }
    for (const clip of CLIP_NAMES) {
      const def = entry.clips[clip];
      if (!def) continue;
      const bounds = CLIP_FRAME_COUNTS[clip];
      if (def.frames.length < bounds.min || def.frames.length > bounds.max) {
        problems.push(
          `asset ${key}: ${clip} has ${def.frames.length} frames, needs ${bounds.min}-${bounds.max}`,
        );
      }
      def.frames.forEach((name, index) => {
        const expected = `${key}/${clip}/${index}`;
        if (name !== expected) {
          problems.push(
            `asset ${key}: ${clip} frame ${index} is "${name}", expected "${expected}"`,
          );
        }
      });
    }
  }
  if (bundle.assets) {
    const wanted: [string, string, number | null][] = [
      ...bundle.characters.map((c): [string, string, number | null] => [
        `character ${c.id}`,
        c.sprite,
        1,
      ]),
      ...bundle.enemies.map((e): [string, string, number | null] => [
        `enemy ${e.id}`,
        e.sprite,
        e.size,
      ]),
      ...bundle.props.map((p): [string, string, number | null] => [`prop ${p.id}`, p.sprite, null]),
      ...bundle.maps.flatMap((m) =>
        m.npcs.map((n): [string, string, number | null] => [`npc ${n.id}`, n.sprite, null]),
      ),
    ];
    for (const [owner, key, size] of wanted) {
      const entry = assets[key];
      if (!entry) {
        problems.push(`${owner}: sprite "${key}" has no entry in the asset manifest`);
        continue;
      }
      if (entry.kind === 'sheet' && size !== null && entry.footprint.w !== size) {
        problems.push(
          `${owner}: sheet "${key}" is ${entry.footprint.w} tiles wide, the unit is ${size}`,
        );
      }
    }
  }

  /* --- shape ------------------------------------------------------- */
  const shapeChecks: [string, z.ZodTypeAny, readonly unknown[]][] = [
    ['ability', abilitySchema, bundle.abilities],
    ['character', characterSchema, bundle.characters],
    ['discipline', disciplineSchema, bundle.disciplines],
    ['enemy', enemySchema, bundle.enemies],
    ['map', mapSchema, bundle.maps],
    ['encounter', encounterSchema, bundle.encounters],
    ['status', statusSchema, bundle.statuses],
    ['surface', surfaceSchema, bundle.surfaces],
    ['prop', propSchema, bundle.props],
    ['combo', comboSchema, bundle.combos],
    ['story node', storyNodeSchema, bundle.story],
  ];

  for (const [label, schema, items] of shapeChecks) {
    items.forEach((item, index) => {
      const result = schema.safeParse(item);
      if (result.success) return;
      const name =
        typeof item === 'object' && item !== null && 'id' in item
          ? String((item as { id: unknown }).id)
          : `#${index}`;
      for (const issue of result.error.issues) {
        problems.push(`${label} "${name}": ${issue.path.join('.')} ${issue.message}`);
      }
    });
  }

  /* --- duplicate ids ----------------------------------------------- */
  const idGroups: [string, readonly string[]][] = [
    ['ability', bundle.abilities.map((a) => a.id)],
    ['character', bundle.characters.map((c) => c.id)],
    ['discipline', bundle.disciplines.map((d) => d.id)],
    ['enemy', bundle.enemies.map((e) => e.id)],
    ['map', bundle.maps.map((m) => m.id)],
    ['encounter', bundle.encounters.map((e) => e.id)],
    ['prop', bundle.props.map((p) => p.id)],
    ['combo', bundle.combos.map((c) => c.id)],
    ['story node', bundle.story.map((n) => n.id)],
  ];
  for (const [label, ids] of idGroups) {
    for (const dupe of duplicates(ids)) problems.push(`duplicate ${label} id: "${dupe}"`);
  }

  const abilityIds = new Set(bundle.abilities.map((a) => a.id));
  const enemyIds = new Set(bundle.enemies.map((e) => e.id));
  const mapIds = new Set(bundle.maps.map((m) => m.id));
  const encounterIds = new Set(bundle.encounters.map((e) => e.id));
  const storyIds = new Set(bundle.story.map((n) => n.id));
  const statusIds = new Set(bundle.statuses.map((s) => s.id));
  const surfaceIds = new Set(bundle.surfaces.map((s) => s.id));
  const propIds = new Set(bundle.props.map((p) => p.id));

  /* --- abilities reference real statuses and surfaces --------------- */
  for (const a of bundle.abilities) {
    for (const effect of a.effects) {
      if (effect.kind === 'status' && !statusIds.has(effect.status)) {
        problems.push(`ability "${a.id}" applies unknown status "${effect.status}"`);
      }
      if (effect.kind === 'cleanse') {
        for (const s of effect.statuses) {
          if (!statusIds.has(s)) problems.push(`ability "${a.id}" cleanses unknown status "${s}"`);
        }
      }
      if (effect.kind === 'surface' && !surfaceIds.has(effect.surface)) {
        problems.push(`ability "${a.id}" paints unknown surface "${effect.surface}"`);
      }
    }
    if (a.minRange > a.range) {
      problems.push(`ability "${a.id}" has minRange ${a.minRange} above range ${a.range}`);
    }
  }

  /* --- props reference real surfaces and statuses ------------------- */
  for (const p of bundle.props) {
    for (const effect of p.onBreak) {
      if (effect.kind === 'surface' && !surfaceIds.has(effect.surface)) {
        problems.push(`prop "${p.id}" paints unknown surface "${effect.surface}"`);
      }
      if (effect.kind === 'status' && !statusIds.has(effect.status)) {
        problems.push(`prop "${p.id}" applies unknown status "${effect.status}"`);
      }
    }
    // Immune wins over vulnerable in the damage maths, so declaring both is a
    // contradiction the author almost certainly did not mean.
    for (const type of p.vulnerableTo) {
      if (p.immuneTo.includes(type)) {
        problems.push(`prop "${p.id}" is both vulnerable and immune to "${type}"`);
      }
    }
  }

  /* --- combos reference real surfaces and statuses ------------------ */
  for (const c of bundle.combos) {
    if (c.existing && !surfaceIds.has(c.existing)) {
      problems.push(`combo "${c.id}" reads unknown surface "${c.existing}"`);
    }
    if (c.result && !surfaceIds.has(c.result)) {
      problems.push(`combo "${c.id}" produces unknown surface "${c.result}"`);
    }
    if (c.status && !statusIds.has(c.status)) {
      problems.push(`combo "${c.id}" applies unknown status "${c.status}"`);
    }
    if (c.chainThroughExisting && !c.existing) {
      problems.push(`combo "${c.id}" chains through a surface but declares no existing surface`);
    }
  }

  /* --- character kits ----------------------------------------------- */
  const disciplineIds = new Set(bundle.disciplines.map((d) => d.id));

  /** Ability references in a kit entry; empty for a discipline gate. */
  const abilityRefs = (entry: CharacterDef['kit'][number]): readonly string[] =>
    'ability' in entry ? [entry.ability] : 'choose' in entry ? entry.choose : [];

  for (const c of bundle.characters) {
    const levels = new Set<number>();
    for (const entry of c.kit) {
      if (levels.has(entry.level)) {
        problems.push(`character "${c.id}" has two kit entries at level ${entry.level}`);
      }
      levels.add(entry.level);
      for (const ref of abilityRefs(entry)) {
        if (!abilityIds.has(ref)) {
          problems.push(`character "${c.id}" kit references unknown ability "${ref}"`);
        }
      }
      if (!('specialize' in entry)) continue;

      /*
       * A gate has to be answerable. Every id must resolve, every path must
       * belong to this character's element, and at least one must be open to a
       * party carrying no flags at all — otherwise a table that skipped the
       * optional content reaches level 5 and is offered nothing it can take.
       */
      let unconditional = 0;
      for (const ref of entry.specialize) {
        const discipline = bundle.disciplines.find((d) => d.id === ref);
        if (!discipline) {
          problems.push(`character "${c.id}" gate references unknown discipline "${ref}"`);
          continue;
        }
        if (discipline.element !== c.element) {
          problems.push(
            `character "${c.id}" (${c.element}) is offered "${ref}", which is a ${discipline.element} path`,
          );
        }
        if (!discipline.requiresFlag) unconditional++;
      }
      if (unconditional === 0) {
        problems.push(
          `character "${c.id}" gate at level ${entry.level} offers no path that is open without a flag`,
        );
      }
    }
    if (!c.kit.some((e) => e.level === 1)) {
      problems.push(`character "${c.id}" has no level 1 ability`);
    }
  }

  /* --- disciplines --------------------------------------------------- */
  for (const d of bundle.disciplines) {
    const levels = new Set<number>();
    for (const entry of d.kit) {
      if (levels.has(entry.level)) {
        problems.push(`discipline "${d.id}" has two kit entries at level ${entry.level}`);
      }
      levels.add(entry.level);
      if ('specialize' in entry) {
        problems.push(`discipline "${d.id}" nests another gate at level ${entry.level}`);
        continue;
      }
      for (const ref of abilityRefs(entry)) {
        const referenced = bundle.abilities.find((a) => a.id === ref);
        if (!referenced) {
          problems.push(`discipline "${d.id}" references unknown ability "${ref}"`);
          continue;
        }
        if (referenced.element !== d.element) {
          problems.push(
            `discipline "${d.id}" (${d.element}) grants "${ref}", which is a ${referenced.element} ability`,
          );
        }
      }
    }
    if (d.requiresFlag && d.lockedHint.trim().length === 0) {
      problems.push(`discipline "${d.id}" is flag-gated but has no lockedHint to show on the card`);
    }
  }

  // Two paths can share an ability only if one of them is meant to be a strict
  // upgrade of the other; today none are, and a duplicate is far more likely to
  // be a copy-paste than a decision.
  const grantedBy = new Map<string, string[]>();
  for (const d of bundle.disciplines) {
    for (const entry of d.kit) {
      for (const ref of abilityRefs(entry)) {
        grantedBy.set(ref, [...(grantedBy.get(ref) ?? []), d.id]);
      }
    }
  }
  for (const [abilityId, owners] of grantedBy) {
    if (owners.length > 1) {
      problems.push(
        `ability "${abilityId}" is granted by more than one path: ${owners.join(', ')}`,
      );
    }
  }

  for (const id of disciplineIds) {
    if (
      !bundle.characters.some((c) =>
        c.kit.some((e) => 'specialize' in e && e.specialize.includes(id)),
      )
    ) {
      problems.push(`discipline "${id}" is not offered at any character's gate`);
    }
  }

  /* --- enemies ------------------------------------------------------ */
  for (const e of bundle.enemies) {
    for (const ref of e.abilities) {
      if (!abilityIds.has(ref)) {
        problems.push(`enemy "${e.id}" references unknown ability "${ref}"`);
      }
    }
  }

  /* --- maps --------------------------------------------------------- */
  for (const m of bundle.maps) {
    m.partySpawns.forEach((spawn, index) => {
      if (!isWalkable(m, spawn.x, spawn.y)) {
        problems.push(
          `map "${m.id}" party spawn ${index} at (${spawn.x},${spawn.y}) is blocked or off-map`,
        );
      }
    });
    if (m.exit && !isWalkable(m, m.exit.pos.x, m.exit.pos.y)) {
      problems.push(`map "${m.id}" exit at (${m.exit.pos.x},${m.exit.pos.y}) is blocked`);
    }

    /*
     * Props are placed before the party is, and a blocking prop bakes itself into
     * the tile. Put one on a spawn point and `placeAt` spirals a character
     * somewhere else without a word — the sort of bug that reads as "the game put
     * me in the wrong place" and never gets reported properly.
     */
    const propCells = new Set<string>();
    const spawnCells = new Set(m.partySpawns.map((s) => `${s.x},${s.y}`));
    for (const placement of m.props) {
      if (!propIds.has(placement.propId)) {
        problems.push(`map "${m.id}" places unknown prop "${placement.propId}"`);
        continue;
      }
      const key = `${placement.pos.x},${placement.pos.y}`;
      if (!isWalkable(m, placement.pos.x, placement.pos.y)) {
        problems.push(
          `map "${m.id}" places "${placement.propId}" on a blocked tile (${key}) — it would have nothing to stand on`,
        );
      }
      if (spawnCells.has(key)) {
        problems.push(`map "${m.id}" places "${placement.propId}" on party spawn (${key})`);
      }
      if (m.exit && key === `${m.exit.pos.x},${m.exit.pos.y}`) {
        problems.push(`map "${m.id}" places "${placement.propId}" on the exit (${key})`);
      }
      if (m.npcs.some((n) => `${n.pos.x},${n.pos.y}` === key)) {
        problems.push(`map "${m.id}" places "${placement.propId}" on an npc (${key})`);
      }
      if (propCells.has(key)) {
        problems.push(`map "${m.id}" stacks two props on (${key})`);
      }
      propCells.add(key);
    }
    for (const npc of m.npcs) {
      if (!isWalkable(m, npc.pos.x, npc.pos.y)) {
        problems.push(`map "${m.id}" npc "${npc.id}" stands on a blocked tile`);
      }
      if (!storyIds.has(npc.node)) {
        problems.push(`map "${m.id}" npc "${npc.id}" points at unknown story node "${npc.node}"`);
      }
      for (const route of npc.routes ?? []) {
        if (!storyIds.has(route.node)) {
          problems.push(
            `map "${m.id}" npc "${npc.id}" routes to "${route.node}", which is not a known story node`,
          );
        }
      }
    }
    if (m.kind === 'combat' && m.partySpawns.length < 6) {
      problems.push(
        `map "${m.id}" is a combat map with only ${m.partySpawns.length} spawns; six players need six`,
      );
    }
  }

  /* --- encounters --------------------------------------------------- */
  for (const e of bundle.encounters) {
    const map = bundle.maps.find((m) => m.id === e.mapId);
    if (!map) {
      problems.push(`encounter "${e.id}" uses unknown map "${e.mapId}"`);
      continue;
    }
    if (!mapIds.has(e.mapId)) problems.push(`encounter "${e.id}" uses unknown map "${e.mapId}"`);

    // Every placement must be legal, including ones only some tables will see.
    const all = [
      ...e.enemies,
      ...e.allies,
      ...e.reinforcements,
      ...e.conditionalEnemies.flatMap((group) => group.placements),
    ];
    const taken = new Set<string>();
    for (const p of all) {
      if (!enemyIds.has(p.enemyId)) {
        problems.push(`encounter "${e.id}" places unknown unit "${p.enemyId}"`);
        continue;
      }
      const def = bundle.enemies.find((x) => x.id === p.enemyId);
      const cells = def?.size === 2 ? [p.pos, { x: p.pos.x + 1, y: p.pos.y }] : [p.pos];
      for (const cell of cells) {
        if (!isWalkable(map, cell.x, cell.y)) {
          problems.push(
            `encounter "${e.id}" places "${p.enemyId}" on a blocked tile (${cell.x},${cell.y}) of "${map.id}"`,
          );
        }
        const key = `${cell.x},${cell.y}`;
        if (taken.has(key)) {
          problems.push(`encounter "${e.id}" stacks two units on (${cell.x},${cell.y})`);
        }
        taken.add(key);
      }
    }
    for (const spawn of map.partySpawns) {
      if (taken.has(`${spawn.x},${spawn.y}`)) {
        problems.push(`encounter "${e.id}" places a unit on party spawn (${spawn.x},${spawn.y})`);
      }
    }
    for (const placement of map.props) {
      const key = `${placement.pos.x},${placement.pos.y}`;
      if (taken.has(key)) {
        problems.push(`encounter "${e.id}" places a unit on prop "${placement.propId}" (${key})`);
      }
    }

    // Same falsy-zero trap as `branch`: conditionalEnemies compares
    // `Boolean(flags[flag])`, which reads neutral standing as absent.
    for (const group of e.conditionalEnemies) {
      if (group.flag.startsWith(STANDING_PREFIX)) {
        problems.push(
          `encounter "${e.id}" gates enemies on "${group.flag}": standing is numeric and 0 is ` +
            `falsy, so use a variant with a "standing" condition instead`,
        );
      }
    }

    /*
     * The threat budget, and it lives here rather than in a test on purpose: a
     * balance rule that only exists in a test file is a comment.
     *
     * XP is the currency because it is already the designer's own declared
     * danger number, and because `xpRoster` scores the authored roster whatever
     * actually spawned — so variants that cost the same *are* XP-identical, and
     * progression.test.ts's level-on-arrival guarantee holds by construction
     * instead of by vigilance. A variant that drifts is not "a harder version",
     * it is an unbalanced fight paying the wrong amount.
     */
    const budgetOf = (placements: readonly { enemyId: string }[]): number =>
      placements.reduce(
        (sum, p) => sum + (bundle.enemies.find((x) => x.id === p.enemyId)?.xp ?? 0),
        0,
      );

    const baseBudget = budgetOf(e.enemies);

    /*
     * What the flags can add, worst case.
     *
     * Groups keyed on the same flag with opposite `whenSet` can never both
     * fire, so the worst case is the heavier side of each flag, summed across
     * distinct flags. Checking groups one at a time would let three 15% groups
     * through and land a 45% roster on the table.
     */
    if (baseBudget > 0 && e.conditionalEnemies.length > 0) {
      const heaviestPerFlag = new Map<string, number>();
      for (const group of e.conditionalEnemies) {
        const cost = budgetOf(group.placements);
        heaviestPerFlag.set(group.flag, Math.max(heaviestPerFlag.get(group.flag) ?? 0, cost));
      }
      const added = [...heaviestPerFlag.values()].reduce((sum, cost) => sum + cost, 0);
      const drift = added / baseBudget;
      if (drift > CONDITIONAL_BUDGET_TOLERANCE) {
        problems.push(
          `encounter "${e.id}" can add ${added} XP of conditional enemies to a baseline of ` +
            `${baseBudget} (${Math.round(drift * 100)}% more, limit ` +
            `${Math.round(CONDITIONAL_BUDGET_TOLERANCE * 100)}%) — a story branch should change ` +
            `who is on the field, not how many. Author it as a variant, which swaps the roster ` +
            `and is reported separately by BALANCE_VARIANTS=1`,
        );
      }
    }

    const variantIds = new Set<string>();
    for (const variant of e.variants) {
      if (variantIds.has(variant.id)) {
        problems.push(`encounter "${e.id}" has two variants called "${variant.id}"`);
      }
      variantIds.add(variant.id);

      for (const p of variant.enemies ?? []) {
        if (!enemyIds.has(p.enemyId)) {
          problems.push(
            `encounter "${e.id}" variant "${variant.id}" places unknown unit "${p.enemyId}"`,
          );
          continue;
        }
        const def = bundle.enemies.find((x) => x.id === p.enemyId);
        const cells = def?.size === 2 ? [p.pos, { x: p.pos.x + 1, y: p.pos.y }] : [p.pos];
        for (const cell of cells) {
          if (!isWalkable(map, cell.x, cell.y)) {
            problems.push(
              `encounter "${e.id}" variant "${variant.id}" places "${p.enemyId}" on a blocked tile (${cell.x},${cell.y})`,
            );
          }
          if (map.partySpawns.some((s) => s.x === cell.x && s.y === cell.y)) {
            problems.push(
              `encounter "${e.id}" variant "${variant.id}" places "${p.enemyId}" on party spawn (${cell.x},${cell.y})`,
            );
          }
        }
      }

      if (!variant.enemies || baseBudget === 0) continue;
      const drift = Math.abs(budgetOf(variant.enemies) - baseBudget) / baseBudget;
      if (drift > VARIANT_BUDGET_TOLERANCE) {
        problems.push(
          `encounter "${e.id}" variant "${variant.id}" costs ${budgetOf(variant.enemies)} XP against a ` +
            `baseline of ${baseBudget} (${Math.round(drift * 100)}% off, limit ` +
            `${Math.round(VARIANT_BUDGET_TOLERANCE * 100)}%) — variants must be comparable fights, ` +
            `because XP is paid from the authored roster whichever one spawns`,
        );
      }
    }
  }

  /* --- story graph -------------------------------------------------- */
  const links: [string, string][] = [];
  for (const node of bundle.story) {
    switch (node.kind) {
      case 'dialogue':
      case 'explore':
      case 'flags':
        links.push([node.id, node.next]);
        break;
      case 'battle':
        links.push([node.id, node.next], [node.id, node.onDefeat]);
        if (!encounterIds.has(node.encounterId)) {
          problems.push(`story node "${node.id}" uses unknown encounter "${node.encounterId}"`);
        }
        break;
      case 'choice':
        for (const option of node.options) links.push([node.id, option.next]);
        break;
      case 'branch':
        links.push([node.id, node.ifSet], [node.id, node.ifUnset]);
        /*
         * `branch` tests the flag for truthiness, and a standing of 0 is falsy —
         * a neutral nation would silently take the "unset" road. Anything that
         * needs to read standing must use a Condition, which compares numbers.
         */
        if (node.flag.startsWith(STANDING_PREFIX)) {
          problems.push(
            `story node "${node.id}" branches on "${node.flag}": standing is numeric and 0 is ` +
              `falsy, so use a condition with "standing" instead of a branch node`,
          );
        }
        break;
      case 'end':
        break;
    }
    if (node.kind === 'explore' && !mapIds.has(node.mapId)) {
      problems.push(`story node "${node.id}" uses unknown map "${node.mapId}"`);
    }
  }

  for (const [from, to] of links) {
    if (!storyIds.has(to)) {
      problems.push(`story node "${from}" links to "${to}", which does not exist`);
    }
  }

  /* --- reachability: every node must be reachable from the entry ----- */
  const entry = 'act1_open';
  if (!storyIds.has(entry)) {
    problems.push(`story has no entry node "${entry}"`);
  } else {
    const reachable = new Set<string>([entry]);
    const queue = [entry];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      for (const [from, to] of links) {
        if (from !== current || reachable.has(to)) continue;
        reachable.add(to);
        queue.push(to);
      }
    }
    // NPC nodes are entered by tapping, not by a link, so they count as roots.
    for (const m of bundle.maps) {
      for (const npc of m.npcs) {
        for (const nodeId of [npc.node, ...(npc.routes ?? []).map((r) => r.node)]) {
          if (!nodeId || reachable.has(nodeId)) continue;
          reachable.add(nodeId);
          queue.push(nodeId);
          while (queue.length > 0) {
            const current = queue.shift();
            if (!current) break;
            for (const [from, to] of links) {
              if (from !== current || reachable.has(to)) continue;
              reachable.add(to);
              queue.push(to);
            }
          }
        }
      }
    }
    for (const nodeId of storyIds) {
      if (!reachable.has(nodeId)) {
        problems.push(`story node "${nodeId}" is unreachable from "${entry}" or any NPC`);
      }
    }
  }

  return problems;
}
