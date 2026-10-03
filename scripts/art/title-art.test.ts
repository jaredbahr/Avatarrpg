import { describe, expect, it } from 'vitest';
import { expectShippedPin } from './lib/shipped-pin';
import { webpSize } from './lib/webp';
import { readFileSync } from 'node:fs';
import { TITLE_ART as SCENE_ART } from '../../src/app/titleArt';
import { TITLE_ART as PACKED } from './title-art';

/**
 * The title key art is generated (docs/art/title-key-art.md), so the packer
 * cannot rebuild it from the repository. The shipped files are pinned by size
 * and hash instead, and their pixel sizes are held to what the scene declares
 * and to what the packer cuts.
 */
const PINS = {
  'title-a-wide.webp': {
    bytes: 271146,
    sha256: '8716cb00b3a1be51110306b5d7fdf9310957c5c71ea524edf85a76d19fc6fdc1',
  },
  'title-a-portrait.webp': {
    bytes: 143618,
    sha256: '1c1128e6c36d6f7b11e9387244714a97e5814b1e16075079fef418895844d9f8',
  },
  'title-b-wide.webp': {
    bytes: 230738,
    sha256: '003920d092313db64477b0b62a0a29de21bd976aea0f2730a3fb9b6508c36a72',
  },
  'title-b-portrait.webp': {
    bytes: 156496,
    sha256: 'a7e394bf726eab50027ee2da55f14a9803c1ff3b721c0c19da01724100dbfd55',
  },
  'title-c-wide.webp': {
    bytes: 304832,
    sha256: '51f2816554be5dba7e273574211b061b7f00b8bb100f8fc9ed45c8ee7fb7f320',
  },
  'title-c-portrait.webp': {
    bytes: 145634,
    sha256: 'a373ff38e8cf622b53a2ee232c875664db9c6c17372b422adab83a5bfa08394c',
  },
} as const;

const DIR = 'public/art/title/';

describe('title key art', () => {
  it('pins every file the scene can show, and nothing else ships in the folder', () => {
    const declared = SCENE_ART.flatMap((art) => [art.wide.file, art.portrait.file]).sort();
    expect(declared).toEqual(Object.keys(PINS).sort());
  });

  for (const art of SCENE_ART) {
    const packed = PACKED[art.id];
    for (const kind of ['wide', 'portrait'] as const) {
      const file = art[kind];
      const pin = PINS[file.file as keyof typeof PINS];
      it(`ships ${file.file} exactly as recorded`, () => {
        expectShippedPin(DIR + file.file, pin);
      });
      it(`keeps ${file.file} at the size the scene and the packer declare`, () => {
        const size = webpSize(readFileSync(DIR + file.file));
        expect(size).toEqual({ width: file.width, height: file.height });
        expect(size).toEqual({ width: packed[kind].width, height: packed[kind].height });
        expect(packed[kind].file).toBe(file.file);
      });
      it(`keeps ${file.file} inside the precache budget`, () => {
        expect(pin.bytes).toBeLessThanOrEqual(350 * 1024);
      });
    }
  }
});
