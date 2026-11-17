/**
 * The scale chart (ADR 0119, `docs/art-cohesion.md`): how tall each kind of prop is drawn, as a share
 * of a person. A person is a 48 px character canvas whose figure stands {@link PERSON_PX} px tall
 * (Kaya's south idle, measured), and a prop's drawn height is its sprite's opaque height after the
 * bake's cleaning, top face included, as the low top-down view shows it.
 *
 * The targets are real proportions, not the sprites' own: a barrel is a little over half a person, a
 * crate under half, a door about one and a half. A placed sprite more than {@link SCALE_SLACK} off
 * its target is an outlier (`scale-chart.test.ts`): redraw it at the right size, swap it, or record
 * why in {@link SCALE_WAIVERS}.
 */

import { existsSync } from 'node:fs';
import { readPng } from '../lib/image';
import { ASSETS } from './lib/board';
import { cleanSprite } from './lib/sprites';

/** A standing figure's drawn height in world px. */
export const PERSON_PX = 46;
/** How far a drawn height may stray from its target, as a share of the target. */
export const SCALE_SLACK = 0.25;

/** Target drawn height per sprite key, in persons. */
export const SCALE_CHART: Readonly<Record<string, number>> = {
  // small things kept by a door or a bed
  pots: 0.35,
  flower_pots: 0.35,
  sack: 0.45,
  crate: 0.45,
  barrel: 0.55,
  rain_barrel: 0.55,
  trough: 0.5,
  bucket_broom: 0.7,
  // two or three of them, stacked
  barrels: 0.7,
  crates: 0.8,
  // furniture and work
  mira_table: 0.6,
  bench: 0.7,
  produce: 0.7,
  beehive: 0.7,
  fence: 0.8,
  garden: 0.8,
  handcart: 0.8,
  haystack: 0.9,
  market_veg: 0.9,
  market_jars: 0.95,
  herb_shelf: 1.0,
  notice_board: 1.1,
  signpost: 1.2,
  laundry_line: 1.2,
  // landmarks
  well: 1.3,
  target: 1.4,
  shrine: 1.6,
  stall: 1.7,
  lamp: 1.8,
  banner_pole: 1.8,
};

/** Sprites allowed off the chart, and why. None in Ba Dan. */
export const SCALE_WAIVERS: Readonly<Record<string, string>> = {};

/** The sprite the Ba Dan bake loads for a key: T3's redraws first, then the houses, then v12. */
const spritePath = (key: string): string =>
  existsSync(`${ASSETS}/objects_t3/${key}.png`)
    ? `${ASSETS}/objects_t3/${key}.png`
    : `${ASSETS}/objects12/${key}.png`;

const drawnHeight = (key: string): number => {
  const raw = readPng(spritePath(key));
  const img = cleanSprite({
    width: raw.width,
    height: raw.height,
    data: new Uint8ClampedArray(raw.data),
  });
  let top = img.height,
    bottom = -1;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if ((img.data[(y * img.width + x) * 4 + 3] ?? 0) > 127) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  return bottom - top + 1;
};

/** Each placed prop sprite's drawn height against its target: the outliers, as sentences. */
export function scaleOutliers(sprites: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of [...new Set(sprites)].sort()) {
    if (SCALE_WAIVERS[key]) continue;
    const target = SCALE_CHART[key];
    if (target === undefined) {
      out.push(`"${key}" has no target on the scale chart`);
      continue;
    }
    const persons = drawnHeight(key) / PERSON_PX;
    if (Math.abs(persons / target - 1) > SCALE_SLACK)
      out.push(`"${key}" is ${persons.toFixed(2)} persons tall, its target ${target}`);
  }
  return out;
}
