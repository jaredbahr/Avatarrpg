/**
 * The NOTICE file, written from `src/content/credits.ts`.
 *
 *   npm run credits && npx prettier --write NOTICE.md
 *   npm run credits -- --check   # fail if it is out of date
 *
 * Prettier pads the table after this writes it, so the drift test compares
 * the two ignoring whitespace, as the map packs are compared.
 *
 * The game shows the same list in its pause menu, so generating this one
 * rather than writing it by hand is what keeps the two from disagreeing.
 * `credits.test.ts` runs the check, so a forgotten regeneration fails CI.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CreditEntry } from '../src/content/credits';
import { CREDITS, needsAttribution, thirdParty } from '../src/content/credits';

const HEADER = `# Notice

Four Nations Tactics is non-commercial fan work. This file lists everything in
it that someone else made, what licence it arrives under, and where it came
from. The game shows the same list under Pause, Credits: both are generated
from \`src/content/credits.ts\`, so run \`npm run credits\` after changing it.

Anything not listed here was made for this project.
`;

function row(entry: CreditEntry): string {
  const source = entry.source ? `[link](${entry.source})` : '—';
  return `| ${entry.what} | ${entry.work} | ${entry.authors} | ${entry.licence} | ${source} |`;
}

export function noticeText(entries: readonly CreditEntry[] = CREDITS): string {
  const outside = thirdParty(entries);
  const ours = entries.filter((entry) => entry.licence === 'own work');

  const lines = [HEADER, '## Third-party work', ''];
  if (outside.length === 0) {
    lines.push('Nothing third-party ships yet.', '');
  } else {
    lines.push(
      '| What | Work | By | Licence | Source |',
      '| --- | --- | --- | --- | --- |',
      ...outside.map(row),
      '',
    );
    const credited = outside.filter((entry) => needsAttribution(entry.licence));
    if (credited.length > 0) {
      lines.push(
        'These licences ask for the author to be named wherever the work is used,',
        'which is why the game carries the same list on its own Credits screen:',
        '',
        ...credited.map((entry) => `- ${entry.work} — ${entry.authors}`),
        '',
      );
    }
    const notes = outside.filter((entry) => entry.note);
    if (notes.length > 0) {
      lines.push('Notes:', '', ...notes.map((entry) => `- **${entry.work}.** ${entry.note}`), '');
    }
  }

  lines.push('## Made for this project', '');
  for (const entry of ours) {
    lines.push(`- **${entry.what}.** ${entry.note ?? entry.work}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Whether two notices say the same thing, blind to the padding prettier adds
 * to a markdown table: the spaces in a cell and the run of dashes under the
 * heading. The map packs are compared the same way.
 */
export function sameNotice(a: string, b: string): boolean {
  const normalise = (text: string): string =>
    text.replace(/\s+/g, ' ').replace(/-{3,}/g, '---').trim();
  return normalise(a) === normalise(b);
}

const target = resolve('NOTICE.md');

// Importing this module (the drift test does) must not write or exit.
if (process.argv[1]?.endsWith('credits.ts')) {
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      console.error('NOTICE.md is missing. Run: npm run credits');
      process.exit(1);
    }
    if (!sameNotice(current, noticeText())) {
      console.error('NOTICE.md is out of date with src/content/credits.ts. Run: npm run credits');
      process.exit(1);
    }
    console.warn('NOTICE.md matches the credits.');
  } else {
    writeFileSync(target, noticeText());
    console.warn(`wrote ${target}`);
  }
}
