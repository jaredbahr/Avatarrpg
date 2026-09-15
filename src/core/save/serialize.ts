/**
 * Save files.
 *
 * A save is a literal dump of `GameState` plus a little metadata and whatever
 * the app wants to keep alongside it (player names, the decider index). That
 * only works because every shape in `core/types.ts` is plain JSON — no classes,
 * no Maps, no undefined-vs-missing games.
 *
 * Imported files are untrusted: they come from a `.json` a child emailed
 * themselves, or from a localStorage entry written by an older build. So the
 * blob is validated rather than cast, and a bad file produces a readable error
 * instead of a half-loaded game.
 */

import { z } from 'zod';
import type { GameState } from '../types';

export const SAVE_FORMAT_VERSION = 1;
export const SAVE_MAGIC = 'four-nations-tactics';

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const vec2 = z.object({ x: z.number().int(), y: z.number().int() });

const statusInstance = z.object({
  id: z.string(),
  duration: z.number(),
  stacks: z.number(),
});

const unitStats = z.object({
  maxHp: z.number(),
  maxAp: z.number(),
  maxMove: z.number(),
  power: z.number(),
  defense: z.number(),
  speed: z.number(),
  focus: z.number(),
});

const unit = z.object({
  id: z.string(),
  name: z.string(),
  faction: z.enum(['party', 'enemy', 'ally']),
  element: z.enum(['fire', 'water', 'earth', 'air', 'nonbender']),
  characterId: z.string().nullable(),
  enemyId: z.string().nullable(),
  level: z.number(),
  xp: z.number(),
  pos: vec2,
  size: z.union([z.literal(1), z.literal(2)]),
  hp: z.number(),
  ap: z.number(),
  move: z.number(),
  bankedAp: z.number(),
  base: unitStats,
  abilities: z.array(z.string()),
  cooldowns: z.record(z.number()),
  statuses: z.array(statusInstance),
  ai: z.enum(['aggressive', 'cautious', 'support', 'boss', 'none']),
  temporary: z.boolean(),
  sprite: z.string(),
});

const tile = z.object({
  terrain: z.string(),
  elevation: z.number(),
  blocked: z.boolean(),
  blocksSight: z.boolean(),
  cover: z.boolean(),
  surface: z.object({ id: z.string(), duration: z.number(), spread: z.number() }).nullable(),
});

const grid = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  tiles: z.array(tile),
});

const battle = z.object({
  encounterId: z.string(),
  // `.default(null)` so a mid-battle save written before variants existed loads
  // as the authored roster, which is exactly what it was.
  variantId: z.string().nullable().default(null),
  mapId: z.string(),
  grid,
  units: z.array(unit),
  order: z.array(z.string()),
  turnIndex: z.number(),
  round: z.number(),
  phase: z.enum(['active', 'victory', 'defeat']),
  temporaryWalls: z.array(z.object({ pos: vec2, untilRound: z.number(), previous: tile })),
  /*
   * `.default([])` rather than a `migrate()` case. SAVE_FORMAT_VERSION is still
   * 1, so a mid-battle save written before props existed would otherwise fail
   * validation outright and greet a family with "This save looks damaged
   * (state.battle.props)". Defaulting loads it as a battle with no props, which
   * is exactly what it was.
   */
  props: z
    .array(
      z.object({
        id: z.string(),
        propId: z.string(),
        pos: vec2,
        hp: z.number(),
        previous: tile,
      }),
    )
    .default([]),
  nextUnitSerial: z.number(),
});

const flagValue = z.union([z.boolean(), z.number(), z.string()]);

const gameState = z.object({
  version: z.number(),
  seed: z.number(),
  rng: z.number(),
  screen: z.enum(['title', 'setup', 'explore', 'dialogue', 'combat', 'ended']),
  party: z.array(unit).min(1),
  battle: battle.nullable(),
  story: z.object({
    nodeId: z.string().nullable(),
    deciderIndex: z.number(),
    visited: z.array(z.string()),
    lineIndex: z.number(),
  }),
  flags: z.record(flagValue),
  pendingChoices: z.array(
    z.object({
      unitId: z.string(),
      level: z.number(),
      options: z.tuple([z.string(), z.string()]),
    }),
  ),
  location: z.object({ mapId: z.string(), pos: vec2 }),
  log: z.array(z.string()),
});

/** Anything the app wants to persist beside the rules state. */
const sessionMeta = z.object({
  players: z.array(z.object({ name: z.string(), unitId: z.string() })),
  soloPlay: z.boolean().optional(),
});

export const saveBlobSchema = z.object({
  magic: z.literal(SAVE_MAGIC),
  format: z.number().int().positive(),
  savedAt: z.number(),
  label: z.string(),
  /** Human-readable summary shown on the slot button. */
  summary: z.string(),
  state: gameState,
  session: sessionMeta,
});

export type SaveBlob = z.infer<typeof saveBlobSchema>;
export type SessionMeta = z.infer<typeof sessionMeta>;

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export interface SaveMeta {
  readonly label: string;
  readonly summary: string;
  /** Milliseconds since the epoch. Passed in — core has no clock. */
  readonly savedAt: number;
  readonly session: SessionMeta;
}

export function toBlob(state: GameState, meta: SaveMeta): SaveBlob {
  return {
    magic: SAVE_MAGIC,
    format: SAVE_FORMAT_VERSION,
    savedAt: meta.savedAt,
    label: meta.label,
    summary: meta.summary,
    state: state as unknown as SaveBlob['state'],
    session: meta.session,
  };
}

export function serialize(state: GameState, meta: SaveMeta): string {
  return JSON.stringify(toBlob(state, meta));
}

/** Pretty-printed, for the file a player exports and might actually look at. */
export function serializeForExport(state: GameState, meta: SaveMeta): string {
  return JSON.stringify(toBlob(state, meta), null, 2);
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export type LoadResult =
  { readonly ok: true; readonly blob: SaveBlob } | { readonly ok: false; readonly error: string };

/**
 * Validates and, where possible, upgrades a save.
 *
 * Migration lives here so that adding a field to GameState later means adding
 * one case below rather than invalidating every save a family has made.
 */
export function migrate(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const blob = raw as Record<string, unknown>;

  // Format 0 (never shipped) had no `summary`; synthesise one so old files
  // from a dev build still load.
  if (blob.format === 0 || blob.summary === undefined) {
    return { ...blob, format: SAVE_FORMAT_VERSION, summary: blob.label ?? 'Saved game' };
  }

  return blob;
}

export function deserialize(json: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  const migrated = migrate(raw);

  if (
    typeof migrated === 'object' &&
    migrated !== null &&
    (migrated as Record<string, unknown>).magic !== SAVE_MAGIC
  ) {
    return { ok: false, error: 'That file is not a Four Nations Tactics save.' };
  }

  const parsed = saveBlobSchema.safeParse(migrated);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first ? first.path.join('.') : 'the file';
    return { ok: false, error: `This save looks damaged (${where}).` };
  }

  if (parsed.data.format > SAVE_FORMAT_VERSION) {
    return {
      ok: false,
      error: 'This save was made by a newer version of the game. Update, then try again.',
    };
  }

  return { ok: true, blob: parsed.data };
}

/** The rules state out of a validated blob. */
export function stateFromBlob(blob: SaveBlob): GameState {
  return blob.state as unknown as GameState;
}

/** One-line description of where a party is up to, for the slot button. */
export function describeProgress(state: GameState, storyTitle: string | null): string {
  const level = Math.max(...state.party.map((u) => u.level));
  const names = state.party.map((u) => u.name).join(', ');
  const place = storyTitle ?? (state.battle ? 'In battle' : 'On the road');
  return `${place} — level ${level} — ${names}`;
}
