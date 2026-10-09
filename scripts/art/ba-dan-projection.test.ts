import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BA_DAN_DRESSING, BA_DAN_SCENE } from '../../src/content/scenes/baDan';
import { measurePiece, readProjectionPins } from './ba-dan-projection';
import { DRESSING_PINS, TRUE_PINS, WALL_RUNS } from './ba-dan-true-pins';
import { OUTPUT_DIR, SOURCE_DIR } from './ba-dan-restyle';
import { offTile } from './lib/ba-dan-projection';
import { readImage } from './lib/image';
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
 * The true pieces are painted on the guides, not conformed, so their ground windows live in
 * `art/source/ba-dan-true/pins.json` (`ba-dan-true-pins.ts` finds them from each piece's lower
 * silhouette) and the guard is the same one: the packed source and the shipped WebP both lie
 * within a degree of the tile line over those windows.
 */
const truePins = readProjectionPins(TRUE_PINS);

describe.each(Object.keys(truePins))('%s', (name) => {
  const source = name.replace(/^true-/, '');
  it('is on the tile lines in its packed source', () => {
    const m = measurePiece(
      truePins,
      name,
      readImage(`art/source/ba-dan-true/${source}.png`),
      false,
    );
    expect(Math.abs(offTile(m.left)), `left ${m.left.degrees}`).toBeLessThanOrEqual(
      TOLERANCE_DEGREES,
    );
    expect(Math.abs(offTile(m.right)), `right ${m.right.degrees}`).toBeLessThanOrEqual(
      TOLERANCE_DEGREES,
    );
  });

  it('is on the tile lines as shipped', async () => {
    const shipped = await decodeWebp(new Uint8Array(readFileSync(`${OUTPUT_DIR}/${name}.webp`)));
    const m = measurePiece(truePins, name, shipped, false);
    expect(Math.abs(offTile(m.left)), `left ${m.left.degrees}`).toBeLessThanOrEqual(
      TOLERANCE_DEGREES,
    );
    expect(Math.abs(offTile(m.right)), `right ${m.right.degrees}`).toBeLessThanOrEqual(
      TOLERANCE_DEGREES,
    );
  });
});

it('has a ground measurement for every upright piece the village draws', () => {
  const upright = BA_DAN_SCENE.scenery.flatMap((piece) => {
    const base = /ba-dan-scene\/(.+)\.webp$/.exec(piece.url)?.[1];
    // Trees stand on a point (and ship in an atlas), the surround is two backdrops, the bridge's near
    // layer is cut from the bridge, and the dressing and wall atlases are measured piece by piece below.
    return base &&
      !/tree$|^village-trees$|^village-surround$|^true-dressing$|^true-walls$|-front$/.test(base)
      ? [base]
      : [];
  });
  expect(upright.length).toBeGreaterThan(0);
  for (const base of new Set(upright))
    expect((pins[base] ?? truePins[base])?.measure, `${base} has no projection pin`).toBeDefined();
});

it('has a ground measurement for every piece of dressing and both wall runs the village draws', () => {
  const dressing = readProjectionPins(DRESSING_PINS);
  // The well's round curb has no tile line to measure; `ba-dan-true-pipeline.test.ts` fits its ellipse.
  const sprites = new Set<string>(BA_DAN_DRESSING.map(([image]) => image));
  sprites.add('terrace-planter-2x1');
  sprites.delete('village-well');
  for (const sprite of sprites)
    expect(dressing[sprite]?.measure, `${sprite} has no projection pin`).toBeDefined();
  for (const run of WALL_RUNS)
    expect(dressing[`wall-${run}`]?.measure, `wall ${run} has no projection pin`).toBeDefined();
});
