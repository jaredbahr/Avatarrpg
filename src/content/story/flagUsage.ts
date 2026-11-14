/**
 * Where every story flag is read and written (#493).
 *
 * The flag registry (`flags.ts`) says what each flag means; this module finds
 * where content actually touches one, so the two can be held together by
 * `flags.test.ts`. It walks plain data and recognises every shape that carries
 * a flag key:
 *
 * - writes: a `flags` node's `set`, a choice option's `setFlags`, and a
 *   choice option's `adjust` (which writes the reserved `standing.<nation>`);
 * - reads: a `flag` or `standing` Condition anywhere (dialogue variants,
 *   option gates, recaps, objectives, map NPC routes and exits, encounter
 *   variants, conditional props, residents, followers, the journal), a
 *   `branch` node, a `conditionalEnemies` group and a discipline's
 *   `requiresFlag`.
 *
 * Usage is attributed to an **area**: `<source>:<id of the nearest record>`,
 * such as `story:welcome_home_dorin`, `map:ba_dan_village` or
 * `journal:ducks`. Areas are content ids, not file paths, so moving a file
 * between regions never changes them.
 *
 * Pure data in, data out: no file system, no DOM. The app-code scan that
 * finds flags written by `setFlags` commands and guidance state lives in the
 * test, which may read source files.
 */

import type { FlagValue } from '../../core/types';
import { SCENE_PREFIX, SCENE_VALUES, STANDING_PREFIX } from '../../core/story/conditions';
import type { FlagDef, FlagType } from './flags';

export type FlagRole = 'read' | 'write';

export interface FlagUse {
  readonly key: string;
  readonly role: FlagRole;
  /** `story:<node id>`, `map:<map id>`, `journal:<note id>`, `app:<module>` and so on. */
  readonly area: string;
  /** A readable path inside the area, for the failure message. */
  readonly at: string;
  /** The value written, or the value an `eq`/`gte`/`lte` condition compares with. */
  readonly value?: FlagValue;
}

/** One collection of records to walk: each record's `id` names its area. */
export interface FlagSource {
  /** The area prefix, such as `story` or `map`. */
  readonly name: string;
  readonly records: readonly unknown[];
  /** How to name a record that has no string `id` (defaults to its index). */
  readonly idOf?: (record: unknown, index: number) => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function isFlagValue(value: unknown): value is FlagValue {
  return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string';
}

function recordId(record: unknown, index: number, source: FlagSource): string {
  if (source.idOf) return source.idOf(record, index);
  if (isRecord(record) && typeof record.id === 'string') return record.id;
  return String(index);
}

/**
 * Every flag use inside one value. Recurses through plain objects, arrays and
 * `Map` values; anything else (functions, class instances) is opaque data.
 */
export function flagUsesIn(value: unknown, area: string, at = ''): FlagUse[] {
  const out: FlagUse[] = [];
  const ancestors = new Set<unknown>();
  const join = (path: string, key: string): string => (path ? `${path}.${key}` : key);

  const visit = (node: unknown, path: string): void => {
    if (typeof node !== 'object' || node === null || ancestors.has(node)) return;
    if (Array.isArray(node)) {
      ancestors.add(node);
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      ancestors.delete(node);
      return;
    }
    if (node instanceof Map) {
      ancestors.add(node);
      for (const [key, item] of node) visit(item, `${path}.get(${String(key)})`);
      ancestors.delete(node);
      return;
    }
    if (!isRecord(node)) return;

    const read = (key: string, where: string, compared?: unknown): void => {
      out.push({
        key,
        role: 'read',
        area,
        at: where,
        ...(isFlagValue(compared) ? { value: compared } : {}),
      });
    };
    const write = (key: string, where: string, written: unknown): void => {
      out.push({
        key,
        role: 'write',
        area,
        at: where,
        ...(isFlagValue(written) ? { value: written } : {}),
      });
    };

    if (node.kind === 'flag' && typeof node.key === 'string') read(node.key, path, node.value);
    if (node.kind === 'standing' && typeof node.nation === 'string') {
      read(`${STANDING_PREFIX}${node.nation}`, path, node.value);
    }
    if (node.kind === 'branch' && typeof node.flag === 'string')
      read(node.flag, join(path, 'flag'));
    if (typeof node.flag === 'string' && typeof node.whenSet === 'boolean') {
      read(node.flag, join(path, 'flag'));
    }
    if (typeof node.requiresFlag === 'string') read(node.requiresFlag, join(path, 'requiresFlag'));
    if (node.kind === 'flags' && isRecord(node.set)) {
      for (const [key, written] of Object.entries(node.set)) write(key, join(path, 'set'), written);
    }
    if (isRecord(node.setFlags)) {
      for (const [key, written] of Object.entries(node.setFlags)) {
        write(key, join(path, 'setFlags'), written);
      }
    }
    // A choice option's `adjust` is the only writer of nation standing.
    if (isRecord(node.adjust) && typeof node.next === 'string') {
      for (const [nation, delta] of Object.entries(node.adjust)) {
        if (typeof delta === 'number' && delta !== 0) {
          write(`${STANDING_PREFIX}${nation}`, join(path, 'adjust'), delta);
        }
      }
    }

    ancestors.add(node);
    for (const [key, item] of Object.entries(node)) visit(item, join(path, key));
    ancestors.delete(node);
  };

  visit(value, at);
  return out;
}

/** Every flag use in every record of every source, attributed to its area. */
export function collectFlagUses(sources: readonly FlagSource[]): FlagUse[] {
  const out: FlagUse[] = [];
  for (const source of sources) {
    source.records.forEach((record, index) => {
      const id = recordId(record, index, source);
      out.push(...flagUsesIn(record, `${source.name}:${id}`));
    });
  }
  return out;
}

/** A templated key (`guidance.tip.*`) covers every key under its prefix. */
export function keyMatches(registered: string, key: string): boolean {
  if (registered.endsWith('.*')) {
    const prefix = registered.slice(0, -1);
    return key === registered || (key.startsWith(prefix) && key.length > prefix.length);
  }
  return registered === key;
}

/** Edit distance, for the near-duplicate check. Small keys only; quadratic is fine. */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** Folds case and separators, so `ruonSpared`, `ruon_spared` and `ruon.spared` collide. */
export function foldKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9*]/g, '');
}

/* ------------------------------------------------------------------ */
/* Holding the registry to the content                                 */
/* ------------------------------------------------------------------ */

export interface RegistryCheckOptions {
  /**
   * Area prefixes whose uses the walk finds reliably (`story`, `map`, …): for
   * these, `setBy`/`readBy` must match the content exactly. Any other prefix
   * (`app`) may be named without being found, because app code can reach a
   * key through a constant, but everything found must still be named.
   */
  readonly exactAreas: readonly string[];
  /** Element ids: the only legal suffixes of a `standing.` key. */
  readonly elements: readonly string[];
}

function typesOf(flag: FlagDef): readonly FlagType[] {
  return typeof flag.type === 'string' ? [flag.type] : flag.type;
}

function describeUse(use: FlagUse): string {
  return use.at ? `${use.area} › ${use.at}` : use.area;
}

/** The registry entry covering `key`: the exact key, else the longest family. */
export function registryEntryFor(registry: readonly FlagDef[], key: string): FlagDef | undefined {
  const exact = registry.find((flag) => flag.key === key);
  if (exact) return exact;
  return registry
    .filter((flag) => flag.key.endsWith('.*') && keyMatches(flag.key, key))
    .sort((a, b) => b.key.length - a.key.length)[0];
}

function suggestionFor(registry: readonly FlagDef[], key: string): string {
  let best: { key: string; distance: number } | null = null;
  for (const flag of registry) {
    const distance =
      foldKey(flag.key) === foldKey(key)
        ? 0
        : editDistance(flag.key.toLowerCase(), key.toLowerCase());
    if (distance <= 3 && (!best || distance < best.distance)) best = { key: flag.key, distance };
  }
  return best ? ` Did you mean "${best.key}"?` : '';
}

/**
 * Every way the registry and the content disagree, one readable line each,
 * naming the flag and where it is used. Empty means they agree.
 */
export function checkFlagRegistry(
  registry: readonly FlagDef[],
  uses: readonly FlagUse[],
  options: RegistryCheckOptions,
): string[] {
  const problems: string[] = [];
  const exact = new Set(options.exactAreas);
  const isExact = (area: string): boolean => exact.has(area.split(':')[0] ?? '');

  /* The registry on its own. */
  const keys = new Set<string>();
  for (const flag of registry) {
    if (keys.has(flag.key)) problems.push(`flag "${flag.key}" is registered twice`);
    keys.add(flag.key);
    if (flag.key.includes('*') && !/^[^*]+\.\*$/.test(flag.key)) {
      problems.push(`flag "${flag.key}": a family key ends in ".*" and has no other "*"`);
    }
    if (flag.status !== 'live' && !flag.note?.trim()) {
      problems.push(`flag "${flag.key}" is ${flag.status} and needs a note saying why`);
    }
    if (!flag.meaning.trim()) problems.push(`flag "${flag.key}" needs a one-line meaning`);
    if (flag.key.startsWith(STANDING_PREFIX)) {
      const nation = flag.key.slice(STANDING_PREFIX.length);
      if (!options.elements.includes(nation)) {
        problems.push(`flag "${flag.key}": standing keys are "${STANDING_PREFIX}<element id>"`);
      }
      if (typesOf(flag).join() !== 'number') {
        problems.push(`flag "${flag.key}": standing is numeric, so its type is "number"`);
      }
    }
    if (flag.key.startsWith(SCENE_PREFIX)) {
      const values = flag.values ?? [];
      if (
        typesOf(flag).join() !== 'string' ||
        values.length === 0 ||
        values.some((value) => !SCENE_VALUES.includes(value))
      ) {
        problems.push(
          `flag "${flag.key}": scene memory is a string, one of ${SCENE_VALUES.map((v) => `"${String(v)}"`).join(' or ')}`,
        );
      }
    }
    for (const value of flag.values ?? []) {
      if (!typesOf(flag).includes(typeof value as FlagType)) {
        problems.push(`flag "${flag.key}" allows ${JSON.stringify(value)}, which is not its type`);
      }
    }
    for (const [field, areas] of [
      ['setBy', flag.setBy],
      ['readBy', flag.readBy],
    ] as const) {
      const seen = new Set<string>();
      for (const area of areas) {
        if (!/^[a-z]+:\S+$/.test(area)) {
          problems.push(`flag "${flag.key}" ${field} "${area}" is not "<source>:<id>"`);
        }
        if (seen.has(area)) problems.push(`flag "${flag.key}" ${field} lists "${area}" twice`);
        seen.add(area);
      }
    }
  }

  /* No two keys a typo apart. */
  for (let i = 0; i < registry.length; i++) {
    for (let j = i + 1; j < registry.length; j++) {
      const a = registry[i]?.key ?? '';
      const b = registry[j]?.key ?? '';
      if (a !== b && (foldKey(a) === foldKey(b) || editDistance(a, b) <= 1)) {
        problems.push(`flags "${a}" and "${b}" are a typo apart: rename one, or merge them`);
      }
    }
  }

  /* Every use is registered. */
  const byEntry = new Map<FlagDef, FlagUse[]>();
  const unregistered = new Map<string, FlagUse[]>();
  for (const use of uses) {
    const entry = registryEntryFor(registry, use.key);
    if (entry) byEntry.set(entry, [...(byEntry.get(entry) ?? []), use]);
    else unregistered.set(use.key, [...(unregistered.get(use.key) ?? []), use]);
  }
  for (const [key, found] of unregistered) {
    const where = found.map((use) => `${use.role} at ${describeUse(use)}`).join('; ');
    problems.push(
      `flag "${key}" is not in the flag registry (src/content/story/flags.ts): ${where}.${suggestionFor(registry, key)}`,
    );
  }

  for (const flag of registry) {
    const found = byEntry.get(flag) ?? [];

    /* setBy / readBy name exactly what touches it. */
    for (const [role, field, declared] of [
      ['write', 'setBy', flag.setBy],
      ['read', 'readBy', flag.readBy],
    ] as const) {
      const actual = found.filter((use) => use.role === role);
      const actualAreas = new Set(actual.map((use) => use.area));
      const missing = [...actualAreas].filter((area) => !declared.includes(area));
      for (const area of missing) {
        const use = actual.find((candidate) => candidate.area === area);
        problems.push(
          `flag "${flag.key}" is ${role === 'write' ? 'set' : 'read'} at ${use ? describeUse(use) : area}, ` +
            `but its ${field} does not list "${area}"`,
        );
      }
      for (const area of declared) {
        if (isExact(area) && !actualAreas.has(area)) {
          problems.push(
            `flag "${flag.key}" lists "${area}" in ${field}, but "${area}" never ${role === 'write' ? 'sets' : 'reads'} it`,
          );
        }
      }
      if (missing.length > 0 || declared.some((area) => isExact(area) && !actualAreas.has(area))) {
        const expected = [
          ...new Set([...actualAreas, ...declared.filter((area) => !isExact(area))]),
        ];
        problems.push(`  expected ${field} for "${flag.key}": ${JSON.stringify(expected)}`);
      }
    }

    /* Status matches what the content does. */
    const written =
      found.some((use) => use.role === 'write') || flag.setBy.some((area) => !isExact(area));
    const read =
      found.some((use) => use.role === 'read') || flag.readBy.some((area) => !isExact(area));
    const firstRead = found.find((use) => use.role === 'read');
    const firstWrite = found.find((use) => use.role === 'write');
    switch (flag.status) {
      case 'live':
        if (read && !written) {
          problems.push(
            `flag "${flag.key}" is read${firstRead ? ` at ${describeUse(firstRead)}` : ''} but nothing sets it: ` +
              `set it, or mark it "pending" with a note naming what will`,
          );
        }
        if (written && !read) {
          problems.push(
            `flag "${flag.key}" is set${firstWrite ? ` at ${describeUse(firstWrite)}` : ''} but nothing reads it: ` +
              `read it, or mark it "informational" with a note naming who cares`,
          );
        }
        if (!written && !read) problems.push(`flag "${flag.key}" is live but nothing uses it`);
        break;
      case 'informational':
        if (read)
          problems.push(`flag "${flag.key}" is informational but is now read: mark it "live"`);
        if (!written) problems.push(`flag "${flag.key}" is informational but nothing sets it`);
        break;
      case 'pending':
        if (read && written) {
          problems.push(`flag "${flag.key}" is pending but is now set and read: mark it "live"`);
        }
        if (!read && !written) {
          problems.push(
            `flag "${flag.key}" is pending but nothing uses it: mark it "reserved" or remove it`,
          );
        }
        break;
      case 'reserved':
        if (read || written) {
          problems.push(`flag "${flag.key}" is reserved but is used: give it a live status`);
        }
        break;
    }

    /* Values fit. */
    for (const use of found) {
      if (use.value === undefined) continue;
      const verb = use.role === 'write' ? 'set to' : 'compared with';
      if (!typesOf(flag).includes(typeof use.value as FlagType)) {
        problems.push(
          `flag "${use.key}" is ${verb} ${JSON.stringify(use.value)} at ${describeUse(use)}, ` +
            `but its type is ${typesOf(flag).join(' or ')}`,
        );
      } else if (flag.values && !flag.values.includes(use.value)) {
        problems.push(
          `flag "${use.key}" is ${verb} ${JSON.stringify(use.value)} at ${describeUse(use)}, ` +
            `but the registry allows only ${flag.values.map((v) => JSON.stringify(v)).join(', ')}`,
        );
      }
    }
  }

  return problems;
}
