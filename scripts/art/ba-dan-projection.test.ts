import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BA_DAN_DRESSING } from '../../src/content/scenes/baDan';
import { BA_DAN_PAINTING, BA_DAN_UPRIGHTS } from '../../src/content/scenes/baDan.art';
import { DRESSING_PINS, TRUE_PINS, measurePiece, readProjectionPins } from './ba-dan-projection';
import { OUTPUT_DIR, SOURCE_DIR } from './ba-dan-restyle';
import { offTile } from './lib/ba-dan-projection';
import { newImage, readImage } from './lib/image';
import type { Image } from './lib/image';
import { decodeWebp } from './lib/webp';

/**
 * The map is a 2:1 dimetric grid, so every ground line of an upright piece must
 * run at 26.57 degrees. This measures what ships (the decoded WebP a browser
 * draws, and the source it is packed from) the way the lodge master was conformed,
 * and fails a piece more than a degree off, so a future piece cannot bring its own
 * projection. The lodge master (`dwelling`) is the one conformed piece still shipped.
 */
const TOLERANCE_DEGREES = 1;
const pins = readProjectionPins();
const names = Object.keys(pins);

describe.each(names)('%s', (name) => {
  it('is on the tile lines in its source', () => {
    const m = measurePiece(pins, name, readImage(`${SOURCE_DIR}/fine/${name}.png`), true);
    expect(Math.abs(offTile(m.left)), `left ${m.left.degrees}`).toBeLessThanOrEqual(
      TOLERANCE_DEGREES,
    );
    expect(Math.abs(offTile(m.right)), `right ${m.right.degrees}`).toBeLessThanOrEqual(
      TOLERANCE_DEGREES,
    );
  });

  it('is on the tile lines as shipped', async () => {
    const shipped = await decodeWebp(new Uint8Array(readFileSync(`${OUTPUT_DIR}/${name}.webp`)));
    const m = measurePiece(pins, name, shipped, true);
    expect(Math.abs(offTile(m.left)), `left ${m.left.degrees}`).toBeLessThanOrEqual(
      TOLERANCE_DEGREES,
    );
    expect(Math.abs(offTile(m.right)), `right ${m.right.degrees}`).toBeLessThanOrEqual(
      TOLERANCE_DEGREES,
    );
  });
});

/**
 * The village's uprights are cut from the painting by their geometry's silhouette, so the ground line a
 * guide drew is the one that ships. The true pieces were painted on the guides, not conformed: their
 * ground windows live in `art/source/ba-dan-true/pins.json` (the longest run of columns over which the guide
 * piece's lower silhouette lay on one tile line, in the piece's own canvas pixels) and the set dressing's in
 * `pins-dressing.json`. Each shipped upright is put back on its piece's canvas (the frozen geometry says where
 * that was) and measured over the same windows: within a degree of the tile line.
 */
const truePins = readProjectionPins(TRUE_PINS);
const dressingPins = readProjectionPins(DRESSING_PINS);

const PIN_OF: Record<string, [Record<string, (typeof truePins)[string]>, string]> = {
  'gao-house': [truePins, 'true-merchant-house-4x3'],
  'north-house': [truePins, 'true-dwelling-4x3'],
  'southwest-house': [truePins, 'true-dwelling-4x4'],
  'southeast-house': [truePins, 'true-merchant-house-4x4'],
  'gao-display': [truePins, 'true-merchant-display'],
  'north-market-display': [truePins, 'true-merchant-display-b'],
  'south-market-display': [truePins, 'true-merchant-display-c'],
  'west-planter': [truePins, 'true-low-planter'],
  'north-garden': [truePins, 'true-low-planter'],
  'southeast-planter': [truePins, 'true-low-planter-1x2'],
  'canal-bridge': [truePins, 'true-canal-bridge'],
};
BA_DAN_DRESSING.forEach(([image], i) => {
  // The well's round curb has no tile line to measure; a piece with no sprite is part of the ground.
  if (image !== 'village-well' && BA_DAN_UPRIGHTS[`d${i}`]) PIN_OF[`d${i}`] = [dressingPins, image];
});

interface FrozenPiece {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
const frozen = new Map(
  (
    JSON.parse(readFileSync('art/source/ba-dan-regions/geometry/scene.json', 'utf8')) as {
      pieces: FrozenPiece[];
    }
  ).pieces.map((piece) => [piece.id, piece]),
);

const pages = new Map<number, Image>();
async function page(index: number): Promise<Image> {
  let image = pages.get(index);
  if (!image) {
    image = await decodeWebp(
      new Uint8Array(readFileSync(`public/art/maps/ba-dan-scene/uprights-${index}.webp`)),
    );
    pages.set(index, image);
  }
  return image;
}

/** The upright on the canvas its piece was painted on: the frozen rectangle, in painting pixels, at 1.5 to the world pixel. */
async function onCanvas(id: string): Promise<Image> {
  const piece = frozen.get(id)!;
  const [index, sx, sy, vx, vy, width, height] = BA_DAN_UPRIGHTS[id]!;
  const scale = BA_DAN_PAINTING.scale;
  const x0 = Math.floor((piece.x - BA_DAN_PAINTING.origin.x) * scale);
  const y0 = Math.floor((piece.y - BA_DAN_PAINTING.origin.y) * scale);
  const canvas = newImage(
    Math.ceil((piece.x + piece.width - BA_DAN_PAINTING.origin.x) * scale) - x0,
    Math.ceil((piece.y + piece.height - BA_DAN_PAINTING.origin.y) * scale) - y0,
  );
  const atlas = await page(index);
  for (let y = 0; y < height; y++)
    canvas.data.set(
      atlas.data.subarray(
        ((sy + y) * atlas.width + sx) * 4,
        ((sy + y) * atlas.width + sx + width) * 4,
      ),
      ((vy - y0 + y) * canvas.width + (vx - x0)) * 4,
    );
  return canvas;
}

describe.each(Object.keys(PIN_OF))('upright %s', (id) => {
  it('is on the tile lines as shipped', async () => {
    const [pins, name] = PIN_OF[id]!;
    const m = measurePiece(pins, name, await onCanvas(id), false);
    expect(Math.abs(offTile(m.left)), `left ${m.left.degrees}`).toBeLessThanOrEqual(
      TOLERANCE_DEGREES,
    );
    expect(Math.abs(offTile(m.right)), `right ${m.right.degrees}`).toBeLessThanOrEqual(
      TOLERANCE_DEGREES,
    );
  });
});

it('has a ground measurement for every upright that stands on a tile line', () => {
  // Trees stand on a point; the bridge's near layer is cut from the bridge.
  const measured = Object.keys(BA_DAN_UPRIGHTS).filter(
    (id) => !id.startsWith('tree-') && id !== 'canal-bridge-front' && id !== 'd0',
  );
  expect(measured.length).toBeGreaterThan(20);
  for (const id of measured) expect(PIN_OF[id], `${id} has no projection pin`).toBeDefined();
});
