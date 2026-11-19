/**
 * Every release's saves against the story as it is today (#773, ADR 0112).
 * `saveHistory.ts` has the rule; `scripts/saves/releases.ts` has the fixtures.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { ID_ALIASES } from '../idAliases';
import { applyIdAliases, resolveAlias } from '../../core/save/aliases';
import { applyBackfills } from '../../core/save/backfill';
import type { BackfillRule } from '../../core/save/backfill';
import {
  reconcileBattleResult,
  reconcileDisciplines,
  reconcileWorld,
} from '../../core/save/reconcile';
import { deserialize, serialize, stateFromBlob } from '../../core/save/serialize';
import { evaluate } from '../../core/story/conditions';
import type { FlagValue, GameState } from '../../core/types';
import {
  GOLDEN_CHECKPOINTS,
  playForward,
  playFresh,
  ROUTE_ENDING,
} from '../../../scripts/saves/make-golden';
import type { RouteStop } from '../../../scripts/saves/make-golden';
import {
  freezeRelease,
  frozenProblems,
  loadReleases,
  snapshotNow,
} from '../../../scripts/saves/releases';
import { FLAG_BACKFILLS, HISTORY_REV } from './flagBackfills';
import { FLAG_REGISTRY, LATE_SCENES } from './flags';
import type { FlagDef } from './flags';
import { registryEntryFor } from './flagUsage';
import { SQ01_HAS_LIST } from './sq01Cabbages';
import {
  checkReleases,
  checkRules,
  checkSave,
  currentArea,
  lateEdges,
  lateScenes,
  lateWrites,
  SNAPSHOT_FORMAT,
} from './saveHistory';
import type { HistoryInput, HistorySnapshot, WriteSite } from './saveHistory';
import { historyInput, HISTORY_NOW, USES_NOW, VISITED_READERS_NOW } from './saveHistoryNow';

const RELEASES = loadReleases();
const SNAPSHOTS = RELEASES.map((release) => release.snapshot);
/** Today's story against every release: what the real checks run on. */
const LIVE = historyInput(SNAPSHOTS);
/**
 * The same against the first release alone. The synthetic cases below edit this one, so they
 * describe one release and one change, however many releases have been frozen since.
 */
const INPUT = { ...LIVE, releases: SNAPSHOTS.slice(0, 1) };
const SAVES = RELEASES.flatMap((release) => release.saves);

/** The app's load path (`App.adoptLoaded`): aliases, backfills at the file's revision, reconcile. */
function load(json: string, rules: readonly BackfillRule[] = FLAG_BACKFILLS): GameState {
  const parsed = deserialize(json);
  if (!parsed.ok) throw new Error(parsed.error);
  const answered = applyBackfills(
    applyIdAliases(stateFromBlob(parsed.blob), ID_ALIASES),
    parsed.blob.history,
    rules,
  );
  const battle = reconcileBattleResult(CONTENT, answered);
  return reconcileWorld(CONTENT, reconcileDisciplines(CONTENT, battle.state));
}

describe('the release fixtures (ADR 0112)', () => {
  it('are frozen: no file has changed since its release', () => {
    expect(frozenProblems()).toEqual([]);
  });

  it('are never dropped or reordered: the index only grows', () => {
    // The hashes guard each file; this guards the index itself. Freezing a release
    // (`npm run saves:release`) appends its id here, and nothing is ever taken out.
    const FROZEN = ['2026-11-08-golden-v5', '2026-11-15-demo', '2026-11-19-roads'];
    expect(RELEASES.map((release) => release.entry.id)).toEqual(FROZEN);
  });

  it('hold a snapshot and saves for every release, oldest first', () => {
    expect(RELEASES.length).toBeGreaterThan(0);
    for (const release of RELEASES) {
      expect(release.snapshot.release).toBe(release.entry.id);
      expect(release.saves.length, release.entry.id).toBeGreaterThan(0);
      for (const save of release.saves) {
        const parsed = deserialize(save.json);
        expect(parsed.ok, save.name).toBe(true);
        // A save cannot know a rule its own release had not shipped.
        if (parsed.ok)
          expect(parsed.blob.history, save.name).toBeLessThanOrEqual(release.snapshot.historyRev);
      }
    }
    const revs = SNAPSHOTS.map((snapshot) => snapshot.historyRev);
    expect([...revs].sort((a, b) => a - b)).toEqual(revs);
  });
});

describe('the story against every release (ADR 0112)', () => {
  it('answers for every flag that gained a write under a release', () => {
    const problems = checkReleases(LIVE);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('keeps its backfill rules readable by the saves they serve, and never rewrites one', () => {
    const problems = checkRules(LIVE);
    expect(problems, problems.join('\n')).toEqual([]);
    expect(HISTORY_REV).toBe(Math.max(0, ...FLAG_BACKFILLS.map((rule) => rule.rev)));
  });

  it.each(SAVES.map((save) => [save.name, save.json] as const))(
    '%s holds every flag it has walked past',
    (name, json) => {
      const problems = checkSave(LIVE, name, load(json));
      expect(problems, problems.join('\n')).toEqual([]);
    },
  );
});

/* ------------------------------------------------------------------ */
/* Played forward                                                      */
/* ------------------------------------------------------------------ */

function answerFor(key: string): string | undefined {
  return registryEntryFor(FLAG_REGISTRY, key)?.oldSaves?.answer;
}

/**
 * What a new game holds at a checkpoint that the old save, played to the same
 * place, does not. `start` is the new game at the checkpoint the save stood
 * at. An `unset` answer accepts the difference outright. An `open` answer
 * accepts it only for what the new game already held at `start`: if the new
 * game picked it up on the very legs the old save has just played, the scene
 * was not open to the old save after all.
 */
function behind(fresh: GameState, old: GameState, start: GameState | undefined): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(fresh.flags)) {
    const answer = answerFor(key);
    if (answer === 'unset') continue;
    if (answer === 'open' && (!start || Object.hasOwn(start.flags, key))) continue;
    if (!Object.hasOwn(old.flags, key))
      out.push(`is missing flag "${key}" (a new game holds ${JSON.stringify(value)})`);
    else if (old.flags[key] !== value)
      out.push(
        `holds flag "${key}" as ${JSON.stringify(old.flags[key])} (a new game holds ${JSON.stringify(value)})`,
      );
  }
  const visited = new Set(old.story.visited);
  for (const node of fresh.story.visited) {
    if (!VISITED_READERS_NOW.has(node) || visited.has(node)) continue;
    const answer = Object.hasOwn(LATE_SCENES, node) ? LATE_SCENES[node]?.answer : undefined;
    if (answer === 'unset') continue;
    if (answer === 'open' && (!start || start.story.visited.includes(node))) continue;
    out.push(`has not visited "${node}" (a condition reads it, and a new game has been there)`);
  }
  return out;
}

const FRESH = new Map<number, readonly RouteStop[]>();
function fresh(partySize: 1 | 4): readonly RouteStop[] {
  const held = FRESH.get(partySize) ?? playFresh(partySize);
  FRESH.set(partySize, held);
  return held;
}

describe('every release save, played forward on today’s story (ADR 0112)', () => {
  const routed = SAVES.filter((save) => save.checkpoint && save.partySize);

  it('has saves along the route to play', () => {
    expect(routed.length).toBeGreaterThan(0);
  });

  it.each(routed.map((save) => [save.name, save] as const))(
    '%s reaches the ending holding what a new game holds',
    (name, save) => {
      if (!save.checkpoint || !save.partySize) return;
      // Throws, naming the scene and the map, if a gate no longer opens for this save.
      const stops = playForward(load(save.json), save.checkpoint, name);
      const rest = GOLDEN_CHECKPOINTS.slice(GOLDEN_CHECKPOINTS.indexOf(save.checkpoint) + 1);
      expect(stops.map((stop) => stop.checkpoint)).toEqual([...rest, ROUTE_ENDING]);
      const now = fresh(save.partySize);
      const problems = stops.flatMap((stop) => {
        const same = now.find((other) => other.checkpoint === stop.checkpoint);
        if (!same) return [`a new game never reaches ${stop.checkpoint}`];
        const start = now.find((other) => other.checkpoint === save.checkpoint);
        return behind(same.state, stop.state, start?.state).map(
          (what) => `${name}, played on to ${stop.checkpoint}, ${what}`,
        );
      });
      expect([...new Set(problems)], problems.join('\n')).toEqual([]);
    },
  );
});

/* ------------------------------------------------------------------ */
/* The check is real                                                   */
/* ------------------------------------------------------------------ */

const BASELINE = SNAPSHOTS[0];
const FIRST = BASELINE?.release ?? '';

function site(key: string, area: string, how: WriteSite['how'], ...values: FlagValue[]): WriteSite {
  const at = how === 'entry' ? 'set' : 'options[0].setFlags';
  return { key, area, how, values: values.map((value) => `${at}=${JSON.stringify(value)}`).sort() };
}

/** Today's story with extra writes and readers, as a later edit would leave it. */
function edited(
  writes: readonly WriteSite[],
  readers: Readonly<Record<string, readonly string[]>>,
  more: Partial<HistoryInput> = {},
): HistoryInput {
  return {
    ...INPUT,
    now: { ...INPUT.now, writes: [...INPUT.now.writes, ...writes] },
    readers: new Map([...INPUT.readers, ...Object.entries(readers)]),
    ...more,
  };
}

function flag(key: string, oldSaves?: FlagDef['oldSaves']): FlagDef {
  return {
    key,
    type: 'boolean',
    meaning: 'A test flag.',
    arc: 'Demo · Forest Road',
    status: 'live',
    setBy: [],
    readBy: [],
    ...(oldSaves ? { oldSaves } : {}),
  };
}

describe('a flag added to an early scene and read by a later one (#773)', () => {
  // Months after release, a writer makes the forest aftermath record a ledger
  // and Mira's epilogue read it. Every save past the forest lacks it.
  const ledger = site('forest_ledger', 'story:after_forest_rewards', 'entry', true);
  const read = { forest_ledger: ['story:mira_epilogue'] };
  const home = SAVES.find((save) => save.file === 'party-4-home.json');
  const early = SAVES.find((save) => save.file === 'party-4-ba-dan.json');
  const rule: BackfillRule = {
    rev: HISTORY_REV + 1,
    key: 'forest_ledger',
    when: { kind: 'visited', nodeId: 'after_forest' },
    set: true,
  };
  const declared = flag('forest_ledger', {
    upTo: FIRST,
    sites: ['story:after_forest_rewards'],
    answer: 'backfill',
    why: 'The forest aftermath always records it now.',
  });

  it('fails without a backfill, naming the flag, the reader, the release and the save', () => {
    expect(home && early).toBeTruthy();
    if (!home || !early) return;
    const bare = edited([ledger], read, { registry: [...FLAG_REGISTRY, flag('forest_ledger')] });
    // Only this flag's lines: the test must not depend on the rest of the story being answered.
    const problems = checkReleases(bare).filter((line) => line.includes('"forest_ledger"'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      'flag "forest_ledger" is now written at story:after_forest_rewards',
    );
    expect(problems[0]).toContain(`release ${FIRST}`);
    expect(problems[0]).toContain('read by story:mira_epilogue');

    // The save past the scene is stranded for certain; the one before it is not.
    const stranded = checkSave(bare, home.name, {
      flags: load(home.json).flags,
      story: { ...load(home.json).story, visited: ['after_forest_rewards'] },
    });
    expect(stranded.filter((line) => line.includes('"forest_ledger"'))).toHaveLength(1);
    expect(stranded[0]).toContain(home.name);
    expect(stranded[0]).toContain('"forest_ledger"');
    expect(stranded[0]).toContain('story:mira_epilogue');
    expect(checkSave(bare, early.name, load(early.json))).toEqual([]);
  });

  it('does not accept a declaration with no rule behind it, or a rule the saves cannot read', () => {
    const noRule = edited([ledger], read, { registry: [...FLAG_REGISTRY, declared] });
    expect(checkReleases(noRule).join('\n')).toContain(
      'has no rule for it newer than that release',
    );
    expect(checkRules(noRule).join('\n')).toContain('flagBackfills.ts has no rule for it');

    const blind: BackfillRule = { ...rule, when: { kind: 'visited', nodeId: 'demo_complete' } };
    const unreadable = edited([ledger], read, {
      registry: [...FLAG_REGISTRY, declared],
      rules: [...FLAG_BACKFILLS, blind],
    });
    expect(checkRules(unreadable).join('\n')).toContain(
      `"when" reads visited "demo_complete", a scene release ${FIRST} did not have`,
    );
    const laterFlag: BackfillRule = {
      ...rule,
      when: { kind: 'flag', key: 'rubbing_given', op: 'set' },
    };
    expect(
      checkRules({ ...unreadable, rules: [...FLAG_BACKFILLS, laterFlag] }).join('\n'),
    ).toContain(`reads flag "rubbing_given", which release ${FIRST} never wrote`);
  });

  it('passes with one, and loading gives the old save its answer for good', () => {
    if (!home || !early) return;
    const rules = [...FLAG_BACKFILLS, rule];
    const fixed = edited([ledger], read, { registry: [...FLAG_REGISTRY, declared], rules });
    expect(checkReleases(fixed).filter((line) => line.includes('"forest_ledger"'))).toEqual([]);
    expect(checkRules(fixed).filter((line) => line.includes('forest_ledger'))).toEqual([]);

    const loaded = load(home.json, rules);
    expect(loaded.flags.forest_ledger).toBe(true);
    expect(checkSave(fixed, home.name, loaded)).toEqual([]);
    // A save that has not reached the forest sets it the normal way.
    expect(load(early.json, rules).flags.forest_ledger).toBeUndefined();

    // Saved again by this build, the file records the rule's revision and keeps the answer.
    const again = serialize(loaded, {
      label: 'Slot 1',
      summary: 'Backfilled',
      savedAt: 1_700_000_000_000,
      session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
      history: rule.rev,
    });
    const parsed = deserialize(again);
    expect(parsed.ok && parsed.blob.history).toBe(rule.rev);
    expect(load(again, rules).flags).toEqual(loaded.flags);
  });

  it('never gives the answer to a save written after the rule shipped', () => {
    if (!home) return;
    // Played on content that sets the flag itself, and it is not set: the
    // player did not do it. The file's revision keeps the rule away.
    const state = load(home.json);
    const current = serialize(state, {
      label: 'Slot 1',
      summary: 'Current',
      savedAt: 1_700_000_000_000,
      session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
      history: rule.rev,
    });
    expect(load(current, [...FLAG_BACKFILLS, rule]).flags.forest_ledger).toBeUndefined();
  });
});

describe('a release that records roads and names options by destination (#813)', () => {
  /** Today's story frozen as a release: nothing differs until a test edits `now`. */
  const TODAY = snapshotNow('test-today', '2026-11-19', 'abc1234', 'A test.');
  const AGAINST_TODAY: HistoryInput = { ...LIVE, releases: [TODAY] };
  const withNow = (now: Partial<HistoryInput['now']>): HistoryInput => ({
    ...AGAINST_TODAY,
    now: { ...AGAINST_TODAY.now, ...now },
  });

  it('finds nothing late against itself', () => {
    expect(lateWrites(AGAINST_TODAY)).toEqual([]);
    expect(lateEdges(AGAINST_TODAY)).toEqual([]);
  });

  it('records the roads into scenes, and not the reads', () => {
    const edges = HISTORY_NOW.edges ?? {};
    expect(edges['story:lost_quarry_gate']).toContain(
      `next=${CONTENT.story.get('lost_quarry_gate')?.kind === 'flags' ? (CONTENT.story.get('lost_quarry_gate') as { next: string }).next : ''}`,
    );
    // A `visited` condition reads a scene; it is no road into it.
    for (const roads of Object.values(edges))
      for (const road of roads) expect(road).not.toMatch(/\.nodeId=/);
  });

  it('asks about a road rerouted to a scene that already set something', () => {
    // The issue's case: the loss at the gate now leads through the talk that sets the gate's
    // outcome. No write site changed, and a save that lost there never passed the talk.
    const edges = HISTORY_NOW.edges ?? {};
    const rerouted = withNow({
      edges: {
        ...edges,
        'story:lost_quarry_gate': ['next=gate_talked_through'],
      },
    });
    expect(lateEdges(rerouted)).toEqual([
      { release: 'test-today', area: 'story:lost_quarry_gate', edge: 'next=gate_talked_through' },
    ]);
    const problems = checkReleases(rerouted).filter((line) => line.includes('lost_quarry_gate'));
    expect(problems.join('\n')).toContain('LATE_EDGES');

    // Answered for that road, it passes; the answer must name the road.
    const answered = {
      ...rerouted,
      edges: {
        'story:lost_quarry_gate': {
          upTo: 'test-today',
          sites: ['next=gate_talked_through'],
          answer: 'open' as const,
          why: 'A test.',
        },
      },
    };
    expect(checkReleases(answered).filter((line) => line.includes('lost_quarry_gate'))).toEqual([]);
  });

  it('needs nothing for a road into a scene the release did not have', () => {
    const edges = HISTORY_NOW.edges ?? {};
    const fresh = withNow({
      edges: { ...edges, 'story:lost_quarry_gate': ['next=a_brand_new_scene'] },
    });
    expect(lateEdges(fresh)).toEqual([]);
  });

  it('does not count an NPC inserted before another as a new road', () => {
    const edges = HISTORY_NOW.edges ?? {};
    const village = edges['map:ba_dan_village'] ?? [];
    expect(village.some((road) => road.startsWith('npcs[#'))).toBe(true);
    expect(village.some((road) => /npcs\[\d/.test(road))).toBe(false);
  });

  it('does not count an option moved to another position as a change', () => {
    // Inserting an option shifts every later one; named by destination, none of them changed.
    const shifted = withNow({
      writes: HISTORY_NOW.writes.map((write) =>
        write.positional
          ? {
              ...write,
              positional: write.positional.map((value) =>
                value.replace(/\[(\d+)\]/, (_, n: string) => `[${Number(n) + 1}]`),
              ),
            }
          : write,
      ),
    });
    expect(lateWrites(shifted)).toEqual([]);
  });

  it('still sees a write added to one more option', () => {
    const added = withNow({
      writes: HISTORY_NOW.writes.map((write) =>
        write.key === 'sq01.cabbages'
          ? { ...write, values: [...write.values, 'options[→sq01_burn].setFlags="burned"'] }
          : write,
      ),
    });
    expect(lateWrites(added).map((late) => [late.site.key, late.change])).toEqual([
      ['sq01.cabbages', 'changed'],
    ]);
  });
});

describe('an "unset" answer and the readers it was decided for (#813)', () => {
  it('asks again when a flag answered "unset" gains a reader', () => {
    const more: HistoryInput = {
      ...LIVE,
      readers: new Map([
        ...LIVE.readers,
        ['sq02.gate', [...(LIVE.readers.get('sq02.gate') ?? []), 'story:a_new_reader']],
      ]),
    };
    expect(checkReleases(LIVE).filter((line) => line.includes('"sq02.gate"'))).toEqual([]);
    const problems = checkReleases(more).filter((line) => line.includes('"sq02.gate"'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('story:a_new_reader now reads it too');
  });

  it('names its readers wherever the check asks', () => {
    for (const flag of FLAG_REGISTRY)
      if (flag.oldSaves?.answer === 'unset')
        expect(flag.oldSaves.readers ?? [], flag.key).not.toEqual([]);
  });
});

describe('what counts as a late write', () => {
  const read = { test_flag: ['story:mira_epilogue'] };

  it('ignores a flag nothing reads, and a region the release never contained', () => {
    const quiet = edited([site('unread_flag', 'story:after_forest', 'entry', true)], {});
    expect(lateWrites(quiet).filter((late) => late.site.key === 'unread_flag')).toEqual([]);

    const ahead = edited([site('test_flag', 'story:saltstep_gate', 'entry', true)], read, {
      now: {
        ...INPUT.now,
        regions: { ...INPUT.now.regions, saltstep: ['story:saltstep_gate'] },
        writes: [...INPUT.now.writes, site('test_flag', 'story:saltstep_gate', 'entry', true)],
      },
    });
    expect(lateWrites(ahead).filter((late) => late.site.key === 'test_flag')).toEqual([]);
  });

  it('counts a new scene in a shipped region, an app module and a changed value', () => {
    const added = edited(
      [
        site('test_flag', 'story:brand_new_scene', 'option', true),
        site('test_flag', 'app:app/Thing', 'app'),
      ],
      read,
      {
        now: {
          ...INPUT.now,
          regions: {
            ba_dan_valley: [...(INPUT.now.regions.ba_dan_valley ?? []), 'story:brand_new_scene'],
          },
          writes: [
            ...INPUT.now.writes,
            site('test_flag', 'story:brand_new_scene', 'option', true),
            site('test_flag', 'app:app/Thing', 'app'),
          ],
        },
      },
    );
    expect(
      lateWrites(added)
        .filter((late) => late.site.key === 'test_flag')
        .map((late) => [late.site.area, late.change]),
    ).toEqual([
      ['story:brand_new_scene', 'new'],
      ['app:app/Thing', 'new'],
    ]);

    // `act1_complete` shipped as `true`; writing another value there changes what old saves hold.
    const shipped = BASELINE?.writes.find((write) => write.key === 'act1_complete');
    expect(shipped).toBeDefined();
    if (!shipped) return;
    const changed: HistoryInput = {
      ...INPUT,
      now: {
        ...INPUT.now,
        writes: INPUT.now.writes.map((write) =>
          // Found the way the check finds it, so a rename with an alias row keeps this honest.
          write.key === resolveAlias(ID_ALIASES, 'flags', shipped.key) &&
          write.area === currentArea(ID_ALIASES, shipped.area)
            ? { ...write, values: ['set="won"'] }
            : write,
        ),
      },
    };
    const late = lateWrites(changed).filter(
      (item) => item.site.key === 'act1_complete' && item.release === FIRST,
    );
    expect(late.map((item) => [item.change, item.was])).toEqual([['changed', shipped.values]]);
  });

  it('follows a renamed scene and a renamed flag through the alias table', () => {
    const shipped = BASELINE?.writes.find((write) => write.area.startsWith('story:'));
    expect(shipped).toBeDefined();
    if (!shipped || !BASELINE) return;
    const node = shipped.area.slice('story:'.length);
    const renamed: HistoryInput = {
      ...INPUT,
      aliases: { story: { [node]: `${node}_v2` }, flags: { [shipped.key]: `${shipped.key}_v2` } },
      releases: [BASELINE],
      now: {
        ...INPUT.now,
        writes: [{ ...shipped, key: `${shipped.key}_v2`, area: `story:${node}_v2` }],
      },
      readers: new Map([[`${shipped.key}_v2`, ['story:mira_epilogue']]]),
    };
    expect(lateWrites(renamed)).toEqual([]);
  });

  it('asks again when a flag answered for one release gains a write under a later one', () => {
    if (!BASELINE) return;
    const second: HistorySnapshot = {
      ...BASELINE,
      release: 'later',
      regions: INPUT.now.regions,
      writes: INPUT.now.writes,
    };
    const answered = flag('test_flag', {
      upTo: FIRST,
      sites: ['story:after_forest'],
      answer: 'open',
      why: 'A new talk.',
    });
    const input = edited([site('test_flag', 'story:after_forest', 'entry', true)], read, {
      releases: [BASELINE, second],
      registry: [...FLAG_REGISTRY, answered],
    });
    const problems = checkReleases(input).filter((problem) => problem.includes('"test_flag"'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`stops at release ${FIRST}`);
    expect(problems[0]).toContain('for later');
    const moved = {
      ...input,
      registry: [
        ...FLAG_REGISTRY,
        {
          ...answered,
          oldSaves: {
            upTo: 'later',
            sites: ['story:after_forest'],
            answer: 'open' as const,
            why: 'Still a talk.',
          },
        },
      ],
    };
    expect(checkReleases(moved).filter((problem) => problem.includes('"test_flag"'))).toEqual([]);
  });

  it('sees a flag added to one more option of a choice', () => {
    // `ruon_choice` shipped setting `ruon_spared` on the escort option only.
    const shipped = BASELINE?.writes.find((write) => write.key === 'ruon_spared');
    expect(shipped?.values).toEqual(['options[0].setFlags=true']);
    if (!shipped) return;
    const both: HistoryInput = {
      ...INPUT,
      now: {
        ...INPUT.now,
        writes: INPUT.now.writes.map((write) =>
          write.key === 'ruon_spared'
            ? {
                ...write,
                // This release names options by position, so it compares that form.
                positional: [...(write.positional ?? write.values), 'options[1].setFlags=true'],
              }
            : write,
        ),
      },
    };
    const late = lateWrites(both).filter((item) => item.site.key === 'ruon_spared');
    expect(late.map((item) => item.change)).toEqual(['changed']);
    expect(checkReleases(both).join('\n')).toContain(
      'flag "ruon_spared" is written at story:ruon_choice',
    );
  });

  it('asks again when an answered choice gains an option, now that a release pins the three', () => {
    // `sq01.cabbages` is answered for the first release. The second release froze its three
    // options, so a fourth is a changed write under that release and the old answer stops short.
    const fourth: HistoryInput = {
      ...LIVE,
      now: {
        ...LIVE.now,
        writes: LIVE.now.writes.map((write) =>
          write.key === 'sq01.cabbages'
            ? {
                ...write,
                values: [...write.values, 'options[→sq01_burn].setFlags="burned"'],
                positional: [...(write.positional ?? write.values), 'options[3].setFlags="burned"'],
              }
            : write,
        ),
      },
    };
    expect(checkReleases(LIVE).filter((line) => line.includes('"sq01.cabbages"'))).toEqual([]);
    const problems = checkReleases(fourth).filter((line) => line.includes('"sq01.cabbages"'));
    expect(problems.join('\n')).toContain('stops at release 2026-11-08-golden-v5');
    expect(problems.join('\n')).toContain('for 2026-11-15-demo');
  });

  it('holds an answer to the sites it names', () => {
    // `rubbing_given` is answered "open" for Mira's new scene. A write added to an old
    // scene later is not covered by that sentence.
    const second = edited([site('rubbing_given', 'story:after_forest', 'entry', true)], {});
    const problems = checkReleases(second).filter((line) => line.includes('"rubbing_given"'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('does not name this site (sites: story:mira_rubbing_given)');
  });

  it('decides shipped territory by what a region holds, not by its id', () => {
    const renamed = edited([site('test_flag', 'story:after_forest', 'entry', true)], read, {
      now: {
        ...INPUT.now,
        regions: { the_valley: INPUT.now.regions.ba_dan_valley ?? [] },
        writes: [...INPUT.now.writes, site('test_flag', 'story:after_forest', 'entry', true)],
      },
    });
    expect(lateWrites(renamed).some((late) => late.site.key === 'test_flag')).toBe(true);
  });

  it('holds a scene a visited condition reads to the same rule', () => {
    // Pella's list is a late scene under the first release, which is why `LATE_SCENES` answers it.
    expect(lateScenes(INPUT).some((late) => late.node === 'sq01_packing_list')).toBe(true);
    const spliced: HistoryInput = {
      ...INPUT,
      now: {
        ...INPUT.now,
        regions: {
          ba_dan_valley: [...(INPUT.now.regions.ba_dan_valley ?? []), 'story:gao_receipt'],
        },
      },
      visitedReaders: new Map([...INPUT.visitedReaders, ['gao_receipt', ['map:ba_dan_village']]]),
    };
    const problems = checkReleases(spliced).filter((line) => line.includes('"gao_receipt"'));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain(
      'scene "gao_receipt" is read by a visited condition (map:ba_dan_village)',
    );
    expect(problems[0]).toContain('LATE_SCENES');
    // A scene the release already had is history every save holds exactly.
    expect(lateScenes(INPUT).some((late) => late.node === 'after_forest')).toBe(false);
  });
});

describe('the backfill rules, held to the releases', () => {
  const rule: BackfillRule = {
    rev: HISTORY_REV + 1,
    key: 'rubbing_given',
    when: { kind: 'visited', nodeId: 'act1_epilogue' },
    set: true,
  };
  // `rubbing_given` was added under the first release, so a rule may answer for it.
  const registry = FLAG_REGISTRY.map((entry) =>
    entry.key === 'rubbing_given'
      ? { ...entry, oldSaves: { upTo: FIRST, answer: 'backfill' as const, why: 'Test.' } }
      : entry,
  );
  const withRule = (...more: BackfillRule[]): BackfillRule[] => [...FLAG_BACKFILLS, ...more];
  /** Only the lines about the rule under test, whatever else the live story needs. */
  const ofRule = (problems: readonly string[]): string[] =>
    problems.filter((line) => line.includes(`backfill rule ${HISTORY_REV + 1} `));

  it('accepts a rule that reads what the release held', () => {
    expect(ofRule(checkRules({ ...INPUT, registry, rules: withRule(rule) }))).toEqual([]);
  });

  it('rejects a revision that does not grow, a value the flag cannot hold and a rule with no history', () => {
    const problems = checkRules({
      ...INPUT,
      registry,
      rules: withRule(
        rule,
        { ...rule, set: 'yes' },
        { ...rule, rev: rule.rev + 1, when: { kind: 'partySize', op: 'gte', value: 1 } },
      ),
    }).join('\n');
    expect(problems).toContain('revisions are whole numbers that only grow');
    expect(problems).toContain('"yes" is not a value the registry allows');
    expect(problems).toContain('"when" must read the save\'s own history');
  });

  it('lets a later rule read what an earlier rule supplied', () => {
    // Rule 1 gives old saves Pella's list; a later rule may build on it.
    const onList: BackfillRule = {
      ...rule,
      when: { kind: 'visited', nodeId: 'sq01_packing_list' },
    };
    expect(ofRule(checkRules({ ...INPUT, registry, rules: withRule(onList) }))).toEqual([]);
    expect(
      checkRules({ ...INPUT, registry, rules: [{ ...onList, rev: 1 }], scenes: {} }).join('\n'),
    ).toContain('"when" reads visited "sq01_packing_list", a scene release');
  });

  it('rejects a rule aimed at a release that already recorded the flag', () => {
    // `act1_complete` shipped in the first release: its saves hold their real answer, and a
    // rule would overwrite a "did not happen" or add a standing delta a second time.
    const aimed = { ...rule, key: 'act1_complete' };
    const answered = FLAG_REGISTRY.map((entry) =>
      entry.key === 'act1_complete'
        ? { ...entry, oldSaves: { upTo: FIRST, answer: 'backfill' as const, why: 'Test.' } }
        : entry,
    );
    const problems = checkRules({ ...INPUT, registry: answered, rules: withRule(aimed) }).join(
      '\n',
    );
    expect(problems).toContain(`release ${FIRST} already recorded this`);
  });

  it('rejects editing or removing a rule a release shipped', () => {
    if (!BASELINE) return;
    const shipped: HistorySnapshot = {
      ...BASELINE,
      release: 'later',
      historyRev: rule.rev,
      rules: withRule(rule),
    };
    const input = { ...INPUT, registry, releases: [BASELINE, shipped] };
    const now = { ...INPUT.now, historyRev: rule.rev };
    expect(ofRule(checkRules({ ...input, now, rules: withRule(rule) }))).toEqual([]);
    expect(
      checkRules({ ...input, now, rules: withRule({ ...rule, set: false }) }).join('\n'),
    ).toContain('has since been edited');
    const removed = checkRules({ ...input, rules: [...FLAG_BACKFILLS] }).join('\n');
    expect(removed).toContain('has since been removed');
    expect(removed).toContain('the history revision went backwards');
  });

  it('adjusts standing once, and only standing', () => {
    const adjust: BackfillRule = {
      rev: HISTORY_REV + 1,
      key: 'standing.earth',
      when: { kind: 'visited', nodeId: 'act1_epilogue' },
      adjust: 1,
    };
    const standing = FLAG_REGISTRY.map((entry) =>
      entry.key === 'standing.earth'
        ? { ...entry, oldSaves: { upTo: FIRST, answer: 'backfill' as const, why: 'Test.' } }
        : entry,
    );
    // A standing delta added to an old option is a late write like any other.
    const nudged = edited(
      [
        {
          key: 'standing.earth',
          area: 'story:gate_parley',
          how: 'option',
          values: ['options[0].adjust=1'],
        },
      ],
      { 'standing.earth': ['story:mira_epilogue'] },
      { registry: standing, rules: withRule(adjust) },
    );
    expect(ofRule(checkRules(nudged))).toEqual([]);
    expect(
      checkRules({ ...INPUT, registry: standing, rules: withRule(adjust) }).join('\n'),
    ).toContain('already recorded this');
    expect(
      checkRules({
        ...INPUT,
        registry,
        rules: withRule({ ...rule, adjust: 1 } as BackfillRule),
      }).join('\n'),
    ).toContain('"adjust" is a whole, non-zero delta to a standing key');
  });
});

describe('rule 1: Pella’s packing list (SQ-01)', () => {
  const early = SAVES.find((save) => save.file === 'party-4-ba-dan.json');
  const session = { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false };
  const meta = { label: 'Slot 1', summary: 'Asked', savedAt: 1_700_000_000_000, session };

  /** The 2026-11-08 Ba Dan save after talking to Pella, as that build would have written it. */
  function asked(history: number, more: GameState['flags'] = {}): string {
    if (!early) throw new Error('no Ba Dan save');
    const state = load(early.json);
    return serialize(
      {
        ...state,
        flags: { ...state.flags, pella_asked: true, ...more },
        story: { ...state.story, visited: [...state.story.visited, 'pella_asked'] },
      },
      { ...meta, history },
    );
  }

  it('gives the list to an older save Pella has already asked, so the sled can appear', () => {
    const loaded = load(asked(0));
    expect(loaded.story.visited).toContain('sq01_packing_list');
    expect(evaluate(loaded, SQ01_HAS_LIST)).toBe(true);
  });

  it('leaves a save that has finished the rescue, or was written by this build, as it is', () => {
    expect(load(asked(0, { act1_complete: true })).story.visited).not.toContain(
      'sq01_packing_list',
    );
    expect(load(asked(HISTORY_REV)).story.visited).not.toContain('sq01_packing_list');
  });
});

describe('freezing a release', () => {
  const root = mkdtempSync(join(tmpdir(), 'fnt-release-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('writes the snapshot and the route saves once, and notices any later change', async () => {
    const entry = await freezeRelease('test-1', {
      note: 'A test.',
      frozen: '2026-11-14',
      commit: 'abc1234',
      root,
    });
    expect(Object.keys(entry.files)).toHaveLength(19);
    expect(frozenProblems(root)).toEqual([]);
    const [release] = loadReleases(root);
    // A release names options by where they lead; the positional copy serves only older ones.
    expect(release?.snapshot.format).toBe(SNAPSHOT_FORMAT);
    expect(release?.snapshot.writes).toEqual(
      HISTORY_NOW.writes.map(({ positional: _positional, ...site }) => site),
    );
    expect(release?.snapshot.edges).toEqual(HISTORY_NOW.edges);
    expect(release?.snapshot.historyRev).toBe(HISTORY_REV);
    expect(release?.saves).toHaveLength(18);
    // Today's story against a release frozen from it: nothing is late.
    expect(lateWrites({ ...INPUT, releases: release ? [release.snapshot] : [] })).toEqual([]);

    await expect(
      freezeRelease('test-1', { note: '', frozen: '2026-11-14', commit: 'abc1234', root }),
    ).rejects.toThrow('already frozen');

    const save = join(root, 'test-1', 'saves', 'party-1-home.json');
    writeFileSync(
      save,
      readFileSync(save, 'utf8').replace('"flags": {', '"flags": { "edited": true,'),
    );
    expect(frozenProblems(root).join('\n')).toContain(
      'party-1-home.json has changed since it was frozen',
    );
  });
});

it('reads every flag use the registry test reads', () => {
  // The same walk as `flags.test.ts`, so a write the registry knows is a write this check knows.
  expect(USES_NOW.some((use) => use.role === 'write' && use.area.startsWith('app:'))).toBe(true);
  expect(USES_NOW.some((use) => use.role === 'write' && use.area.startsWith('story:'))).toBe(true);
});
