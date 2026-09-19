/**
 * Prompt packs for the map paintings, written from the content itself.
 *
 *   npm run art:map-pack
 *
 * One pack and one layout image per map under `docs/art/prompts/maps/`. The
 * layout image is the tile grid as flat colour blocks at 32 px a tile, the
 * composition a generator is handed to paint over; the pack describes the
 * same grid in words, and carries the scene, the prompt, the negative
 * prompt, the commands and the check. `scripts/art/lib/maps.test.ts`
 * regenerates both and compares, so a map edit that forgets to re-run this
 * fails the build rather than shipping a pack that no longer matches the
 * rules.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_MAPS } from '../../src/content';
import type { MapDef, TerrainId } from '../../src/core/types';
import { ELEMENT_PALETTES, TERRAIN_STYLES } from '../../src/render/palettes';
import { writePng } from './lib/image';
import { describeLayout, legendWords, renderLayout } from './lib/layout';
import { backdropLine, defaultPixelsPerTile } from './map';

export const PACK_DIR = join('docs', 'art', 'prompts', 'maps');
/** Pixels a tile in the layout image: enough to read, small enough to commit. */
export const LAYOUT_PX = 32;

export const packPath = (map: MapDef): string => join(PACK_DIR, `${map.id}.md`);
export const layoutPath = (map: MapDef): string => join(PACK_DIR, `${map.id}-layout.png`);

/**
 * What each map is, in the words a generator gets. The grid section says
 * where everything is to the tile; this says what it looks like.
 */
interface Scene {
  readonly place: string;
  readonly scene: string;
  readonly light: string;
}

const SCENES: Readonly<Record<string, Scene>> = {
  ba_dan_riverside: {
    place: 'The riverside neighborhood of Ba Dan, a quiet afternoon beyond the village.',
    scene:
      'A warm painted village of timber houses and terracotta roofs occupies the left bank. A great banyan shades a central open square. A stream flows from a waterfall at the north toward the south, crossed by a wooden footbridge through the middle. Across it, a little practice clearing opens to the east and a narrow path climbs north to an old stone shrine. A tea veranda overlooks the southwest path. Mossy stones, flowers and reeds soften the banks. Keep the central square, bridge and marked paths clear.',
    light:
      'Warm afternoon daylight, sage greens and cream earth, gently painted edges with dark brown ink accents.',
  },
  forest_road: {
    place:
      'A road through lowland woods a day out of the village, where the party is first waylaid.',
    scene:
      'A wide road of packed earth crosses the whole picture left to right through the middle, five tiles deep. In its left half a rough diamond of dry bare earth marks the substrate for a live pond just left of centre; leave its interior empty. In its right half a grassy island splits the road into two lanes, one above it and one below. Grass fills the top and bottom thirds, meadow with the odd fallen branch. Trees with round canopies stand in all four corners, one alone near the top centre, and two more standing out from the right-hand corners, one near the top and one near the bottom. Along the right edge a low ledge of grey stone steps up out of the grass. Two heaps of tumbled rock sit in the open grass, one above the road toward the left, one below it near the middle.',
    light: 'Late morning under thin cloud: even light, no long shadows.',
  },
  quarry_gate: {
    place: 'The gate of a stone quarry, its yard and the road that runs through it.',
    scene:
      'A yard of hard-packed pale earth with a two-lane road of flagstones crossing it left to right through the middle. A stripe of clean flat grey stone two tiles wide runs top to bottom across the middle of the yard, stepping one tile to the right where it crosses the road; the game draws oil over it. Two gatehouses of dressed grey stone stand at the top and two at the bottom: each a hollow rectangle of wall round a small floor of earth, the pairs leaving a gap between them where the road out of the quarry passes. Stone ledges step up in all four corners and in short runs along the left and right edges. Four wooden crates stand as cover on the earth, two above the road and two below.',
    light: 'Flat noon light; dust on everything, no shadows longer than a tile.',
  },
  ambush_road: {
    place: 'A road through a cutting between rock walls, where the party is ambushed.',
    scene:
      'A road of flagstones crosses the whole picture left to right through the middle, four tiles deep, with a grassy island along its middle that holds a long dry earth patch beneath the live puddle. Above and below the road the floor of the cutting is grass, narrowing toward both ends. Rock walls close in from the top and bottom edges: the outermost band two steps high, stepping down to a band one step high, with the high band reaching further in at the left and right ends so the cutting is widest at its centre. Four heaps of tumbled rock lie on the grass, two above the road and two below.',
    light: 'Overcast midday: even light in the cutting, the rock faces a little darker.',
  },
  quarry_floor: {
    place: 'The floor of the quarry itself, an open pit of earth ringed by terraces.',
    scene:
      'An open floor of bare earth with stepped stone terraces in all four corners, the outer step two tiles high and the inner one tile, so the corners rise like a shallow amphitheatre. Four clean flat stone patches, each two tiles across, sit in the earth in a ring round the centre, two above the middle and two below; the game adds oil. A dry earth patch two tiles across marks the exact centre beneath live mud. Six heaps of tumbled rock lie on the floor: one just above each of the two upper stone patches, one just below each of the two lower stone patches, and two on the left of the open floor, one above and one below the middle.',
    light: 'Hard afternoon light into the pit; the terraces cast no shadow onto the floor.',
  },
  ba_dan_village: {
    place: 'Ba Dan, the small village the party sets out from: a clearing in the woods.',
    scene:
      'A village clearing ringed by trees, thickest in the corners. A road of flagstones crosses the whole picture left to right through the middle, two tiles deep, and runs out through the east gate at the right edge where the flagstones give way to bare earth. Four timber houses, two above the road and two below, each an open cutaway rectangle of timber walls round a visible floor of planks with a doorway opening onto a paved path that leads to the road. Between the houses above the road a paved yard opens off the road with a short canal running across its lower edge: three shallow water cells, a dry stone footbridge, then three more water cells, all low enough to keep the crossing readable and walkable. Below the road a matching paved yard has small market and garden edges. Grass everywhere else, worn to paths near the doors.',
    light: 'Soft mid-morning light, no long shadows.',
  },
};

/** The game's own tones for the terrains a map holds, for the painting to sit near. */
function paletteWords(map: MapDef): string {
  const terrains = new Set<TerrainId>();
  let water = false;
  for (const row of map.rows) {
    for (const ch of row) {
      const template = map.legend[ch];
      if (!template) continue;
      terrains.add(template.terrain);
      if (template.surface === 'water') water = true;
    }
  }
  const parts = [...terrains].map((t) => `${t.replace('_', ' ')} \`${TERRAIN_STYLES[t].fill}\``);
  if (water) parts.push(`still water \`${ELEMENT_PALETTES.water.base}\``);
  return parts.join(', ');
}

function aspectWords(map: MapDef): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(map.width, map.height);
  return `${map.width / d}:${map.height / d}`;
}

export function mapPack(map: MapDef): string {
  const scene = SCENES[map.id];
  if (!scene) throw new Error(`No scene written for map "${map.id}" in scripts/art/map-pack.ts`);
  const px = map.backdrop?.pixelsPerTile ?? defaultPixelsPerTile(map);
  const w = map.width * px;
  const h = map.height * px;
  const layout = describeLayout(map);
  const spawns = map.partySpawns.map((p) => `(${p.x}, ${p.y})`).join(', ');
  const exit = map.exit ? ` The exit is at (${map.exit.pos.x}, ${map.exit.pos.y}).` : '';

  const lines = [
    `# Map painting: ${map.name} (\`${map.id}\`)`,
    '',
    `**Deliver** one PNG of ${w}×${h} pixels or a whole multiple of it (${w * 2}×${h * 2} is the comfortable size to generate at), landscape ${aspectWords(map)}, saved as \`art/raw/maps/${map.id}.png\`. \`art:map\` downsizes it with a box filter and never upscales.`,
    '',
    `**Ships as** \`public/art/maps/${map.id}.webp\`, ${px} px a tile, under 1 MB.`,
    '',
    `**Map** \`${backdropLine(map, px)}\` on the map's definition in \`src/content/maps/\`.`,
    '',
    `**Layout** \`${map.id}-layout.png\` beside this file: the tile grid as flat colour blocks at ${LAYOUT_PX} px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.`,
    '',
    `**Palette** hue anchors from the game's own ground (\`src/render/palettes.ts\`): ${paletteWords(map)}. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.`,
    '',
    '## Where',
    '',
    scene.place,
    '',
    '## The grid',
    '',
    `${map.width} columns by ${map.height} rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.`,
    '',
    ...layout.features.map((line) => `- ${line}`),
    `- ${layout.ground}`,
    `- The party enters from the left, standing at ${spawns}; enemies come from the right.${exit} Paint nothing there that would read as an object to walk round.`,
    '',
    'The rows as the rules read them:',
    '',
    '```',
    ...map.rows,
    '```',
    '',
    `Legend: ${legendWords(map).join('; ')}.`,
    '',
    '## Prompt',
    '',
    ...(map.id === 'ba_dan_riverside'
      ? []
      : [
          '**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.',
          '',
        ]),
    `> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. ${scene.scene} ${scene.light} Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (\`#1b1410\`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape ${aspectWords(map)}, ${w * 2}×${h * 2}.`,
    '',
    '## Negative prompt',
    '',
    '> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients',
    '',
    '## Commands',
    '',
    '```',
    `npm run art:map -- --map ${map.id} --px ${px}`,
    'npm run art:validate',
    'npm run check:assets',
    '```',
    '',
    `Then put the \`backdrop\` line above on the map, run \`npm run verify\`, and open the ${map.kind === 'combat' ? 'fight' : 'village'} in the game.`,
    '',
    '## Check',
    '',
    '- [ ] Settings, Show grid on: the road edges, banks, ledges and walls in the painting sit on the tile lines, and nothing that matters is cut by one',
    '- [ ] Every feature in the grid section is there, and nothing the game places (units, props) is painted in',
    '- [ ] The live surfaces read over it: a puddle is tinted by the game, fire burns on it, a ledge still shows its step under High contrast',
    '- [ ] Even light edge to edge: no vignette, no dark corners (the game adds its own shading round the board)',
    '- [ ] Ink is dark brown, never black; no text, watermark or border',
    '- [ ] Under 1 MB as WebP; `npm run art:validate` and `npm run check:assets` pass',
    '- [ ] Looked at on the tablet at the fitted zoom and pinched to the largest, on both renderers (`?renderer=canvas`, `?renderer=webgl`)',
    '',
  ];
  return lines.join('\n');
}

export function main(): void {
  mkdirSync(PACK_DIR, { recursive: true });
  for (const map of ALL_MAPS) {
    writeFileSync(packPath(map), mapPack(map));
    writePng(layoutPath(map), renderLayout(map, LAYOUT_PX, { grid: true }));
    console.warn(`wrote ${packPath(map)} and ${layoutPath(map)}`);
  }
  console.warn('Now: npx prettier --write docs/art/prompts/maps');
}

if (process.argv[1]?.endsWith('map-pack.ts')) main();
