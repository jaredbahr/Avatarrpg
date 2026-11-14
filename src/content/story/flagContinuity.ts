/**
 * A save's history against the story still ahead of it (#773).
 *
 * A save is a place in the story plus the flags set on the way there. When a
 * later region reads a flag that an earlier region now sets, a save already
 * past that earlier point never got it, and because unset and `0` are falsy
 * the later scene silently takes the "never happened" road. The rule:
 *
 * > For every frozen save, each flag that content still ahead of that save can
 * > read must be one of: already in the save, still settable from where the
 * > save stands, or covered by a declared backfill (`FlagDef.backfill`).
 *
 * `missingHistory` applies it to one save. Reachability over-approximates on
 * the side that reports more, never less:
 *
 * - **readers** count as ahead whenever they might be: a story node reachable
 *   through every edge with its conditions ignored, where an explore node
 *   reaches every node and map its map names and every node a resident names;
 *   a map once reachable; anything outside the story and the maps (encounters,
 *   disciplines, residents, followers, the journal, the app) always;
 * - **setters** count as still able to set only if they are a story node that
 *   is reachable and not yet visited (a visited one has had its chance), or
 *   app code (which sets its flags at any time).
 *
 * Standing keys (`standing.<nation>`) are left out: unset is neutral by design,
 * and a later standing change cannot be told apart from one never made.
 *
 * Pure data in, data out: the test feeds it the frozen corpus.
 */

import type { GameState, MapDef, ResidentDef, StoryNode } from '../../core/types';
import { STANDING_PREFIX } from '../../core/story/conditions';
import type { FlagUse } from './flagUsage';
import { keyMatches } from './flagUsage';

export interface ContinuityContent {
  readonly story: readonly StoryNode[];
  readonly maps: readonly MapDef[];
  readonly residents: readonly ResidentDef[];
  /** Every read and write of a flag, from `collectFlagUses` (plus the app's writes). */
  readonly uses: readonly FlagUse[];
  /** Keys (or `.*` families) that declare a backfill. */
  readonly backfilled: readonly string[];
}

export interface MissingHistory {
  readonly key: string;
  /** The areas still ahead of the save that read it. */
  readonly readers: readonly string[];
  /** Its setters, none of which can still set it from this save. */
  readonly setters: readonly string[];
}

/** Every string anywhere inside a value, for the over-approximating edge scan. */
function strings(value: unknown, out: Set<string>, seen = new Set<unknown>()): Set<string> {
  if (typeof value === 'string') {
    out.add(value);
  } else if (typeof value === 'object' && value !== null && !seen.has(value)) {
    seen.add(value);
    for (const child of Array.isArray(value) ? value : Object.values(value))
      strings(child, out, seen);
  }
  return out;
}

/** The story graph with every condition ignored. */
function storyEdges(content: ContinuityContent): ReadonlyMap<string, readonly string[]> {
  const nodeIds = new Set(content.story.map((node) => node.id));
  const mapIds = new Set(content.maps.map((map) => map.id));
  const exploreOn = new Map<string, string[]>();
  for (const node of content.story)
    if (node.kind === 'explore')
      exploreOn.set(node.mapId, [...(exploreOn.get(node.mapId) ?? []), node.id]);
  const named = (value: unknown) => [...strings(value, new Set())];
  const residentNodes = named(content.residents).filter((text) => nodeIds.has(text));
  const mapReach = new Map<string, string[]>();
  for (const map of content.maps) {
    const texts = named(map);
    mapReach.set(map.id, [
      ...texts.filter((text) => nodeIds.has(text)),
      ...texts.filter((text) => mapIds.has(text)).flatMap((id) => exploreOn.get(id) ?? []),
    ]);
  }
  const edges = new Map<string, string[]>();
  for (const node of content.story) {
    // Every node id the node itself names: next, options, branch arms, defeat, visited gates.
    const own = named(node).filter((text) => text !== node.id && nodeIds.has(text));
    const hub =
      node.kind === 'explore' ? [...(mapReach.get(node.mapId) ?? []), ...residentNodes] : [];
    edges.set(node.id, [...own, ...hub]);
  }
  return edges;
}

/** Story nodes and maps reachable from where the save stands. */
export function reachableFrom(
  content: ContinuityContent,
  save: Pick<GameState, 'story' | 'location'>,
): { readonly nodes: ReadonlySet<string>; readonly maps: ReadonlySet<string> } {
  const edges = storyEdges(content);
  const exploreOn = new Map<string, string[]>();
  for (const node of content.story)
    if (node.kind === 'explore')
      exploreOn.set(node.mapId, [...(exploreOn.get(node.mapId) ?? []), node.id]);
  const start = [
    ...(save.story.nodeId ? [save.story.nodeId] : []),
    ...(exploreOn.get(save.location.mapId) ?? []),
  ];
  const nodes = new Set<string>();
  const queue = [...start];
  while (queue.length) {
    const id = queue.pop();
    if (id === undefined || nodes.has(id)) continue;
    nodes.add(id);
    queue.push(...(edges.get(id) ?? []));
  }
  const byId = new Map(content.story.map((node) => [node.id, node]));
  const maps = new Set<string>([save.location.mapId]);
  for (const id of nodes) {
    const node = byId.get(id);
    if (node?.kind === 'explore') maps.add(node.mapId);
  }
  return { nodes, maps };
}

function areaAhead(
  area: string,
  reach: { readonly nodes: ReadonlySet<string>; readonly maps: ReadonlySet<string> },
): boolean {
  const split = area.indexOf(':');
  const kind = area.slice(0, split);
  const id = area.slice(split + 1);
  if (kind === 'story') return reach.nodes.has(id);
  if (kind === 'map') return reach.maps.has(id);
  return true;
}

/** The flags content ahead of this save reads that it can never come to hold. */
export function missingHistory(
  content: ContinuityContent,
  save: Pick<GameState, 'story' | 'location' | 'flags'>,
): MissingHistory[] {
  const reach = reachableFrom(content, save);
  const visited = new Set(save.story.visited);
  const byKey = new Map<string, { readers: string[]; setters: string[]; open: boolean }>();
  for (const use of content.uses) {
    if (use.key.startsWith(STANDING_PREFIX)) continue;
    const entry = byKey.get(use.key) ?? { readers: [], setters: [], open: false };
    byKey.set(use.key, entry);
    if (use.role === 'read') {
      if (areaAhead(use.area, reach) && !entry.readers.includes(use.area))
        entry.readers.push(use.area);
      continue;
    }
    if (!entry.setters.includes(use.area)) entry.setters.push(use.area);
    const split = use.area.indexOf(':');
    const kind = use.area.slice(0, split);
    const id = use.area.slice(split + 1);
    if (kind === 'app' || (kind === 'story' && reach.nodes.has(id) && !visited.has(id)))
      entry.open = true;
  }
  const out: MissingHistory[] = [];
  for (const [key, entry] of byKey) {
    // A flag nothing writes yet (a pending gate) is unset for every save alike.
    if (!entry.readers.length || !entry.setters.length || entry.open) continue;
    if (Object.hasOwn(save.flags, key)) continue;
    if (content.backfilled.some((registered) => keyMatches(registered, key))) continue;
    out.push({ key, readers: entry.readers.sort(), setters: entry.setters.sort() });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
