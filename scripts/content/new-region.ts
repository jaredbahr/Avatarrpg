/**
 * Starts a new region from the template (`new-region-lib.ts`, ADR 0111).
 *
 *   npm run new:region -- salt_step "Saltstep"
 *
 * Writes `src/content/regions/<camelId>/` and appends the region to the three registration lists.
 * The result passes `validateContent`; every placeholder in it is marked `TODO(region)`.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { REGIONS } from '../../src/content/regions';
import { regionFiles, regionIdProblem, regionIdentifiers, registerRegion } from './new-region-lib';

const REGIONS_DIR = resolve('src/content/regions');
const [id, ...nameWords] = process.argv.slice(2).filter((arg) => arg !== '--');
const name = nameWords.join(' ').trim();

async function formatted(path: string, text: string): Promise<string> {
  const options = (await resolveConfig(path)) ?? {};
  return format(text, { ...options, filepath: path });
}

async function main(): Promise<void> {
  if (!id || !name) {
    console.error('Usage: npm run new:region -- <snake_case_id> "<Name>"');
    process.exitCode = 1;
    return;
  }
  const problem = regionIdProblem(
    id,
    REGIONS.map((region) => region.id),
  );
  const folder = join(REGIONS_DIR, regionIdentifiers(id).folder);
  if (problem || existsSync(folder)) {
    console.error(problem ?? `${folder} already exists`);
    process.exitCode = 1;
    return;
  }

  const listPaths = {
    index: join(REGIONS_DIR, 'index.ts'),
    content: join(REGIONS_DIR, 'content.ts'),
    layouts: join(REGIONS_DIR, 'layouts.ts'),
  };
  const lists = registerRegion(
    {
      index: await readFile(listPaths.index, 'utf8'),
      content: await readFile(listPaths.content, 'utf8'),
      layouts: await readFile(listPaths.layouts, 'utf8'),
    },
    id,
  );

  await mkdir(folder, { recursive: true });
  for (const [file, text] of Object.entries(regionFiles({ id, name }))) {
    const path = join(folder, file);
    await writeFile(path, await formatted(path, text), 'utf8');
  }
  for (const key of ['index', 'content', 'layouts'] as const) {
    await writeFile(listPaths[key], await formatted(listPaths[key], lists[key]), 'utf8');
  }

  console.log(`Wrote ${folder} and registered "${id}" in the three region lists.
Next:
  1. Replace every TODO(region) with the beat sheet's maps, NPCs, story and fights.
  2. npm run ids:ledger          record the region's ids (src/content/ids.ledger.json)
  3. Add any flag it sets or reads to src/content/story/flags.ts.
  4. Link it into the world: an exit or story link from a neighbour, both manifests' neighbours.
  5. npm run docs:story          regenerate the story diagrams
  6. Draw its board (scripts/art/topdown/boards/) and add its scene and music rows to manifest.ts.`);
}

await main();
