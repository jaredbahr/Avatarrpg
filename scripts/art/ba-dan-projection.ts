/**
 * Report where each Ba Dan upright piece's ground lines run: the Forest Road lodge master
 * (`art/source/ba-dan-restyle/fine/pins.json`) and the true pieces
 * (`art/source/ba-dan-true/pins.json`).
 *
 *   node --import tsx scripts/art/ba-dan-projection.ts
 *
 * The windows each piece is measured over live in the pins; `lib/ba-dan-projection.ts` is the
 * measurement. The tile line is atan(0.5), 26.565 degrees; `ba-dan-projection.test.ts` fails a
 * shipped piece more than one degree off it.
 */
import { readFileSync } from 'node:fs';
import type { Image } from './lib/image';
import { readImage } from './lib/image';
import type { GroundSpec } from './lib/ba-dan-projection';
import {
  groundEnds,
  lowerEnvelope,
  measureGround,
  offTile,
  scaleSpec,
  TILE_DEGREES,
} from './lib/ba-dan-projection';
import { SOURCE_DIR } from './ba-dan-restyle';

const PINS = `${SOURCE_DIR}/fine/pins.json`;
/**
 * The true pieces' ground-line windows (`art/source/ba-dan-true/pins.json`): each is the longest run of columns
 * over which the piece's lower silhouette lay on a tile line (slope +0.5 on grid x, -0.5 on grid y), found from
 * the guide's own silhouette, so they are not tuned to a painting. The set dressing and the wall runs are in
 * `pins-dressing.json`, measured the same way. The ba-dan-true packers that found them are retired with the
 * pieces' own sprites (`art/source/ba-dan-true/README.md`); the pins are the record.
 */
export const TRUE_PINS = 'art/source/ba-dan-true/pins.json';
export const DRESSING_PINS = 'art/source/ba-dan-true/pins-dressing.json';

export interface ProjectionPin {
  readonly measure?: GroundSpec;
  readonly leftSlope?: number;
  readonly rightSlope?: number;
  readonly a: number;
  readonly k: number;
  readonly placed?: { width: number; height: number; a: number; shiftX: number };
}

export function readProjectionPins(path = PINS): Record<string, ProjectionPin> {
  const doc = JSON.parse(readFileSync(path, 'utf8')) as {
    projection: { assets: Record<string, ProjectionPin> };
  };
  return doc.projection.assets;
}

/** The ground-line spec of a piece. */
export function specOf(pins: Record<string, ProjectionPin>, name: string): GroundSpec {
  const spec = pins[name]?.measure;
  if (!spec) throw new Error(`${name}: no ground measurement in pins.json`);
  return spec;
}

/** Measure a piece, with the windows moved with a conformed one when `conformed` is set. */
export function measurePiece(
  pins: Record<string, ProjectionPin>,
  name: string,
  image: Image,
  conformed: boolean,
) {
  const spec = specOf(pins, name);
  const placed = pins[name]?.placed;
  const use = conformed && placed ? scaleSpec(spec, placed.a, placed.shiftX) : spec;
  const measured = measureGround(image, use);
  return { ...measured, ends: groundEnds(lowerEnvelope(image), use, measured) };
}

const round = (n: number, d = 3): number => Math.round(n * 10 ** d) / 10 ** d;

function report(
  pins: Record<string, ProjectionPin>,
  source: (name: string) => string,
  conformed: boolean,
): void {
  for (const name of Object.keys(pins)) {
    const m = measurePiece(pins, name, readImage(source(name)), conformed);
    const f = (d: number) => `${round(d, 2)}`.padStart(6);
    console.log(
      `${name.padEnd(24)} L ${f(m.left.degrees)} (${f(offTile(m.left))}) R ${f(m.right.degrees)} (${f(offTile(m.right))})  ` +
        `front ${round(m.front.x, 1)},${round(m.front.y, 1)} ends ${m.ends.left}..${m.ends.right}`,
    );
  }
}

function main(): void {
  console.log(`tile line ${round(TILE_DEGREES, 2)} deg`);
  report(readProjectionPins(), (n) => `${SOURCE_DIR}/fine/${n}.png`, true);
  report(
    readProjectionPins(TRUE_PINS),
    (n) => `art/source/ba-dan-true/${n.replace(/^true-/, '')}.png`,
    false,
  );
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/art/ba-dan-projection.ts')) main();
