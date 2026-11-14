/**
 * Every frozen save against the story still ahead of it (#773). See
 * `flagContinuity.ts` for the rule and `flagBackfills.ts` for the answers.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE } from '../index';
import { JOURNAL_NOTES } from '../journal';
import { applyFlagBackfills } from '../../core/save/backfill';
import { deserialize, serialize, stateFromBlob } from '../../core/save/serialize';
import type { GameState } from '../../core/types';
import { FLAG_BACKFILLS } from './flagBackfills';
import { missingHistory } from './flagContinuity';
import type { ContinuityContent } from './flagContinuity';
import { FLAG_REGISTRY } from './flags';
import { collectFlagUses } from './flagUsage';
import type { FlagSource, FlagUse } from './flagUsage';
import { FOLLOWERS } from './followers';

const GOLDEN = fileURLToPath(new URL('../../core/save/fixtures/golden/', import.meta.url));

/** Bundle collection -> area prefix, as `flags.test.ts` names them. */
const AREA_NAMES: Readonly<Record<string, string>> = {
  story: 'story',
  maps: 'map',
  encounters: 'encounter',
  disciplines: 'discipline',
  residents: 'resident',
  backgroundRoles: 'role',
  anchors: 'anchor',
  characters: 'character',
  enemies: 'enemy',
  abilities: 'ability',
  props: 'prop',
};

function contentUses(): FlagUse[] {
  const sources: FlagSource[] = Object.entries(CONTENT_BUNDLE)
    .filter((entry): entry is [string, readonly unknown[]] => Array.isArray(entry[1]))
    .map(([name, records]) => ({ name: AREA_NAMES[name] ?? name, records }));
  sources.push(
    { name: 'follower', records: FOLLOWERS },
    { name: 'journal', records: JOURNAL_NOTES },
  );
  // App code writes a few flags at any time (the riverside, guidance); the
  // registry names them, and `flags.test.ts` holds it to the source.
  const app = FLAG_REGISTRY.flatMap((flag) =>
    flag.setBy
      .filter((area) => area.startsWith('app:'))
      .map((area): FlagUse => ({ key: flag.key, role: 'write', area, at: '' })),
  );
  return [...collectFlagUses(sources), ...app];
}

const CONTENT_NOW: ContinuityContent = {
  story: CONTENT_BUNDLE.story,
  maps: CONTENT_BUNDLE.maps,
  residents: CONTENT_BUNDLE.residents,
  uses: contentUses(),
  backfilled: FLAG_BACKFILLS.map((rule) => rule.key),
};

function goldenSaves(): { name: string; state: GameState }[] {
  return readdirSync(GOLDEN, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
    .flatMap((version) =>
      readdirSync(join(GOLDEN, version.name))
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
          const parsed = deserialize(readFileSync(join(GOLDEN, version.name, name), 'utf8'));
          if (!parsed.ok) throw new Error(`${version.name}/${name}: ${parsed.error}`);
          return { name: `${version.name}/${name}`, state: stateFromBlob(parsed.blob) };
        }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

const SAVES = goldenSaves();

describe('the frozen saves against the story ahead of them (#773)', () => {
  it('has a corpus to check', () => {
    expect(SAVES.length).toBeGreaterThan(0);
  });

  it.each(SAVES.map((save) => [save.name, save.state] as const))(
    '%s can answer every flag read ahead of it',
    (_name, state) => {
      const missing = missingHistory(CONTENT_NOW, state);
      expect(
        missing,
        missing
          .map(
            (item) =>
              `${item.key}: read by ${item.readers.join(', ')}; set only by ${item.setters.join(', ')}, all behind this save. Declare its answer in flagBackfills.ts.`,
          )
          .join('\n'),
      ).toEqual([]);
    },
  );

  it('reads `ruon_traded` past the vote without a backfill, which is why it declares one', () => {
    // The escort route holds `ruon_spared`; `ruon_traded` is the road not taken.
    const home = SAVES.find((save) => save.name.endsWith('party-4-home.json'));
    expect(home).toBeDefined();
    if (!home) return;
    const bare = missingHistory({ ...CONTENT_NOW, backfilled: [] }, home.state);
    expect(bare.map((item) => item.key)).toEqual(['ruon_traded']);
    // And the declared answer, applied on load, leaves the escort save as it was.
    expect(applyFlagBackfills(home.state, FLAG_BACKFILLS).flags.ruon_traded).toBeUndefined();
  });

  it('catches a flag added to an early scene and read later, until its backfill is declared', () => {
    // A writer adds a flag to the forest aftermath and a reader in Mira's
    // epilogue, months after this save walked past the forest.
    const home = SAVES.find((save) => save.name.endsWith('party-4-home.json'));
    expect(home).toBeDefined();
    if (!home) return;
    const added: FlagUse[] = [
      { key: 'forest_ledger', role: 'write', area: 'story:after_forest', at: 'set' },
      { key: 'forest_ledger', role: 'read', area: 'story:mira_epilogue', at: 'when' },
    ];
    const later = { ...CONTENT_NOW, uses: [...CONTENT_NOW.uses, ...added] };
    expect(missingHistory(later, home.state)).toEqual([
      { key: 'forest_ledger', readers: ['story:mira_epilogue'], setters: ['story:after_forest'] },
    ]);
    // A save that has not reached the forest yet will set it the normal way.
    const early = SAVES.find((save) => save.name.endsWith('party-4-ba-dan.json'));
    expect(early && missingHistory(later, early.state)).toEqual([]);

    // Declared: the check passes, the load gives the old save its answer, and
    // a save of the loaded save keeps it.
    const rule = {
      key: 'forest_ledger',
      setters: ['after_forest'],
      backfill: { value: true },
    } as const;
    expect(
      missingHistory({ ...later, backfilled: [...later.backfilled, 'forest_ledger'] }, home.state),
    ).toEqual([]);
    const loaded = applyFlagBackfills(home.state, [rule]);
    expect(loaded.flags.forest_ledger).toBe(true);
    const meta = {
      label: 'Slot 1',
      summary: 'Backfill',
      savedAt: 1_700_000_000_000,
      session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
    };
    const again = deserialize(serialize(loaded, meta));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const reloaded = applyFlagBackfills(stateFromBlob(again.blob), [rule]);
    expect(reloaded.flags).toEqual(loaded.flags);
  });
});

describe('the backfill rules (#773)', () => {
  it('name a registered flag and exactly its story setters', () => {
    for (const rule of FLAG_BACKFILLS) {
      const flag = FLAG_REGISTRY.find((entry) => entry.key === rule.key);
      expect(flag, rule.key).toBeDefined();
      expect(rule.key.endsWith('.*'), `${rule.key} must be one concrete key`).toBe(false);
      const setters = (flag?.setBy ?? [])
        .filter((area) => area.startsWith('story:'))
        .map((area) => area.slice('story:'.length));
      expect([...rule.setters].sort(), rule.key).toEqual(setters.sort());
      expect(
        rule.setters.length,
        `${rule.key} needs a story setter to apply after`,
      ).toBeGreaterThan(0);
    }
  });

  it('gate only on story nodes that exist', () => {
    const nodes = new Set(CONTENT_BUNDLE.story.map((node) => node.id));
    for (const rule of FLAG_BACKFILLS)
      if ('when' in rule.backfill && rule.backfill.when.kind === 'visited')
        expect(nodes.has(rule.backfill.when.nodeId), rule.key).toBe(true);
  });
});
