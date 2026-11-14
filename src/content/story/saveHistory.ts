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
import { keyMatches, registryEntryFor } from './flagUsage';
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
  /** Every value the site writes, as sorted JSON; a standing site lists its deltas. */
  readonly values: readonly string[];
}

/** The parts of the story a save's history depends on, as content has them today. */
export interface StoryHistory {
  /** The highest backfill rule revision (`HISTORY_REV`). */
  readonly historyRev: number;
  /** Region id to every area it owns (story nodes, maps, encounters, residents). */
  readonly regions: Readonly<Record<string, readonly string[]>>;
  readonly writes: readonly WriteSite[];
}

/** `StoryHistory` as one release shipped it, frozen beside that release's saves. */
export interface HistorySnapshot extends StoryHistory {
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
  const sites = new Map<string, { site: WriteSite; values: Set<string> }>();
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
    };
    if (use.value !== undefined) held.values.add(JSON.stringify(use.value));
    // A node is one kind, so a site cannot be both; if it ever is, `entry` is the stronger claim.
    if (how === 'entry' && held.site.how !== 'entry') held.site = { ...held.site, how };
    sites.set(id, held);
  }
  return [...sites.values()]
    .map(({ site, values }) => ({ ...site, values: [...values].sort() }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.area.localeCompare(b.area));
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
        if (node.kind === 'visited' && typeof node.nodeId === 'string') {
          const areas = readers.get(node.nodeId) ?? [];
          if (!areas.includes(area)) areas.push(area);
          readers.set(node.nodeId, areas);
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
    for (const site of release.writes) {
      const key = resolveAlias(input.aliases, 'flags', site.key);
      shipped.set(`${key}\n${currentArea(input.aliases, site.area)}`, site);
    }
    const shippedRegions = new Set(Object.keys(release.regions));
    for (const site of input.now.writes) {
      const region = regionOf(input.now.regions, site.area);
      // A region the release never contained is ahead of every one of its saves.
      if (region !== CORE && !shippedRegions.has(region)) continue;
      const readers = readersFor(input.readers, site.key);
      if (readers.length === 0) continue;
      const before = shipped.get(`${site.key}\n${site.area}`);
      if (!before) {
        out.push({ release: release.release, site, change: 'new', readers });
      } else if (before.values.join() !== site.values.join()) {
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
    const shipped = new Set(
      Object.values(release.regions)
        .flat()
        .map((area) => currentArea(input.aliases, area)),
    );
    const shippedRegions = new Set(Object.keys(release.regions));
    for (const [node, readers] of input.visitedReaders) {
      const area = `story:${node}`;
      if (shipped.has(area)) continue;
      const region = regionOf(input.now.regions, area);
      if (region === CORE || !shippedRegions.has(region)) continue;
      out.push({ release: release.release, node, readers });
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

const DECLARE =
  'Say how that release\'s saves answer in its registry entry (src/content/story/flags.ts): oldSaves: { upTo: "<release>", answer: "backfill" | "open" | "unset", why }.';
const DECLARE_SCENE =
  'Say how that release\'s saves answer in LATE_SCENES (src/content/story/flags.ts): { upTo: "<release>", answer: "backfill" | "open" | "unset", why }.';

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
  ): void => {
    if (!answer) {
      problems.push(`${said} ${declare}`);
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
      DECLARE,
      registryEntryFor(input.registry, late.site.key)?.oldSaves,
      (rule) => 'key' in rule && rule.key === late.site.key,
    );
  for (const late of lateScenes(input))
    hold(
      `scene "${late.node}"`,
      late.release,
      `scene "${late.node}" is read by a visited condition (${shortList(late.readers)}) and was added to a region release ${late.release} had already shipped, so a save of that release may be past the only road into it.`,
      DECLARE_SCENE,
      Object.hasOwn(input.scenes, late.node) ? input.scenes[late.node] : undefined,
      (rule) => 'node' in rule && rule.node === late.node,
    );
  return [...new Set(problems)];
}

/* ------------------------------------------------------------------ */
/* Rules: readable by the saves they serve, and never rewritten        */
/* ------------------------------------------------------------------ */

/** Every node a condition's `visited` names and every flag key it reads. */
export function conditionInputs(condition: Condition): { nodes: string[]; flags: string[] } {
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
          : DECLARE
      }`,
    );
  }
  return problems;
}
