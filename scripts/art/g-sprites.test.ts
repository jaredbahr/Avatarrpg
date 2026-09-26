import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ASSETS } from '../../src/content/assets/manifest';
import type { SheetEntry } from '../../src/content/assets/manifest';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import type { Image } from './lib/image';
import { newImage, pixelAt, setPixel } from './lib/image';
import { decodeWebp, encodeWebpLossless } from './lib/webp';
import { CHARACTERS, STANCE_CELS, checkSources, sha256, sourceFiles } from './g-sprites';
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
      expect(files.combat).toHaveLength(8 * STANCE_CELS);
      expect(Object.keys(pins.pixellab).sort()).toEqual([...files.pixellab].sort());
      expect(Object.keys(pins.combat).sort()).toEqual([...files.combat].sort());
      for (const hash of [...Object.values(pins.pixellab), ...Object.values(pins.combat)])
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      // Sura and Bo ship toned, Kaya never is (ADR 0052); the pin file says which parameters.
      expect(pins.tone !== undefined, character.name).toBe(character.toned);
      if (pins.tone) expect(pins.tone.params).toMatch(/^[0-9a-f]{64}$/);
      expect(checkSources(character.actions, files.actions, pins.actions, 'action')).toEqual([]);
      expect(WEBP_SHEET_PINS[character.key]).toBe(character.pins);
    });
  }

  it('places every rest on a walk cel and keeps each heading inside its frame', () => {
    for (const character of PARTY) {
      for (const h of character.headings) {
        expect(h.restCel, `${character.name} ${h.direction}`).toBeGreaterThanOrEqual(0);
        expect(h.restCel, `${character.name} ${h.direction}`).toBeLessThan(12);
        for (const shift of [h.walkDx, h.walkDy, h.idleDy, h.stanceDy])
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
 * decoded pixels of every page and are re-encoded losslessly: an untouched
 * cel decodes to exactly its pin, and only the cel a fixture edits can change.
 */
function decodedAtlas(character: GCharacter) {
  const entry = sheetOf(character);
  const paths = [entry.atlas, ...(entry.atlasPages ?? [])];
  const atlases = paths.map((path) => parseAtlasJson(readFileSync(`public/${path}`, 'utf8')));
  let decoded: Image[] = [];
  const load = async () => {
    decoded = await Promise.all(
      atlases.map(
        async (atlas) =>
          await decodeWebp(new Uint8Array(readFileSync(`public/art/units/${atlas.image}`))),
      ),
    );
  };
  /** A cel's rectangle, and the page it is on. */
  const rect = (name: string) => {
    for (const [page, atlas] of atlases.entries()) {
      const found = atlas.frames.get(`${character.key}/${name}`);
      if (found) return { ...found, page };
    }
    throw new Error(`Missing ${character.key}/${name}`);
  };
  async function fixture(edit: (pages: Image[]) => void): Promise<string> {
    if (decoded.length !== atlases.length) throw new Error('Load the atlas first');
    const dir = mkdtempSync(join(tmpdir(), `${character.name}-g-atlas-`));
    mkdirSync(join(dir, 'art', 'units'), { recursive: true });
    for (const path of paths) copyFileSync(`public/${path}`, join(dir, path));
    const pages = decoded.map((page) => {
      const copy = newImage(page.width, page.height);
      copy.data.set(page.data);
      return copy;
    });
    edit(pages);
    for (const [index, atlas] of atlases.entries()) {
      const page = pages[index];
      if (!page) throw new Error(`Missing page ${index}`);
      writeFileSync(join(dir, 'art', 'units', atlas.image), await encodeWebpLossless(page));
    }
    return dir;
  }
  /** Move a cel's pixels by (dx, dy), clearing what it uncovers. */
  function shift(
    pages: Image[],
    cel: { x: number; y: number; w: number; h: number; page: number },
    dx: number,
    dy: number,
  ) {
    const image = pages[cel.page];
    if (!image) throw new Error(`Missing page ${cel.page}`);
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
  /** Set one pixel of a cel, on its page. */
  function paint(
    pages: Image[],
    cel: { x: number; y: number; page: number },
    x: number,
    y: number,
    rgba: (was: readonly number[]) => [number, number, number, number],
  ) {
    const image = pages[cel.page];
    if (!image) throw new Error(`Missing page ${cel.page}`);
    setPixel(image, cel.x + x, cel.y + y, rgba(pixelAt(image, cel.x + x, cel.y + y)));
  }
  return { entry, load, rect, fixture, shift, paint };
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
      const dir = await g.fixture((pages) =>
        g.paint(pages, rect, MARGIN - 1, 40, () => [200, 40, 40, 255]),
      );
      expect(await validateSheets(dir, { [KEY]: g.entry })).toEqual([
        `${KEY}: frame "${KEY}/idle/0" has art inside the ${MARGIN} px margin`,
        `${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`,
      ]);
    }, 60_000);

    it('fails a subtly recoloured cel through its pin alone', async () => {
      const rect = g.rect('idle/0');
      const dir = await g.fixture((pages) =>
        g.paint(pages, rect, 64, 100, ([r = 0, gr = 0, b = 0, a = 0]) => [r ^ 1, gr, b, a]),
      );
      expect(await validateSheets(dir, { [KEY]: g.entry })).toEqual([
        `${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`,
      ]);
    }, 60_000);

    it('fails a recoloured stance cel on the second page through its pin', async () => {
      const rect = g.rect('stanceSouth/3');
      expect(rect.page).toBe(1);
      const dir = await g.fixture((pages) =>
        g.paint(pages, rect, 64, 100, ([r = 0, gr = 0, b = 0, a = 0]) => [r, gr ^ 1, b, a]),
      );
      expect(await validateSheets(dir, { [KEY]: g.entry })).toEqual([
        `${KEY}: decoded cel "${KEY}/stanceSouth/3" does not match its pin`,
      ]);
    }, 60_000);

    it('fails a stance that sinks below where its idle stands', async () => {
      // Five px down on every cel moves the guard's mean foot row off idle's.
      const dir = await g.fixture((pages) => {
        for (let i = 0; i < STANCE_CELS; i++) g.shift(pages, g.rect(`stance/${i}`), 0, 5);
      });
      const problems = await validateSheets(dir, { [KEY]: g.entry });
      expect(problems.some((p) => p.includes('clip "stance" has its mean foot row'))).toBe(true);
      expect(problems.every((p) => p.includes(`${KEY}/stance/`) || p.includes('"stance"'))).toBe(
        true,
      );
    }, 60_000);

    it('fails a walk that sinks below where its idle stands', async () => {
      // Five px down on every cel moves the clip's mean foot row off idle's by
      // more than the 4 px the stop can hide.
      const dir = await g.fixture((pages) => {
        for (let i = 0; i < 12; i++) g.shift(pages, g.rect(`walkNorth/${i}`), 0, 5);
      });
      const problems = await validateSheets(dir, { [KEY]: g.entry });
      expect(problems.some((p) => p.includes(`clip "walkNorth" has its mean foot row`))).toBe(true);
      expect(
        problems.every((p) => p.includes(`${KEY}/walkNorth/`) || p.includes('"walkNorth"')),
      ).toBe(true);
    }, 60_000);

    it('fails a rest that stops beside its feet', async () => {
      // 20 px right is still inside a mid-stride cel's 32 px, not a stop's 12.
      const dir = await g.fixture((pages) => g.shift(pages, g.rect('restSouth/0'), 20, 0));
      const problems = await validateSheets(dir, { [KEY]: g.entry });
      expect(problems).toContain(`${KEY}: decoded cel "${KEY}/restSouth/0" does not match its pin`);
      expect(problems.some((p) => p.includes(`"${KEY}/restSouth/0" centres its feet at x`))).toBe(
        true,
      );
    }, 60_000);

    it('fails a lossy sheet with no pin file', async () => {
      expect(await validateSheets('public', { [KEY]: g.entry }, {})).toEqual([
        `${KEY}: lossy ${character.name}-g.webp + ${character.name}-g-2.webp has no cel pin file`,
      ]);
    }, 60_000);

    it('fails a sheet whose second page is missing', async () => {
      const dir = await g.fixture(() => {});
      const [, page2] = [g.entry.atlas, ...(g.entry.atlasPages ?? [])];
      if (!page2) throw new Error('Expected a second page');
      rmSync(join(dir, page2));
      expect(await validateSheets(dir, { [KEY]: g.entry })).toEqual([
        `${KEY}: ${page2} is missing under ${dir}/`,
      ]);
    }, 60_000);
  });
}

describe('decoded Kaya G foot line', () => {
  const KEY = CHARACTERS.kaya.key;
  const g = decodedAtlas(CHARACTERS.kaya);
  beforeAll(g.load);

  it('fails a cel whose figure moved off the foot line', async () => {
    const dir = await g.fixture((pages) => g.shift(pages, g.rect('idle/0'), 0, 12));
    const problems = await validateSheets(dir, { [KEY]: g.entry });
    expect(problems).toContain(`${KEY}: decoded cel "${KEY}/idle/0" does not match its pin`);
    expect(problems.some((p) => p.includes(`"${KEY}/idle/0" puts its feet at row`))).toBe(true);
    // Idle cel 0 is where the east walk, rest and stance are measured from,
    // so they now sit above it; nothing else moves.
    expect(
      problems.every(
        (p) =>
          p.includes(`${KEY}/idle/0`) || /clip "(walk|rest|stance)" has its mean foot row/.test(p),
      ),
    ).toBe(true);
    expect(problems.some((p) => p.includes('clip "stance" has its mean foot row'))).toBe(true);
  }, 60_000);

  it("measures a stride's lift from the heading's standing feet, not past them", async () => {
    // South's idle stands at row 159, 4 px above the anchor line; its walk is
    // placed on it, and cel 9's lowest foot sits 5 px above those feet. Six
    // more is 11 above where she stands (15 above the line) and passes; eight
    // more is 13 above where she stands, and that is a floating stride.
    const lifted = (dy: number) =>
      g.fixture((pages) => g.shift(pages, g.rect('walkSouth/9'), 0, dy));
    expect(await validateSheets(await lifted(-6), { [KEY]: g.entry })).toEqual([
      `${KEY}: decoded cel "${KEY}/walkSouth/9" does not match its pin`,
    ]);
    expect(await validateSheets(await lifted(-8), { [KEY]: g.entry })).toEqual([
      `${KEY}: decoded cel "${KEY}/walkSouth/9" does not match its pin`,
      `${KEY}: cel "${KEY}/walkSouth/9" puts its feet at row 146, off the foot line 163`,
    ]);
  }, 60_000);

  it('stands every heading of north on the foot line (ADR 0052)', async () => {
    const problems = await validateSheets('public', { [KEY]: g.entry });
    expect(problems).toEqual([]);
    const dir = await g.fixture((pages) => {
      // Back where it stood before it was levelled: 6 px above the line.
      for (let i = 0; i < 4; i++) g.shift(pages, g.rect(`idleNorth/${i}`), 0, -6);
    });
    const lifted = await validateSheets(dir, { [KEY]: g.entry });
    // The walk, rest and stance were levelled with it, so they now read as
    // sunk below where she stands.
    expect(lifted.some((p) => p.includes('clip "walkNorth" has its mean foot row'))).toBe(true);
    expect(lifted.some((p) => p.includes('clip "stanceNorth" has its mean foot row'))).toBe(true);
  }, 60_000);
});
