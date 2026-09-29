/**
 * The health bar clears a bend's raised arms (ADR 0055, step 6).
 *
 * A unit's bar sits over `headroom`, the sheet's silhouette envelope over its
 * clips' cels, and a bend cel is in none of those clips. So this measures the
 * envelope the store would measure in the browser (the first opaque row of
 * every clip cel, `headroomFromPixels`) and the same for every cel of every
 * heading of each G bend, from the decoded pages that ship, and holds the
 * bend under the envelope: the bar never needs to move while a bend plays.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSETS } from '../../content/assets/manifest';
import { HEADINGS } from '../../content/assets/clips';
import type { BendSetDef } from '../../content/bends';
import { readPng } from '../../../scripts/art/lib/image';
import type { Image } from '../../../scripts/art/lib/image';
import { decodeWebp } from '../../../scripts/art/lib/webp';
import { parseAtlasJson } from './atlasJson';
import type { AtlasFrame } from './atlasJson';
import { headroomFromPixels } from './bake';

const PARTY = ['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo'] as const;

const decoded = new Map<string, Promise<Image>>();
const decodePage = (path: string): Promise<Image> => {
  let found = decoded.get(path);
  if (!found) {
    found = path.endsWith('.png')
      ? Promise.resolve(readPng(`public/${path}`))
      : decodeWebp(new Uint8Array(readFileSync(`public/${path}`)));
    decoded.set(path, found);
  }
  return found;
};

/** Every frame of the pages, with the decoded image it sits on. */
async function pages(paths: readonly string[]) {
  const frames = new Map<string, { frame: AtlasFrame; image: Image }>();
  for (const path of paths) {
    const atlas = parseAtlasJson(JSON.parse(readFileSync(`public/${path}`, 'utf8')));
    const image = await decodePage(path.slice(0, path.lastIndexOf('/') + 1) + atlas.image);
    for (const [name, frame] of atlas.frames) frames.set(name, { frame, image });
  }
  return frames;
}

function crop(image: Image, frame: AtlasFrame): Uint8Array {
  const out = new Uint8Array(frame.w * frame.h * 4);
  for (let y = 0; y < frame.h; y++) {
    const from = ((frame.y + y) * image.width + frame.x) * 4;
    out.set(image.data.subarray(from, from + frame.w * 4), y * frame.w * 4);
  }
  return out;
}

describe('the health bar over a bend (ADR 0055)', () => {
  for (const key of PARTY) {
    it(`clears every cel of ${key}'s bend in every heading`, async () => {
      const entry = ASSETS[key];
      if (entry?.kind !== 'sheet' || !entry.bend || !entry.bendPages)
        throw new Error(`${key} has no bend.`);
      const sheet = await pages([entry.atlas, ...(entry.atlasPages ?? [])]);
      const names = new Set([
        ...Object.values(entry.clips).flatMap((clip) => clip?.frames ?? []),
        ...Object.values(entry.meleeDirections ?? {}).flatMap((frames) => frames ?? []),
      ]);
      let envelope = 0;
      for (const name of names) {
        const found = sheet.get(name);
        if (!found) continue;
        const { frame, image } = found;
        envelope = Math.max(
          envelope,
          headroomFromPixels(
            crop(image, frame),
            frame.w,
            frame.h,
            entry.pixelsPerTile,
            entry.anchor.y,
          ),
        );
      }
      const set = JSON.parse(readFileSync(`public/${entry.bend}`, 'utf8')) as BendSetDef;
      const bend = await pages(entry.bendPages);
      let worst = { headroom: 0, where: '' };
      for (const heading of HEADINGS) {
        const facing = set.facings[heading];
        for (const name of new Set(facing.frames)) {
          const found = bend.get(name);
          if (!found) throw new Error(`No cel ${name}.`);
          const { frame, image } = found;
          const headroom = headroomFromPixels(
            crop(image, frame),
            frame.w,
            frame.h,
            entry.pixelsPerTile,
            facing.anchor.y,
          );
          if (headroom > worst.headroom) worst = { headroom, where: name };
        }
      }
      // The bar is placed over the envelope; a bend cel above it would be clipped.
      expect(worst.headroom, `${worst.where} vs the sheet's ${envelope}`).toBeLessThanOrEqual(
        envelope,
      );
    }, 60_000);
  }
});
