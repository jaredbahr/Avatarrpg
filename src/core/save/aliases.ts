/**
 * Content ids are forever (`docs/pipeline-proof-plan.md` §4).
 *
 * A save names content by id: the story node it stopped on, the map it stands
 * on, the flags it set, the abilities its party learned. A family's save from
 * the first region has to load years of updates later, so an id a save may
 * hold is never deleted or renamed silently. `src/content/ids.ledger.json`
 * records every such id ever shipped, and when one has to change,
 * `src/content/idAliases.ts` maps the retired id to its replacement.
 *
 * This module applies that table to a loaded game. It runs first on load
 * (`App.adoptSave`), before the app picks which region to fetch for the saved
 * map and before `reconcile` repairs the game against the content. The table
 * is passed in, so core stays free of content values.
 *
 * NPCs and triggers are keyed `<map id>:<id>`, as `world.fired` already keys
 * triggers, because their ids are only unique within a map.
 */

import type { GameState, PendingChoice, Unit } from '../types';

/** Every kind of id a save can hold. The ledger and the alias table use these keys. */
export const SAVED_ID_KINDS = [
  'story',
  'maps',
  'encounters',
  'npcs',
  'triggers',
  'anchors',
  'residents',
  'flags',
  'characters',
  'abilities',
  'disciplines',
  'enemies',
  'props',
  'statuses',
  'combos',
] as const;
export type SavedIdKind = (typeof SAVED_ID_KINDS)[number];

/** Retired id to replacement, per kind. A kind with no renames is left out. */
export type IdAliases = { readonly [K in SavedIdKind]?: Readonly<Record<string, string>> };

/** How far a chain of renames is followed; `idAliases.test` keeps real chains far shorter. */
const MAX_CHAIN = 32;

/**
 * The id `id` is now known by: the alias chain followed to its end, or `id`
 * itself. A cycle stops at the cap rather than looping; the content test
 * rejects one before it can ship.
 */
export function resolveAlias(aliases: IdAliases, kind: SavedIdKind, id: string): string {
  const table = aliases[kind];
  if (!table) return id;
  let current = id;
  for (let step = 0; step < MAX_CHAIN; step++) {
    const next = Object.hasOwn(table, current) ? table[current] : undefined;
    if (next === undefined || next === current) return current;
    current = next;
  }
  return current;
}

/**
 * A `<map id>:<id>` key renamed: the map part follows the map aliases, then
 * the whole key follows its own kind's aliases, tried under the old map id
 * first and the new one second, so either spelling can be aliased.
 */
export function resolveScopedAlias(
  aliases: IdAliases,
  kind: 'npcs' | 'triggers',
  key: string,
): string {
  const split = key.indexOf(':');
  if (split < 0) return resolveAlias(aliases, kind, key);
  const mapId = key.slice(0, split);
  const rest = key.slice(split + 1);
  const underOld = resolveAlias(aliases, kind, key);
  if (underOld !== key) return underOld;
  return resolveAlias(aliases, kind, `${resolveAlias(aliases, 'maps', mapId)}:${rest}`);
}

function hasAny(aliases: IdAliases): boolean {
  return SAVED_ID_KINDS.some((kind) => {
    const table = aliases[kind];
    return table !== undefined && Object.keys(table).length > 0;
  });
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Renames the keys of a record. Where a retired key and its replacement are
 * both present, the replacement's value wins: it was written by a newer build.
 */
function renameKeys<T>(
  record: Readonly<Record<string, T>>,
  rename: (key: string) => string,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    const next = rename(key);
    if (next === key || !Object.hasOwn(record, next)) out[next] = value;
  }
  return out;
}

function renameUnit(unit: Unit, aliases: IdAliases): Unit {
  return {
    ...unit,
    characterId: unit.characterId && resolveAlias(aliases, 'characters', unit.characterId),
    enemyId: unit.enemyId && resolveAlias(aliases, 'enemies', unit.enemyId),
    disciplineId: unit.disciplineId && resolveAlias(aliases, 'disciplines', unit.disciplineId),
    abilities: unique(unit.abilities.map((id) => resolveAlias(aliases, 'abilities', id))),
    cooldowns: renameKeys(unit.cooldowns, (id) => resolveAlias(aliases, 'abilities', id)),
    statuses: unit.statuses.map((status) => ({
      ...status,
      id: resolveAlias(aliases, 'statuses', status.id) as typeof status.id,
    })),
  };
}

function renameChoice(choice: PendingChoice, aliases: IdAliases): PendingChoice {
  const kind = choice.kind === 'ability' ? 'abilities' : 'disciplines';
  return {
    ...choice,
    options: unique(choice.options.map((id) => resolveAlias(aliases, kind, id))),
  };
}

/**
 * The loaded game with every retired id it holds replaced. Idempotent, and
 * returns `state` itself when the table is empty. Ids it does not know are
 * left alone: deciding what a missing id means is `reconcile`'s job.
 */
export function applyIdAliases(state: GameState, aliases: IdAliases): GameState {
  if (!hasAny(aliases)) return state;
  const map = (id: string): string => resolveAlias(aliases, 'maps', id);
  const talk = state.world.talk;
  const talkKey = talk ? resolveScopedAlias(aliases, 'npcs', `${talk.mapId}:${talk.npcId}`) : '';
  const split = talkKey.indexOf(':');
  const battle = state.battle;
  return {
    ...state,
    party: state.party.map((unit) => renameUnit(unit, aliases)),
    battle: battle && {
      ...battle,
      encounterId: resolveAlias(aliases, 'encounters', battle.encounterId),
      mapId: map(battle.mapId),
      units: battle.units.map((unit) => renameUnit(unit, aliases)),
      props: battle.props.map((prop) => ({
        ...prop,
        propId: resolveAlias(aliases, 'props', prop.propId),
      })),
    },
    story: {
      ...state.story,
      nodeId: state.story.nodeId && resolveAlias(aliases, 'story', state.story.nodeId),
      visited: unique(state.story.visited.map((id) => resolveAlias(aliases, 'story', id))),
    },
    flags: renameKeys(state.flags, (key) => resolveAlias(aliases, 'flags', key)),
    pendingChoices: state.pendingChoices.map((choice) => renameChoice(choice, aliases)),
    location: { ...state.location, mapId: map(state.location.mapId) },
    world: {
      ...state.world,
      returnPos: renameKeys(state.world.returnPos, map),
      fired: unique(state.world.fired.map((key) => resolveScopedAlias(aliases, 'triggers', key))),
      cleared: unique(state.world.cleared.map((id) => resolveAlias(aliases, 'encounters', id))),
      talk: talk && {
        mapId: talkKey.slice(0, split),
        npcId: talkKey.slice(split + 1),
        anchor: resolveAlias(aliases, 'anchors', talk.anchor),
      },
      residentProfiles: renameKeys(state.world.residentProfiles, (id) =>
        resolveAlias(aliases, 'residents', id),
      ),
    },
    discoveredCombos: unique(
      state.discoveredCombos.map((id) => resolveAlias(aliases, 'combos', id)),
    ),
  };
}
