import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HEADINGS,
  KO_HEADINGS,
  headingClip,
  hitClip,
  koClip,
} from '../../src/content/assets/clips';
import type { Heading } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import type { BendCharacter, Registration } from './bend-sprites';
import { STANCE_TOLERANCE, packCel } from './bend-sprites';
import {
  CLIP_CHARACTERS,
  buildClips,
  celFile,
  checkClipSources,
  clipBox,
  clipDataFile,
  clipDataPath,
  clipTakes,
  frameHolds,
  parseTiming,
  pinClipSources,
  timingFile,
} from './g-clips';
import type { ClipCharacter, ClipPins, ClipSet, PackedClip } from './g-clips';
import { FRAME_H, FRAME_W } from './g-sprites';
import type { Image } from './lib/image';
import { newImage, setPixel, writePng } from './lib/image';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

/* ------------------------------------------------------------------ */
/* A synthetic hand-off: a fall on each of four diagonals              */
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

/** Where the synthetic stance sits in its 320 px cels, as the hand-off's do. */
const REG: Registration = { ox: 65, oy: 61, dy: 0 };

function fill(image: Image, x0: number, y0: number, x1: number, y1: number, rgb: number[]): void {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const shade = (x + y) % 2 === 0 ? 0 : 24;
      setPixel(image, x, y, [rgb[0]! + shade, rgb[1]! + shade, rgb[2]!, 255]);
    }
}

/** The stance, ragged so it registers at one offset only (see bend-sprites.test). */
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

/** A stagger: the body rocked back a little. */
function flinchCel(lean: number): Image {
  const image = newImage(320, 320);
  fill(image, 140 - lean, 116, 184 - lean, 232, [120, 60, 40]);
  fill(image, 136, 230, 156, 246, [40, 40, 40]);
  fill(image, 168, 230, 188, 246, [40, 40, 40]);
  return image;
}

/** Lying flat: far wider than a standing cel. */
function lyingCel(): Image {
  const image = newImage(320, 320);
  fill(image, 40, 220, 290, 246, [120, 60, 40]);
  return image;
}

function character(overrides: Partial<ClipCharacter> = {}): ClipCharacter {
  const bend = {
    headings: HEADINGS.map((heading) => ({
      heading,
      direction: DIRECTIONS[heading],
      stance: headingClip('stance', heading),
      dy: 0,
    })),
  } as unknown as BendCharacter;
  return {
    name: 'kaya',
    key: 'unit.fire.kaya',
    pins: { ko: 'unused', hit: 'unused' },
    toned: false,
    bend,
    holds: {},
    retakes: {},
    ...overrides,
  };
}

const CMU =
  'motion: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), subject 79 trial 73';

function timing(frames: number, set: ClipSet = 'ko') {
  return {
    take: 'synthetic',
    kind: set,
    n_frames: frames,
    ms_per_frame: Array.from({ length: frames }, (_, i) => (i === frames - 1 ? 400 : 60)),
    hitstop: { frame: 1, ms: 80 },
    last_frame_holds: set === 'ko',
    cel: { size: [320, 320] },
    ...(set === 'hit' ? { attribution: CMU } : {}),
  };
}

const koCels = (): Image[] => [stanceCel(), flinchCel(8), flinchCel(20), lyingCel()];
/** A hit: stance, contact, extreme, recovery, and the stance again. */
const hitCels = (): Image[] => [
  stanceCel(),
  flinchCel(4),
  flinchCel(12),
  flinchCel(6),
  stanceCel(),
];

const TEMP: string[] = [];
function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  TEMP.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of TEMP.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes a source set for every take of the sets; `cels` may replace a take's cels. */
function sourceSet(
  who: ClipCharacter,
  cels: (take: string, set: ClipSet) => Image[] = (_, set) =>
    set === 'hit' ? hitCels() : koCels(),
  sets: readonly ClipSet[] = ['ko'],
): string {
  const root = temp('clips-src-');
  for (const set of sets)
    for (const t of clipTakes(who, set)) {
      const images = cels(t.take, set);
      mkdirSync(join(root, 'proc', t.take), { recursive: true });
      mkdirSync(join(root, who.toned ? 'toned' : 'proc', t.take), { recursive: true });
      images.forEach((image, index) => writePng(join(root, celFile(who, t.take, index)), image));
      writeFileSync(join(root, timingFile(t.take)), JSON.stringify(timing(images.length, set)));
    }
  return root;
}

/** The packed stance a G build would ship for the synthetic stance. */
const STANCE = packCel(stanceCel(), REG, { x: 0, y: 0, w: FRAME_W, h: FRAME_H });

function pinned(source: string, who: ClipCharacter, set: ClipSet = 'ko'): string {
  const pinsPath = join(temp('clips-pins-'), 'pins.json');
  pinClipSources(source, who, set, pinsPath);
  return pinsPath;
}

async function build(
  source: string,
  pinsPath: string | Partial<Record<ClipSet, string>>,
  who: ClipCharacter,
  sets: readonly ClipSet[] = ['ko'],
) {
  const outDir = temp('clips-out-');
  const dataPath = join(outDir, 'data.json');
  const result = await buildClips(who, source, {
    outDir,
    dataPath,
    pinsPaths: typeof pinsPath === 'string' ? { ko: pinsPath } : pinsPath,
    sets,
    stance: () => STANCE,
    log: () => undefined,
  });
  return { outDir, dataPath, ...result };
}

const foot = { x: 0.5 * FRAME_W, y: 0.85 * FRAME_H };

/* ------------------------------------------------------------------ */
/* Tests                                                                */
/* ------------------------------------------------------------------ */

describe('G knockout and hit packer (ADR 0059, ADR 0063)', () => {
  it('takes a knockout on each diagonal, Bo’s NW retake, and only the licence-safe hits', () => {
    for (const who of Object.values(CLIP_CHARACTERS)) {
      const takes = clipTakes(who, 'ko');
      expect(takes.map((t) => t.clip)).toEqual(KO_HEADINGS.map(koClip));
      expect(takes.some((t) => /-hit-/.test(t.take))).toBe(false);
      for (const t of takes)
        expect(t.heading.stance).toBe(headingClip('stance', t.heading.heading));
      // Round 1's hits are CC BY-SA motion, which does not ship; round 3's
      // `-lic` takes are CMU capture, one in every heading (ADR 0063).
      const hits = clipTakes(who, 'hit');
      expect(hits.map((t) => t.clip)).toEqual(HEADINGS.map(hitClip));
      for (const t of hits) {
        expect(t.take).toMatch(new RegExp(`^${who.name}-hit-(se|s|e|sw|ne|w|n|nw)-lic$`));
        expect(t.heading.heading).toBe(
          t.clip.replace(/^hit(.)/, (_, c: string) => c.toLowerCase()),
        );
      }
    }
    const bo = clipTakes(CLIP_CHARACTERS.bo, 'ko').map((t) => t.take);
    expect(bo).toContain('bo-ko-nw-r2');
    expect(bo).not.toContain('bo-ko-nw');
    expect(clipTakes(CLIP_CHARACTERS.kaya, 'ko').map((t) => t.take)).toContain('kaya-ko-nw');
  });

  it('pins exactly the files each set’s build reads: Kaya untoned, Sura and Bo toned', () => {
    for (const who of Object.values(CLIP_CHARACTERS)) {
      for (const [set, cels] of [
        ['ko', 7],
        ['hit', 5],
      ] as const) {
        const pins = JSON.parse(readFileSync(who.pins[set], 'utf8')) as ClipPins;
        const takes = clipTakes(who, set);
        expect(Object.keys(pins.timing).sort()).toEqual(
          takes.map((t) => timingFile(t.take)).sort(),
        );
        const folders = new Set(
          Object.keys(pins.cels).map((file) => file.replace(/\/\d\d\.png$/, '')),
        );
        expect([...folders].sort()).toEqual(
          takes.map((t) => `${who.toned ? 'toned' : 'proc'}/${t.take}`).sort(),
        );
        for (const t of takes) {
          const count = Object.keys(pins.cels).filter((file) =>
            file.startsWith(`${who.toned ? 'toned' : 'proc'}/${t.take}/`),
          ).length;
          expect(count, t.take).toBe(cels);
        }
        for (const hash of [...Object.values(pins.cels), ...Object.values(pins.timing)])
          expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(Object.keys(pins.frames).length).toBeGreaterThan(0);
        expect(Object.keys(pins.frames).every((name) => name.includes(`/${set}`))).toBe(true);
      }
    }
  });

  it('ships the packed clips as the sheet’s clip data, beside the page it loads', () => {
    for (const who of Object.values(CLIP_CHARACTERS)) {
      const data = JSON.parse(readFileSync(clipDataPath(who.name), 'utf8')) as Record<
        string,
        PackedClip
      >;
      const entry = ASSETS[who.key];
      if (entry?.kind !== 'sheet') throw new Error(`${who.key} is not a sheet`);
      expect(entry.atlasPages).toContain(`art/units/${who.name}-g-3.json`);
      expect(entry.atlasPages).toContain(`art/units/${who.name}-g-4.json`);
      expect(entry.clipData).toBe(clipDataFile(who.name));
      const takes = [...clipTakes(who, 'ko'), ...clipTakes(who, 'hit')];
      expect(Object.keys(data)).toEqual(takes.map((t) => t.clip));
      for (const t of takes) {
        const pins = JSON.parse(readFileSync(who.pins[t.set], 'utf8')) as ClipPins;
        const packed = data[t.clip];
        // Fetched, never bundled: the manifest itself does not carry it.
        expect(entry.clips[t.clip], t.clip).toBeUndefined();
        expect(packed?.loop, t.clip).toBe(false);
        for (const name of packed?.frames ?? []) expect(pins.frames[name], name).toBeDefined();
      }
      // One timing per character, its hit-stop on the contact cel (REPORT-3 §3).
      const [ms, stop] = ({ kaya: [400, 80], sura: [470, 70], bo: [540, 110] } as const)[who.name];
      for (const heading of HEADINGS) {
        const hit = data[hitClip(heading)];
        expect(
          hit?.frameMs.reduce((sum, t) => sum + t, 0),
          heading,
        ).toBe(ms + stop);
        expect(hit?.frames.at(-1), heading).toBe(hit?.frames[0]);
      }
    }
  });

  it('adds the hit-stop to its contact frame, and reads only its own set’s timing', () => {
    const t = parseTiming(JSON.stringify(timing(5)), 'synthetic');
    expect(frameHolds(t)).toEqual([60, 140, 60, 60, 400]);
    expect(() => parseTiming(JSON.stringify({ ...timing(5), n_frames: 4 }), 's')).toThrow(
      /not a P0 knockout timing file/,
    );
    expect(() => parseTiming(JSON.stringify(timing(5, 'hit')), 's')).toThrow(
      /not a P0 knockout timing file/,
    );
    const hit = parseTiming(JSON.stringify(timing(5, 'hit')), 's', 'hit');
    expect(frameHolds(hit)).toEqual([60, 140, 60, 60, 400]);
    expect(() => parseTiming(JSON.stringify(timing(5)), 's', 'hit')).toThrow(
      /does not credit CMU capture/,
    );
  });

  it('refuses a hit whose timing does not credit CMU capture', () => {
    const noCredit = { ...timing(5, 'hit'), attribution: undefined };
    expect(() => parseTiming(JSON.stringify(noCredit), 's', 'hit')).toThrow(/CMU/);
    const banned = {
      ...timing(5, 'hit'),
      attribution: `${CMU}; also mocapdata.com hit-reaction, CC BY-SA`,
    };
    expect(() => parseTiming(JSON.stringify(banned), 's', 'hit')).toThrow(/CMU/);
  });

  it('is deterministic and registers frame 0 on the stance', async () => {
    const who = character();
    const source = sourceSet(who);
    const pinsPath = pinned(source, who);
    const first = await build(source, pinsPath, who);
    const files = readdirSync(first.outDir).sort();
    const firstPins = readFileSync(pinsPath);
    const second = await build(source, pinsPath, who);
    expect(readdirSync(second.outDir).sort()).toEqual(files);
    for (const file of files)
      expect(
        readFileSync(join(second.outDir, file)).equals(readFileSync(join(first.outDir, file))),
      ).toBe(true);
    expect(readFileSync(pinsPath).equals(firstPins)).toBe(true);
    expect(files).toEqual(['data.json', 'kaya-g-3.json', 'kaya-g-3.webp']);

    const ko = first.clips.koNorthWest;
    if (!ko) throw new Error('Expected a knockout');
    expect(Object.keys(first.clips)).toEqual(KO_HEADINGS.map(koClip));
    expect(ko.frames).toEqual([0, 1, 2, 3].map((i) => `unit.fire.kaya/koNorthWest/${i}`));
    expect(ko.frameMs).toEqual([60, 140, 60, 400]);
    expect(ko.fps).toBeCloseTo((4 * 1000) / 660, 5);
    expect(ko.loop).toBe(false);
    // A body lying flat is wider than a standing cel; the clip is its own size.
    expect(ko.frameSize.w).toBeGreaterThan(FRAME_W);
    // The anchor recovers each clip's rectangle, and frame 0 sampled into it
    // is the stance cel exactly where the stance stands.
    for (const clip of [ko]) {
      const box = clipBox(clip, foot);
      expect({ w: box.w, h: box.h }).toEqual(clip.frameSize);
      const frame0 = packCel(stanceCel(), REG, box);
      let differ = 0;
      for (let y = 0; y < FRAME_H; y++)
        for (let x = 0; x < FRAME_W; x++) {
          const inside = x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h;
          const a = inside ? (frame0.data[((y - box.y) * box.w + (x - box.x)) * 4 + 3] ?? 0) : 0;
          if (a !== STANCE.data[(y * FRAME_W + x) * 4 + 3]) differ++;
        }
      expect(differ).toBe(0);
    }
    expect(Object.keys(JSON.parse(readFileSync(pinsPath, 'utf8')).frames as object)).toHaveLength(
      4 * 4,
    );
  });

  it('stops on a frame 0 that is not the stance', async () => {
    const who = character();
    const source = sourceSet(who, (take) =>
      take === 'kaya-ko-sw' ? [flinchCel(2), flinchCel(6), flinchCel(10), lyingCel()] : koCels(),
    );
    await expect(build(source, pinned(source, who), who)).rejects.toThrow(
      /kaya-ko-sw: frame 0 does not register on the packed stance cel/,
    );
  });

  it('stops on a stance whose colour drifted past the tolerance', async () => {
    const who = character();
    const recoloured = stanceCel();
    for (let i = 0; i < recoloured.data.length; i += 4)
      if ((recoloured.data[i + 3] ?? 0) > 0)
        recoloured.data[i] = Math.min(255, (recoloured.data[i] ?? 0) + 40);
    const source = sourceSet(who, (take) =>
      take === 'kaya-ko-se' ? [recoloured, flinchCel(8), flinchCel(20), lyingCel()] : koCels(),
    );
    await expect(build(source, pinned(source, who), who)).rejects.toThrow(
      new RegExp(
        `kaya-ko-se frame 0 does not match the packed stance.*at most ${STANCE_TOLERANCE.meanRgb}`,
      ),
    );
  });

  it('stops on an undeclared repeat and on a declared hold that is not one', async () => {
    const who = character();
    const held = (take: string) =>
      take === 'kaya-ko-sw'
        ? [stanceCel(), flinchCel(8), flinchCel(20), flinchCel(20), lyingCel()]
        : koCels();
    const source = sourceSet(who, held);
    await expect(build(source, pinned(source, who), who)).rejects.toThrow(
      /kaya-ko-sw: frame 3 duplicates cel 2; declare a hold or retake it/,
    );
    const declared = character({ holds: { 'kaya-ko-sw': { 3: 2 } } });
    const ok = await build(source, pinned(source, declared), declared);
    expect(ok.clips.koSouthWest?.frames[3]).toBe('unit.fire.kaya/koSouthWest/2');

    const wrong = character({ holds: { 'kaya-ko-se': { 2: 1 } } });
    const plain = sourceSet(wrong);
    await expect(build(plain, pinned(plain, wrong), wrong)).rejects.toThrow(
      /kaya-ko-se: frame 2 should repeat cel 1 and does not/,
    );
  });

  it('stops on a changed, missing or stray source file before writing anything', async () => {
    const who = character();
    const source = sourceSet(who);
    const pinsPath = pinned(source, who);
    const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as ClipPins;
    expect(checkClipSources(source, who, 'ko', pins)).toEqual([]);
    writePng(join(source, celFile(who, 'kaya-ko-ne', 2)), flinchCel(11));
    writePng(join(source, 'proc', 'kaya-ko-ne', '09.png'), flinchCel(1));
    expect(checkClipSources(source, who, 'ko', pins)).toEqual([
      'clip cel proc/kaya-ko-ne/02.png does not match its pin',
      'clip cel proc/kaya-ko-ne/09.png is in ' + source + ' but not in the timing',
    ]);
    const outDir = temp('clips-out-');
    await expect(
      buildClips(who, source, {
        outDir,
        dataPath: join(outDir, 'data.json'),
        pinsPaths: { ko: pinsPath },
        sets: ['ko'],
        stance: () => STANCE,
        log: () => undefined,
      }),
    ).rejects.toThrow(/do not match/);
    expect(readdirSync(outDir)).toEqual([]);
    expect(() => pinClipSources(source, who, 'ko', pinsPath)).toThrow(/never rewritten/);
  });

  it('packs the hits on pages of their own, leaving the knockouts’ page as it was', async () => {
    const who = character();
    const source = sourceSet(who, undefined, ['ko', 'hit']);
    const pins = { ko: pinned(source, who, 'ko'), hit: pinned(source, who, 'hit') };
    const alone = await build(source, pins.ko, who, ['ko']);
    const both = await build(source, pins, who, ['ko', 'hit']);
    expect(readdirSync(both.outDir).sort()).toEqual([
      'data.json',
      'kaya-g-3.json',
      'kaya-g-3.webp',
      'kaya-g-4.json',
      'kaya-g-4.webp',
    ]);
    for (const file of ['kaya-g-3.json', 'kaya-g-3.webp'])
      expect(
        readFileSync(join(both.outDir, file)).equals(readFileSync(join(alone.outDir, file))),
        file,
      ).toBe(true);
    expect(Object.keys(both.clips)).toEqual([...KO_HEADINGS.map(koClip), ...HEADINGS.map(hitClip)]);
    // The last frame returns to the stance, one cel named twice, on one camera.
    const hit = both.clips.hitNorthWest;
    if (!hit) throw new Error('Expected a hit');
    expect(hit.frames).toEqual([0, 1, 2, 3, 0].map((i) => `unit.fire.kaya/hitNorthWest/${i}`));
    expect(hit.frameMs).toEqual([60, 140, 60, 60, 400]);
    const hitPins = JSON.parse(readFileSync(pins.hit, 'utf8')) as ClipPins;
    expect(Object.keys(hitPins.frames)).toHaveLength(8 * 4);
    expect(Object.keys(hitPins.frames).every((name) => name.includes('/hit'))).toBe(true);
    const koPins = JSON.parse(readFileSync(pins.ko, 'utf8')) as ClipPins;
    expect(Object.keys(koPins.frames)).toHaveLength(4 * 4);
  });

  it('stops on a hit that does not return to its stance', async () => {
    const who = character();
    const source = sourceSet(
      who,
      (take, set) =>
        take === 'kaya-hit-sw-lic'
          ? [stanceCel(), flinchCel(4), flinchCel(12), flinchCel(6), flinchCel(2)]
          : set === 'hit'
            ? hitCels()
            : koCels(),
      ['hit'],
    );
    await expect(build(source, { hit: pinned(source, who, 'hit') }, who, ['hit'])).rejects.toThrow(
      /kaya-hit-sw-lic: frame 4 should repeat cel 0 and does not/,
    );
  });
});
