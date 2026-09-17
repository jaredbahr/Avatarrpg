import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { noticeText, sameNotice } from '../../scripts/credits';
import type { CreditEntry } from './credits';
import { CREDITS, needsAttribution, thirdParty, THIRD_PARTY_CREDITS } from './credits';
import { readFileSync } from 'node:fs';

const PUBLIC = resolve('public');

/** Every file under `public/`, as paths relative to it, ignoring the odds and ends at its root. */
function shipped(dir = PUBLIC): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...shipped(full));
    else out.push(relative(PUBLIC, full));
  }
  return out;
}

/** The entry accounting for a shipped path, by the longest `covers` prefix that matches. */
function coverFor(path: string, entries: readonly CreditEntry[]): CreditEntry | undefined {
  let best: { entry: CreditEntry; length: number } | undefined;
  for (const entry of entries) {
    for (const cover of entry.covers) {
      if (path !== cover && !path.startsWith(`${cover}/`)) continue;
      if (!best || cover.length > best.length) best = { entry, length: cover.length };
    }
  }
  return best?.entry;
}

describe('credits', () => {
  it('give every entry the fields a licence needs', () => {
    expect(CREDITS.length).toBeGreaterThan(0);
    for (const entry of CREDITS) {
      expect(entry.what, JSON.stringify(entry)).not.toBe('');
      expect(entry.work, entry.what).not.toBe('');
      expect(entry.authors, entry.what).not.toBe('');
      expect(entry.covers.length, `${entry.what} covers nothing`).toBeGreaterThan(0);
      // Someone else's work has to say where it came from; ours must not pretend to.
      if (entry.licence === 'own work') expect(entry.source, entry.what).toBe('');
      else expect(entry.source, `${entry.what} needs a source`).toMatch(/^https:\/\//);
    }
  });

  it('keeps every third-party attribution in the runtime list', () => {
    expect(THIRD_PARTY_CREDITS).toEqual(thirdParty(CREDITS));
  });

  it('name an author for every work whose licence asks for one', () => {
    for (const entry of thirdParty()) {
      if (!needsAttribution(entry.licence)) continue;
      expect(entry.authors, `${entry.work} must credit someone`).not.toBe('');
    }
  });

  it('account for everything that ships under public/', () => {
    const uncovered = shipped()
      // Loose files at the root of public/ are configuration, not art.
      .filter((path) => path.includes('/'))
      .filter((path) => !coverFor(path, CREDITS));
    expect(uncovered, 'add an entry to src/content/credits.ts for these').toEqual([]);
  });

  it('keep NOTICE.md the same as the list the game shows', () => {
    // `sameNotice` is what `npm run credits -- --check` uses, so the test and
    // the command can never disagree about what counts as drift. It is blind
    // to the padding prettier adds to a markdown table, the way the map packs
    // are compared in scripts/art/lib/maps.test.ts.
    const onDisk = readFileSync(resolve('NOTICE.md'), 'utf8');
    expect(sameNotice(onDisk, noticeText()), 'run: npm run credits').toBe(true);
  });
});
