/**
 * A save's history against a story that was edited after it was written
 * (#773, ADR 0112).
 *
 * `migrate()` protects a save's format and the id ledger protects its ids.
 * This protects what it remembers. The rule:
 *
 * > For every frozen save, each flag that content still ahead of that save can
 * > read must be one of: already in the save, still settable from where the
 * > save stands, or covered by a declared backfill.
 *
 * "Still settable" cannot be proved from the graph: free roam reaches nearly
 * every scene with its conditions ignored, and a scene behind a one-shot gate
 * the save has passed is as reachable on paper as one ahead of it. So the
 * check does not guess. It compares today's story with a **snapshot of the
 * story as each release shipped it** (`fixtures/releases/<id>/history.json`),
 * and asks the writer to answer for every difference that can strand a save:
 *
 * - `checkReleases`: a flag that something reads gained a **write site** (a
 *   scene, an option, an app module) inside a region the release already
 *   contained. Some save of that release may be past it, so the flag's
 *   registry entry must say how such a save answers (`FlagDef.oldSaves`): a
 *   backfill rule, "still open to every save", or "unset is the true answer".
 *   A flag set only in regions newer than the release needs nothing: nobody
 *   has been there. "Read" means read anywhere, so no reader is ever missed.
 *   A **scene** some `visited` condition reads is held to the same rule when
 *   it is added to a region a release shipped (`LATE_SCENES` in `flags.ts`):
 *   being there is history too.
 * - `checkSave`: one frozen save, loaded as the app loads it. Where it has
 *   walked through a scene that sets a flag on entry today and still does not
 *   hold the flag, it is stranded for certain, and only an explicit `unset` or
 *   `open` answer excuses it. This also proves each rule reaches the saves it
 *   was written for.
 * - `checkRules`: a rule reads only what the saves it serves can hold, and a
 *   rule a release shipped is never edited afterwards.
 *
 * Pure data in, data out. `saveHistoryNow.ts` gathers today's content and
 * `saveHistory.test.ts` feeds it the frozen corpus.
 */

import type { BackfillRule } from '../../core/save/backfill';
import { resolveAlias } from '../../core/save/aliases';
import type { IdAliases, SavedIdKind } from '../../core/save/aliases';
import type { Condition, FlagValue, GameState } from '../../core/types';
import { STANDING_PREFIX } from '../../core/story/conditions';
import type { FlagUse } from './flagUsage';
import { itemNames, keyMatches, registryEntryFor } from './flagUsage';
import type { FlagDef, FlagType, OldSavesAnswer } from './flags';

/** One place a flag is written. */
export interface WriteSite {
  readonly key: string;
  /** `story:<node id>`, `app:<module>` and so on, as the registry names areas. */
  readonly area: string;
  /**
   * - `entry`: a `flags` node, which writes whenever it is entered;
   * - `option`: one option of a choice (a value, or a standing delta);
   * - `app`: app code.
   */
  readonly how: 'entry' | 'option' | 'app';
  /**
   * Every write the site makes, sorted: where inside the record and what
   * (`set=true`, `options[→gate_talked].setFlags="crew"`, `options[→home].adjust=1`). An
   * option is named by where it leads, so inserting one leaves the others alone. App sites
   * list none: the registry names the module, not the line.
   */
  readonly values: readonly string[];
  /**
   * The same writes with each option named by its position (`options[1].setFlags="crew"`),
   * only where that differs: how the releases frozen before option identity recorded them.
   */
  readonly positional?: readonly string[];
}

/** The parts of the story a save's history depends on, as content has them today. */
export interface StoryHistory {
  /** The highest backfill rule revision (`HISTORY_REV`). */
  readonly historyRev: number;
  /** Region id to every area it owns (story nodes, maps, encounters, residents). */
  readonly regions: Readonly<Record<string, readonly string[]>>;
  readonly writes: readonly WriteSite[];
  /**
   * Area to every road it opens into a story scene, sorted (`next=gate_talked_through`,
   * `options[→home].next=home`, `npcs[2].node=mira_intro`). A road rerouted to a scene that
   * already existed changes no write site, so only this shows it (#813).
   */
  readonly edges?: Readonly<Record<string, readonly string[]>>;
}

/**
 * The snapshot format. Absent (1): options named by position, no edges. 2: options named by
 * where they lead (`WriteSite.values`), and `edges` recorded.
 */
export const SNAPSHOT_FORMAT = 2;

/** `StoryHistory` as one release shipped it, frozen beside that release's saves. */
export interface HistorySnapshot extends StoryHistory {
  readonly format?: number;
  readonly release: string;
  /** The date the release was frozen, and the commit its content came from. */
  readonly frozen: string;
  readonly commit: string;
  readonly note: string;
  /** The backfill rules the release shipped. They never change afterwards. */
  readonly rules: readonly BackfillRule[];
}

/** Areas outside every region (disciplines, followers, the journal, the app) have always shipped. */
const CORE = 'core';

const AREA_KINDS: Readonly<Record<string, SavedIdKind>> = {
  story: 'story',
  map: 'maps',
  encounter: 'encounters',
  resident: 'residents',
  anchor: 'anchors',
  discipline: 'disciplines',
  character: 'characters',
  enemy: 'enemies',
  ability: 'abilities',
  prop: 'props',
};

function splitArea(area: string): readonly [string, string] {
  const at = area.indexOf(':');
  return at < 0 ? [area, ''] : [area.slice(0, at), area.slice(at + 1)];
}

/** An area as it is named today: a retired id follows the alias table. */
export function currentArea(aliases: IdAliases, area: string): string {
  const [prefix, id] = splitArea(area);
  const kind = AREA_KINDS[prefix];
  return kind ? `${prefix}:${resolveAlias(aliases, kind, id)}` : area;
}

/** Every write site in a list of flag uses. */
export function writeSites(uses: readonly FlagUse[]): WriteSite[] {
  const sites = new Map<
    string,
    { site: WriteSite; values: Set<string>; positional: Set<string> }
  >();
  for (const use of uses) {
    if (use.role !== 'write') continue;
    const id = `${use.key}\n${use.area}`;
    const how: WriteSite['how'] = use.area.startsWith('app:')
      ? 'app'
      : use.at === 'set'
        ? 'entry'
        : 'option';
    const held = sites.get(id) ?? {
      site: { key: use.key, area: use.area, how, values: [] },
      values: new Set<string>(),
      positional: new Set<string>(),
    };
    // Each write keeps its place inside the record (`options[→home].setFlags=true`), so a flag
    // added to one more option of a choice changes the site.
    if (how !== 'app') {
      const written = `=${use.value === undefined ? '' : JSON.stringify(use.value)}`;
      held.values.add(`${use.at}${written}`);
      held.positional.add(`${use.positionalAt ?? use.at}${written}`);
    }
    // A node is one kind, so a site cannot be both; if it ever is, `entry` is the stronger claim.
    if (how === 'entry' && held.site.how !== 'entry') held.site = { ...held.site, how };
    sites.set(id, held);
  }
  return [...sites.values()]
    .map(({ site, values, positional }) => {
      const named = [...values].sort();
      const placed = [...positional].sort();
      return {
        ...site,
        values: named,
        ...(placed.join() !== named.join() && { positional: placed }),
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key) || a.area.localeCompare(b.area));
}

/**
 * The fields that lead somewhere: a scene's `next` (and each option's), a battle's `onDefeat`,
 * the two arms of a branch, and the `node` an NPC, a route or a trigger opens. Other fields can
 * hold a scene's id by coincidence (a flag key, an NPC id, a camera target) and are no road.
 */
const ROAD_FIELDS: ReadonlySet<string> = new Set([
  'next',
  'onDefeat',
  'ifSet',
  'ifUnset',
  'ifTrue',
  'ifFalse',
  'node',
]);

/**
 * Every road each record opens into a story scene: a road field (`ROAD_FIELDS`) naming a story
 * node. Options are named by where they lead, as in `WriteSite.values`.
 */
export function storyEdges(
  sources: readonly { readonly name: string; readonly records: readonly unknown[] }[],
  nodes: ReadonlySet<string>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const source of sources) {
    source.records.forEach((record, index) => {
      const id = (record as { id?: unknown } | null)?.id;
      const area = `${source.name}:${typeof id === 'string' ? id : String(index)}`;
      const edges = new Set<string>();
      const seen = new Set<unknown>();
      const walk = (value: unknown, path: string): void => {
        if (typeof value !== 'object' || value === null || seen.has(value)) return;
        seen.add(value);
        if (Array.isArray(value)) {
          const names = itemNames(value);
          value.forEach((item, at) => walk(item, `${path}[${names[at] ?? at}]`));
          return;
        }
        const node = value as Record<string, unknown>;
        if (node.kind === 'visited') return;
        for (const [key, item] of Object.entries(node)) {
          const where = path ? `${path}.${key}` : key;
          if (typeof item === 'string') {
            if (ROAD_FIELDS.has(key) && nodes.has(item)) edges.add(`${where}=${item}`);
          } else walk(item, where);
        }
      };
      walk(record, '');
      if (edges.size > 0) out[area] = [...edges].sort();
    });
  }
  return out;
}

/** Flag key to the areas that read it. */
export function readersOf(uses: readonly FlagUse[]): Map<string, string[]> {
  const readers = new Map<string, string[]>();
  for (const use of uses) {
    if (use.role !== 'read') continue;
    const areas = readers.get(use.key) ?? [];
    if (!areas.includes(use.area)) areas.push(use.area);
    readers.set(use.key, areas);
  }
  for (const areas of readers.values()) areas.sort();
  return readers;
}

/** Story node to the areas whose `visited` conditions read it. */
export function visitedReaders(
  sources: readonly { readonly name: string; readonly records: readonly unknown[] }[],
): Map<string, string[]> {
  const readers = new Map<string, string[]>();
  for (const source of sources) {
    source.records.forEach((record, index) => {
      const id = (record as { id?: unknown } | null)?.id;
      const area = `${source.name}:${typeof id === 'string' ? id : String(index)}`;
      const seen = new Set<unknown>();
      const walk = (value: unknown): void => {
        if (typeof value !== 'object' || value === null || seen.has(value)) return;
        seen.add(value);
        if (Array.isArray(value)) return value.forEach(walk);
        const node = value as Record<string, unknown>;
        // A `visited` condition, or an arrival shot that plays until a scene has been seen.
        const read =
          node.kind === 'visited' && typeof node.nodeId === 'string'
            ? node.nodeId
            : typeof node.unlessVisited === 'string'
              ? node.unlessVisited
              : null;
        if (read !== null) {
          const areas = readers.get(read) ?? [];
          if (!areas.includes(area)) areas.push(area);
          readers.set(read, areas);
        }
        Object.values(node).forEach(walk);
      };
      walk(record);
    });
  }
  for (const areas of readers.values()) areas.sort();
  return readers;
}

/** The areas that read `key`, a family key (`guidance.tip.*`) matching either way. */
function readersFor(readers: ReadonlyMap<string, readonly string[]>, key: string): string[] {
  const out = new Set<string>();
  for (const [read, areas] of readers)
    if (keyMatches(key, read) || keyMatches(read, key)) for (const area of areas) out.add(area);
  return [...out].sort();
}

function regionOf(regions: Readonly<Record<string, readonly string[]>>, area: string): string {
  for (const [id, areas] of Object.entries(regions)) if (areas.includes(area)) return id;
  return CORE;
}

/**
 * Whether a release shipped the territory `area` is in: shared content, or a
 * region that today holds anything the release had. Decided by what the
 * region contains, not by its id, so renaming or splitting a region hides
 * nothing.
 */
function shippedTerritory(now: StoryHistory, shipped: ReadonlySet<string>, area: string): boolean {
  if (shipped.has(area)) return true;
  const region = regionOf(now.regions, area);
  if (region === CORE) return true;
  return (now.regions[region] ?? []).some((other) => shipped.has(other));
}

function shippedAreas(release: HistorySnapshot, aliases: IdAliases): Set<string> {
  return new Set(
    Object.values(release.regions)
      .flat()
      .map((area) => currentArea(aliases, area)),
  );
}

function shortList(items: readonly string[], most = 4): string {
  return items.length <= most
    ? items.join(', ')
    : `${items.slice(0, most).join(', ')} and ${items.length - most} more`;
}

/* ------------------------------------------------------------------ */
/* Releases: what changed under saves already written                  */
/* ------------------------------------------------------------------ */

export interface HistoryInput {
  readonly now: StoryHistory;
  /** Today's readers (`readersOf`). */
  readonly readers: ReadonlyMap<string, readonly string[]>;
  /** Today's `visited` readers (`visitedReaders`). */
  readonly visitedReaders: ReadonlyMap<string, readonly string[]>;
  /** How old saves answer for a scene added under them (`LATE_SCENES`). */
  readonly scenes: Readonly<Record<string, OldSavesAnswer>>;
  /** How old saves answer for a road opened under them into an old scene (`LATE_EDGES`). */
  readonly edges: Readonly<Record<string, OldSavesAnswer>>;
  /** Every release snapshot, oldest first. */
  readonly releases: readonly HistorySnapshot[];
  readonly registry: readonly FlagDef[];
  readonly rules: readonly BackfillRule[];
  readonly aliases: IdAliases;
}

/** A write site today that a release did not ship, in territory that release did ship. */
export interface LateWrite {
  readonly release: string;
  readonly site: WriteSite;
  /** `new`: the release had no such site. `changed`: it wrote other values there. */
  readonly change: 'new' | 'changed';
  readonly was?: readonly string[];
  readonly readers: readonly string[];
}

/** Every late write: a read flag that gained or changed a write site under a release's saves. */
export function lateWrites(input: HistoryInput): LateWrite[] {
  const out: LateWrite[] = [];
  for (const release of input.releases) {
    const shipped = new Map<string, WriteSite>();
    // A release frozen before option identity named options by position: compare in that form.
    const valuesOf = (site: WriteSite): readonly string[] =>
      (release.format ?? 1) >= 2 ? site.values : (site.positional ?? site.values);
    for (const site of release.writes) {
      const key = resolveAlias(input.aliases, 'flags', site.key);
      shipped.set(`${key}\n${currentArea(input.aliases, site.area)}`, site);
    }
    const areas = shippedAreas(release, input.aliases);
    for (const site of input.now.writes) {
      // A region the release never contained is ahead of every one of its saves.
      if (!shippedTerritory(input.now, areas, site.area)) continue;
      const readers = readersFor(input.readers, site.key);
      if (readers.length === 0) continue;
      const before = shipped.get(`${site.key}\n${site.area}`);
      if (!before) {
        out.push({ release: release.release, site, change: 'new', readers });
      } else if (before.values.join() !== valuesOf(site).join()) {
        out.push({
          release: release.release,
          site,
          change: 'changed',
          was: before.values,
          readers,
        });
      }
    }
  }
  return out;
}

/** A scene a `visited` condition reads that a release did not have, in a region it did have. */
export interface LateScene {
  readonly release: string;
  readonly node: string;
  readonly readers: readonly string[];
}

export function lateScenes(input: HistoryInput): LateScene[] {
  const out: LateScene[] = [];
  for (const release of input.releases) {
    const shipped = shippedAreas(release, input.aliases);
    for (const [node, readers] of input.visitedReaders) {
      const area = `story:${node}`;
      if (shipped.has(area) || !shippedTerritory(input.now, shipped, area)) continue;
      out.push({ release: release.release, node, readers });
    }
  }
  return out;
}

/**
 * A road a release did not have, opened from an area it did have into a scene it also had.
 * A save of that release went the old way, so it never passed that scene from here: if the
 * scene (or anything after it) records something a later scene reads, the save lacks it, and
 * no write site has changed. A road into a new scene needs nothing here: whatever the new
 * scene records is a new write site, which `lateWrites` asks about.
 */
export interface LateEdge {
  readonly release: string;
  readonly area: string;
  readonly edge: string;
}

export function lateEdges(input: HistoryInput): LateEdge[] {
  const out: LateEdge[] = [];
  const nowEdges = input.now.edges ?? {};
  for (const release of input.releases) {
    if (!release.edges) continue; // frozen before edges were recorded
    const shipped = shippedAreas(release, input.aliases);
    // Two retired areas can fold onto one live id (a copied chain aliased onto the plain one), so
    // their roads are united rather than the later one replacing the earlier.
    const before = new Map<string, Set<string>>();
    for (const [area, edges] of Object.entries(release.edges)) {
      const key = currentArea(input.aliases, area);
      const had = before.get(key) ?? new Set<string>();
      for (const edge of edges) {
        const at = edge.lastIndexOf('=');
        had.add(`${edge.slice(0, at)}=${resolveAlias(input.aliases, 'story', edge.slice(at + 1))}`);
      }
      before.set(key, had);
    }
    for (const [area, edges] of Object.entries(nowEdges)) {
      if (!shipped.has(area)) continue; // a new area: its roads into old scenes are new writes' business
      const had = before.get(area) ?? new Set<string>();
      for (const edge of edges) {
        if (had.has(edge)) continue;
        const target = edge.slice(edge.lastIndexOf('=') + 1);
        if (!shipped.has(`story:${target}`)) continue;
        out.push({ release: release.release, area, edge });
      }
    }
  }
  return out;
}

function describeLate(late: LateWrite): string {
  const what =
    late.change === 'new'
      ? `is now written at ${late.site.area} (${late.site.how})`
      : `is written at ${late.site.area} as ${late.site.values.join(' | ')}, where the release wrote ${(late.was ?? []).join(' | ') || 'nothing'}`;
  return `flag "${late.site.key}" ${what}, which release ${late.release} shipped without. It is read by ${shortList(late.readers)}.`;
}

/** The line to add, with the release and the site already filled in. */
function declareFlag(release: string, area: string): string {
  return `Say how that release's saves answer in its registry entry (src/content/story/flags.ts): oldSaves: { upTo: '${release}', sites: ['${area}'], answer: 'backfill' | 'open' | 'unset', why: '...' }.`;
}

function declareScene(release: string): string {
  return `Say how that release's saves answer in LATE_SCENES (src/content/story/flags.ts): { upTo: '${release}', answer: 'backfill' | 'open' | 'unset', why: '...' }.`;
}

function declareEdge(release: string, area: string, edge: string): string {
  return `Say how that release's saves answer in LATE_EDGES (src/content/story/flags.ts): '${area}': { upTo: '${release}', sites: ['${edge}'], answer: 'backfill' | 'open' | 'unset', why: '...' }.`;
}

/**
 * Every late write and late scene that does not answer for the release's
 * saves. Empty means each one is declared: a backfill rule newer than the
 * release, or an `open` or `unset` answer that names the release (or a later
 * one).
 */
export function checkReleases(input: HistoryInput): string[] {
  const problems: string[] = [];
  const order = new Map(input.releases.map((release, index) => [release.release, index]));
  const revOf = new Map(input.releases.map((release) => [release.release, release.historyRev]));

  const hold = (
    name: string,
    release: string,
    said: string,
    declare: string,
    answer: OldSavesAnswer | undefined,
    ruled: (rule: BackfillRule) => boolean,
    site?: string,
    readers?: readonly string[],
  ): void => {
    if (!answer) {
      problems.push(`${said} ${declare}`);
      return;
    }
    // "Never happened" was decided for the readers there were. A new reader may need the
    // other road, so it is asked about afresh (#813).
    if (answer.answer === 'unset' && readers !== undefined) {
      const known = new Set(answer.readers ?? []);
      const added = readers.filter((reader) => !known.has(reader));
      if (added.length > 0) {
        problems.push(
          `${said} Its oldSaves answer is "unset" for the readers it names (${(answer.readers ?? []).join(', ') || 'none'}), and ${shortList(added)} now ${added.length === 1 ? 'reads' : 'read'} it too: read the answer again with ${added.length === 1 ? 'that reader' : 'those readers'} in mind, then add ${added.length === 1 ? 'it' : 'them'} to "readers".`,
        );
        return;
      }
    }
    // An answer is for the writes it names: one written for a new talk does not cover a
    // write added to an old scene later.
    if (site !== undefined && !(answer.sites ?? []).includes(site)) {
      problems.push(
        `${said} Its oldSaves answer does not name this site (sites: ${(answer.sites ?? []).join(', ') || 'none'}): read the answer again with this write in mind, then add "${site}".`,
      );
      return;
    }
    const covers = order.get(answer.upTo);
    if (covers === undefined) {
      problems.push(
        `${name}: its answer for old saves names "${answer.upTo}", which is not a release (${[...order.keys()].join(', ')}).`,
      );
      return;
    }
    if (covers < (order.get(release) ?? 0)) {
      problems.push(
        `${said} Its answer for old saves stops at release ${answer.upTo}: read it again for ${release} and move upTo.`,
      );
      return;
    }
    if (answer.answer !== 'backfill') return;
    const shippedRev = revOf.get(release) ?? 0;
    if (!input.rules.some((rule) => ruled(rule) && rule.rev > shippedRev))
      problems.push(
        `${said} It answers "backfill", but src/content/story/flagBackfills.ts has no rule for it newer than that release (rev > ${shippedRev}).`,
      );
  };

  for (const late of lateWrites(input))
    hold(
      `flag "${late.site.key}"`,
      late.release,
      describeLate(late),
      declareFlag(late.release, late.site.area),
      registryEntryFor(input.registry, late.site.key)?.oldSaves,
      (rule) => 'key' in rule && rule.key === late.site.key,
      late.site.area,
      late.readers,
    );
  for (const late of lateScenes(input))
    hold(
      `scene "${late.node}"`,
      late.release,
      `scene "${late.node}" is read by a visited condition (${shortList(late.readers)}) and was added to a region release ${late.release} had already shipped, so a save of that release may be past the only road into it.`,
      declareScene(late.release),
      Object.hasOwn(input.scenes, late.node) ? input.scenes[late.node] : undefined,
      (rule) => 'node' in rule && rule.node === late.node,
      undefined,
      late.readers,
    );
  for (const late of lateEdges(input))
    hold(
      `road "${late.edge}" in ${late.area}`,
      late.release,
      `${late.area} now opens a road "${late.edge}" into a scene release ${late.release} already had, which that release did not open from there. A save of that release went the old way, so it never passed that scene from here: anything the scene (or a scene after it) records, the save lacks.`,
      declareEdge(late.release, late.area, late.edge),
      Object.hasOwn(input.edges, late.area) ? input.edges[late.area] : undefined,
      // A backfill for a road answers for what the scenes past it record: any newer rule may.
      () => true,
      late.edge,
    );
  return [...new Set(problems)];
}

/* ------------------------------------------------------------------ */
/* Rules: readable by the saves they serve, and never rewritten        */
/* ------------------------------------------------------------------ */

/** Every node a condition's `visited` names and every flag key it reads. */
function conditionInputs(condition: Condition): { nodes: string[]; flags: string[] } {
  const nodes: string[] = [];
  const flags: string[] = [];
  const walk = (value: Condition): void => {
    switch (value.kind) {
      case 'visited':
        nodes.push(value.nodeId);
        return;
      case 'flag':
        flags.push(value.key);
        return;
      case 'standing':
        flags.push(`${STANDING_PREFIX}${value.nation}`);
        return;
      case 'all':
      case 'any':
        value.of.forEach(walk);
        return;
      case 'not':
        walk(value.of);
        return;
      default:
        return;
    }
  };
  walk(condition);
  return { nodes, flags };
}

function typesOf(flag: FlagDef): readonly FlagType[] {
  return typeof flag.type === 'string' ? [flag.type] : flag.type;
}

function fits(flag: FlagDef, value: FlagValue): boolean {
  if (!typesOf(flag).includes(typeof value as FlagType)) return false;
  return !flag.values || flag.values.includes(value);
}

export function checkRules(input: HistoryInput): string[] {
  const problems: string[] = [];
  const { rules, registry, releases, aliases } = input;
  const nodesNow = new Set(
    Object.values(input.now.regions)
      .flat()
      .filter((area) => area.startsWith('story:'))
      .map((area) => area.slice('story:'.length)),
  );

  let previous = 0;
  for (const rule of rules) {
    const name = `backfill rule ${rule.rev} ("${'node' in rule ? rule.node : rule.key}")`;
    if (!Number.isInteger(rule.rev) || rule.rev <= previous)
      problems.push(
        `${name}: revisions are whole numbers that only grow, in file order; this follows ${previous}`,
      );
    previous = Math.max(previous, rule.rev);

    if ('node' in rule) {
      if (!nodesNow.has(rule.node)) problems.push(`${name}: the scene does not exist`);
      const answer = Object.hasOwn(input.scenes, rule.node) ? input.scenes[rule.node] : undefined;
      if (answer?.answer !== 'backfill')
        problems.push(`${name}: LATE_SCENES does not answer "backfill" for the scene`);
    } else {
      const entry = registry.find((flag) => flag.key === rule.key);
      if (!entry) {
        problems.push(`${name}: the flag is not one concrete key in the registry`);
      } else {
        if (entry.oldSaves?.answer !== 'backfill')
          problems.push(`${name}: the registry entry's oldSaves does not answer "backfill"`);
        if ('adjust' in rule) {
          if (
            !rule.key.startsWith(STANDING_PREFIX) ||
            !Number.isInteger(rule.adjust) ||
            !rule.adjust
          )
            problems.push(`${name}: "adjust" is a whole, non-zero delta to a standing key`);
        } else if (rule.key.startsWith(STANDING_PREFIX)) {
          problems.push(`${name}: a standing key is adjusted, never set`);
        } else if (!fits(entry, rule.set)) {
          problems.push(`${name}: ${JSON.stringify(rule.set)} is not a value the registry allows`);
        }
      }
    }

    // A rule answers for something added under a release. Aimed at a release that already
    // recorded it, the rule would overwrite a real answer or add a delta twice.
    for (const release of releases) {
      if (release.historyRev >= rule.rev) continue;
      const one = { ...input, releases: [release] };
      const late =
        'node' in rule
          ? lateScenes(one).some((scene) => scene.node === rule.node)
          : lateWrites(one).some((write) => write.site.key === rule.key);
      if (!late)
        problems.push(
          `${name}: release ${release.release} already recorded this, so the rule would rewrite what its saves really hold. A rule ships in the same release as the write it answers for.`,
        );
    }

    const inputs = conditionInputs(rule.when);
    if (inputs.nodes.length + inputs.flags.length === 0)
      problems.push(
        `${name}: "when" must read the save's own history (a visited node or an older flag), or a save that has not reached the scene yet is given the flag too`,
      );
    for (const node of inputs.nodes)
      if (!nodesNow.has(node))
        problems.push(`${name}: "when" names story node "${node}", which does not exist`);

    // What the rule reads must be something the saves it serves could hold.
    for (const release of releases) {
      if (release.historyRev >= rule.rev) continue;
      const nodes = new Set(
        Object.values(release.regions)
          .flat()
          .map((area) => currentArea(aliases, area)),
      );
      const flags = new Set(release.writes.map((site) => resolveAlias(aliases, 'flags', site.key)));
      for (const earlier of rules) {
        if (earlier.rev >= rule.rev) continue;
        if ('node' in earlier) nodes.add(`story:${earlier.node}`);
        else flags.add(earlier.key);
      }
      for (const node of inputs.nodes)
        if (!nodes.has(`story:${node}`))
          problems.push(
            `${name}: "when" reads visited "${node}", a scene release ${release.release} did not have, so none of its saves can have visited it`,
          );
      for (const flag of inputs.flags)
        if (![...flags].some((held) => keyMatches(held, flag)))
          problems.push(
            `${name}: "when" reads flag "${flag}", which release ${release.release} never wrote and no earlier rule supplies`,
          );
    }
  }

  const answers: [string, OldSavesAnswer, boolean][] = [
    ...registry.flatMap((flag): [string, OldSavesAnswer, boolean][] =>
      flag.oldSaves
        ? [
            [
              `flag "${flag.key}"`,
              flag.oldSaves,
              rules.some((rule) => 'key' in rule && rule.key === flag.key),
            ],
          ]
        : [],
    ),
    ...Object.entries(input.scenes).map(([node, answer]): [string, OldSavesAnswer, boolean] => [
      `scene "${node}"`,
      answer,
      rules.some((rule) => 'node' in rule && rule.node === node),
    ]),
  ];
  for (const [name, answer, ruled] of answers) {
    if (answer.answer === 'backfill' && !ruled)
      problems.push(
        `${name} answers old saves with "backfill", but flagBackfills.ts has no rule for it`,
      );
    if (!answer.why.trim()) problems.push(`${name}: its answer for old saves needs a "why"`);
    if (!releases.some((release) => release.release === answer.upTo))
      problems.push(
        `${name}: its answer for old saves names "${answer.upTo}", which is not a release`,
      );
  }
  for (const node of Object.keys(input.scenes))
    if (!nodesNow.has(node))
      problems.push(`LATE_SCENES names "${node}", which is not a story node`);
  // A road's answer: it names the roads it answers for, and the area still has each of them.
  for (const [area, answer] of Object.entries(input.edges)) {
    const name = `LATE_EDGES "${area}"`;
    if (!answer.why.trim()) problems.push(`${name}: its answer for old saves needs a "why"`);
    if (!releases.some((release) => release.release === answer.upTo))
      problems.push(`${name}: its answer names "${answer.upTo}", which is not a release`);
    if ((answer.sites ?? []).length === 0)
      problems.push(`${name}: name the roads it answers for in "sites"`);
    const roads = new Set(input.now.edges?.[area] ?? []);
    for (const road of answer.sites ?? [])
      if (!roads.has(road)) problems.push(`${name}: "${road}" is not a road this area opens today`);
    if (answer.answer === 'backfill' && rules.length === 0)
      problems.push(`${name} answers "backfill", but flagBackfills.ts has no rules`);
  }

  // A released rule is part of every save loaded since: it never changes or goes away.
  for (const release of releases) {
    for (const shipped of release.rules) {
      const kept = rules.find((rule) => rule.rev === shipped.rev);
      if (!kept || JSON.stringify(kept) !== JSON.stringify(shipped))
        problems.push(
          `backfill rule ${shipped.rev} ("${'node' in shipped ? shipped.node : shipped.key}") shipped in release ${release.release} and has since been ${kept ? 'edited' : 'removed'}; add a new rule with a higher rev instead`,
        );
    }
    if (input.now.historyRev < release.historyRev)
      problems.push(
        `the history revision went backwards: release ${release.release} shipped ${release.historyRev}, content is at ${input.now.historyRev}`,
      );
  }
  return [...new Set(problems)];
}

/* ------------------------------------------------------------------ */
/* One save: stranded for certain                                      */
/* ------------------------------------------------------------------ */

/**
 * Flags this loaded save has walked past without holding. `state` is the save
 * after the app's load path (aliases, then backfills). A `flags` node writes
 * whenever it is entered, so a save that visited one and does not hold its
 * flag was written before the node set it. Nothing here is approximate.
 */
export function checkSave(
  input: Pick<HistoryInput, 'now' | 'readers' | 'registry'>,
  save: string,
  state: Pick<GameState, 'flags' | 'story'>,
): string[] {
  const problems: string[] = [];
  const visited = new Set(state.story.visited);
  for (const site of input.now.writes) {
    if (site.how !== 'entry' || !site.area.startsWith('story:')) continue;
    if (!visited.has(site.area.slice('story:'.length))) continue;
    if (Object.hasOwn(state.flags, site.key)) continue;
    const readers = readersFor(input.readers, site.key);
    if (readers.length === 0) continue;
    const answer = registryEntryFor(input.registry, site.key)?.oldSaves;
    if (answer && answer.answer !== 'backfill') continue;
    problems.push(
      `${save} has visited ${site.area}, which sets "${site.key}" today, and does not hold it (read by ${shortList(readers)}). ${
        answer
          ? 'Its backfill rule did not reach this save: check the rule\'s "when" and "rev".'
          : `Say how saves from before that write answer in its registry entry (src/content/story/flags.ts): oldSaves: { upTo: '<newest release>', sites: ['${site.area}'], answer: 'backfill' | 'open' | 'unset', why: '...' }.`
      }`,
    );
  }
  return problems;
}
