import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CONTENT_BUNDLE } from '../../src/content';
import { validateContent } from '../../src/content/schemas';
import { levelBandProblems } from '../../src/content/regions/bands';
import { MAX_LEVEL } from '../../src/core/rules/leveling';
import type { RegionContent, RegionManifest } from '../../src/content/regions';
import { regionFiles, regionIdProblem, regionIdentifiers, registerRegion } from './new-region-lib';

const CONTENT_DIR = resolve('src/content');
const REGIONS_DIR = join(CONTENT_DIR, 'regions');
// Outside `src/content/regions`, so `regions.test.ts` never counts the scratch folder as a region.
const scratch = mkdtempSync(join(tmpdir(), 'fnt-new-region-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

async function generate(id: string, name: string) {
  const folder = join(scratch, regionIdentifiers(id).folder);
  const root = relative(folder, CONTENT_DIR).split('\\').join('/');
  const { mkdirSync } = await import('node:fs');
  mkdirSync(folder, { recursive: true });
  for (const [file, text] of Object.entries(regionFiles({ id, name }, root)))
    writeFileSync(join(folder, file), text, 'utf8');
  const manifestModule = (await import(join(folder, 'manifest.ts'))) as Record<
    string,
    RegionManifest
  >;
  const manifest = manifestModule[regionIdentifiers(id).manifest];
  if (!manifest) throw new Error('manifest export missing');
  return { manifest, content: await manifest.load() };
}

function withRegion(region: RegionContent) {
  return {
    ...CONTENT_BUNDLE,
    maps: [...CONTENT_BUNDLE.maps, ...region.maps],
    story: [...CONTENT_BUNDLE.story, ...region.story],
    encounters: [...CONTENT_BUNDLE.encounters, ...region.encounters],
    anchors: [...(CONTENT_BUNDLE.anchors ?? []), ...region.anchors],
    residents: [...(CONTENT_BUNDLE.residents ?? []), ...region.residents],
    backgroundRoles: [...(CONTENT_BUNDLE.backgroundRoles ?? []), ...region.backgroundRoles],
  };
}

describe('new-region template', () => {
  it('generates a region that loads through its manifest and validates', async () => {
    const { manifest, content } = await generate('salt_step', 'Saltstep');
    expect(manifest.id).toBe('salt_step');
    expect(content.id).toBe('salt_step');
    expect(content.maps.map((map) => map.id)).toEqual(manifest.mapIds);
    expect(content.story.map((node) => node.id)).toEqual(
      content.storyGroups.flatMap((group) => group.nodes.map((node) => node.id)),
    );
    const problems = validateContent(withRegion(content));
    expect(problems, problems.join('\n')).toEqual([]);
    expect(levelBandProblems([manifest], [content], MAX_LEVEL)).toEqual([]);
    expect(manifest.levelBand.placeholder).toBe(true);
  });

  it('quotes a name with an apostrophe safely', async () => {
    const { manifest } = await generate('gaos_rest', "Gao's Rest");
    expect(manifest.name).toBe("Gao's Rest");
  });

  it('refuses ids that are not snake_case or already taken', () => {
    expect(regionIdProblem('salt_step', ['ba_dan_valley'])).toBeNull();
    expect(regionIdProblem('SaltStep', [])).toMatch(/snake_case/);
    expect(regionIdProblem('salt__step', [])).toMatch(/snake_case/);
    expect(regionIdProblem('ba_dan_valley', ['ba_dan_valley'])).toMatch(/already exists/);
  });

  it('appends the region to the three real registration lists', () => {
    const read = (file: string) => readFileSync(join(REGIONS_DIR, file), 'utf8');
    const lists = registerRegion(
      { index: read('index.ts'), content: read('content.ts'), layouts: read('layouts.ts') },
      'salt_step',
    );
    expect(lists.index).toContain("import { SALT_STEP } from './saltStep/manifest';");
    expect(lists.index).toMatch(
      /REGIONS: readonly RegionManifest\[\] = \[BA_DAN_VALLEY, SALTSTEP_EMBERWATCH, SALT_STEP\];/,
    );
    expect(lists.content).toContain("import { SALT_STEP_CONTENT } from './saltStep/content';");
    expect(lists.content).toMatch(
      /= \[\s*BA_DAN_VALLEY_CONTENT,\s*SALTSTEP_EMBERWATCH_CONTENT, SALT_STEP_CONTENT\];/,
    );
    expect(lists.layouts).toContain("import { SALT_STEP_LAYOUTS } from './saltStep/layouts';");
    expect(lists.layouts).toMatch(
      /= \[\s*BA_DAN_VALLEY_LAYOUTS,\s*SALTSTEP_EMBERWATCH_LAYOUTS, SALT_STEP_LAYOUTS\];/,
    );
  });
});
