import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import type { Image } from './lib/image';
import { newImage, pixelAt, setPixel } from './lib/image';
import { decodeWebp, encodeWebpLossless } from './lib/webp';
import { CHARACTERS, checkSources, sha256, sourceFiles } from './g-sprites';
import type { GPins } from './g-sprites';
import { MARGIN } from './lib/align';
import { validateSheets, WEBP_SHEET_PINS } from './validate';

const KAYA = CHARACTERS.kaya;
const KEY = KAYA.key;
const PINS = KAYA.pins;
const pins = JSON.parse(readFileSync(PINS, 'utf8')) as GPins;

describe('Kaya G source pins', () => {
  it('pins exactly the files the build reads, and the preserved action cels in the repo', () => {
    const files = sourceFiles(KAYA);
    expect(files.pixellab).toHaveLength(8 * (4 + 12));
    expect(Object.keys(pins.pixellab).sort()).toEqual([...files.pixellab].sort());
    for (const hash of Object.values(pins.pixellab)) expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(checkSources('art/source/kaya-actions', files.actions, pins.actions, 'action')).toEqual(
      [],
    );
  });

  it('rejects a changed, missing, unpinned or stray source cel', () => {
    const root = mkdtempSync(join(tmpdir(), 'kaya-g-src-'));
    mkdirSync(join(root, 'walk'), { recursive: true });
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5, 6]);
    writeFileSync(join(root, 'walk', 'a.png'), a);
    writeFileSync(join(root, 'walk', 'b.png'), b);
    const good = { 'walk/a.png': sha256(a), 'walk/b.png': sha256(b) };
    const files = ['walk/a.png', 'walk/b.png'];
    expect(checkSources(root, files, good, 'PixelLab')).toEqual([]);
    writeFileSync(join(root, 'walk', 'b.png'), new Uint8Array([4, 5, 7]));
    expect(checkSources(root, files, good, 'PixelLab')).toEqual([
      'PixelLab walk/b.png does not match its pin',
    ]);
    expect(checkSources(root, [...files, 'walk/c.png'], good, 'PixelLab')).toContain(
      'PixelLab walk/c.png has no pin',
    );
    expect(checkSources(root, files, { ...good, 'walk/c.png': sha256(a) }, 'PixelLab')).toContain(
      'PixelLab pin walk/c.png is not a file the build reads',
    );
    expect(
      checkSources(join(root, 'elsewhere'), files, good, 'PixelLab').every((p) =>
        p.includes('is missing'),
      ),
    ).toBe(true);
  });
});

/**
 * The shipped atlas is lossy, so its negative fixtures start from its decoded
 * pixels and are re-encoded losslessly: an untouched cel decodes to exactly
 * its pin, and only the cel a fixture edits can change.
 */
describe('decoded Kaya G atlas validation', () => {
  const asset = ASSETS[KEY];
  if (asset?.kind !== 'sheet') throw new Error('Missing Kaya sheet');
  const entry = asset;
  const atlas = parseAtlasJson(readFileSync(`public/${entry.atlas}`, 'utf8'));
  const rect = atlas.frames.get(`${KEY}/idle/0`);
  if (!rect) throw new Error('Missing Kaya idle');
  let decoded: Image;

  beforeAll(async () => {
    decoded = await decodeWebp(
      new Uint8Array(readFileSync(`public/${entry.atlas}`.replace(/\.json$/, '.webp'))),
    );
  });

  async function fixture(edit: (image: Image) => void): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), 'kaya-g-atlas-'));
    mkdirSync(join(dir, 'art', 'units'), { recursive: true });
    copyFileSync(`public/${entry.atlas}`, join(dir, entry.atlas));
    const image = newImage(decoded.width, decoded.height);
    image.data.set(decoded.data);
    edit(image);
    writeFileSync(join(dir, 'art', 'units', 'kaya-g.webp'), await encodeWebpLossless(image));
    return dir;
  }

  it('passes the shipped atlas and an exact lossless copy of its decoded pixels', async () => {
    expect(await validateSheets('public', { [KEY]: entry })).toEqual([]);
    expect(await validateSheets(await fixture(() => {}), { [KEY]: entry })).toEqual([]);
  }, 60_000);

  it('fails a cel that touches its margin', async () => {
    const dir = await fixture((image) =>
      setPixel(image, rect.x + MARGIN - 1, rect.y + 40, [200, 40, 40, 255]),
    );
    const problems = await validateSheets(dir, { [KEY]: entry });
    expect(problems).toEqual([
      `${KEY}: frame "${KEY}/idle/0" has art inside the ${MARGIN} px margin`,
      `${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`,
    ]);
  }, 60_000);

  it('fails a cel whose figure moved off the foot line', async () => {
    const dir = await fixture((image) => {
      const shift = 12;
      for (let y = rect.h - 1 - MARGIN; y >= 0; y--) {
        for (let x = 0; x < rect.w; x++) {
          const from =
            y - shift >= 0 ? pixelAt(image, rect.x + x, rect.y + y - shift) : [0, 0, 0, 0];
          setPixel(image, rect.x + x, rect.y + y, from);
        }
      }
    });
    const problems = await validateSheets(dir, { [KEY]: entry });
    expect(problems).toContain(`${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`);
    expect(problems.some((p) => p.includes(`"${KEY}/idle/0" puts its feet at row`))).toBe(true);
    expect(problems.every((p) => p.includes(`${KEY}/idle/0`))).toBe(true);
  }, 60_000);

  it("measures a stride's lift from the heading's standing feet, not past them", async () => {
    // North's idle stands at row 157, 6 px above the anchor line; its walk is
    // level with it, and cel 8's lowest foot sits 9 px above those feet. Four
    // more is 13 above where she stands, and that is a floating stride.
    const cel = atlas.frames.get(`${KEY}/walkNorth/8`);
    if (!cel) throw new Error('Missing Kaya north walk');
    const dir = await fixture((image) => {
      const lift = 4;
      for (let y = 0; y < cel.h; y++) {
        for (let x = 0; x < cel.w; x++) {
          const from =
            y + lift < cel.h ? pixelAt(image, cel.x + x, cel.y + y + lift) : [0, 0, 0, 0];
          setPixel(image, cel.x + x, cel.y + y, from);
        }
      }
    });
    const problems = await validateSheets(dir, { [KEY]: entry });
    expect(problems).toEqual([
      `${KEY}: decoded cel "${KEY}/walkNorth/8" does not match its pin`,
      `${KEY}: cel "${KEY}/walkNorth/8" puts its feet at row 144, off the foot line 163`,
    ]);
  }, 60_000);

  it('fails a subtly recoloured cel through its pin alone', async () => {
    const dir = await fixture((image) => {
      const [r, g, b, a] = pixelAt(image, rect.x + 64, rect.y + 100);
      setPixel(image, rect.x + 64, rect.y + 100, [r ^ 1, g, b, a]);
    });
    expect(await validateSheets(dir, { [KEY]: entry })).toEqual([
      `${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`,
    ]);
  }, 60_000);

  it('fails a lossy sheet with no pin file', async () => {
    expect(WEBP_SHEET_PINS[KEY]).toBe(PINS);
    expect(await validateSheets('public', { [KEY]: entry }, {})).toEqual([
      `${KEY}: lossy kaya-g.webp has no cel pin file`,
    ]);
  }, 60_000);
});
