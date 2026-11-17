/**
 * The region template (`docs/pipeline-proof-plan.md` §1, ADR 0111): the files a new region starts
 * from, and the three list edits that register it. `new-region.ts` is the command; this module is
 * pure text so `new-region.test.ts` can generate a region, load it and validate it without
 * touching the real lists.
 *
 * A generated region passes `validateContent` as it stands: one small explore map with one NPC,
 * whose conversation leads into the map's explore node (an NPC's node is a story root, so the
 * region needs no link from the rest of the world yet). Everything in it is placeholder, marked
 * `TODO(region)`, for the region's own beat sheet to replace.
 */

export interface RegionNames {
  /** snake_case, as every content id is: `salt_step`. */
  readonly id: string;
  /** What the player reads: `Saltstep`. */
  readonly name: string;
}

/** The identifiers one region id gives the files. */
export function regionIdentifiers(id: string) {
  const camel = id.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
  const constant = id.toUpperCase();
  return {
    folder: camel,
    manifest: constant,
    content: `${constant}_CONTENT`,
    layouts: `${constant}_LAYOUTS`,
    map: `${constant}_HUB`,
    story: `${constant}_STORY`,
    mapId: `${id}_hub`,
    npcId: `${id}_guide`,
    welcomeNode: `${id}_welcome`,
    exploreNode: `${id}_explore`,
  };
}

/** Why `id` cannot name a region, or null when it can. */
export function regionIdProblem(id: string, existing: readonly string[]): string | null {
  if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(id)) {
    return `"${id}" is not a snake_case id (letters, digits and single underscores)`;
  }
  if (existing.includes(id)) return `a region "${id}" already exists`;
  return null;
}

function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * The region's files, by name inside its folder. `contentRoot` is the import path from that folder
 * to `src/content`: `'../..'` for a real region in `src/content/regions/<folder>/`.
 */
export function regionFiles(
  names: RegionNames,
  contentRoot = '../..',
): Readonly<Record<string, string>> {
  const ids = regionIdentifiers(names.id);
  const name = quote(names.name);
  const regions = `${contentRoot}/regions`;
  const core = `${contentRoot}/../core`;
  return {
    'manifest.ts': `/**
 * ${names.name}. TODO(region): one paragraph on what the region is and where it sits in the saga.
 */
import type { RegionManifest } from '${regions}/types';

export const ${ids.manifest}: RegionManifest = {
  id: ${quote(names.id)},
  name: ${name},
  mapIds: [${quote(ids.mapId)}],
  // TODO(region): the regions this one's exits, story links or fights name.
  neighbours: [],
  // TODO(region): the owner's level band (ADR 0011, #784); every fight here must expect a level in it.
  levelBand: { minLevel: 1, maxLevel: 10, placeholder: true },
  // TODO(region): an area track per map (\`MUSIC_TRACKS\`); a map with no row keeps what is playing.
  music: {},
  // TODO(region): each map's top-down scene once its board is baked (ADR 0104).
  scenes: {},
  load: () => import('./content').then((module) => module.${ids.content}),
};
`,
    'content.ts': `/** ${names.name}'s data (see \`manifest.ts\`). */
import type { RegionContent, StoryGroup } from '${regions}/types';
import { withPartyVoices } from '${contentRoot}/story/partyVoices';
import { ${ids.map} } from './map';
import { ${ids.story} } from './story';

const STORY_GROUPS: readonly StoryGroup[] = [
  {
    slug: ${quote(names.id.replace(/_/g, '-'))},
    title: ${name},
    source: ${quote(`../regions/${ids.folder}/story.ts`)},
    nodes: ${ids.story},
  },
];

export const ${ids.content}: RegionContent = {
  id: ${quote(names.id)},
  maps: [${ids.map}],
  storyGroups: STORY_GROUPS,
  story: withPartyVoices(STORY_GROUPS.flatMap((group) => group.nodes)),
  encounters: [],
  anchors: [],
  residents: [],
  backgroundRoles: [],
};
`,
    'layouts.ts': `/** ${names.name}'s top-down layouts (CI and the ground packer only; see \`../types.ts\`). */
import type { TopDownLayout } from '${contentRoot}/topdownLayout';

// TODO(region): a layout per map once its board is drawn.
export const ${ids.layouts}: readonly TopDownLayout[] = [];
`,
    'map.ts': `/** ${names.name}'s first map. TODO(region): the real rows, NPCs and exits. */
import type { MapDef } from '${core}/types';
import { LEGEND } from '${contentRoot}/maps/legend';

export const ${ids.map}: MapDef = {
  id: ${quote(ids.mapId)},
  name: ${name},
  kind: 'explore',
  width: 12,
  height: 8,
  rows: [
    'TTTTTTTTTTTT',
    'T,,,,,,,,,,T',
    'T,,,,==,,,,T',
    'T,,,,==,,,,T',
    'T,,,,==,,,,T',
    'T,,,,==,,,,T',
    'T,,,,,,,,,,T',
    'TTTTTTTTTTTT',
  ],
  legend: LEGEND,
  partySpawns: [
    { x: 5, y: 6 },
    { x: 6, y: 6 },
    { x: 4, y: 6 },
    { x: 7, y: 6 },
    { x: 3, y: 6 },
    { x: 8, y: 6 },
  ],
  npcs: [
    {
      id: ${quote(ids.npcId)},
      name: 'Guide',
      pos: { x: 6, y: 2 },
      sprite: 'npc.elder',
      node: ${quote(ids.welcomeNode)},
    },
  ],
  props: [],
  ambience: 'none',
};
`,
    'story.ts': `/**
 * ${names.name}'s story. TODO(region): the beat sheet's scenes (\`docs/pipeline-proof-plan.md\` §3),
 * read against \`docs/writing-guide.md\` and \`docs/story-bible.md\`.
 */
import type { StoryNode } from '${core}/types';

export const ${ids.story}: readonly StoryNode[] = [
  {
    id: ${quote(ids.welcomeNode)},
    kind: 'dialogue',
    speaker: 'Guide',
    portrait: 'npc.elder',
    lines: ['TODO(region): the first thing anybody says here.'],
    next: ${quote(ids.exploreNode)},
    // Played over the map with the guide framed, not on the dialogue scene.
    presentation: { mapId: ${quote(ids.mapId)}, stage: { npc: ${quote(ids.npcId)} } },
  },
  {
    id: ${quote(ids.exploreNode)},
    kind: 'explore',
    mapId: ${quote(ids.mapId)},
    objective: 'TODO(region): what the party is here to do.',
    next: ${quote(ids.exploreNode)},
  },
];
`,
  };
}

function insertAfterLastImport(source: string, line: string): string {
  const imports = [...source.matchAll(/^import .*;$/gm)];
  const last = imports.at(-1);
  if (!last || last.index === undefined) throw new Error('no import to insert after');
  const at = last.index + last[0].length;
  return `${source.slice(0, at)}\n${line}${source.slice(at)}`;
}

function appendToList(source: string, listName: string, entry: string): string {
  const pattern = new RegExp(`(export const ${listName}[^=]*= \\[)([^\\]]*)(\\];)`);
  const match = pattern.exec(source);
  if (!match) throw new Error(`cannot find the ${listName} list`);
  const items = (match[2] ?? '').trim().replace(/,$/, '');
  return source.replace(pattern, `$1${items ? `${items}, ` : ''}${entry}$3`);
}

/** The three registration lists with the region appended (ADR 0111: "one line" in each). */
export function registerRegion(
  lists: { readonly index: string; readonly content: string; readonly layouts: string },
  id: string,
): { readonly index: string; readonly content: string; readonly layouts: string } {
  const ids = regionIdentifiers(id);
  return {
    index: appendToList(
      insertAfterLastImport(
        lists.index,
        `import { ${ids.manifest} } from './${ids.folder}/manifest';`,
      ),
      'REGIONS',
      ids.manifest,
    ),
    content: appendToList(
      insertAfterLastImport(
        lists.content,
        `import { ${ids.content} } from './${ids.folder}/content';`,
      ),
      'REGION_CONTENT',
      ids.content,
    ),
    layouts: appendToList(
      insertAfterLastImport(
        lists.layouts,
        `import { ${ids.layouts} } from './${ids.folder}/layouts';`,
      ),
      'REGION_LAYOUTS',
      ids.layouts,
    ),
  };
}
