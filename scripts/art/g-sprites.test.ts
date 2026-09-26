import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import type { SheetEntry } from '../../src/content/assets/manifest';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import type { Image } from './lib/image';
import { newImage, pixelAt, setPixel } from './lib/image';
import { decodeWebp, encodeWebpLossless } from './lib/webp';
import { CHARACTERS, checkSources, sha256, sourceFiles } from './g-sprites';
import type { GCharacter, GPins } from './g-sprites';
import { MARGIN } from './lib/align';
import { validateSheets, WEBP_SHEET_PINS } from './validate';

const PARTY = Object.values(CHARACTERS);

describe('G source pins', () => {
  for (const character of PARTY) {
    it(`pins exactly the files ${character.name}'s build reads, and the preserved action cels in the repo`, () => {
      const pins = JSON.parse(readFileSync(character.pins, 'utf8')) as GPins;
      const files = sourceFiles(character);
      expect(character.headings).toHaveLength(8);
      expect(files.pixellab).toHaveLength(8 * (4 + 12));
      expect(Object.keys(pins.pixellab).sort()).toEqual([...files.pixellab].sort());
      for (const hash of Object.values(pins.pixellab)) expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(checkSources(character.actions, files.actions, pins.actions, 'action')).toEqual([]);
      expect(WEBP_SHEET_PINS[character.key]).toBe(character.pins);
    });
  }

  it('places every rest on a walk cel and keeps each heading inside its frame', () => {
    for (const character of PARTY) {
      for (const h of character.headings) {
        expect(h.restCel, `${character.name} ${h.direction}`).toBeGreaterThanOrEqual(0);
        expect(h.restCel, `${character.name} ${h.direction}`).toBeLessThan(12);
        for (const shift of [h.walkDx, h.walkDy, h.idleDy])
          expect(Math.abs(shift), `${character.name} ${h.direction}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it('rejects a changed, missing, unpinned or stray source cel', () => {
    const root = mkdtempSync(join(tmpdir(), 'g-src-'));
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

function sheetOf(character: GCharacter): SheetEntry {
  const asset = ASSETS[character.key];
  if (asset?.kind !== 'sheet') throw new Error(`Missing ${character.name} sheet`);
  return asset;
}

/**
 * The shipped atlases are lossy, so their negative fixtures start from the
 * decoded pixels and are re-encoded losslessly: an untouched cel decodes to
 * exactly its pin, and only the cel a fixture edits can change.
 */
function decodedAtlas(character: GCharacter) {
  const entry = sheetOf(character);
  const atlas = parseAtlasJson(readFileSync(`public/${entry.atlas}`, 'utf8'));
  let decoded: Image | undefined;
  const load = async () => {
    decoded = await decodeWebp(
      new Uint8Array(readFileSync(`public/${entry.atlas}`.replace(/\.json$/, '.webp'))),
    );
  };
  const rect = (name: string) => {
    const found = atlas.frames.get(`${character.key}/${name}`);
    if (!found) throw new Error(`Missing ${character.key}/${name}`);
    return found;
  };
  async function fixture(edit: (image: Image) => void): Promise<string> {
    if (!decoded) throw new Error('Load the atlas first');
    const dir = mkdtempSync(join(tmpdir(), `${character.name}-g-atlas-`));
    mkdirSync(join(dir, 'art', 'units'), { recursive: true });
    copyFileSync(`public/${entry.atlas}`, join(dir, entry.atlas));
    const image = newImage(decoded.width, decoded.height);
    image.data.set(decoded.data);
    edit(image);
    writeFileSync(join(dir, 'art', 'units', atlas.image), await encodeWebpLossless(image));
    return dir;
  }
  /** Move a cel's pixels by (dx, dy), clearing what it uncovers. */
  function shift(
    image: Image,
    cel: { x: number; y: number; w: number; h: number },
    dx: number,
    dy: number,
  ) {
    const copy = newImage(cel.w, cel.h);
    for (let y = 0; y < cel.h; y++)
      for (let x = 0; x < cel.w; x++) setPixel(copy, x, y, pixelAt(image, cel.x + x, cel.y + y));
    for (let y = 0; y < cel.h; y++) {
      for (let x = 0; x < cel.w; x++) {
        const sx = x - dx;
        const sy = y - dy;
        const from =
          sx >= 0 && sy >= 0 && sx < cel.w && sy < cel.h ? pixelAt(copy, sx, sy) : [0, 0, 0, 0];
        setPixel(image, cel.x + x, cel.y + y, from as [number, number, number, number]);
      }
    }
  }
  return { entry, load, rect, fixture, shift };
}

for (const character of PARTY) {
  const KEY = character.key;
  describe(`decoded ${character.name} G atlas validation`, () => {
    const g = decodedAtlas(character);
    beforeAll(g.load);

    it('passes the shipped atlas and an exact lossless copy of its decoded pixels', async () => {
      expect(await validateSheets('public', { [KEY]: g.entry })).toEqual([]);
      expect(await validateSheets(await g.fixture(() => {}), { [KEY]: g.entry })).toEqual([]);
    }, 60_000);

    it('fails a cel that touches its margin', async () => {
      const rect = g.rect('idle/0');
      const dir = await g.fixture((image) =>
        setPixel(image, rect.x + MARGIN - 1, rect.y + 40, [200, 40, 40, 255]),
      );
      expect(await validateSheets(dir, { [KEY]: g.entry })).toEqual([
        `${KEY}: frame "${KEY}/idle/0" has art inside the ${MARGIN} px margin`,
        `${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`,
      ]);
    }, 60_000);

    it('fails a subtly recoloured cel through its pin alone', async () => {
      const rect = g.rect('idle/0');
      const dir = await g.fixture((image) => {
        const [r, gr, b, a] = pixelAt(image, rect.x + 64, rect.y + 100);
        setPixel(image, rect.x + 64, rect.y + 100, [r ^ 1, gr, b, a]);
      });
      expect(await validateSheets(dir, { [KEY]: g.entry })).toEqual([
        `${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`,
      ]);
    }, 60_000);

    it('fails a walk that sinks below where its idle stands', async () => {
      // Five px down on every cel moves the clip's mean foot row off idle's by
      // more than the 4 px the stop can hide.
      const dir = await g.fixture((image) => {
        for (let i = 0; i < 12; i++) g.shift(image, g.rect(`walkNorth/${i}`), 0, 5);
      });
      const problems = await validateSheets(dir, { [KEY]: g.entry });
      expect(problems.some((p) => p.includes(`clip "walkNorth" has its mean foot row`))).toBe(true);
      expect(
        problems.every((p) => p.includes(`${KEY}/walkNorth/`) || p.includes('"walkNorth"')),
      ).toBe(true);
    }, 60_000);

    it('fails a rest that stops beside its feet', async () => {
      // 20 px right is still inside a mid-stride cel's 32 px, not a stop's 12.
      const dir = await g.fixture((image) => g.shift(image, g.rect('restSouth/0'), 20, 0));
      const problems = await validateSheets(dir, { [KEY]: g.entry });
      expect(problems).toContain(`${KEY}: decoded cel "${KEY}/restSouth/0" does not match its pin`);
      expect(problems.some((p) => p.includes(`"${KEY}/restSouth/0" centres its feet at x`))).toBe(
        true,
      );
    }, 60_000);

    it('fails a lossy sheet with no pin file', async () => {
      expect(await validateSheets('public', { [KEY]: g.entry }, {})).toEqual([
        `${KEY}: lossy ${character.name}-g.webp has no cel pin file`,
      ]);
    }, 60_000);
  });
}

describe('decoded Kaya G foot line', () => {
  const KEY = CHARACTERS.kaya.key;
  const g = decodedAtlas(CHARACTERS.kaya);
  beforeAll(g.load);

  it('fails a cel whose figure moved off the foot line', async () => {
    const dir = await g.fixture((image) => g.shift(image, g.rect('idle/0'), 0, 12));
    const problems = await validateSheets(dir, { [KEY]: g.entry });
    expect(problems).toContain(`${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`);
    expect(problems.some((p) => p.includes(`"${KEY}/idle/0" puts its feet at row`))).toBe(true);
    // Idle cel 0 is where the east walk and rest are measured from, so they
    // now sit above it; nothing else moves.
    expect(
      problems.every(
        (p) => p.includes(`${KEY}/idle/0`) || /clip "(walk|rest)" has its mean foot row/.test(p),
      ),
    ).toBe(true);
  }, 60_000);

  it("measures a stride's lift from the heading's standing feet, not past them", async () => {
    // North's idle stands at row 157, 6 px above the anchor line; its walk is
    // level with it, and cel 8's lowest foot sits 9 px above those feet. Four
    // more is 13 above where she stands, and that is a floating stride.
    const dir = await g.fixture((image) => g.shift(image, g.rect('walkNorth/8'), 0, -4));
    const problems = await validateSheets(dir, { [KEY]: g.entry });
    expect(problems).toEqual([
      `${KEY}: decoded cel "${KEY}/walkNorth/8" does not match its pin`,
      `${KEY}: cel "${KEY}/walkNorth/8" puts its feet at row 144, off the foot line 163`,
    ]);
  }, 60_000);
});
