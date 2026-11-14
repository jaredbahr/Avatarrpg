/**
 * The effects at the world's grain (G1, ADR 0085; ADR 0021 amended by ADR
 * 0086): the element cel sheets, redrawn as pixel art and packed
 * reproducibly. (The painted bend effects page this also packed went with the
 * bends, ADR 0104 T7.)
 *
 * Usage:
 *   node --import tsx scripts/art/fx-g1.ts           # write the shipped files
 *   node --import tsx scripts/art/fx-g1.ts --check   # prove they are what the sources make
 *   node --import tsx scripts/art/fx-g1.ts --pin     # re-pin the sources (after a new accepted sheet)
 *
 * Sources, all under `art/source/fx-g1/` and pinned by SHA-256 in its
 * `pins.json`:
 * - `inputs/<sheet>.png`: the painted art, reduced to the 96 px master by
 *   `tools/inputs.py` from the files this script replaced;
 * - `generated/<sheet>.png`: the accepted PixelLab Pro Flash clean-up of each
 *   input sheet (`tools/generate.py`, every job in `ledger.json`);
 * - `layout.json`: where each cel sits on its sheet.
 *
 * Each cel is cleaned up the same deterministic way:
 * 1. its shape is the generated pixels that are opaque (alpha >= 128) and lie
 *    within one pixel of the painted cel's own silhouette, plus any pixel the
 *    painting held solid that the generator dropped, so registration and
 *    silhouette are the approved art's, and nothing strays outside its margin;
 * 2. each pixel snaps to the nearest colour of its element's ramp (three or
 *    four tones from `src/render/palettes.ts`) or the `#1b1410` ink, by a
 *    perceptual RGB distance, so a cel has at most five flat colours;
 * 3. alpha is hard: one level a cel, the painted cel's median opacity rounded
 *    to eighths, so a cel the painting faded (the crack's last cels, the
 *    burst's tail) still fades, with hard edges.
 *
 * The element cel sheets are 96 px a cel (a 192 px cel was 2 art px a world px at
 * its largest use). Two runs write byte-identical files.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CEL_FRAMES, CEL_SIZE, FX_CEL_SHEETS } from '../../src/content/fxCels';
import { dropOrphanPixels } from '../../src/render/fx/celResample';
import type { Image } from './lib/image';
import { newImage, parseHex, readPng, writePng } from './lib/image';
import { MARGIN } from './lib/align';

export const G1_DIR = 'art/source/fx-g1';
export const G1_PINS = `${G1_DIR}/pins.json`;

/** The art bible's ink, the darkest any effect outline gets. */
export const INK = '#1b1410';

/** Each element's tones, darkest first, every one a colour `palettes.ts` already holds. */
export const RAMPS = {
  /** `ELEMENT_PALETTES.fire` dark, the burning surface's fill and edge, and the rim white. */
  fire: ['#8c2416', '#e0521f', '#ffb648', '#fff6e0'],
  /** Water's light end and `frozen`, for lightning's pale bolts. */
  lightning: ['#3e8fb0', '#7ec8e3', '#cdeefb'],
  /** `ELEMENT_PALETTES.water`. */
  water: ['#22566e', '#3e8fb0', '#7ec8e3', '#cdeefb'],
  /** Water's light end and the ice surface's white edge. */
  ice: ['#3e8fb0', '#7ec8e3', '#cdeefb', '#ffffff'],
  /** `NEUTRAL_PALETTE` dark and the road terrain's browns: earth bends stone, not the nation's green. */
  stone: ['#4a3a2c', '#7a5f3e', '#b39064', '#d8cbb0'],
  /** The wall terrain's detail and the stone terrain's edge, detail and fill. */
  metal: ['#4a443c', '#9a8c72', '#b3a488', '#d8cbb0'],
  /** `ELEMENT_PALETTES.air`: dark, base, light. */
  air: ['#9a8e72', '#e8dcc0', '#fdf6e3'],
  /** `ENEMY_PALETTE` clay and the sand terrain's cork. */
  flask: ['#4d241b', '#8a4b3c', '#b8705c', '#c7a87d'],
} as const;
export type Ramp = keyof typeof RAMPS;

/** Which ramp each generated sheet snaps to. */
export const SHEET_RAMP: Readonly<Record<string, Ramp>> = {
  'cel-flame': 'fire',
  'cel-fire-burst': 'fire',
  'cel-lightning': 'lightning',
  'cel-splash': 'water',
  'cel-ice': 'ice',
  'cel-healing': 'water',
  'cel-boulder': 'stone',
  'cel-earth-rise': 'stone',
  'cel-metal': 'metal',
  'cel-wind': 'air',
  'cel-cyclone': 'air',
  'cel-cushion': 'air',
  'cel-flask': 'flask',
};

/** Clips of one rigid object: every cel is the first (the thrown flask, docs/art/deserter-material-fx.md). */
export const RIGID: ReadonlySet<string> = new Set(['flask']);

/** A cel is a strand when fewer than this share of its solid pixels have four solid neighbours. */
export const THIN_CORE = 0.2;
/** The most a cel's generated values move back toward the painting's, in luma. */
export const MAX_SHIFT = 48;

/** An element cel's clear margin: the 192 px cels' 8 px at the 96 px master. */
export const CEL_MARGIN = (MARGIN * CEL_SIZE) / 192;

export interface LayoutCel {
  readonly name: string;
  readonly sheet: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface Layout {
  readonly cels: readonly LayoutCel[];
}

export interface G1Pins {
  /** SHA-256 of every source file, relative to `art/source/fx-g1/`. */
  readonly sources: Readonly<Record<string, string>>;
}

export const sha256 = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex');

/** Every file the build reads, relative to the source folder, in a fixed order. */
export function sourceFiles(dir = G1_DIR): string[] {
  const list = (sub: string) =>
    readdirSync(join(dir, sub))
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => `${sub}/${f}`);
  return ['layout.json', ...list('inputs'), ...list('generated')];
}

/** Problems with the pinned sources; empty when every file is present and unchanged. */
export function checkG1Sources(dir = G1_DIR, pinsPath = G1_PINS): string[] {
  if (!existsSync(pinsPath)) return [`${pinsPath} is missing`];
  const pins = (JSON.parse(readFileSync(pinsPath, 'utf8')) as G1Pins).sources;
  const files = sourceFiles(dir);
  const problems: string[] = [];
  for (const file of files) {
    const want = pins[file];
    if (!want) problems.push(`${file} has no pin`);
    else if (sha256(readFileSync(join(dir, file))) !== want) problems.push(`${file} has changed`);
  }
  for (const file of Object.keys(pins))
    if (!files.includes(file)) problems.push(`pinned ${file} is missing`);
  return problems;
}

/* ------------------------------------------------------------------ */
/* The clean-up                                                         */
/* ------------------------------------------------------------------ */

const rgb = (hex: string) => parseHex(hex);

/** Rec. 601 luma, in integers so every platform agrees. */
export const luma = (c: readonly number[]): number =>
  (299 * (c[0] ?? 0) + 587 * (c[1] ?? 0) + 114 * (c[2] ?? 0)) / 1000;

/**
 * The ramp tone (or the ink, darkest of all) whose luma band holds the
 * colour's: bands split halfway between neighbouring tones. By value, not by
 * hue, so a painted form keeps its light and shade when the hue moves onto
 * the palette; ties go to the darker tone.
 */
export function snap(
  colour: readonly number[],
  ramp: Ramp,
  shift = 0,
  /** How many of the darkest choices (the ink first) to leave out. */
  skipDark = 0,
): [number, number, number] {
  const tones = [rgb(INK), ...RAMPS[ramp].map(rgb)]
    .sort((a, b) => luma(a) - luma(b))
    .slice(skipDark);
  const value = luma(colour) + shift;
  for (let i = 0; i < tones.length - 1; i++) {
    const here = tones[i] ?? rgb(INK);
    const next = tones[i + 1] ?? here;
    if (value <= (luma(here) + luma(next)) / 2) return here;
  }
  return tones[tones.length - 1] ?? rgb(INK);
}

const crop = (image: Image, c: LayoutCel): Image => {
  const out = newImage(c.w, c.h);
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const from = ((c.y + y) * image.width + c.x + x) * 4;
      out.data.set(image.data.subarray(from, from + 4), (y * c.w + x) * 4);
    }
  return out;
};

/**
 * One cel, cleaned: `painted` is the input cel (soft, straight alpha),
 * `generated` the same rectangle of the accepted PixelLab sheet. `margin`
 * keeps the result that many px clear of every edge.
 */
export function cleanCel(painted: Image, generated: Image, ramp: Ramp, margin: number): Image {
  const { width: w, height: h } = painted;
  const alpha = (image: Image, x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : (image.data[(y * w + x) * 4 + 3] ?? 0);
  const near = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (alpha(painted, x + dx, y + dy) > 24) return true;
    return false;
  };
  const levels: number[] = [];
  for (let i = 3; i < painted.data.length; i += 4) {
    const a = painted.data[i] ?? 0;
    if (a > 24) levels.push(a);
  }
  levels.sort((a, b) => a - b);
  const median = levels[Math.floor(levels.length / 2)] ?? 255;
  const level = Math.max(32, Math.min(255, Math.round((median / 255) * 8) * 32));
  // A strand a pixel or two thick has no inside for the generator to redraw,
  // and it frays one: its shape comes from the painting alone.
  // Solid against the cel's own opacity, so a faded cel is not all edge.
  const solid = (x: number, y: number) => alpha(painted, x, y) >= Math.max(24, median / 2);
  let solids = 0;
  let cores = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (solid(x, y)) {
        solids += 1;
        if (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) cores += 1;
      }
  const thin = cores < solids * THIN_CORE;
  // A strand keeps every pixel that is at least half its row's or its
  // column's strongest, so a one-pixel line that straddles two rows of the
  // reduction stays one unbroken line.
  const rowPeak = Array.from({ length: h }, (_, y) =>
    Math.max(0, ...Array.from({ length: w }, (_, x) => alpha(painted, x, y))),
  );
  const columnPeak = Array.from({ length: w }, (_, x) =>
    Math.max(0, ...Array.from({ length: h }, (_, y) => alpha(painted, x, y))),
  );
  const strand = (x: number, y: number) => {
    const a = alpha(painted, x, y);
    return a >= 32 && (a * 2 >= (rowPeak[y] ?? 0) || a * 2 >= (columnPeak[x] ?? 0));
  };
  // The generator redraws the light key a little darker or lighter: its values
  // move back by the median difference where both are solid.
  const lumas = (image: Image) => {
    const values: number[] = [];
    for (let i = 0; i < w * h; i++)
      if ((painted.data[i * 4 + 3] ?? 0) >= median / 2 && (generated.data[i * 4 + 3] ?? 0) >= 128)
        values.push(luma([...image.data.subarray(i * 4, i * 4 + 3)]));
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  const before = lumas(painted);
  const after = lumas(generated);
  const shift =
    before === undefined || after === undefined
      ? 0
      : Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, before - after));
  const out = newImage(w, h);
  for (let y = margin; y < h - margin; y++)
    for (let x = margin; x < w - margin; x++) {
      const i = (y * w + x) * 4;
      const fromGenerated = !thin && alpha(generated, x, y) >= 128 && near(x, y);
      const fromPainted = !fromGenerated && (thin ? strand(x, y) : solid(x, y));
      if (!fromGenerated && !fromPainted) continue;
      const source = fromGenerated ? generated : painted;
      const colour = [source.data[i] ?? 0, source.data[i + 1] ?? 0, source.data[i + 2] ?? 0];
      // A strand is one or two pixels thick: ink or the deepest tone would turn it into a dark line.
      // Light carries no dark ink: an emissive cel's darkest choice is its element's darkest tone.
      const skip = thin ? 2 : EMISSIVE.has(ramp) ? 1 : 0;
      out.data.set([...snap(colour, ramp, fromGenerated ? shift : 0, skip), level], i);
    }
  if (!thin && !EMISSIVE.has(ramp)) interruptInk(out, ramp);
  dropOrphans(out);
  return out;
}

/**
 * Ramps of light: fire, lightning, water, ice and air glow or catch the light
 * and take no `#1b1410` at all, only their own tones (the darkest on the outer
 * edge). Stone, metal and the flask keep the ink.
 */
export const EMISSIVE: ReadonlySet<Ramp> = new Set<Ramp>([
  'fire',
  'lightning',
  'water',
  'ice',
  'air',
]);

/** Pieces this small, with nothing else touching them, are clean-up debris and go. */
export const ORPHAN = 2;

/** Clears every 8-connected piece of `ORPHAN` pixels or fewer (shared with the runtime resample). */
export function dropOrphans(cel: Image): void {
  dropOrphanPixels(cel.data, cel.width, cel.height, ORPHAN);
}

/** Specks this small take no outline: a droplet would be all ink. */
export const SPECK = 6;

/**
 * The contour gives way where the key light catches it (ADR 0085): an ink
 * pixel whose clear neighbours are all above or left of it, beside the
 * effect's own colour, becomes the ramp's darkest tone; so does every ink
 * pixel of a speck of `SPECK` pixels or fewer. Ink between two forms, with no
 * clear neighbour, stays.
 */
export function interruptInk(cel: Image, ramp: Ramp): void {
  const { width: w, height: h } = cel;
  const ink = rgb(INK);
  const dark = rgb(RAMPS[ramp][0]);
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && (cel.data[(y * w + x) * 4 + 3] ?? 0) > 0;
  const isInk = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return (
      opaque(x, y) &&
      cel.data[i] === ink[0] &&
      cel.data[i + 1] === ink[1] &&
      cel.data[i + 2] === ink[2]
    );
  };
  const recolour: number[] = [];
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !opaque(start % w, Math.floor(start / w))) continue;
    const component: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const at = stack.pop() ?? 0;
      component.push(at);
      const x = at % w;
      const y = Math.floor(at / w);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const n = (y + dy) * w + x + dx;
          if (opaque(x + dx, y + dy) && !seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        }
    }
    if (component.length <= SPECK) recolour.push(...component);
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!isInk(x, y)) continue;
      const clearLit = !opaque(x - 1, y) || !opaque(x, y - 1);
      const clearShade = !opaque(x + 1, y) || !opaque(x, y + 1);
      const besideColour = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx = 0, ny = 0]) => opaque(nx, ny) && !isInk(nx, ny));
      if (clearLit && !clearShade && besideColour) recolour.push(y * w + x);
    }
  for (const at of recolour) {
    if (!isInk(at % w, Math.floor(at / w))) continue;
    cel.data.set(dark, at * 4);
  }
}

function blit(target: Image, cel: Image, x0: number, y0: number): void {
  for (let y = 0; y < cel.height; y++)
    target.data.set(
      cel.data.subarray(y * cel.width * 4, (y + 1) * cel.width * 4),
      ((y0 + y) * target.width + x0) * 4,
    );
}

export interface G1Build {
  /** Each element cel sheet's pixels, by its public url. */
  readonly sheets: ReadonlyMap<string, Image>;
  /** Per cel: its colours (ink included) and how many of its pixels are ink. */
  readonly report: readonly { name: string; colours: number; ink: number; pixels: number }[];
}

export function buildG1(dir = G1_DIR): G1Build {
  const layout = JSON.parse(readFileSync(join(dir, 'layout.json'), 'utf8')) as Layout;
  const images = new Map<string, { input: Image; generated: Image }>();
  const sheet = (name: string) => {
    let got = images.get(name);
    if (!got) {
      got = {
        input: readPng(join(dir, 'inputs', `${name}.png`)),
        generated: readPng(join(dir, 'generated', `${name}.png`)),
      };
      images.set(name, got);
    }
    return got;
  };
  const report: { name: string; colours: number; ink: number; pixels: number }[] = [];
  const note = (name: string, cel: Image) => {
    const colours = new Set<string>();
    let ink = 0;
    let pixels = 0;
    const [ir, ig, ib] = rgb(INK);
    for (let i = 0; i < cel.data.length; i += 4) {
      if ((cel.data[i + 3] ?? 0) === 0) continue;
      pixels += 1;
      colours.add(`${cel.data[i]},${cel.data[i + 1]},${cel.data[i + 2]}`);
      if (cel.data[i] === ir && cel.data[i + 1] === ig && cel.data[i + 2] === ib) ink += 1;
    }
    report.push({ name, colours: colours.size, ink, pixels });
  };
  const clean = (c: LayoutCel, margin: number) => {
    const ramp = SHEET_RAMP[c.sheet];
    if (!ramp) throw new Error(`Sheet ${c.sheet} has no ramp.`);
    const { input, generated } = sheet(c.sheet);
    return cleanCel(crop(input, c), crop(generated, c), ramp, margin);
  };

  const sheets = new Map<string, Image>();
  const elementCels = new Map(layout.cels.map((c) => [c.name, c]));
  for (const def of FX_CEL_SHEETS) {
    const image = newImage(CEL_SIZE * CEL_FRAMES, CEL_SIZE * def.clips.length);
    def.clips.forEach((clip, row) => {
      for (let col = 0; col < CEL_FRAMES; col++) {
        // A rigid clip repeats its first drawing; spin supplies the motion.
        const name = `${clip}/${RIGID.has(clip) ? 0 : col}`;
        const c = elementCels.get(name);
        if (!c || c.w !== CEL_SIZE || c.h !== CEL_SIZE)
          throw new Error(`The layout has no ${CEL_SIZE} px cel "${name}".`);
        const cel = clean(c, CEL_MARGIN);
        note(name, cel);
        blit(image, cel, col * CEL_SIZE, row * CEL_SIZE);
      }
    });
    sheets.set(`public/${def.url}`, image);
  }
  return { sheets, report };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--pin')) {
    const sources = Object.fromEntries(
      sourceFiles().map((file) => [file, sha256(readFileSync(join(G1_DIR, file)))]),
    );
    writeFileSync(G1_PINS, `${JSON.stringify({ sources }, null, 2)}\n`);
    console.log(`Pinned ${Object.keys(sources).length} sources.`);
    return;
  }
  const problems = checkG1Sources();
  if (problems.length > 0)
    throw new Error(`The G1 effect sources do not match their pins:\n${problems.join('\n')}`);
  const build = buildG1(G1_DIR);
  const check = args.includes('--check');
  const mismatches: string[] = [];
  const outputs: [string, Uint8Array | string][] = [];
  for (const [url, image] of build.sheets) {
    const tmp = `${url}.g1.tmp`;
    writePng(tmp, image);
    outputs.push([url, new Uint8Array(readFileSync(tmp))]);
    (await import('node:fs')).rmSync(tmp);
  }
  for (const [path, bytes] of outputs) {
    if (check) {
      const have = existsSync(path) ? readFileSync(path) : Buffer.alloc(0);
      const want = typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes);
      if (!have.equals(want)) mismatches.push(path);
    } else writeFileSync(path, bytes);
  }
  if (check) {
    if (mismatches.length > 0)
      throw new Error(`Not what the sources make:\n${mismatches.join('\n')}`);
    console.log('The G1 effects are exactly what their sources make.');
    return;
  }
  const worst = build.report.reduce((m, r) => Math.max(m, r.colours), 0);
  console.log(
    JSON.stringify({
      sheets: [...build.sheets.keys()].map((url) => ({ url, bytes: readFileSync(url).length })),
      cels: build.report.length,
      mostColours: worst,
    }),
  );
}

if (process.argv[1]?.endsWith('fx-g1.ts')) await main();
