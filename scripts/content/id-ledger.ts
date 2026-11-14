/**
 * Adds every new content id a save can hold to `src/content/ids.ledger.json`
 * (`src/core/save/aliases.ts` explains the ledger). It only ever adds: an id
 * that has gone from the content stays in the ledger, and the test then asks
 * for it back or for a row in `src/content/idAliases.ts`.
 *
 *   npm run ids:ledger            add new ids
 *   npm run ids:ledger -- --check exit 1 if the ledger, content and aliases disagree
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { CONTENT } from '../../src/content';
import { ID_ALIASES } from '../../src/content/idAliases';
import {
  currentSavedIds,
  mergeLedger,
  savedIdProblems,
  type SavedIds,
} from '../../src/content/savedIds';

const LEDGER = resolve('src/content/ids.ledger.json');
const CHECK = process.argv.includes('--check');

async function readLedger(): Promise<Partial<SavedIds>> {
  try {
    return JSON.parse(await readFile(LEDGER, 'utf8')) as Partial<SavedIds>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

const ledger = await readLedger();
const current = currentSavedIds(CONTENT);

if (CHECK) {
  const problems = savedIdProblems(ledger, current, ID_ALIASES);
  for (const problem of problems) console.error(problem);
  process.exitCode = problems.length ? 1 : 0;
} else {
  const merged = mergeLedger(ledger, current);
  const options = (await resolveConfig(LEDGER)) ?? {};
  const text = await format(JSON.stringify(merged), { ...options, parser: 'json' });
  await writeFile(LEDGER, text, 'utf8');
  const added = Object.values(merged).flat().length - Object.values(ledger).flat().length;
  console.log(`ids.ledger.json: ${added} id(s) added.`);
  const problems = savedIdProblems(merged, current, ID_ALIASES);
  for (const problem of problems) console.error(problem);
  if (problems.length) process.exitCode = 1;
}
