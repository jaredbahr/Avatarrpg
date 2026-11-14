/**
 * The flag registry against the game (#493).
 *
 * Content is walked from the bundle plus the two collections that live outside
 * it (followers and the journal); app code is scanned as text for the flags it
 * writes with `setFlags` commands and its guidance state. A third pass imports
 * every content module and walks every export, so a new collection that holds
 * flags cannot slip past the first pass unnoticed.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE } from '../index';
import { ELEMENTS } from '../elements';
import { JOURNAL_NOTES } from '../journal';
import { FOLLOWERS } from './followers';
import { FLAG_REGISTRY, INFORMATIONAL_FLAGS } from './flags';
import type { FlagDef } from './flags';
import {
  checkFlagRegistry,
  collectFlagUses,
  flagUsesIn,
  keyMatches,
  registryEntryFor,
} from './flagUsage';
import type { FlagSource, FlagUse, RegistryCheckOptions } from './flagUsage';
import type { ContentBundle } from '../schemas';

const SRC = fileURLToPath(new URL('../../', import.meta.url));

/** Bundle collection -> area prefix. A collection not named here walks under its own name. */
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

function contentSources(bundle: ContentBundle): FlagSource[] {
  const sources: FlagSource[] = Object.entries(bundle)
    .filter((entry): entry is [string, readonly unknown[]] => Array.isArray(entry[1]))
    .map(([name, records]) => ({ name: AREA_NAMES[name] ?? name, records }));
  sources.push(
    { name: 'follower', records: FOLLOWERS },
    { name: 'journal', records: JOURNAL_NOTES },
  );
  return sources;
}

const OPTIONS: RegistryCheckOptions = {
  exactAreas: [
    ...new Set([
      ...Object.values(AREA_NAMES),
      ...Object.keys(CONTENT_BUNDLE),
      'follower',
      'journal',
    ]),
  ],
  elements: ELEMENTS.map((element) => element.id),
};

/* ------------------------------------------------------------------ */
/* App code: a text scan                                               */
/* ------------------------------------------------------------------ */

interface AppRef {
  readonly key: string;
  readonly area: string;
  readonly at: string;
}

/** Template literals become families: `guidance.tip.${feature}` -> `guidance.tip.*`. */
function keyFromLiteral(literal: string): string {
  return literal.replace(/\$\{[^}]*\}.*$/, '*');
}

const NOT_FLAG_KEYS = new Set(['length', 'map', 'filter', 'some', 'every', 'forEach', 'find']);

/**
 * Flag uses in one app module. Recognises a `setFlags` command or a
 * `…Flags({ … })` / `flags: { … }` literal (writes), `flags.key`,
 * `flags['key']` and `` flags[`key`] `` (reads) and a `flag` Condition literal
 * (reads). A quoted `guidance.`, `scene.` or `standing.` key anywhere is
 * returned as a reference, which must be registered but has no role.
 */
function scanAppSource(text: string, area: string): { uses: FlagUse[]; refs: AppRef[] } {
  const uses: FlagUse[] = [];
  const refs: AppRef[] = [];
  const lineAt = (index: number): string => `line ${text.slice(0, index).split('\n').length}`;

  for (const match of text.matchAll(/(?:flags:\s*|Flags\(\s*)\{((?:[^{}]|\$\{[^{}]*\})*)\}/g)) {
    const body = match[1] ?? '';
    for (const key of body.matchAll(
      /(?:^|,)\s*(?:(['"])([^'"]+)\1|\[\s*`([^`]+)`\s*\]|([A-Za-z_$][\w$]*))\s*:/g,
    )) {
      const name = key[2] ?? (key[3] ? keyFromLiteral(key[3]) : key[4]);
      if (name) uses.push({ key: name, role: 'write', area, at: lineAt(match.index ?? 0) });
    }
  }
  for (const match of text.matchAll(/\bflags\??\.([A-Za-z_$][\w$]*)/g)) {
    const name = match[1] ?? '';
    if (!NOT_FLAG_KEYS.has(name)) {
      uses.push({ key: name, role: 'read', area, at: lineAt(match.index ?? 0) });
    }
  }
  for (const match of text.matchAll(/\bflags\[\s*(['"`])([^'"`]+)\1\s*\]/g)) {
    uses.push({
      key: keyFromLiteral(match[2] ?? ''),
      role: 'read',
      area,
      at: lineAt(match.index ?? 0),
    });
  }
  for (const match of text.matchAll(/kind:\s*'flag',\s*key:\s*'([^']+)'/g)) {
    uses.push({ key: match[1] ?? '', role: 'read', area, at: lineAt(match.index ?? 0) });
  }
  for (const match of text.matchAll(/(['"`])((?:guidance|scene|standing)\.[A-Za-z][\w.]*)\1/g)) {
    refs.push({ key: match[2] ?? '', area, at: lineAt(match.index ?? 0) });
  }
  return { uses, refs };
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')
      ? [path]
      : [];
  });
}

function areaOf(file: string): string {
  return `app:${relative(SRC, file).split(sep).join('/').replace(/\.ts$/, '')}`;
}

const APP_FILES = sourceFiles(join(SRC, 'app'));
const APP_SCAN = APP_FILES.map((file) => scanAppSource(readFileSync(file, 'utf8'), areaOf(file)));
const APP_USES = APP_SCAN.flatMap((scan) => scan.uses);
const APP_REFS = APP_SCAN.flatMap((scan) => scan.refs);

const CONTENT_USES = collectFlagUses(contentSources(CONTENT_BUNDLE));

/* ------------------------------------------------------------------ */
/* The real game                                                       */
/* ------------------------------------------------------------------ */

describe('the flag registry', () => {
  it('agrees with every flag the content and the app set or read', () => {
    expect(checkFlagRegistry(FLAG_REGISTRY, [...CONTENT_USES, ...APP_USES], OPTIONS)).toEqual([]);
  });

  it('registers every guidance, scene and standing key the app names', () => {
    const missing = APP_REFS.filter((ref) => !registryEntryFor(FLAG_REGISTRY, ref.key)).map(
      (ref) => `flag "${ref.key}" is named at ${ref.area} › ${ref.at} but is not registered`,
    );
    expect(missing).toEqual([]);
  });

  it('names only app modules that exist, and one of them spells the key', () => {
    const problems: string[] = [];
    const texts = new Map(APP_FILES.map((file) => [areaOf(file), readFileSync(file, 'utf8')]));
    for (const flag of FLAG_REGISTRY) {
      const appAreas = [...flag.setBy, ...flag.readBy].filter((area) => area.startsWith('app:'));
      for (const area of appAreas) {
        if (!texts.has(area))
          problems.push(`flag "${flag.key}" names ${area}, which does not exist`);
      }
      const spelling = flag.key.endsWith('.*') ? flag.key.slice(0, -1) : flag.key;
      if (appAreas.length > 0 && !appAreas.some((area) => texts.get(area)?.includes(spelling))) {
        problems.push(`flag "${flag.key}": none of ${appAreas.join(', ')} spells "${spelling}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('reaches every flag held anywhere in content', () => {
    const modules = import.meta.glob(
      [
        '../**/*.ts',
        '!../**/*.test.ts',
        '!../**/*.fixture.ts',
        '!../schemas.ts',
        '!../tuning.schema.ts',
      ],
      { eager: true },
    );
    const reached = new Set(CONTENT_USES.map((use) => use.key));
    const strays: string[] = [];
    for (const [file, exports] of Object.entries(modules)) {
      for (const [name, value] of Object.entries(exports as Record<string, unknown>)) {
        for (const use of flagUsesIn(value, `${file} › ${name}`)) {
          if (!reached.has(use.key)) {
            strays.push(
              `flag "${use.key}" is held in ${use.area} › ${use.at}, which the registry walk ` +
                `does not reach: add its collection to contentSources() in flags.test.ts`,
            );
          }
        }
      }
    }
    expect([...new Set(strays)]).toEqual([]);
  });

  it('exports the informational allowlist #493 asks for, each with its reason', () => {
    expect([...INFORMATIONAL_FLAGS].sort()).toEqual(
      FLAG_REGISTRY.filter((flag) => flag.status === 'informational')
        .map((flag) => flag.key)
        .sort(),
    );
    for (const key of INFORMATIONAL_FLAGS) {
      expect(FLAG_REGISTRY.find((flag) => flag.key === key)?.note?.length).toBeGreaterThan(10);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Fixtures: each failure says which flag and where                    */
/* ------------------------------------------------------------------ */

function live(
  key: string,
  setBy: string[],
  readBy: string[],
  extra: Partial<FlagDef> = {},
): FlagDef {
  return {
    key,
    type: 'boolean',
    values: [true],
    meaning: 'A fixture flag.',
    arc: 'Demo · Ba Dan',
    status: 'live',
    setBy,
    readBy,
    ...extra,
  };
}

const write = (key: string, area: string, value: FlagUse['value'] = true): FlagUse => ({
  key,
  role: 'write',
  area,
  at: 'set',
  value,
});
const read = (key: string, area: string): FlagUse => ({ key, role: 'read', area, at: 'when' });

const FIXTURE_OPTIONS: RegistryCheckOptions = {
  exactAreas: ['story', 'map', 'journal'],
  elements: ['fire', 'earth'],
};

describe('flag registry checks', () => {
  it('passes a registry that matches its uses', () => {
    const registry = [live('audit.flag', ['story:a'], ['map:m'])];
    expect(
      checkFlagRegistry(
        registry,
        [write('audit.flag', 'story:a'), read('audit.flag', 'map:m')],
        FIXTURE_OPTIONS,
      ),
    ).toEqual([]);
  });

  it('rejects an unregistered flag, naming where it is used and the likely typo', () => {
    const registry = [live('ruon_spared', ['story:a'], ['map:m'])];
    const problems = checkFlagRegistry(
      registry,
      [
        write('ruon_spared', 'story:a'),
        read('ruon_spared', 'map:m'),
        read('ruon_spard', 'story:b'),
      ],
      FIXTURE_OPTIONS,
    );
    expect(problems).toEqual([
      'flag "ruon_spard" is not in the flag registry (src/content/story/flags.ts): ' +
        'read at story:b › when. Did you mean "ruon_spared"?',
    ]);
  });

  it('rejects a flag that is read but never set', () => {
    const registry = [live('audit.orphan', [], ['map:m'])];
    expect(checkFlagRegistry(registry, [read('audit.orphan', 'map:m')], FIXTURE_OPTIONS)).toContain(
      'flag "audit.orphan" is read at map:m › when but nothing sets it: set it, or mark it ' +
        '"pending" with a note naming what will',
    );
  });

  it('rejects a flag that is set but never read, unless it is informational', () => {
    const uses = [write('audit.dead', 'story:a')];
    expect(
      checkFlagRegistry([live('audit.dead', ['story:a'], [])], uses, FIXTURE_OPTIONS),
    ).toContain(
      'flag "audit.dead" is set at story:a › set but nothing reads it: read it, or mark it ' +
        '"informational" with a note naming who cares',
    );
    const informational = live('audit.dead', ['story:a'], [], {
      status: 'informational',
      note: 'The ending summary will read it.',
    });
    expect(checkFlagRegistry([informational], uses, FIXTURE_OPTIONS)).toEqual([]);
  });

  it('asks for a status change once the other side is written', () => {
    const informational = live('audit.now_read', ['story:a'], ['map:m'], {
      status: 'informational',
      note: 'Nobody reads this yet.',
    });
    expect(
      checkFlagRegistry(
        [informational],
        [write('audit.now_read', 'story:a'), read('audit.now_read', 'map:m')],
        FIXTURE_OPTIONS,
      ),
    ).toContain('flag "audit.now_read" is informational but is now read: mark it "live"');
  });

  it('rejects a registered flag nothing uses, unless it is reserved', () => {
    expect(checkFlagRegistry([live('audit.unused', [], [])], [], FIXTURE_OPTIONS)).toContain(
      'flag "audit.unused" is live but nothing uses it',
    );
    const reserved = live('audit.unused', [], [], { status: 'reserved', note: 'A later region.' });
    expect(checkFlagRegistry([reserved], [], FIXTURE_OPTIONS)).toEqual([]);
    expect(checkFlagRegistry([{ ...reserved, note: '' }], [], FIXTURE_OPTIONS)).toContain(
      'flag "audit.unused" is reserved and needs a note saying why',
    );
  });

  it('holds setBy and readBy to the records that really touch the flag', () => {
    const registry = [live('audit.flag', ['story:old'], ['map:m'])];
    const problems = checkFlagRegistry(
      registry,
      [write('audit.flag', 'story:new'), read('audit.flag', 'map:m')],
      FIXTURE_OPTIONS,
    );
    expect(problems).toEqual([
      'flag "audit.flag" is set at story:new › set, but its setBy does not list "story:new"',
      'flag "audit.flag" lists "story:old" in setBy, but "story:old" never sets it',
      '  expected setBy for "audit.flag": ["story:new"]',
    ]);
  });

  it('lets an app module be named without being found, but never the reverse', () => {
    const appSet = live('audit.app', ['app:app/Thing'], ['journal:j']);
    expect(checkFlagRegistry([appSet], [read('audit.app', 'journal:j')], FIXTURE_OPTIONS)).toEqual(
      [],
    );
    expect(
      checkFlagRegistry(
        [live('audit.app', [], ['journal:j'])],
        [write('audit.app', 'app:app/Thing'), read('audit.app', 'journal:j')],
        FIXTURE_OPTIONS,
      ),
    ).toContain(
      'flag "audit.app" is set at app:app/Thing › set, but its setBy does not list "app:app/Thing"',
    );
  });

  it('rejects a value outside the registered type or values', () => {
    const registry = [live('audit.flag', ['story:a'], ['map:m'])];
    expect(
      checkFlagRegistry(
        registry,
        [write('audit.flag', 'story:a', 'yes'), read('audit.flag', 'map:m')],
        FIXTURE_OPTIONS,
      ),
    ).toContain('flag "audit.flag" is set to "yes" at story:a › set, but its type is boolean');
    expect(
      checkFlagRegistry(
        [live('audit.flag', ['story:a'], ['map:m'], { values: [true] })],
        [write('audit.flag', 'story:a', false), read('audit.flag', 'map:m')],
        FIXTURE_OPTIONS,
      ),
    ).toContain(
      'flag "audit.flag" is set to false at story:a › set, but the registry allows only true',
    );
  });

  it('rejects two registered keys a typo apart', () => {
    const registry = [
      live('ruon_spared', ['story:a'], ['map:m']),
      live('ruonSpared', ['story:a'], ['map:m']),
      live('ruon_spare', ['story:a'], ['map:m']),
    ];
    const problems = checkFlagRegistry(
      registry,
      ['ruon_spared', 'ruonSpared', 'ruon_spare'].flatMap((key) => [
        write(key, 'story:a'),
        read(key, 'map:m'),
      ]),
      FIXTURE_OPTIONS,
    );
    expect(problems).toContain(
      'flags "ruon_spared" and "ruonSpared" are a typo apart: rename one, or merge them',
    );
    expect(problems).toContain(
      'flags "ruon_spared" and "ruon_spare" are a typo apart: rename one, or merge them',
    );
  });

  it('holds the reserved prefixes to their own rules', () => {
    const problems = checkFlagRegistry(
      [
        live('standing.moon', [], [], {
          type: 'number',
          values: undefined,
          status: 'reserved',
          note: 'x',
        }),
        live('scene.audit', [], [], {
          type: 'string',
          values: ['done'],
          status: 'reserved',
          note: 'x',
        }),
      ],
      [],
      FIXTURE_OPTIONS,
    );
    expect(problems).toContain('flag "standing.moon": standing keys are "standing.<element id>"');
    expect(problems).toContain(
      'flag "scene.audit": scene memory is a string, one of "completed" or "declined"',
    );
  });

  it('covers a run-time family with one entry', () => {
    expect(keyMatches('guidance.tip.*', 'guidance.tip.surface.oil')).toBe(true);
    expect(keyMatches('guidance.tip.*', 'guidance.tipster')).toBe(false);
    const registry = [live('guidance.tip.*', ['app:app/X'], ['app:app/X'])];
    expect(
      checkFlagRegistry(registry, [read('guidance.tip.cover', 'app:app/X')], FIXTURE_OPTIONS),
    ).toEqual([]);
  });
});

describe('finding flag uses', () => {
  it('finds every shape that carries a flag', () => {
    const uses = flagUsesIn(
      [
        { id: 'n1', kind: 'flags', set: { a_set: true }, next: 'x' },
        { id: 'n2', kind: 'branch', flag: 'a_branch', ifSet: 'x', ifUnset: 'y' },
        {
          id: 'n3',
          kind: 'choice',
          options: [
            { next: 'x', setFlags: { a_option: true }, adjust: { earth: 2, fire: 0 } },
            {
              next: 'y',
              requires: { kind: 'not', of: { kind: 'flag', key: 'a_gate', op: 'set' } },
            },
          ],
        },
        { conditionalEnemies: [{ flag: 'a_enemies', whenSet: true, placements: [] }] },
        { requiresFlag: 'a_discipline' },
        { when: { kind: 'standing', nation: 'fire', op: 'gte', value: 2 } },
      ],
      'test:x',
    );
    expect(uses.map((use) => `${use.role} ${use.key}`).sort()).toEqual([
      'read a_branch',
      'read a_discipline',
      'read a_enemies',
      'read a_gate',
      'read standing.fire',
      'write a_option',
      'write a_set',
      'write standing.earth',
    ]);
  });

  it('attributes a use to its record, so a moved file keeps its area', () => {
    const uses = collectFlagUses([
      { name: 'story', records: [{ id: 'node_a', kind: 'flags', set: { a: true }, next: 'b' }] },
    ]);
    expect(uses).toEqual([
      { key: 'a', role: 'write', area: 'story:node_a', at: 'set', value: true },
    ]);
  });

  it('reports an unregistered flag added to real content with its node', () => {
    const node = CONTENT_BUNDLE.story.find((candidate) => candidate.kind === 'choice');
    if (!node || node.kind !== 'choice') throw new Error('Missing a story choice');
    const bundle: ContentBundle = {
      ...CONTENT_BUNDLE,
      story: CONTENT_BUNDLE.story.map((candidate) =>
        candidate.id === node.id && candidate.kind === 'choice'
          ? {
              ...candidate,
              options: candidate.options.map((option, index) =>
                index === 0 ? { ...option, setFlags: { 'audit.new_flag': true } } : option,
              ),
            }
          : candidate,
      ),
    };
    const problems = checkFlagRegistry(
      FLAG_REGISTRY,
      [...collectFlagUses(contentSources(bundle)), ...APP_USES],
      OPTIONS,
    );
    expect(problems).toContain(
      `flag "audit.new_flag" is not in the flag registry (src/content/story/flags.ts): ` +
        `write at story:${node.id} › options[0].setFlags.`,
    );
  });

  it('scans app code for setFlags commands, guidance state and Condition literals', () => {
    const { uses, refs } = scanAppSource(
      [
        "app.dispatch({ type: 'setFlags', flags: { riverside_drill: true } });",
        "this.state = { ...state, flags: { ...state.flags, 'guidance.firstFightEligible': true } };",
        'this.saveGuidanceFlags({ [`guidance.tip.${feature}`]: true });',
        'const pet = this.app.state?.flags.riverside_pet;',
        "if (flags['audit.read']) return;",
        "const seen = { kind: 'flag',\n  key: 'scene.bd03_handover', op: 'eq' };",
      ].join('\n'),
      'app:app/Fixture',
    );
    expect(uses.map((use) => `${use.role} ${use.key} ${use.at}`)).toEqual([
      'write riverside_drill line 1',
      'write guidance.firstFightEligible line 2',
      'write guidance.tip.* line 3',
      'read riverside_pet line 4',
      'read audit.read line 5',
      'read scene.bd03_handover line 6',
    ]);
    expect(refs.map((ref) => ref.key)).toEqual([
      'guidance.firstFightEligible',
      'scene.bd03_handover',
    ]);
  });
});
