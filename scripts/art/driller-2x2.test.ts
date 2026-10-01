import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { pixelAt, readPng } from './lib/image';
import { decodeWebp, encodeWebpLossless, isLosslessWebp } from './lib/webp';
import {
  DRILLER_CLIPS,
  DRILLER_FRAME_SIZE,
  DRILLER_MARGIN,
  DRILLER_PACKED_FRAME_SIZE,
  DRILLER_JSON,
  DRILLER_KEY,
  DRILLER_WEBP,
  drillerSource,
  packDriller,
} from './driller-2x2';

it('keeps every Driller source at the approved 160x160 size', () => {
  expect(readPng('media/art-sources/driller-2x2-v1/base.png')).toMatchObject({
    width: DRILLER_FRAME_SIZE,
    height: DRILLER_FRAME_SIZE,
  });
  for (const [clip, packedCount] of Object.entries(DRILLER_CLIPS)) {
    for (let sourceIndex = 0; sourceIndex <= packedCount; sourceIndex++) {
      expect(readPng(drillerSource(clip as keyof typeof DRILLER_CLIPS, sourceIndex))).toMatchObject(
        {
          width: DRILLER_FRAME_SIZE,
          height: DRILLER_FRAME_SIZE,
        },
      );
    }
  }
});

it('ships the deterministic lossless 32-frame atlas with the shadowed stills removed', async () => {
  const packed = packDriller();
  const encoded = await encodeWebpLossless(packed.image);
  expect(isLosslessWebp(encoded)).toBe(true);
  expect(isLosslessWebp(new Uint8Array(readFileSync('public/art/units/thug-g.webp')))).toBe(false);
  expect(encoded).toEqual(new Uint8Array(readFileSync(DRILLER_WEBP)));
  expect(await decodeWebp(encoded)).toEqual(packed.image);
  expect(packed.json).toBe(readFileSync(DRILLER_JSON, 'utf8'));

  const atlas = parseAtlasJson(packed.json);
  const expected = Object.entries(DRILLER_CLIPS).flatMap(([clip, count]) =>
    Array.from({ length: count }, (_, index) => `${DRILLER_KEY}/${clip}/${index}`),
  );
  expect([...atlas.frames.keys()]).toEqual(expected);
  expect(atlas.frames.size).toBe(32);

  // The shadowed still is source cel 0 of every clip. Inside the transparent
  // gutter, packed cel n is the horizontal mirror of source cel n + 1.
  for (const [name, frame] of atlas.frames) {
    const match = /\/(idle|walk|cast|hit|ko)\/(\d+)$/.exec(name);
    if (!match) throw new Error(`Unexpected Driller frame id: ${name}`);
    const source = readPng(
      drillerSource(match[1] as keyof typeof DRILLER_CLIPS, Number(match[2]) + 1),
    );
    expect(frame).toMatchObject({ w: DRILLER_PACKED_FRAME_SIZE, h: DRILLER_PACKED_FRAME_SIZE });
    for (let y = 0; y < DRILLER_FRAME_SIZE; y++)
      for (let x = 0; x < DRILLER_FRAME_SIZE; x++)
        if (
          pixelAt(
            packed.image,
            frame.x + DRILLER_MARGIN + x,
            frame.y + DRILLER_MARGIN + y,
          ).join() !== pixelAt(source, DRILLER_FRAME_SIZE - 1 - x, y).join()
        )
          throw new Error(`${name} differs from its source cel at ${x},${y}`);
  }
  // The standing loops never reach the shadow's rows; a cast or hit may, with
  // the drill and its burst.
  for (const [name, frame] of atlas.frames) {
    if (!/\/(idle|walk)\//.test(name)) continue;
    for (let y = DRILLER_MARGIN + 139; y < frame.h; y++)
      for (let x = DRILLER_MARGIN; x < frame.w - DRILLER_MARGIN; x++)
        if (pixelAt(packed.image, frame.x + x, frame.y + y)[3] !== 0)
          throw new Error(`${name} has paint at ${x},${y}, below the tracks`);
  }
});

it('references only packed Driller frames from the dormant manifest entry', () => {
  const entry = ASSETS[DRILLER_KEY];
  expect(entry?.kind).toBe('sheet');
  if (!entry || entry.kind !== 'sheet') throw new Error('Driller sheet manifest entry is missing.');
  const names = parseAtlasJson(readFileSync(DRILLER_JSON, 'utf8')).frames;
  expect(Object.values(entry.clips).flatMap((clip) => clip?.frames ?? [])).toSatisfy(
    (frames: string[]) => frames.length === 32 && frames.every((frame) => names.has(frame)),
  );
});
