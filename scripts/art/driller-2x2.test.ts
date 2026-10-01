import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, it } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { pixelAt, readPng } from './lib/image';
import {
  DRILLER_CLIPS,
  DRILLER_FRAME_SIZE,
  DRILLER_JSON,
  DRILLER_KEY,
  DRILLER_PNG,
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

it('ships the deterministic 32-frame atlas with the shadowed stills removed', () => {
  const packed = packDriller();
  const encoded = new PNG({ width: packed.image.width, height: packed.image.height });
  encoded.data = Buffer.from(packed.image.data);
  expect(PNG.sync.write(encoded)).toEqual(readFileSync(DRILLER_PNG));
  expect(packed.json).toBe(readFileSync(DRILLER_JSON, 'utf8'));

  const atlas = parseAtlasJson(packed.json);
  const expected = Object.entries(DRILLER_CLIPS).flatMap(([clip, count]) =>
    Array.from({ length: count }, (_, index) => `${DRILLER_KEY}/${clip}/${index}`),
  );
  expect([...atlas.frames.keys()]).toEqual(expected);
  expect(atlas.frames.size).toBe(32);

  for (const [name, frame] of atlas.frames) {
    for (let y = 139; y < frame.h; y++)
      for (let x = 0; x < frame.w; x++)
        expect(pixelAt(packed.image, frame.x + x, frame.y + y)[3], `${name} at ${x},${y}`).toBe(0);
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
