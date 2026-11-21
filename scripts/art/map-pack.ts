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
      'A yard of hard-packed pale earth with a two-lane road of flagstones crossing it left to right through the middle. A stripe of clean flat grey stone two tiles wide runs top to bottom across the middle of the yard, stepping one tile to the right where it crosses the road; the game draws oil over it. Two gatehouses of dressed grey stone stand at the top and two at the bottom: each a hollow rectangle of wall round a small floor of earth. Between each pair a barred gate of upright timber planks strapped with iron closes the gap, set into the stone of the gatehouses either side. All four corners are cut quarry rock standing two steps above the yard, each fronted by a one-step stone ledge that runs a short way along the left and right edges. Four wooden crates stand as cover on the earth, two above the road and two below.',
    light: 'Flat noon light; dust on everything, no shadows longer than a tile.',
  },
  ambush_road: {
    place: 'A road through a cutting between rock walls, where the party is ambushed.',
    scene:
      "A road of flagstones crosses the whole picture left to right through the middle, four tiles deep. Its two middle rows hold a small runoff pool a little left of centre, which the game draws water over, and further right a long strip of loose floor. The road is the only way through: at the centre, two tiles wide, cut quarry rock two steps high closes in from above and below to the road's edge, so the floor either side of the pinch opens into four small bays, two above the road and two below. The same rock fills the top and bottom edges and the ground between the bays. Its top faces are sheer, scarred by rows of drill holes; along the bottom edge it is a low sawn lip. Two one-step stone ledges face each other across the pinch above the road, a short one at the upper left and a longer one at the upper right, and two more sit under the bottom rock at the lower left and lower right. Four heaps of tumbled rock lie on the floor, two above the road and two below.",
    light: 'Overcast midday: even light in the cutting, the rock faces a little darker.',
  },
  quarry_floor: {
    place: 'The floor of the quarry itself, an open pit of earth ringed by terraces.',
    scene:
      'An open floor of bare earth closed at the top and bottom by a wall of cut quarry rock two steps high, which also fills the four corners two tiles deep; along the bottom edge the rock is only a low lip, so nothing behind it is hidden. Inside each wall runs a one-step stone bench the length of the floor, carrying two heaps of tumbled rock, and at each end of each bench a small timber gantry platform stands a step higher again. On the left a two-lane haul road of packed earth comes in from the edge through the middle, between timber cribbing. On the right, through the middle four rows, a drill shaft two tiles wide drops into darkness inside a timber collar, its headframe and winch beyond the edge. Four clean flat stone patches, each two tiles across, sit in the earth in a ring round the centre, two above the middle and two below; the game adds oil. A dry earth patch two tiles across marks the exact centre beneath live mud. Two more heaps of tumbled rock lie on the left of the open floor, one above and one below the middle.',
    light: 'Hard afternoon light into the pit; the terraces cast no shadow onto the floor.',
  },
  ba_dan_village: {
    place: 'Ba Dan, a quarry village built from the pale stone of its own hill.',
    scene:
      'A village on a hillside under a quarry. Cliff and trees close the top edge, with a dry-stone terrace on the left reached by a short flight of steps, and trees close the left and bottom edges. A road of flagstones runs in from the east edge through a gap in a low stone wall, past a shop with a storeroom and a stone trough on the road, and opens into a square at the middle of the picture. A long patched awning over a table stands at the near side of the square, in front of the largest house. A lane leaves the square to the left past a yard of cut stone blocks and a small house, and a path runs behind the house backs along the top, through a side gate in a garden fence on the right. A canal crosses the lower third from the left edge to the right, with a two-tile-wide stone bridge a little left of centre and washing steps on its near bank, and runs out under the east wall. South of the canal a row of small houses with doorsteps faces a lane, and a path leaves the bottom edge at the middle. A flooded ford closes the left edge of the road.',
    light: 'Soft midday light, pale dust on the square, no long shadows.',
  },
  /*
   * RG-02, the pipeline-trial slice. Written from the script's build list
   * (`docs/story/scripts/act2-sparks.md`) for the map rows as they stand; the region's real art
   * is top-down PixelLab boards (ADR 0103, 0104), so these packs are the composition record, not
   * the art route.
   */
  saltstep_market: {
    place: 'Saltstep, a market town built out over a grey bay.',
    scene:
      'A packed-sand quay runs along the top third, with a road of flagstones coming in at the left edge and a dirt lane behind it. North of it a strip of grass holds three buildings of different sizes: an L-shaped house on the left, a freight office with a clean brass plate in the middle and a small house on the right. South of the quay the bay is deep, still water. A two-plank-wide walk runs out from the left of the quay to a ring of plank platforms on piles round an open basin, and a ferry jetty on the right joins the ring back to the shore. A short side jetty points out to sea from the bottom of the ring. Tall painted level poles stand in the basin and along the walk. Trees close the top corners and edges.',
    light: 'Flat grey coastal daylight; the water darker than the planks.',
  },
  saltstep_pontoon: {
    place: 'The freight pontoon at Saltstep, where the handlers load the barges.',
    scene:
      'A broad deck of weathered planks on the water, ragged at its edges, with deep harbour water all round it. A cast-iron hand pump in its crate stands near the left end, in two places. A short two-plank-wide gangway, its brake lever at its far end, joins the deck to a smaller platform on the right, where a heavy timber winch with a crane arm stands; the platform runs on to the right edge as a gangway toward a barge beyond the picture.',
    light: 'Grey afternoon light off the water, the tide on the turn.',
  },
  saltstep_platform: {
    place:
      'A spare market platform at Saltstep, floating loose in the harbour, where the ferry apprentices spar.',
    scene:
      'A small square deck of market planking alone on the water, with deep harbour water all round it. Down its middle runs the short stub of an old stall counter, open at both ends. A low step of planks runs along the top edge, sloping down at each end. Two mooring bollards with looped rope stand at the top-left and bottom-right corners of the deck.',
    light: 'Bright midday light, calm water.',
  },
  river_road: {
    place: 'The river road, the cart road up the river from the coast to Causeway, a day long.',
    scene:
      'A packed-earth road runs left to right across the middle, a wide slow river along the whole bottom edge and a wooded hillside along the top. Halfway along, a side stream comes down from the hills to the river; a plank bridge carries the road over it, with stepping stones a little downstream. A big shade tree and a trough stand by the road on the left, a footpath leads down to a small jetty, and a camp with a cold fire sits past the bridge. At the right the road climbs past a rock face to a rise looking out over open country.',
    light: 'Bright morning light, a little haze over the river.',
  },
  river_road_bridge: {
    place:
      'The plank bridge on the river road, where a quarry corporal and his guards have put a pole across it.',
    scene:
      'A packed-earth road crosses the middle left to right and runs over a plank bridge where a side stream comes down from wooded hills along the top. A striped pole lies across the bridge. Past it, above the road on the right, a small camp: a cold fire ringed with stones, bedrolls, a cook pot and stacked crates. Two rows below the bridge the stream runs shallow over stepping stones, a fallen log beside them. A wide slow river runs along the bottom edge, gravel bars at its edge, and a grey rock face rises at the top-right corner.',
    light: 'Bright morning light, a little haze over the river.',
  },
  emberwatch_parade: {
    place: 'Emberwatch, an old military outpost across the bay, reopened for civilians.',
    scene:
      'A long barracks wall of grey stone runs the whole width along the top, its old slogans painted over. Below it a wide parade ground of packed sand is covered in beans drying on old tent canvas, with a spear rack used as a bean trellis. Grass rims the ground. A timber jetty juts into deep water at the lower left, where the ferry lands. A gap in the right edge leads on to the power yard.',
    light: 'Early evening, the outpost lamps not yet lit.',
  },
  emberwatch_power_yard: {
    place: 'The power yard at Emberwatch, where the live line comes in.',
    scene:
      'A walled yard of bare earth. Along the top edge a line of timber poles carries a live cable, a fence you can see over. At the top right a rain cistern of stone has overflowed, and standing water spreads across the yard in two broad puddles, one beside the line and one lower down. Down the right side a second row of poles holds a dead copper spur. A gate in the left wall leads back to the parade ground.',
    light: 'Night after rain, lit by the yard lamps; the puddles catch the light.',
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
