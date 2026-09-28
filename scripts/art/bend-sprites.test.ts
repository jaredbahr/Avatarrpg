import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HEADINGS, headingClip } from '../../src/content/assets/clips';
import type { Heading } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import { bendSetDefSchema, validateBendSets } from '../../src/content/bends';
import type { BendSetDef } from '../../src/content/bends';
import {
  BEND_CHARACTERS,
  STANCE_TOLERANCE,
  bendFrameName,
  bendOutputs,
  buildBend,
  celFile,
  checkBendSources,
  layoutBendPages,
  packCel,
  packSocket,
  pinBendSources,
  register,
  sourcePixel,
  sourceToG,
  stanceDifference,
  timingFile,
} from './bend-sprites';
import type { BendCharacter, BendPins, Registration } from './bend-sprites';
import { FRAME_H, FRAME_W } from './g-sprites';
import type { Image } from './lib/image';
import { newImage, pixelAt, setPixel, writePng } from './lib/image';
import { BEND_SHEETS, validateBends } from './validate';

/* ------------------------------------------------------------------ */
/* A synthetic three-cel bend in eight headings                         */
/* ------------------------------------------------------------------ */

const DIRECTIONS: Readonly<Record<Heading, string>> = {
  east: 'east',
  southEast: 'south-east',
  south: 'south',
  southWest: 'south-west',
  west: 'west',
  northWest: 'north-west',
  north: 'north',
  northEast: 'north-east',
};

/** Where the synthetic stance sits in its 320 px cels, as the r10 sets do. */
const REG: Registration = { ox: 64, oy: 64, dy: 0 };
/** A lone marker pixel on the reaching fist, and the socket measured on it. */
const FIST = { x: 262, y: 170 };

function fill(image: Image, x0: number, y0: number, x1: number, y1: number, rgb: number[]): void {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      // A checker, so the cels are not flat colour.
      const shade = (x + y) % 2 === 0 ? 0 : 24;
      setPixel(image, x, y, [rgb[0]! + shade, rgb[1]! + shade, rgb[2]!, 255]);
    }
}

/**
 * The stance: a body and two feet inside the 192 px stance square, with a
 * ragged edge and loose pixels, so like drawn art it registers at one offset
 * only (a bare rectangle survives a 1 px shift of the 75% sampling).
 */
function stanceCel(): Image {
  const image = newImage(320, 320);
  fill(image, 140, 110, 184, 230, [120, 60, 40]);
  fill(image, 136, 230, 156, 246, [40, 40, 40]);
  fill(image, 168, 230, 188, 246, [40, 40, 40]);
  for (let i = 0; i < 60; i++) {
    setPixel(image, 184 + ((i * 7) % 5), 110 + i * 2, [90, 40, 30, 255]);
    setPixel(image, 100 + ((i * 37) % 120), 80 + ((i * 53) % 170), [60, 90, 150, 255]);
  }
  return image;
}

/** A strike: the stance with an arm reaching past the stance square. */
function strikeCel(): Image {
  const image = stanceCel();
  fill(image, 184, 160, FIST.x, 180, [200, 150, 90]);
  fill(image, FIST.x, 164, FIST.x + 12, 184, [230, 200, 120]);
  return image;
}

const TEMP: string[] = [];
function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  TEMP.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of TEMP.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function character(overrides: Partial<BendCharacter> = {}): BendCharacter {
  return {
    name: 'test',
    key: 'unit.fire.kaya',
    element: 'fire',
    pins: 'unused',
    gPins: 'unused',
    stancePage: 'unused',
    attackId: 'fire-strike',
    effectId: 'fx.fire.jet',
    roles: { K1: 'contact' },
    holds: {},
    headings: HEADINGS.map((heading) => ({
      heading,
      direction: DIRECTIONS[heading],
      stance: headingClip('stance', heading),
      dy: 0,
    })),
    ...overrides,
  };
}

function timing(frames: number) {
  return {
    n_frames: frames,
    ms_per_frame: Array.from({ length: frames }, (_, i) => (i === 1 ? 120 : 60)),
    key_frames: { K1: 1 },
    smear_frame: 1,
    attacks: [{ name: 'hit', frame: 1, socket: 'LW', hitstop_ms: 50, launch_frame: 1 }],
    sockets_per_frame: Array.from({ length: frames }, (_, frame) => ({
      frame,
      ms: frame === 1 ? 120 : 60,
      LW: frame === 1 ? [FIST.x + 4, FIST.y + 6] : [184, 170],
      RA: [146, 246],
    })),
  };
}

/** Writes a source set: stance, strike, stance again, in every heading. */
function sourceSet(
  cels: (heading: Heading) => Image[] = () => [stanceCel(), strikeCel(), stanceCel()],
): string {
  const root = temp('bend-src-');
  for (const heading of HEADINGS) {
    const direction = DIRECTIONS[heading];
    const images = cels(heading);
    mkdirSync(join(root, 'final', direction), { recursive: true });
    images.forEach((image, index) => writePng(join(root, celFile(direction, index)), image));
    writeFileSync(join(root, timingFile(direction)), JSON.stringify(timing(images.length)));
  }
  return root;
}

/** The packed stance a G build would ship for the synthetic stance. */
const STANCE = packCel(stanceCel(), REG, { x: 0, y: 0, w: FRAME_W, h: FRAME_H });

async function build(source: string, pinsPath: string, who = character()) {
  const outDir = temp('bend-out-');
  const result = await buildBend(who, source, {
    outDir,
    pinsPath,
    stance: () => STANCE,
    knownUnitAssets: ['unit.fire.kaya'],
    log: () => undefined,
  });
  return { outDir, ...result };
}

function pinned(source: string, who = character()): string {
  const pinsPath = join(temp('bend-pins-'), 'pins.json');
  pinBendSources(source, who, pinsPath);
  return pinsPath;
}

/* ------------------------------------------------------------------ */
/* Tests                                                                */
/* ------------------------------------------------------------------ */

describe('bend packer', () => {
  it('is deterministic: two builds write byte-identical pages, data and pins', async () => {
    const source = sourceSet();
    const pinsPath = pinned(source);
    const first = await build(source, pinsPath);
    const firstPins = readFileSync(pinsPath);
    const second = await build(source, pinsPath);
    const files = readdirSync(first.outDir).sort();
    expect(files).toEqual(bendOutputs('test', 1).sort());
    expect(readdirSync(second.outDir).sort()).toEqual(files);
    for (const file of files)
      expect(
        readFileSync(join(second.outDir, file)).equals(readFileSync(join(first.outDir, file))),
        file,
      ).toBe(true);
    expect(readFileSync(pinsPath).equals(firstPins)).toBe(true);
    const pins = JSON.parse(firstPins.toString()) as BendPins;
    // Two distinct cels a heading: the return to the stance reuses frame 0.
    expect(Object.keys(pins.frames)).toHaveLength(16);
    for (const hash of Object.values(pins.frames)) expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('writes a set the bend contract accepts, one cel named twice for the return', async () => {
    const source = sourceSet();
    const { set, outDir } = await build(source, pinned(source));
    const data = JSON.parse(readFileSync(join(outDir, 'test-bend.json'), 'utf8')) as BendSetDef;
    expect(data).toEqual(set);
    expect(bendSetDefSchema.safeParse(data).success).toBe(true);
    const names = HEADINGS.flatMap((heading) => data.facings[heading].frames);
    expect(validateBendSets([data], null, ['unit.fire.kaya'], names)).toEqual([]);
    const east = data.facings.east;
    expect(east.frames).toEqual([0, 1, 0].map((i) => bendFrameName('unit.fire.kaya', 'east', i)));
    expect(east.attacks[0]?.releases).toEqual([
      { frame: 1, launchFrame: 1, socket: 'LW', launchHoldMs: 50, impactHoldMs: 0 },
    ]);
    expect(east.keyFrames).toEqual({ K1: { frame: 1, role: 'contact' } });
  });

  it('refuses a changed, missing or stray cel, and a changed timing', async () => {
    const source = sourceSet();
    const pinsPath = pinned(source);
    const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as BendPins;
    const who = character();
    expect(checkBendSources(source, who, pins)).toEqual([]);

    const changed = strikeCel();
    setPixel(changed, 150, 150, [0, 0, 255, 255]);
    writePng(join(source, celFile('west', 1)), changed);
    await expect(build(source, pinsPath)).rejects.toThrow(
      'bend cel final/west/01.png does not match its pin',
    );
    writePng(join(source, celFile('west', 1)), strikeCel());

    rmSync(join(source, celFile('north', 2)));
    expect(checkBendSources(source, who, pins)).toEqual([
      expect.stringContaining('bend cel final/north/02.png is missing'),
    ]);
    writePng(join(source, celFile('north', 2)), stanceCel());

    writePng(join(source, celFile('north', 3)), stanceCel());
    await expect(build(source, pinsPath)).rejects.toThrow('final/north/03.png is in');
    rmSync(join(source, celFile('north', 3)));

    writeFileSync(
      join(source, timingFile('south')),
      JSON.stringify(timing(3)).replace('120', '130'),
    );
    expect(checkBendSources(source, who, pins)).toEqual([
      'bend timing timing-south.json does not match its pin',
    ]);
  });

  it('never rewrites a pin file from --pin', () => {
    const source = sourceSet();
    const pinsPath = pinned(source);
    expect(() => pinBendSources(source, character(), pinsPath)).toThrow('never rewritten');
  });

  it('stops when frame 0 does not stand on the packed stance', async () => {
    const source = sourceSet();
    const pinsPath = pinned(source);
    expect(register(stanceCel(), STANCE, 0, 'same')).toEqual(REG);
    // A stance with another outline, however slight, cannot register.
    const wider = packCel(stanceCel(), REG, { x: 0, y: 0, w: FRAME_W, h: FRAME_H });
    for (let y = 100; y < 160; y++) setPixel(wider, 20, y, [40, 40, 40, 255]);
    expect(() => register(stanceCel(), wider, 0, 'wider')).toThrow('does not register');
    // A re-toned stance registers, and fails the colour tolerance.
    const toned = packCel(stanceCel(), REG, { x: 0, y: 0, w: FRAME_W, h: FRAME_H });
    for (let i = 0; i < toned.data.length; i += 4)
      if (toned.data[i + 3]) toned.data[i] = Math.min(255, (toned.data[i] ?? 0) + 20);
    await expect(
      buildBend(character(), source, {
        outDir: temp('bend-out-'),
        pinsPath,
        stance: () => toned,
        knownUnitAssets: ['unit.fire.kaya'],
        log: () => undefined,
      }),
    ).rejects.toThrow('does not match the packed stance');
  });

  it('holds the last frame to the stance too', async () => {
    const moved = stanceCel();
    fill(moved, 184, 200, 200, 210, [10, 200, 10]);
    const source = sourceSet(() => [stanceCel(), strikeCel(), moved]);
    await expect(build(source, pinned(source))).rejects.toThrow('frame 2 should repeat cel 0');
  });

  it('measures the stance difference as alpha, mean colour and bias', () => {
    const box = { x: -4, y: -4, w: FRAME_W + 8, h: FRAME_H + 8 };
    const same = stanceDifference(packCel(stanceCel(), REG, box), box, STANCE);
    expect(same).toEqual({ alpha: 0, meanRgb: 0, bias: 0, outliers: 0, outside: 0 });
    const reaching = stanceDifference(packCel(strikeCel(), REG, box), box, STANCE);
    expect(reaching.alpha + reaching.outside).toBeGreaterThan(0);
    expect(STANCE_TOLERANCE.meanRgb).toBeLessThanOrEqual(6);
  });

  it('rejects an undeclared duplicate cel and a declared hold that is not one', async () => {
    const twice = sourceSet(() => [stanceCel(), strikeCel(), strikeCel(), stanceCel()]);
    await expect(build(twice, pinned(twice))).rejects.toThrow('frame 2 duplicates cel 1');
    const held = character({
      holds: Object.fromEntries(Object.values(DIRECTIONS).map((d) => [d, { 2: 1 }])),
    });
    const { set } = await build(twice, pinned(twice, held), held);
    expect(set.facings.south.frames.map((name) => name.split('/').pop())).toEqual([
      '0',
      '1',
      '1',
      '0',
    ]);
    const fresh = sourceSet(() => [stanceCel(), strikeCel(), stanceCel()]);
    const stale = character({ holds: { east: { 1: 0 } } });
    await expect(build(fresh, pinned(fresh, stale), stale)).rejects.toThrow(
      'frame 1 should repeat cel 0',
    );
  });

  it('moves sockets into the packed cel by the same map as the pixels', async () => {
    // The G map: a 320 px cel with its stance at (64, 64) lands 8 px left of and
    // 31 px below a 128x192 cel's corner, at 75%.
    expect(sourceToG({ x: 64, y: 64 }, REG)).toEqual({ x: -8, y: 31 });
    expect(sourceToG({ x: 160, y: 240.25 }, REG)).toEqual({ x: 64, y: 163.1875 });
    expect(packSocket({ x: 160, y: 240 }, REG, { x: -10, y: 20, w: 1, h: 1 })).toEqual({
      x: 74,
      y: 143,
    });
    expect(sourcePixel(-8, 31, REG)).toEqual([64, 64]);
    expect(sourcePixel(-9, 30, REG)).toEqual([62, 62]);

    const source = sourceSet();
    const { set, outDir } = await build(source, pinned(source));
    const east = set.facings.east;
    const socket = east.socketsPerFrame[1]?.sockets.LW;
    expect(socket).toBeDefined();
    // The socket lands on the fist's pixels in the packed cel.
    const atlas = JSON.parse(readFileSync(join(outDir, 'test-g-bend.json'), 'utf8')) as {
      frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
    };
    const rect = atlas.frames[bendFrameName('unit.fire.kaya', 'east', 1)]?.frame;
    expect(rect).toEqual(
      expect.objectContaining({ w: east.frameSize.width, h: east.frameSize.height }),
    );
    const cel = packCel(strikeCel(), REG, {
      x: Math.round(64 - east.anchor.x * east.frameSize.width),
      y: Math.round(163.2 - east.anchor.y * east.frameSize.height),
      w: east.frameSize.width,
      h: east.frameSize.height,
    });
    const [r, g] = pixelAt(cel, Math.floor(socket?.x ?? -1), Math.floor(socket?.y ?? -1));
    expect(r).toBeGreaterThanOrEqual(230);
    expect(g).toBeGreaterThanOrEqual(200);
    // The root is the source point on the foot anchor.
    const foot = packSocket(east.root, REG, {
      x: Math.round(64 - east.anchor.x * east.frameSize.width),
      y: Math.round(163.2 - east.anchor.y * east.frameSize.height),
      w: 0,
      h: 0,
    });
    expect(foot.x).toBeCloseTo(east.anchor.x * east.frameSize.width, 3);
    expect(foot.y).toBeCloseTo(east.anchor.y * east.frameSize.height, 3);
    expect(east.scale).toBe(0.75);
  });

  it('shelf-packs in order and opens a page when one is full', () => {
    const cels = new Map<string, Image>();
    for (let i = 0; i < 5; i++) cels.set(`c/${i}`, newImage(40, 30));
    const pages = layoutBendPages(cels, 100);
    expect(pages.map((page) => [...page.frames.values()])).toEqual([
      [
        { x: 0, y: 0, w: 40, h: 30 },
        { x: 40, y: 0, w: 40, h: 30 },
        { x: 0, y: 30, w: 40, h: 30 },
        { x: 40, y: 30, w: 40, h: 30 },
        { x: 0, y: 60, w: 40, h: 30 },
      ],
    ]);
    expect(layoutBendPages(cels, 60)).toHaveLength(3);
  });
});

describe('the packed r10 bends', () => {
  const PARTY = Object.values(BEND_CHARACTERS);

  for (const who of PARTY) {
    it(`pins ${who.name}'s eight timings and every cel, and ships a valid set`, () => {
      const pins = JSON.parse(readFileSync(who.pins, 'utf8')) as BendPins;
      expect(Object.keys(pins.timing).sort()).toEqual(
        who.headings.map((h) => timingFile(h.direction)).sort(),
      );
      const set = JSON.parse(
        readFileSync(`public/art/units/${who.name}-bend.json`, 'utf8'),
      ) as BendSetDef;
      expect(bendSetDefSchema.safeParse(set).success).toBe(true);
      const frames = HEADINGS.flatMap((heading) => set.facings[heading].frames);
      expect(validateBendSets([set], null, Object.keys(ASSETS), frames)).toEqual([]);
      const celCount = HEADINGS.reduce(
        (sum, heading) => sum + set.facings[heading].frames.length,
        0,
      );
      expect(Object.keys(pins.cels)).toHaveLength(celCount);
      expect(Object.keys(pins.frames).sort()).toEqual([...new Set(frames)].sort());
      expect(BEND_SHEETS[who.key]?.pins).toBe(who.pins);
      for (const heading of HEADINGS) {
        const facing = set.facings[heading];
        // Every heading starts and ends on the one stance cel.
        expect(facing.frames[facing.frames.length - 1]).toBe(facing.frames[0]);
        expect(facing.scale).toBe(0.75);
        expect(facing.sourceSize).toEqual({ width: 320, height: 320 });
      }
    });
  }

  it('keeps Kaya’s cross hold and Sura’s two W4 holds as one cel named twice', () => {
    const kaya = JSON.parse(readFileSync('public/art/units/kaya-bend.json', 'utf8')) as BendSetDef;
    for (const heading of HEADINGS)
      expect(kaya.facings[heading].frames[7]).toBe(kaya.facings[heading].frames[6]);
    const sura = JSON.parse(readFileSync('public/art/units/sura-bend.json', 'utf8')) as BendSetDef;
    for (const heading of ['south', 'northWest'] as const)
      expect(sura.facings[heading].frames[6]).toBe(sura.facings[heading].frames[5]);
    expect(sura.facings.east.frames[6]).not.toBe(sura.facings.east.frames[5]);
  });

  it('art:validate holds the shipped pages to their pins and the stance', async () => {
    expect(await validateBends()).toEqual([]);
    const dir = temp('bend-pins-');
    const bad: Record<string, { pins: string; data: string; pages: string[] }> = {};
    for (const [key, entry] of Object.entries(BEND_SHEETS)) {
      const pins = join(dir, `${key}.json`);
      copyFileSync(entry.pins, pins);
      bad[key] = { ...entry, pins, pages: [...entry.pages] };
    }
    const kaya = bad['unit.fire.kaya'];
    if (!kaya) throw new Error('no kaya');
    const pins = JSON.parse(readFileSync(kaya.pins, 'utf8')) as BendPins;
    const name = bendFrameName('unit.fire.kaya', 'south', 3);
    writeFileSync(
      kaya.pins,
      JSON.stringify({ ...pins, frames: { ...pins.frames, [name]: '0'.repeat(64) } }),
    );
    expect(await validateBends('public', bad)).toEqual([
      `unit.fire.kaya: decoded bend cel "${name}" does not match its pin`,
    ]);
  }, 60_000);
});
