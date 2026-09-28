import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BendEffectDef, BendSetDef } from '../../src/content/bends';
import { BEND_FX } from '../../src/content/fxCels';
import {
  EFFECT_IDS,
  EFFECT_PINS,
  GAME_SCALE,
  RENDERER,
  SEQUENCES,
  TIMING_FILES,
  buildEffects,
  checkEffectSources,
  drawnFiles,
  effectDefs,
  packEffectCel,
  pinEffectSources,
  pyRound,
  resize,
  shake,
} from './bend-effects';
import type { EffectPins } from './bend-effects';
import { BEND_CHARACTERS } from './bend-sprites';
import type { Image } from './lib/image';
import { newImage, pixelAt, setPixel, writePng } from './lib/image';
import { MARGIN } from './lib/align';
import { alphaBounds } from './lib/trim';
import { BEND_FX_PINS, validateBendFx } from './validate';

const TEMP: string[] = [];
function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  TEMP.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of TEMP.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A painted-looking blob: a shaded disc with an ink edge, offset by `seed`. */
function blob(seed: number): Image {
  const image = newImage(160, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 160; x++) {
      const d = Math.hypot(x - 70 - (seed % 9), y - 60 - (seed % 5));
      if (d < 30) setPixel(image, x, y, [200 - seed, 90 + ((x * 3) % 40), 40 + seed, 255]);
      else if (d < 32) setPixel(image, x, y, [30, 20, 10, 255]);
    }
  return image;
}

const FIRE_MS = [60, 60, 110, 50, 120, 40, 150, 110, 70, 110, 70, 70, 120];
const EARTH_MS = [60, 80, 150, 40, 130, 50, 170, 120, 80, 130, 90, 120];
const WATER_MS = [60, 70, 110, 150, 40, 140, 110, 70, 130, 80, 120];

/** A stand-in prototype: every file the packer draws, the timing and the renderer. */
function prototype(): string {
  const root = temp('fx-src-');
  drawnFiles().forEach((file, index) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writePng(join(root, file), blob(index));
  });
  const timing = { fire: FIRE_MS, earth: EARTH_MS, water: WATER_MS };
  for (const [element, file] of Object.entries(TIMING_FILES)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    const ms = timing[element as keyof typeof timing];
    writeFileSync(join(root, file), JSON.stringify({ ms_per_frame: ms }));
  }
  mkdirSync(dirname(join(root, RENDERER)), { recursive: true });
  writeFileSync(join(root, RENDERER), '# the approved renderer\n');
  return root;
}

async function build(source: string, pinsPath: string) {
  const publicDir = temp('fx-out-');
  const result = await buildEffects(source, {
    publicDir,
    pinsPath,
    sets: [],
    log: () => undefined,
  });
  return { publicDir, ...result };
}

function pinned(source: string): string {
  const pinsPath = join(temp('fx-pins-'), 'pins.json');
  pinEffectSources(source, pinsPath);
  return pinsPath;
}

const OUTPUTS = [
  BEND_FX.data,
  ...BEND_FX.pages,
  ...BEND_FX.pages.map((p) => p.replace('.json', '.webp')),
];

describe('resampling as the prototype did', () => {
  it('rounds halves to even, as Python does', () => {
    expect([0.5, 1.5, 2.5, 2.4, 2.6, 3].map(pyRound)).toEqual([0, 2, 2, 2, 3, 3]);
  });

  it('averages on premultiplied alpha, so a clear pixel never darkens an edge', () => {
    const image = newImage(2, 1);
    setPixel(image, 0, 0, [200, 100, 50, 255]);
    const half = resize(image, 1, 1);
    expect(pixelAt(half, 0, 0)).toEqual([200, 100, 50, 128]);
  });
});

describe('an effect cel', () => {
  it('sits its anchor on the pivot, at the game scale, inside the margin', () => {
    const sprite = blob(0);
    const { image, meta } = packEffectCel(
      {
        draws: [{ file: 'a', cut: 'whole', scale: 1.35, opacity: 255, anchor: { x: 70, y: 90 } }],
      },
      () => sprite,
      'test',
    );
    // 0.75 game pixels a source pixel: the anchor lands at 52.5, 67.5 of the
    // resized sprite; the cel starts one margin before its ink.
    expect(GAME_SCALE * 1.35).toBeCloseTo(0.75, 9);
    const ink = alphaBounds(resize(sprite, 120, 96), 1);
    if (!ink) throw new Error('no ink');
    expect(meta.pivot).toEqual({ x: 52.5 - ink.x + MARGIN, y: 67.5 - ink.y + MARGIN });
    expect(image.width).toBe(ink.width + 2 * MARGIN);
    for (let x = 0; x < image.width; x++) {
      expect(pixelAt(image, x, 0)[3]).toBe(0);
      expect(pixelAt(image, x, image.height - 1)[3]).toBe(0);
    }
  });
});

describe('the effect packer', () => {
  it('is deterministic: two builds write byte-identical pages, data and pins', async () => {
    const source = prototype();
    const pinsPath = pinned(source);
    const first = await build(source, pinsPath);
    const firstPins = readFileSync(pinsPath);
    const second = await build(source, pinsPath);
    for (const file of OUTPUTS)
      expect(
        readFileSync(join(second.publicDir, file)).equals(
          readFileSync(join(first.publicDir, file)),
        ),
        file,
      ).toBe(true);
    expect(readFileSync(pinsPath).equals(firstPins)).toBe(true);
    const pins = JSON.parse(firstPins.toString()) as EffectPins;
    const cels = SEQUENCES.reduce((sum, s) => sum + s.cels.length, 0);
    expect(Object.keys(pins.frames)).toHaveLength(cels);
    expect(await validateBendFx(first.publicDir, BEND_FX, pinsPath)).toEqual([]);
  });

  it('refuses a changed, missing or stray source, and writes nothing', async () => {
    const source = prototype();
    const pinsPath = pinned(source);
    const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as EffectPins;
    expect(checkEffectSources(source, pins)).toEqual([]);
    const [file] = drawnFiles();
    if (!file) throw new Error('no drawn file');

    writePng(join(source, file), blob(99));
    const publicDir = temp('fx-out-');
    await expect(
      buildEffects(source, { publicDir, pinsPath, sets: [], log: () => undefined }),
    ).rejects.toThrow(`effect source ${file} does not match its pin`);
    for (const output of OUTPUTS) expect(existsSync(join(publicDir, output))).toBe(false);

    rmSync(join(source, file));
    expect(checkEffectSources(source, pins)).toContain(
      `effect source ${file} is missing from ${source}`,
    );
    writePng(join(source, file), blob(0));

    const stray = join(dirname(join(source, file)), '99.png');
    writePng(stray, blob(1));
    expect(checkEffectSources(source, pins).join('\n')).toContain('/99.png has no pin');
    rmSync(stray);

    writeFileSync(join(source, RENDERER), '# edited\n');
    expect(checkEffectSources(source, pins)).toEqual([
      `effect source ${RENDERER} does not match its pin`,
    ]);
  });

  it('never rewrites a pin file from --pin', () => {
    const source = prototype();
    const pinsPath = pinned(source);
    expect(() => pinEffectSources(source, pinsPath)).toThrow('never rewritten');
  });

  it('stops when a shipped bend is no longer timed as the approved one', async () => {
    const source = prototype();
    const pinsPath = pinned(source);
    const kaya = JSON.parse(readFileSync('public/art/units/kaya-bend.json', 'utf8')) as BendSetDef;
    const retimed: BendSetDef = {
      ...kaya,
      facings: { ...kaya.facings, west: { ...kaya.facings.west, frameMs: [...FIRE_MS].reverse() } },
    };
    await expect(
      buildEffects(source, {
        publicDir: temp('fx-out-'),
        pinsPath,
        sets: [retimed],
        log: () => undefined,
      }),
    ).rejects.toThrow('kaya.bend west is not timed as the approved fire bend');
  });
});

describe('the shipped effects', () => {
  const shipped = JSON.parse(readFileSync(join('public', BEND_FX.data), 'utf8')) as BendEffectDef[];

  it('are exactly what the packer derives from the bends’ approved timing', () => {
    const ms = (name: string) =>
      (JSON.parse(readFileSync(`public/art/units/${name}-bend.json`, 'utf8')) as BendSetDef).facings
        .southEast.frameMs;
    const derived = effectDefs({
      fire: { ms_per_frame: ms('kaya') },
      earth: { ms_per_frame: ms('bo') },
      water: { ms_per_frame: ms('sura') },
    });
    expect(shipped).toEqual(derived);
  });

  it('are the effects the party bends name, one an element', () => {
    expect(
      Object.values(BEND_CHARACTERS)
        .map((who) => who.effectId)
        .sort(),
    ).toEqual(Object.values(EFFECT_IDS).sort());
    expect(shipped.map((effect) => effect.id)).toEqual(Object.values(EFFECT_IDS));
  });

  it('carry the prototype’s holds, flashes and shakes in tiles', () => {
    expect(shake(3, -2)).toBe(0.034);
    const fire = shipped.find((effect) => effect.id === 'fx.fire.fireball');
    expect(fire?.trajectory).toEqual({
      kind: 'arc',
      speedTilesPerSecond: 9.8,
      heightTiles: 0.2,
      spin: 0,
    });
    const water = shipped.find((effect) => effect.id === 'fx.water.bolt');
    expect(water?.trajectory).toMatchObject({ kind: 'whipBolt', whipMaxTiles: 1.5 });
    expect(water?.residue).toEqual({
      sequence: 'fx.water.bolt/puddle',
      durationMs: 120,
      gameplaySurface: false,
    });
  });

  it('art:validate holds the shipped page to its pins', async () => {
    expect(await validateBendFx()).toEqual([]);
    const dir = temp('fx-pins-');
    const pinsPath = join(dir, 'pins.json');
    const pins = JSON.parse(readFileSync(BEND_FX_PINS, 'utf8')) as EffectPins;
    const name = 'fx.earth.rock/tumble/2';
    writeFileSync(
      pinsPath,
      JSON.stringify({ ...pins, frames: { ...pins.frames, [name]: '0'.repeat(64) } }),
    );
    expect(await validateBendFx('public', BEND_FX, pinsPath)).toEqual([
      `bend effects: decoded cel "${name}" does not match its pin`,
    ]);
    expect(EFFECT_PINS).toBe(BEND_FX_PINS);
  }, 60_000);
});
