/**
 * Every content id a save can hold, by kind, read from the full content index.
 *
 * `scripts/content/id-ledger.ts` writes these into `ids.ledger.json`, and
 * `savedIds.test.ts` holds the ledger, the content and `ID_ALIASES` together
 * (`src/core/save/aliases.ts` explains why). Tooling only: the shipped game
 * never imports this, so it may read every region.
 */
import { SAVED_ID_KINDS, resolveAlias, resolveScopedAlias } from '../core/save/aliases';
import type { IdAliases, SavedIdKind } from '../core/save/aliases';
import type { ContentIndex } from '../core/types';
import { FLAG_REGISTRY } from './story/flags';

export type SavedIds = Record<SavedIdKind, readonly string[]>;

function sorted(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort();
}

/** The ids `content` defines, each kind sorted and without duplicates. */
export function currentSavedIds(content: ContentIndex): SavedIds {
  const maps = [...content.maps.values()];
  return {
    story: sorted(content.story.keys()),
    maps: sorted(content.maps.keys()),
    encounters: sorted(content.encounters.keys()),
    npcs: sorted(maps.flatMap((map) => map.npcs.map((npc) => `${map.id}:${npc.id}`))),
    triggers: sorted(
      maps.flatMap((map) => (map.triggers ?? []).map((trigger) => `${map.id}:${trigger.id}`)),
    ),
    anchors: sorted(content.anchors.keys()),
    residents: sorted(content.residents.keys()),
    flags: sorted(FLAG_REGISTRY.map((flag) => flag.key)),
    characters: sorted(content.characters.keys()),
    abilities: sorted(content.abilities.keys()),
    disciplines: sorted(content.disciplines.keys()),
    enemies: sorted(content.enemies.keys()),
    props: sorted(content.props.keys()),
    statuses: sorted(content.statuses.keys()),
    combos: sorted(content.combos.map((combo) => combo.id)),
  };
}

/** `ledger` with every id of `current` added. Nothing is ever removed. */
export function mergeLedger(ledger: Partial<SavedIds>, current: SavedIds): SavedIds {
  const out = {} as Record<SavedIdKind, readonly string[]>;
  for (const kind of SAVED_ID_KINDS)
    out[kind] = sorted([...(ledger[kind] ?? []), ...current[kind]]);
  return out;
}

/** The id a retired one resolves to under `aliases`, by its kind's rule. */
export function resolveSavedId(aliases: IdAliases, kind: SavedIdKind, id: string): string {
  return kind === 'npcs' || kind === 'triggers'
    ? resolveScopedAlias(aliases, kind, id)
    : resolveAlias(aliases, kind, id);
}

/**
 * Everything wrong between a ledger, the content and the alias table, as
 * readable lines; empty when they agree.
 */
export function savedIdProblems(
  ledger: Partial<SavedIds>,
  current: SavedIds,
  aliases: IdAliases,
): string[] {
  const problems: string[] = [];
  for (const kind of SAVED_ID_KINDS) {
    const recorded = new Set(ledger[kind] ?? []);
    const live = new Set(current[kind]);
    for (const id of current[kind]) {
      if (!recorded.has(id)) {
        problems.push(`${kind} "${id}" is not in the ledger: run npm run ids:ledger`);
      }
    }
    for (const id of recorded) {
      if (live.has(id)) continue;
      const target = resolveSavedId(aliases, kind, id);
      if (target === id) {
        problems.push(
          `${kind} "${id}" was shipped and is gone: restore it or alias it in idAliases.ts`,
        );
      } else if (!live.has(target)) {
        problems.push(`${kind} "${id}" is aliased to "${target}", which does not exist`);
      }
    }
    for (const [from, to] of Object.entries(aliases[kind] ?? {})) {
      if (live.has(from)) problems.push(`${kind} alias "${from}" shadows a live id`);
      if (!recorded.has(from)) problems.push(`${kind} alias "${from}" was never in the ledger`);
      const end = resolveSavedId(aliases, kind, from);
      if (aliases[kind]?.[end] !== undefined) {
        problems.push(`${kind} alias "${from}" -> "${to}" loops`);
      }
    }
  }
  for (const id of current.maps) {
    if (id.includes(':')) problems.push(`map id "${id}" may not contain ":"`);
  }
  return problems;
}
