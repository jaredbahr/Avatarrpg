/**
 * The shared ground baker (ADR 0120): one baker for any board whose ground is data (`src/content/ground.ts`). A
 * board's config is its `GroundTerrain`; this paints it, in order:
 *
 * 1. the classes per pixel, each quilted from its own plain tile (warped Voronoi regions, each with its own offset,
 *    flip and turn, so no tile repeats as wallpaper) and drawn toward its own mean (calm ground, core G2);
 * 2. the edges: the hillside's pale cut face over the ground below it with its lit lip, foot line and short cast;
 *    the rim's earth face falling into the void; the verge where paving meets grass;
 * 3. the made shapes, exactly on the cell lines (made edges are clean, core G8): the dug canal with its kerb, its
 *    north wall's face and the shadow on the water; the raised terrace with its cut face and steps; the plinths
 *    that stand in for houses, walls and pieces until their set pieces do, each with a hard cast;
 * 4. the tracks, worn by their wear (bare in the core, fraying at a wide band's edge, a narrow trail crisp), most
 *    where they cross, ruts where carts go (core G3);
 * 5. the aprons (core G4), then the growth (core G6), which never lands on a track or in quiet ground;
 * 6. the region palette lock, last.
 *
 * Deterministic: hashes and value noise only. One art px is one world px; everything lands on the world-pixel grid.
 */
import { readdirSync } from 'node:fs';
import type { MapScene } from '../../../../src/core/types';
import {
  apronDepth,
  GROUND_CELL as CELL,
  GROUND_TILE as T,
  hash2,
  inBox,
  polylineDistance,
  polylineNearest,
  trackDepth,
  widthAt,
  trackHalf,
  vnoise,
  type GroundApron,
  type GroundTerrain,
  type MadeDef,
} from '../../../../src/content/ground';
import type { RgbaImage } from '../../../../src/render/shadow/hardShadowMask';
import type { TopDownObject } from '../../../../src/content/topdownLayout';
import type { SceneScenery } from '../../../../src/core/types';
import {
  ASSETS,
  CLASS,
  type Baked,
  type Placed,
  type TopDownBoard,
  type UprightData,
} from '../lib/board';
import {
  FLAT_KINDS,
  groundObject,
  seatFringe,
  shadowOptions,
  standingUprights,
} from '../lib/grounding';
import { cleanSprite } from '../lib/sprites';
import { lockImage, nearestIn } from '../lib/look';
import { at, blank, crop, draw, load, type Rgb } from '../lib/raster';
import { BA_DAN_PALETTE } from '../palettes/baDan';

/** The region palettes a ground spec may name. */
const PALETTES: Readonly<Record<string, readonly string[]>> = { ba_dan: BA_DAN_PALETTE };

type Px = [number, number, number];
const SHADE: Rgb = [0x32, 0x21, 0x25];
const VOID: Rgb = [0x1c, 0x17, 0x19];

/** A tile of a set by its corner key: `c0000.png`, or the one `NN_<key>.png`. */
export function tileFile(set: string, key: string): RgbaImage {
  const dir = `${ASSETS}/tiles/${set}`;
  const files = readdirSync(dir).filter((f) => f === `${key}.png` || f.endsWith(`_${key}.png`));
  if (files.length !== 1) throw new Error(`${dir} has ${files.length} tiles keyed ${key}`);
  return crop(load(`${dir}/${files[0] ?? ''}`), 0, 0, T, T);
}

function vstack(parts: readonly RgbaImage[]): RgbaImage {
  const out = blank(
    T,
    parts.reduce((h, p) => h + p.height, 0),
  );
  let y = 0;
  for (const p of parts) {
    draw(out, p, 0, y);
    y += p.height;
  }
  return out;
}

const px = (img: RgbaImage, x: number, y: number): Px => {
  const i =
    ((((y % img.height) + img.height) % img.height) * img.width +
      (((x % img.width) + img.width) % img.width)) *
    4;
  return [at(img.data, i), at(img.data, i + 1), at(img.data, i + 2)];
};

/**
 * A plain tile quilted over warped Voronoi regions about `R` px across, each with its own offset, flip and (unless
 * `turn` is off, for a tile with a direction such as the water's ripples) a quarter turn; the borders dither.
 */
function quilt(tile: RgbaImage, x: number, y: number, R: number, sk: number, turn = true): Px {
  const wx = x + vnoise(x, y, sk + 1, 22) * 16 + vnoise(x, y, sk + 2, 7) * 4,
    wy = y + vnoise(x, y, sk + 3, 22) * 16 + vnoise(x, y, sk + 4, 7) * 4;
  let best = 1e9,
    second = 1e9,
    bx = 0,
    by = 0,
    sx = 0,
    sy = 0;
  const cx = Math.floor(wx / R),
    cy = Math.floor(wy / R);
  for (let j = -1; j <= 1; j++)
    for (let k = -1; k <= 1; k++) {
      const gx = cx + j,
        gy = cy + k,
        qx = (gx + 0.15 + hash2(gx, gy, sk + 11) * 0.7) * R,
        qy = (gy + 0.15 + hash2(gx, gy, sk + 12) * 0.7) * R,
        d = (wx - qx) ** 2 + (wy - qy) ** 2;
      if (d < best) {
        second = best;
        sx = bx;
        sy = by;
        best = d;
        bx = gx;
        by = gy;
      } else if (d < second) {
        second = d;
        sx = gx;
        sy = gy;
      }
    }
  let gx = bx,
    gy = by;
  if (Math.sqrt(second) - Math.sqrt(best) < 3 && hash2(x, y, sk + 13) < 0.5) {
    gx = sx;
    gy = sy;
  }
  const f = Math.floor(hash2(gx, gy, sk + 15) * 8),
    ox = Math.floor(hash2(gx, gy, sk + 16) * T),
    oy = Math.floor(hash2(gx, gy, sk + 17) * T);
  let u = (x + ox) & (T - 1),
    v = (y + oy) & (T - 1);
  if (f & 1) u = T - 1 - u;
  if (turn && f & 2) v = T - 1 - v;
  if (turn && f & 4) [u, v] = [v, u];
  return px(tile, u, v);
}

const mixPx = (a: readonly number[], b: readonly number[], t: number): Px => [
  (a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t,
  (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t,
  (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t,
];

/** Grass blades for growth, dark to light (the village's own grass ramp). */
const BLADE: readonly Rgb[] = [
  [0x3d, 0x57, 0x3b],
  [0x47, 0x6b, 0x42],
  [0x56, 0x82, 0x4b],
  [0x77, 0x97, 0x59],
  [0xa3, 0xbd, 0x6a],
];
/** Worn ground: the pale limestone the square goes to, packed earth, and the earth a rut holds. */
const WORN: Rgb = [0xe6, 0xdf, 0xcd];
/** Loose limestone dust pressed by feet and wheels: darker and warmer than the loose dust. */
const PACKED_DUST: Rgb = [0xb6, 0xa5, 0x84];
/** Loose dust heaped at the fringes and against walls. */
const DRIFT: Rgb = [0xea, 0xe2, 0xcc];
const PACKED: Rgb = [0xb0, 0x9a, 0x78];
const EARTH: Rgb = [0x8a, 0x70, 0x52];
const RUT: Rgb = [0x8d, 0x7c, 0x66];
const MUD: Rgb = [0x4c, 0x3a, 0x2c];
const SOIL: readonly Rgb[] = [
  [0x4c, 0x34, 0x28],
  [0x5e, 0x3e, 0x2b],
  [0x79, 0x52, 0x35],
];
const KERB: readonly Rgb[] = [
  [0x6b, 0x62, 0x5c],
  [0x9a, 0x91, 0x84],
  [0xb8, 0xae, 0x9c],
  [0xcd, 0xc4, 0xb0],
];
/** A plinth's stone, dark to light: outline, shade, face, lit edge (the palette's stone ramp). */
const PLINTH: readonly Rgb[] = [
  [0x3d, 0x32, 0x30],
  [0x4b, 0x3f, 0x38],
  [0x5b, 0x4d, 0x43],
  [0x7c, 0x6c, 0x5c],
];
/** Dry hillside grass, dark to light. */
const DRY: readonly Rgb[] = [
  [0x5e, 0x5a, 0x3e],
  [0x7a, 0x74, 0x4c],
  [0x9a, 0x92, 0x62],
];
const CHIP: Rgb = [0xef, 0xea, 0xdd];
const CHIP_SHADE: Rgb = [0x9a, 0x8f, 0x80];
const GLINT: Rgb = [0xa9, 0xc6, 0xc4];

/** The game's terrain class for the shadows and the checks. */
function gameClass(terrain: string, reads: string): number {
  if (reads === 'void') return CLASS.void;
  if (reads === 'face') return CLASS.face;
  if (reads === 'water') return CLASS.W;
  return terrain === 'C'
    ? CLASS.C
    : terrain === 'D'
      ? CLASS.D
      : terrain === 'W'
        ? CLASS.W
        : CLASS.G;
}

export interface GroundBaked extends Baked {
  /** The class index per plate pixel (`GroundSpec.classes`). */
  readonly groundClasses: Uint8Array;
}

export function bakeGround(tr: GroundTerrain, opts: { hidePlinths?: boolean } = {}): GroundBaked {
  const spec = tr.spec;
  const PW = tr.plateW,
    PH = tr.plateH,
    N = PW * PH;
  const g = blank(PW, PH);
  const d = g.data;
  const S0 = spec.seed;
  const tiles = spec.classes.map((c) => tileFile(c.tile.set, c.tile.key));
  const cls = new Uint8Array(N);
  const madeIdx = new Int16Array(N).fill(-1);
  const madeDefs: MadeDef[] = [
    ...Object.values(spec.made ?? {}),
    ...(spec.structures ?? []).map((s) => s.made),
  ];
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const m = tr.madeAt(x, y);
      const i = y * PW + x;
      // a board whose set pieces stand on it draws no plinth: the sprites are the houses, walls and pieces
      if (m && !(opts.hidePlinths && m.def.draw === 'plinth')) {
        cls[i] = m.k;
        madeIdx[i] = madeDefs.indexOf(m.def);
      } else cls[i] = tr.blendAt(x, y);
    }
  const K = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= PW || y >= PH ? -1 : (cls[y * PW + x] ?? -1);
  const M = (x: number, y: number): MadeDef | undefined =>
    x < 0 || y < 0 || x >= PW || y >= PH ? undefined : madeDefs[madeIdx[y * PW + x] ?? -1];
  const reads = (k: number): string => spec.classes[k]?.reads ?? 'void';
  const get = (i: number): Px => [at(d, i * 4), at(d, i * 4 + 1), at(d, i * 4 + 2)];
  const set = (i: number, c: readonly number[]): void => {
    d[i * 4] = c[0] ?? 0;
    d[i * 4 + 1] = c[1] ?? 0;
    d[i * 4 + 2] = c[2] ?? 0;
    d[i * 4 + 3] = 255;
  };
  const mix = (i: number, c: readonly number[], a: number): void => set(i, mixPx(get(i), c, a));
  const voidK = tr.classIndex.get(spec.beyond) ?? 0;
  const hillK = spec.hill ? (tr.classIndex.get(spec.hill.class) ?? -1) : -1;
  const isGround = (k: number): boolean => reads(k) === 'ground';
  // where a made shape or its kerb lies: the natural-edge check leaves these out, as straight is allowed there
  const made = new Uint8Array(N);

  /* 1. the classes, quilted and calmed ---------------------------------------------------------- */
  const sums = spec.classes.map(() => [0, 0, 0, 0]);
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x,
        k = cls[i] ?? 0;
      const tile = tiles[k];
      if (!tile || k === voidK) {
        set(i, VOID);
        continue;
      }
      const water = reads(k) === 'water';
      const c = quilt(tile, x, y, water ? 96 : 60, S0 + 31 + k * 13, !water);
      set(i, c);
      const s = sums[k];
      if (s) {
        s[0] = (s[0] ?? 0) + c[0];
        s[1] = (s[1] ?? 0) + c[1];
        s[2] = (s[2] ?? 0) + c[2];
        s[3] = (s[3] ?? 0) + 1;
      }
    }
  const means = sums.map((s) => [0, 1, 2].map((j) => (s[j] ?? 0) / Math.max(1, s[3] ?? 1)));
  for (let i = 0; i < N; i++) {
    const k = cls[i] ?? 0,
      def = spec.classes[k];
    if (!def || k === voidK) continue;
    const m = means[k] ?? [0, 0, 0];
    const calm = def.calm ?? 1,
      grade = def.grade ?? [1, 1, 1];
    // no drift: a plain field of one ground is one calm field; variation gathers at edges and feet (owner, 2026-11-18)
    const drift = 1;
    const c = get(i);
    set(
      i,
      [0, 1, 2].map((j) =>
        Math.max(
          0,
          Math.min(
            255,
            ((m[j] ?? 0) + ((c[j] ?? 0) - (m[j] ?? 0)) * calm) * (grade[j] ?? 1) * drift,
          ),
        ),
      ),
    );
  }

  /* 2. edges: the hill's face, the rim's face, the verge ------------------------------------------ */
  const faceStrip = vstack([
    crop(tileFile('q_terrace32', 'UUTT'), 0, 14, T, 18),
    crop(tileFile('q_terrace32', 'TTLL'), 0, 0, T, 24),
  ]);
  const rimStrip = vstack([
    crop(tileFile('cliff32', 'UUTT'), 0, 17, T, 15),
    crop(tileFile('cliff32', 'TTLL'), 0, 0, T, 20),
  ]);
  const faceH = (x: number): number =>
    Math.max(
      6,
      Math.round(
        (spec.hill?.height ?? 0) + vnoise(x, 0, S0 + 101, 37) * 5 + vnoise(x, 0, S0 + 102, 9) * 2,
      ),
    );
  // the hill: each column's pixels within its face height of the ground below are the cut face
  const face = new Uint8Array(N);
  if (hillK >= 0)
    for (let x = 0; x < PW; x++) {
      const H = faceH(x);
      for (let y = 0; y < PH; y++) {
        if (K(x, y) !== hillK) continue;
        let k = 1;
        while (k <= H && K(x, y + k) === hillK) k++;
        if (k > H) continue;
        // k px above the ground: the face's row counts down from its lit lip (1) to its foot (H)
        const row = H - k + 1;
        face[y * PW + x] = row;
        const strip = px(faceStrip, x, Math.max(0, faceStrip.height - 1 - (H - row)));
        const sh = 1 - (0.2 * row) / H;
        let c: Px = [strip[0] * sh, strip[1] * sh, strip[2] * sh];
        if (row === 1) c = c.map((v) => Math.min(255, v * 1.18 + 12)) as Px;
        if (row === H) c = mixPx(c, SHADE, 0.5);
        set(y * PW + x, c);
      }
    }
  // the hillside above the face: scree with sparse dry grass, and pale outcrops of its own stone, calm
  if (hillK >= 0) {
    const rock = tileFile('q_rock_var', 'clean_12');
    const top = (x: number, y: number): boolean => K(x, y) === hillK && !face[y * PW + x];
    // sparse dry grass: small olive tufts, a few to a cell
    for (let y = 2; y < PH; y++)
      for (let x = 1; x < PW - 1; x++) {
        if (!top(x, y) || hash2(x, y, S0 + 121) > 0.005) continue;
        const len = 2 + Math.floor(hash2(x, y, S0 + 122) * 2);
        for (let b = 0; b < 3; b++)
          for (let st = 0; st < len; st++) {
            const X = x + Math.round((b - 1) * st * 0.5),
              Y = y - st;
            if (top(X, Y)) set(Y * PW + X, DRY[st >= len - 1 ? 2 : st ? 1 : 0] ?? SHADE);
          }
      }
    // outcrops: low pale ellipses of rock, lit on the upper left, shaded and casting to the lower right
    const per = (spec.hill?.outcrops ?? 0) / 100;
    for (let cy = -4; cy < tr.gh + 4; cy++)
      for (let cx = -3; cx < tr.gw + 3; cx++) {
        if (hash2(cx, cy, S0 + 131) > per) continue;
        const ox = tr.grid.x + (cx + 0.2 + hash2(cx, cy, S0 + 132) * 0.6) * CELL,
          oy = tr.grid.y + (cy + 0.2 + hash2(cx, cy, S0 + 133) * 0.6) * CELL;
        const rx = 9 + hash2(cx, cy, S0 + 134) * 13,
          ry = 5 + hash2(cx, cy, S0 + 135) * 6;
        const inside = (x: number, y: number): boolean =>
          Math.hypot((x - ox) / rx, (y - oy) / ry) + vnoise(x, y, S0 + 136, 4) * 0.18 < 1;
        // only on the hill's top, clear of the face by a few px
        let clear = true;
        for (let y = Math.floor(oy - ry - 2); y <= oy + ry + 8 && clear; y++)
          for (let x = Math.floor(ox - rx - 2); x <= ox + rx + 6; x++)
            if (!top(x, y)) {
              clear = false;
              break;
            }
        if (!clear) continue;
        for (let y = Math.floor(oy - ry - 1); y <= oy + ry + 4; y++)
          for (let x = Math.floor(ox - rx - 1); x <= ox + rx + 4; x++) {
            const i = y * PW + x;
            if (inside(x, y)) {
              const c = px(rock, x, y);
              const lit = !inside(x - 1, y - 1),
                dark = !inside(x + 1, y + 1);
              let o: Px = mixPx([c[0] * 1.1, c[1] * 1.08, c[2] * 1.0], [0xcd, 0xc4, 0xb0], 0.35);
              if (lit) o = mixPx(o, [0xe6, 0xdd, 0xc8], 0.45);
              else if (dark) o = mixPx(o, SHADE, 0.45);
              set(i, o);
            } else if (inside(x - 2, y - 2) || inside(x - 1, y - 3)) mix(i, SHADE, 0.32);
          }
      }
  }
  // the face's cast: a short hard band on the ground below and to the right of its foot
  if (hillK >= 0)
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const k = K(x, y);
        if (k === hillK || !isGround(k) || M(x, y)) continue;
        for (let s = 1; s <= 5; s++) {
          if (K(x - Math.floor(s / 2), y - s) === hillK) {
            mix(y * PW + x, SHADE, s <= 2 ? 0.5 : 0.36);
            break;
          }
        }
      }
  // the rim: the earth face hangs under the ground into the void, then the void deepens
  for (let x = 0; x < PW; x++) {
    let run = 99;
    for (let y = 0; y < PH; y++) {
      const i = y * PW + x,
        k = K(x, y);
      if (k !== voidK) {
        run = reads(k) === 'water' ? 99 : 0;
        continue;
      }
      run++;
      const len = 14 + Math.round((vnoise(x, 0, S0 + 91, 11) + 1) * 4);
      if (run <= len) {
        const c = px(rimStrip, x, Math.min(rimStrip.height - 1, run - 1));
        const f = 1 - (run / len) * 0.55;
        set(i, mixPx([c[0] * f, c[1] * f, c[2] * f], VOID, run === len ? 0.4 : 0));
      } else if (run > len + 24) set(i, [0x16, 0x11, 0x13]);
    }
  }
  // the verge: paving meeting grass takes a darker joint, the grass creeping over its edge (core G8)
  {
    const paving = (k: number): boolean =>
      spec.classes[k]?.terrain === 'C' && isGround(k) && k !== hillK;
    const soft = (k: number): boolean => spec.classes[k]?.terrain === 'G' && isGround(k);
    const darken: [number, number][] = [];
    for (let y = 1; y < PH - 1; y++)
      for (let x = 1; x < PW - 1; x++) {
        const i = y * PW + x;
        if (!paving(cls[i] ?? 0) || madeIdx[i] !== -1) continue;
        let near = 0;
        for (const [dx, dy, n] of [
          [-1, 0, 1],
          [1, 0, 1],
          [0, -1, 1],
          [0, 1, 1],
          [-2, 0, 2],
          [2, 0, 2],
          [0, -2, 2],
          [0, 2, 2],
        ] as const)
          if (soft(K(x + dx, y + dy))) {
            near = n;
            break;
          }
        if (near) darken.push([i, near === 1 ? 0.3 : 0.14]);
      }
    for (const [i, a] of darken) mix(i, SHADE, a);
  }

  /* 3. made shapes --------------------------------------------------------------------------------- */
  const madeKind = (x: number, y: number): MadeDef['draw'] | undefined => M(x, y)?.draw;
  const isWater = (x: number, y: number): boolean => madeKind(x, y) === 'water';
  // the dug canal: its north wall's face and the shade on the water under it; ripples kept to their rows
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x;
      if (!isWater(x, y)) continue;
      made[i] = 1;
      let up = 0;
      while (up < 8 && isWater(x, y - up - 1)) up++;
      if (up < 3) {
        // the wall face down from the north kerb: cut stone, in shade
        set(
          i,
          up === 0
            ? (KERB[1] ?? SHADE)
            : up === 1
              ? (KERB[0] ?? SHADE)
              : mixPx(KERB[0] ?? SHADE, SHADE, 0.35),
        );
        if (up === 2 && hash2(Math.floor((x + 5) / 13), y, S0 + 141) < 0.3)
          set(i, mixPx(KERB[0] ?? SHADE, SHADE, 0.6));
        continue;
      }
      if (up < 7) mix(i, SHADE, up < 5 ? 0.42 : 0.24);
      // where the canal runs off the rim, the water breaks pale over the lip
      if (K(x + 1, y) === voidK || K(x + 2, y) === voidK) {
        set(i, hash2(x, y, S0 + 145) < 0.5 ? GLINT : mixPx(get(i), GLINT, 0.5));
        continue;
      }
      // the damp line where water meets the south kerb
      if (!isWater(x, y + 1)) mix(i, SHADE, 0.3);
    }
  // the kerb: cut limestone blocks on the banks, a lit edge on the land side, a dark joint at the water
  const kerbDef = madeDefs.find((m) => m.draw === 'water' && m.kerb);
  if (kerbDef?.kerb) {
    const r = kerbDef.kerb;
    const waterDist = (x: number, y: number): number => {
      let best = 99;
      for (let oy = -r; oy <= r; oy++)
        for (let ox = -r; ox <= r; ox++) {
          if (!isWater(x + ox, y + oy)) continue;
          best = Math.min(best, Math.max(Math.abs(ox), Math.abs(oy)));
        }
      return best;
    };
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const i = y * PW + x;
        if ((madeIdx[i] !== -1 && M(x, y)?.draw !== 'deck') || cls[i] === voidK) continue;
        const wd = waterDist(x, y);
        if (wd > r) continue;
        made[i] = 1;
        // block joints along the bank: a joint every 11-19 px, set by the column (or row, on a bank that runs north)
        const horiz = isWater(x, y + wd) || isWater(x, y - wd);
        const a = horiz ? x : y;
        const block = Math.floor((a + hash2(horiz ? y >> 3 : x >> 3, 0, S0 + 151) * 15) / 15);
        const joint =
          Math.floor((a + 1 + hash2(horiz ? y >> 3 : x >> 3, 0, S0 + 151) * 15) / 15) !== block;
        const tint = (hash2(block, horiz ? y >> 3 : x >> 3, S0 + 152) - 0.5) * 12;
        let c: readonly number[] = KERB[2] ?? SHADE;
        if (wd === r)
          c = KERB[1] ?? SHADE; // the joint to the land
        else if (wd === 1)
          c = KERB[1] ?? SHADE; // the arris over the water
        else if (wd === r - 1) c = KERB[3] ?? SHADE; // the lit edge
        if (joint && wd > 1 && wd < r) c = KERB[1] ?? SHADE;
        set(
          i,
          c.map((v) => v + tint),
        );
      }
  }
  // plinths, the terrace and its steps, exactly on the cell lines
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x,
        m = M(x, y);
      if (!m || m.draw === 'water') continue;
      made[i] = 1;
      if (m.draw === 'deck') continue;
      const same = (dx: number, dy: number): boolean => {
        const o = M(x + dx, y + dy);
        return o === m || (m.draw !== 'plinth' && (o?.draw === 'terrace' || o?.draw === 'steps'));
      };
      if (m.draw === 'plinth') {
        // a flat slab in the region's stone: a darker outline in its own material, its top-left edge lit, its
        // lower-right edge in shade, a few worn specks on its face
        if (!same(-1, 0) || !same(0, -1) || !same(1, 0) || !same(0, 1)) set(i, PLINTH[0] ?? SHADE);
        else if (!same(-1, -1) || !same(-2, 0) || !same(0, -2)) set(i, PLINTH[3] ?? SHADE);
        else if (!same(2, 0) || !same(0, 2)) set(i, PLINTH[1] ?? SHADE);
        else set(i, hash2(x, y, S0 + 161) < 0.04 ? (PLINTH[1] ?? SHADE) : (PLINTH[2] ?? SHADE));
        continue;
      }
      if (m.draw === 'steps') {
        // treads down to the south: each 8 px, its nose lit, its riser in shade
        const ly = (y - tr.grid.y) % CELL;
        const r = ly % 8;
        if (r === 0) mix(i, [0xe6, 0xdd, 0xc8], 0.35);
        else if (r >= 6) mix(i, SHADE, r === 7 ? 0.42 : 0.26);
        if (!same(-1, 0)) mix(i, [0xe6, 0xdd, 0xc8], 0.25);
        if (!same(1, 0) || !same(2, 0)) mix(i, SHADE, 0.35);
        continue;
      }
      // the terrace: lit along its west side, dark on its east side, and its cut face where it drops
      const f = tr.terraceFace(x, y);
      if (f) {
        const H = m.face ?? 1;
        const strip = px(faceStrip, x, faceStrip.height - 1 - (H - f));
        let c: Px = [strip[0] * 0.92, strip[1] * 0.92, strip[2] * 0.92];
        if (f === 1) c = c.map((v) => Math.min(255, v * 1.2 + 14)) as Px;
        if (f === H) c = mixPx(c, SHADE, 0.5);
        set(i, c);
        continue;
      }
      if (!same(1, 0)) mix(i, SHADE, 0.45);
      else if (!same(2, 0)) mix(i, SHADE, 0.22);
      else if (!same(-1, 0)) mix(i, [0xe6, 0xdd, 0xc8], 0.3);
      else if (!same(0, -1)) mix(i, SHADE, 0.3);
    }
  // the casts of the made shapes that stand proud: a short hard band to the lower right (light from the upper left)
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x;
      if (madeIdx[i] !== -1 || !isGround(cls[i] ?? 0)) continue;
      for (let s = 1; s <= 4; s++) {
        const o = M(x - Math.ceil(s * 0.75), y - s) ?? (s <= 2 ? M(x - s, y) : undefined);
        if (o && o.draw !== 'water' && o.draw !== 'steps' && o.draw !== 'deck') {
          mix(i, SHADE, o.draw === 'terrace' ? 0.42 : s <= 2 ? 0.5 : 0.38);
          break;
        }
      }
    }

  const clean: RgbaImage = { width: PW, height: PH, data: new Uint8ClampedArray(d) };

  /* 4. tracks ------------------------------------------------------------------------------------------ */
  const cellX = (x: number): number => (x - tr.grid.x) / CELL,
    cellY = (y: number): number => (y - tr.grid.y) / CELL;
  const quietAt = (x: number, y: number): boolean =>
    (spec.quiet ?? []).some((b) => inBox(b, cellX(x), cellY(y)));
  // each pixel's wear (0..1) and how many tracks it lies on
  const wear = new Float32Array(N);
  const onTrack = new Uint8Array(N);
  const rut = new Uint8Array(N);
  const mid = new Uint8Array(N);
  spec.tracks.forEach((t, ti) => {
    const half = trackHalf(t) * CELL;
    // a narrow light trail is a crisp line narrower than the cells it keeps clear; a worn band is nearly its width
    const k = t.wear === 3 ? 0.95 : t.wear === 2 ? 0.8 : 0.42;
    const strength = t.wear === 3 ? 1 : t.wear === 2 ? 0.66 : 0.5;
    const pts =
      'line' in t
        ? t.line
        : 'disk' in t
          ? [t.disk]
          : [
              [t.ring[0] - t.r, t.ring[1] - t.r],
              [t.ring[0] + t.r, t.ring[1] + t.r],
            ];
    const xs = pts.map((p) => tr.grid.x + (p[0] ?? 0) * CELL),
      ys = pts.map((p) => tr.grid.y + (p[1] ?? 0) * CELL);
    const pad = half + 12;
    for (
      let y = Math.max(0, Math.floor(Math.min(...ys) - pad));
      y < Math.min(PH, Math.ceil(Math.max(...ys) + pad));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(Math.min(...xs) - pad));
        x < Math.min(PW, Math.ceil(Math.max(...xs) + pad));
        x++
      ) {
        const i = y * PW + x;
        // the band's edge wanders on slow noise; a wide worn band also frays per pixel
        const depth =
          trackDepth(t, cellX(x), cellY(y)) * CELL -
          half * (1 - k) +
          vnoise(x, y, S0 + 201 + ti, 14) * (t.wear === 1 ? 1.5 : 4 + half / 10) +
          vnoise(x, y, S0 + 204 + ti, 37) * (t.wear === 1 ? 0 : half / 6) +
          vnoise(x, y, S0 + 202 + ti, 5) * (t.wear === 1 ? 0.6 : 1.5);
        const frayW = t.wear === 1 ? 1 : t.wear === 2 ? 6 : 9 + half / 8;
        let w = depth >= frayW ? 1 : depth > 0 ? depth / frayW : 0;
        if (w > 0 && w < 1 && t.wear > 1)
          w = hash2(x, y, S0 + 203 + ti) < w ? Math.max(w, 0.55) : 0;
        if (w <= 0) continue;
        onTrack[i] = Math.min(9, (onTrack[i] ?? 0) + 1);
        wear[i] = Math.min(
          1.15,
          Math.max(wear[i] ?? 0, w * strength) + (onTrack[i] > 1 ? 0.12 : 0),
        );
        if (t.ruts && 'line' in t) {
          // only alongside the line, never round its ends
          const near = polylineNearest(cellX(x), cellY(y), t.line);
          const endSeg = near.seg === t.line.length - 2;
          if ((near.seg === 0 && near.t <= 0) || (endSeg && near.t >= 1)) continue;
          const dist = near.d * CELL;
          // the ruts thin out where the line ends inside the board (its last point); its first may leave the map
          const fade = (1 - near.along) * (t.line.length - 1);
          if (fade < 0.6 && hash2(x >> 1, y >> 1, S0 + 215) > fade / 0.6) continue;
          const gauge = Math.min(12, (widthAt(t, cellX(x), cellY(y)) * CELL) / 2 - 8);
          // two wheel ruts a cart's track apart, unbroken, and the hooves' worn middle between them
          const off = gauge + vnoise(x, y, S0 + 211, 31) * 1.5;
          if (Math.abs(dist - off) < 2.2 + vnoise(x, y, S0 + 212, 9) * 0.6) rut[i] = 1;
          if (dist < 6 + vnoise(x, y, S0 + 214, 13) * 2) mid[i] = 1;
        }
      }
  });
  for (let i = 0; i < N; i++) {
    const w = wear[i] ?? 0;
    if (w <= 0 || madeIdx[i] !== -1) continue;
    const k = cls[i] ?? 0;
    if (!isGround(k) || face[i]) continue;
    const def = spec.classes[k];
    const wears =
      def?.wears ?? (def?.terrain === 'D' ? 'packs' : def?.terrain === 'C' ? 'lifts' : 'bares');
    const x = i % PW,
      y = (i - x) / PW;
    if (wears === 'packs') {
      // loose ground pressed: its speckle smoothed toward its own mean, a step darker and warmer
      const m = means[k] ?? [0, 0, 0];
      const g0 = def?.grade ?? [1, 1, 1];
      const smooth = [0, 1, 2].map((j) => (m[j] ?? 0) * (g0[j] ?? 1));
      const ww = Math.min(1, w);
      mix(i, smooth, 0.75 * ww);
      mix(i, PACKED_DUST, 0.6 * ww);
      if (mid[i]) mix(i, PACKED_DUST, 0.25);
      if (rut[i]) set(i, mixPx(get(i), RUT, 0.55));
    } else if (wears === 'lifts') {
      mix(i, WORN, Math.min(0.32, 0.22 * w));
      if (rut[i]) mix(i, RUT, 0.26);
    } else {
      // grass trodden: bare limestone earth in a worn core, trodden toward it where it thins
      const bare = mixPx(PACKED, WORN, 0.45);
      if (w >= 0.9) set(i, mixPx(bare, get(i), hash2(x, y, S0 + 221) < 0.12 ? 0.35 : 0.08));
      else mix(i, bare, 0.25 + 0.6 * w);
    }
  }

  /* 4b. drifts: loose ground heaped at its edges and against walls, where no wheel or foot packs it --------- */
  {
    const drifts = (k: number): boolean => spec.classes[k]?.drifts === true;
    // a two-pass chamfer distance (px) from anything that is not drifting ground
    const dist = new Float32Array(N).fill(99);
    const packs = (k: number): boolean => {
      const def = spec.classes[k];
      return (def?.wears ?? (def?.terrain === 'D' ? 'packs' : '')) === 'packs';
    };
    for (let i = 0; i < N; i++)
      if ((!drifts(cls[i] ?? 0) && !packs(cls[i] ?? 0)) || madeIdx[i] !== -1) dist[i] = 0;
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const i = y * PW + x;
        let v = dist[i] ?? 0;
        if (x > 0) v = Math.min(v, (dist[i - 1] ?? 0) + 1);
        if (y > 0) v = Math.min(v, (dist[i - PW] ?? 0) + 1);
        if (x > 0 && y > 0) v = Math.min(v, (dist[i - PW - 1] ?? 0) + 1.4);
        if (x < PW - 1 && y > 0) v = Math.min(v, (dist[i - PW + 1] ?? 0) + 1.4);
        dist[i] = v;
      }
    for (let y = PH - 1; y >= 0; y--)
      for (let x = PW - 1; x >= 0; x--) {
        const i = y * PW + x;
        let v = dist[i] ?? 0;
        if (x < PW - 1) v = Math.min(v, (dist[i + 1] ?? 0) + 1);
        if (y < PH - 1) v = Math.min(v, (dist[i + PW] ?? 0) + 1);
        if (x < PW - 1 && y < PH - 1) v = Math.min(v, (dist[i + PW + 1] ?? 0) + 1.4);
        if (x > 0 && y < PH - 1) v = Math.min(v, (dist[i + PW - 1] ?? 0) + 1.4);
        dist[i] = v;
      }
    for (let i = 0; i < N; i++) {
      const dd = dist[i] ?? 0;
      if (dd <= 0 || dd > 16) continue;
      const x = i % PW,
        y = (i - x) / PW;
      const reach = 9 + vnoise(x, y, S0 + 231, 17) * 5 + vnoise(x, y, S0 + 232, 5) * 1.5;
      if (dd > reach || (wear[i] ?? 0) > 0.5 || !drifts(cls[i] ?? 0)) continue;
      mix(i, DRIFT, dd > reach - 2.5 ? 0.22 : 0.4);
    }
  }

  /* 5. aprons ------------------------------------------------------------------------------------------ */
  const nearWater = (x: number, y: number, r: number): number => {
    for (let s = 1; s <= r; s++)
      for (const [ox, oy] of [
        [s, 0],
        [-s, 0],
        [0, s],
        [0, -s],
      ] as const)
        if (reads(K(x + ox, y + oy)) === 'water') return s;
    return 0;
  };
  spec.aprons.forEach((a: GroundApron, ai) => {
    const sk = S0 + 300 + ai * 17;
    const box =
      'at' in a
        ? [a.at[0] - a.r - 0.3, a.at[1] - a.r - 0.3, a.at[0] + a.r + 0.3, a.at[1] + a.r + 0.3]
        : [a.rect[0] - 0.3, a.rect[1] - 0.3, a.rect[2] + 1.3, a.rect[3] + 1.3];
    const x0 = Math.max(0, Math.floor(tr.grid.x + (box[0] ?? 0) * CELL)),
      x1 = Math.min(PW - 1, Math.ceil(tr.grid.x + (box[2] ?? 0) * CELL)),
      y0 = Math.max(0, Math.floor(tr.grid.y + (box[1] ?? 0) * CELL)),
      y1 = Math.min(PH - 1, Math.ceil(tr.grid.y + (box[3] ?? 0) * CELL));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * PW + x,
          k = cls[i] ?? 0;
        const groundHere = isGround(k) && !face[i];
        // how far inside, in px: a wobbled edge, cut per pixel
        const depthPx =
          apronDepth(a, cellX(x), cellY(y)) * CELL +
          vnoise(x, y, sk, 9) * 4 +
          vnoise(x, y, sk + 1, 3) * 1.5;
        if (quietAt(x, y)) continue;
        switch (a.kind) {
          case 'packed': {
            if (!groundHere || madeIdx[i] !== -1 || depthPx <= 0) break;
            if (depthPx < 6 && hash2(x, y, sk + 2) > depthPx / 6) break;
            // on grass, packed earth; on the dust, only a little warmer and smoother where feet press it
            const grass = spec.classes[k]?.terrain === 'G';
            if (grass) mix(i, mixPx(PACKED, EARTH, 0.3), 0.58);
            else mix(i, mixPx(PACKED, WORN, 0.5), 0.22);
            break;
          }
          case 'wet': {
            // a damp ring hugging what stands there: darkest at its foot, thinning out, a glint or two
            if (!groundHere || madeIdx[i] !== -1 || depthPx <= 0) break;
            if (depthPx < 7 && hash2(x, y, sk + 2) > depthPx / 7) break;
            const c = get(i);
            const strong = depthPx > ('at' in a ? a.r * CELL * 0.45 : 12);
            const glint = strong && hash2(x, y, sk + 3) > 0.996;
            const f = strong ? 0.7 : 0.84;
            set(i, glint ? GLINT : [c[0] * f, c[1] * f, c[2] * f]);
            break;
          }
          case 'damp': {
            // damp where the water is drawn: the kerb darkest, the bank behind it in a ragged fringe
            const w = nearWater(x, y, 16);
            if (!w || reads(k) === 'water') break;
            const reach =
              6 + 7 * Math.max(0, Math.min(1, depthPx / 20)) + vnoise(x, y, sk + 3, 8) * 4;
            if (w > reach || (w > reach - 3 && hash2(x, y, sk + 2) > 0.5)) break;
            mix(i, SHADE, w <= 2 ? 0.34 : w <= 6 ? 0.22 : 0.13);
            break;
          }
          case 'mud': {
            if (!groundHere || depthPx <= 0) break;
            // a wet fringe in two tones, darkest at the water, its edge on slow noise
            const w = nearWater(x, y, 16);
            const t =
              Math.min(1, depthPx / 18) * (w ? 1 - w / 22 : 0.45) + vnoise(x, y, sk + 3, 7) * 0.12;
            if (t <= 0.18) break;
            mix(i, MUD, t > 0.55 ? 0.5 : 0.3);
            break;
          }
          case 'chips': {
            if (!groundHere || madeIdx[i] !== -1 || depthPx <= 0) break;
            if (depthPx < 8 && hash2(x, y, sk + 2) > depthPx / 8) break;
            mix(i, WORN, 0.4);
            const h = hash2(x, y, sk + 3);
            if (h < 0.012) {
              set(i, CHIP);
              if (x + 1 < PW) mix(i + 1, CHIP_SHADE, 0.5);
              if (y + 1 < PH) mix(i + PW, CHIP_SHADE, 0.55);
            }
            break;
          }
          case 'sward': {
            // grass surviving where nobody walks: thick in the corner, thinning to tufts toward the trodden ground
            if (!groundHere || madeIdx[i] !== -1 || (onTrack[i] ?? 0) > 0 || depthPx <= 0) break;
            const t = Math.min(1, depthPx / 22) + vnoise(x, y, sk + 3, 9) * 0.35;
            if (t < 0.35 || hash2(x, y, sk + 2) > t * 1.3) break;
            const g = tiles[tr.classIndex.get('grass') ?? -1];
            if (!g) break;
            const gm = means[tr.classIndex.get('grass') ?? 0] ?? [0, 0, 0];
            const gc = quilt(g, x, y, 60, S0 + 31 + (tr.classIndex.get('grass') ?? 0) * 13);
            const gdef = spec.classes[tr.classIndex.get('grass') ?? 0];
            const calm = gdef?.calm ?? 1;
            set(
              i,
              [0, 1, 2].map(
                (j) =>
                  ((gm[j] ?? 0) + ((gc[j] ?? 0) - (gm[j] ?? 0)) * calm) * (gdef?.grade?.[j] ?? 1),
              ),
            );
            break;
          }
          case 'treads': {
            // steps cut down the bank into the water: each tread's nose lit, its riser in shade, the last one wet
            if (!('rect' in a) || reads(k) !== 'water') break;
            const lx = x - (tr.grid.x + a.rect[0] * CELL),
              ly = y - (tr.grid.y + a.rect[1] * CELL);
            const w = (a.rect[2] - a.rect[0] + 1) * CELL;
            if (lx < 0 || lx >= w || ly < 0 || ly >= 16) break;
            const r = ly % 5;
            const step = Math.floor(ly / 5);
            let c: readonly number[] = KERB[2] ?? SHADE;
            if (r === 0) c = KERB[3] ?? SHADE;
            else if (r === 4) c = KERB[0] ?? SHADE;
            if (lx === 0 || lx === w - 1) c = KERB[0] ?? SHADE;
            set(i, step >= 2 ? mixPx(c, [0x37, 0x5d, 0x69], 0.45) : c);
            break;
          }
          case 'tilled': {
            // dug by hand in straight strips: a clean inset rectangle, no wobble; the side gate's path runs through
            if (!('rect' in a) || !groundHere || madeIdx[i] !== -1) break;
            const lx = x - (tr.grid.x + a.rect[0] * CELL),
              ly = y - (tr.grid.y + a.rect[1] * CELL);
            const w = (a.rect[2] - a.rect[0] + 1) * CELL,
              h = (a.rect[3] - a.rect[1] + 1) * CELL;
            const inset = 5 + Math.round(vnoise(x, y, sk + 4, 7) * 1.2);
            if (lx < inset || ly < inset || lx >= w - inset || ly >= h - inset) break;
            if ((onTrack[i] ?? 0) > 0) break;
            const strip = Math.floor((ly - inset) / 18),
              r = (ly - inset) % 18;
            // each household's strip its own shade of soil, ridges a step lighter, and a trodden edge between strips
            const tone = r % 6 === 1 ? SOIL[2] : SOIL[1];
            const tint = (hash2(strip, 0, sk + 5) - 0.5) * 10;
            if (r >= 16) set(i, SOIL[0] ?? MUD);
            else
              set(
                i,
                (tone ?? MUD).map((v) => v + tint),
              );
            break;
          }
        }
      }
    // hoofprints: where carts water their animals, small marks out into the road
    if (a.kind === 'wet' && 'at' in a) {
      for (let n = 0; n < 22; n++) {
        const ang = Math.PI * (0.15 + hash2(n, 1, sk + 7) * 0.7),
          dist = (a.r * 0.7 + hash2(n, 2, sk + 7) * 1.4) * CELL;
        const hx = Math.round(tr.grid.x + a.at[0] * CELL + Math.cos(ang) * dist * 1.4),
          hy = Math.round(tr.grid.y + a.at[1] * CELL + Math.sin(ang) * dist);
        for (const [ox, oy, s] of [
          [0, 0, 0.42],
          [1, 0, 0.3],
          [0, 1, 0.3],
          [1, 1, 0.42],
        ] as const) {
          const X = hx + ox,
            Y = hy + oy;
          if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue;
          const j = Y * PW + X;
          if (!isGround(cls[j] ?? 0) || madeIdx[j] !== -1 || quietAt(X, Y)) continue;
          mix(j, SHADE, s);
        }
      }
    }
  });

  /* 5b. growth: tufts where nobody walks, never on a track ---------------------------------------------- */
  spec.growth.forEach((gr, gi) => {
    const sk = S0 + 500 + gi * 7;
    const pts = 'line' in gr ? gr.line : [gr.ring];
    const reach = ('line' in gr ? gr.width / 2 : gr.r + 0.3) * CELL + 2;
    const xs = pts.map((p) => tr.grid.x + (p[0] ?? 0) * CELL),
      ys = pts.map((p) => tr.grid.y + (p[1] ?? 0) * CELL);
    for (
      let y = Math.max(4, Math.floor(Math.min(...ys) - reach));
      y < Math.min(PH - 1, Math.ceil(Math.max(...ys) + reach));
      y++
    )
      for (
        let x = Math.max(2, Math.floor(Math.min(...xs) - reach));
        x < Math.min(PW - 2, Math.ceil(Math.max(...xs) + reach));
        x++
      ) {
        const i = y * PW + x;
        const inside =
          'line' in gr
            ? polylineDistance(cellX(x), cellY(y), gr.line) * CELL <
              (gr.width / 2) * CELL + vnoise(x, y, sk, 5) * 2
            : Math.abs(Math.hypot(cellX(x) - gr.ring[0], cellY(y) - gr.ring[1]) - gr.r) * CELL < 4;
        if (!inside || hash2(x, y, sk + 1) > gr.density) continue;
        const k = cls[i] ?? 0;
        if (!isGround(k) || madeIdx[i] !== -1 || face[i] || quietAt(x, y)) continue;
        // never on a track, nor a hair from one
        let trodden = false;
        for (const [ox, oy] of [
          [0, 0],
          [3, 0],
          [-3, 0],
          [0, 3],
          [0, -3],
        ] as const)
          if ((onTrack[(y + oy) * PW + x + ox] ?? 0) > 0) trodden = true;
        if (trodden) continue;
        // a tuft of three blades leaning out from its root, light at the tips
        const len = 2 + Math.floor(hash2(x, y, sk + 2) * 3);
        for (let b = 0; b < 3; b++)
          for (let s = 0; s < len; s++) {
            const X = x + Math.round((b - 1) * s * 0.5),
              Y = y - s;
            const j = Y * PW + X;
            if (X < 0 || Y < 0 || madeIdx[j] !== -1 || !isGround(cls[j] ?? 0)) continue;
            set(j, BLADE[s >= len - 1 ? 3 : s ? 2 : 1] ?? SHADE);
          }
        if (y + 1 < PH) mix(i + PW, SHADE, 0.3);
      }
  });

  /* 6. the palette lock ------------------------------------------------------------------------------- */
  const palette = spec.palette ? PALETTES[spec.palette] : undefined;
  if (spec.palette && !palette) throw new Error(`no palette "${spec.palette}"`);
  const near = palette ? nearestIn(palette) : undefined;
  const ground = near ? lockImage(g, near) : g;
  const cleanOut = near ? lockImage(clean, near) : clean;

  const classes = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const def = spec.classes[cls[i] ?? 0];
    classes[i] = face[i] ? CLASS.face : def ? gameClass(def.terrain, def.reads) : CLASS.void;
  }
  // the edge check's key: each class, the hill's face its own; made shapes and the kerb are left out (`made`)
  const edges = new Uint8Array(N);
  for (let i = 0; i < N; i++) edges[i] = face[i] ? 250 : (cls[i] ?? 0);
  const none = new Uint8Array(N);
  return {
    origin: tr.origin,
    ground,
    clean: cleanOut,
    bare: { width: PW, height: PH, data: new Uint8ClampedArray(ground.data) },
    classes,
    edges,
    made,
    cover: none,
    shadows: [],
    bridgeShadows: [],
    uprights: [],
    placed: [],
    groundClasses: cls,
  };
}

/** The cells whose foot point is on paving: their feet blob is drawn at paving's strength. */
function pavedCells(tr: GroundTerrain, baked: Baked): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let cy = 0; cy < tr.gh; cy++)
    for (let cx = 0; cx < tr.gw; cx++) {
      const X = tr.grid.x + cx * CELL + CELL / 2,
        Y = tr.grid.y + cy * CELL + CELL - 9;
      if (baked.classes[Y * tr.plateW + X] === CLASS.C) out.push({ x: cx, y: cy });
    }
  return out;
}

function scene(
  tr: GroundTerrain,
  url: string,
  baked: Baked,
  uprights: readonly UprightData[],
  layout: GroundLayout | undefined,
  boardId: string,
): MapScene {
  const byId = new Map(uprights.map((u) => [u.id, u]));
  // the glow of each lamp is centred on its lantern's glass: the centroid of the warm yellow pixels of its sprite
  const lanterns = (layout?.objects ?? []).flatMap((o) => {
    const up = o.sprite === 'lamp' ? baked.uprights.find((u) => u.id === o.id) : undefined;
    if (!up) return [];
    let n = 0,
      sx = 0,
      sy = 0;
    for (let y = 0; y < up.image.height; y++)
      for (let x = 0; x < up.image.width; x++) {
        const i = (y * up.image.width + x) * 4,
          d = up.image.data;
        if (
          at(d, i + 3) &&
          at(d, i) >= 235 &&
          at(d, i + 1) >= 205 &&
          at(d, i + 2) >= 100 &&
          at(d, i + 2) <= 135
        ) {
          n++;
          sx += x;
          sy += y;
        }
      }
    return n ? [{ x: (up.x + (sx / n + 0.5)) / 40, y: (up.y + (sy / n + 0.5)) / 40 }] : [];
  });
  const scenery: SceneScenery[] = (layout?.objects ?? []).flatMap((o) => {
    const art = byId.get(o.id);
    if (!art) return [];
    return [
      {
        id: `${boardId}.td.${o.id}`,
        url: `${url}/uprights.webp`,
        sourceRect: art.sourceRect,
        x: art.x,
        y: art.y,
        width: art.width,
        height: art.height,
        footprint: o.footprint,
        depth: o.depth,
        ...(o.exterior && { exterior: true }),
        ...(o.fadeWhenOccluding && { fadeWhenOccluding: true }),
        ...(o.revealOccluded && { revealOccluded: true }),
        contactShadow: false,
        castShadow: false,
      },
    ];
  });
  return {
    paintedWater: true,
    paintExtent: { x: tr.origin.x, y: tr.origin.y, width: tr.plateW, height: tr.plateH },
    actorGrounding: { contact: 205 / 255, ink: { r: 0x32, g: 0x21, b: 0x25 } },
    pavedCells: pavedCells(tr, baked),
    ground: [
      {
        url: `${url}/ground.webp`,
        x: tr.origin.x,
        y: tr.origin.y,
        width: tr.plateW,
        height: tr.plateH,
      },
    ],
    scenery,
    ...(lanterns.length > 0 && { ambienceSources: { steam: [], lanterns } }),
  };
}

/** The set pieces that stand on a ground board: its objects and where each sprite's art is (relative to `ASSETS`). */
export interface GroundLayout {
  readonly objects: readonly TopDownObject[];
  readonly sprites: Readonly<Record<string, string>>;
}

/** The shadow's strength on Ba Dan's grass: stronger than the plain 1, so a cast on the pale kerb and dust still reads 25 % darker (as the quarry's 1.45). */
const GRASS_SCALE = 1.4;

function mirror(img: RgbaImage): RgbaImage {
  const out = blank(img.width, img.height);
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      for (let c = 0; c < 4; c++)
        out.data[(y * img.width + x) * 4 + c] = at(
          img.data,
          (y * img.width + img.width - 1 - x) * 4 + c,
        );
  return out;
}

/** Grounds every object of `layout` on the baked ground (ADR 0093 / 0104 §2): the shared `hardShadowMask` casts, the grass kit's contacts, one upright atlas. */
export function placeObjects(tr: GroundTerrain, b: GroundBaked, layout: GroundLayout): GroundBaked {
  const g = b.ground;
  const PW = g.width;
  const sprites = new Map<string, RgbaImage>();
  const sprite = (o: TopDownObject): RgbaImage => {
    const key = `${o.sprite}${o.flip ? '|flip' : ''}`;
    let img = sprites.get(key);
    if (!img) {
      const file = layout.sprites[o.sprite];
      if (!file) throw new Error(`no art registered for sprite "${o.sprite}" (${o.id})`);
      const raw = cleanSprite(load(`${ASSETS}/${file}`));
      img = o.flip ? mirror(raw) : raw;
      sprites.set(key, img);
    }
    return img;
  };
  const placed: Placed[] = layout.objects.map((o) => {
    const img = sprite(o);
    const base = o.base - tr.origin.y;
    return {
      o,
      img,
      x: Math.round(o.x - tr.origin.x - img.width / 2),
      y: base - img.height,
      w: img.width,
      h: img.height,
      base,
    };
  });
  const bare = { ...b.bare, data: new Uint8ClampedArray(b.bare.data) };
  for (const p of placed)
    if (FLAT_KINDS.has(p.o.kind)) {
      draw(g, p.img, p.x, p.y);
      draw(bare, p.img, p.x, p.y);
    }
  const shadows: Baked['shadows'][number][] = [];
  const fringes = new Map<Placed, RgbaImage>();
  for (const p of placed) {
    if (FLAT_KINDS.has(p.o.kind)) continue;
    const ux = Math.max(0, Math.min(PW - 1, p.x + (p.w >> 1))),
      uy = Math.max(0, Math.min(g.height - 1, p.base - 2));
    const soft = b.classes[uy * PW + ux] === CLASS.G;
    const { record, fringe } = groundObject(g, p, b.classes, soft, shadowOptions(p), {
      softScale: GRASS_SCALE,
      dryKit: true,
    });
    shadows.push(record);
    if (fringe) {
      seatFringe(fringe, p, record.m, b.classes, soft ? GRASS_SCALE : 1.3, g);
      fringes.set(p, fringe);
    }
  }
  const { cover, uprights } = standingUprights(placed, fringes, g, tr.origin);
  return { ...b, bare, cover, shadows, uprights, placed };
}

/** A board baked from its ground data alone (its set pieces stand on it at stage 5). */
export function groundBoard(cfg: {
  id: string;
  folder: string;
  terrain: GroundTerrain;
  /** Set pieces standing on the ground; their plinths are then not drawn. */
  layout?: GroundLayout;
}): TopDownBoard {
  const url = `art/topdown/${cfg.folder}`;
  return {
    id: cfg.id,
    out: `public/art/topdown/${cfg.folder}`,
    url,
    bake: () =>
      cfg.layout
        ? placeObjects(cfg.terrain, bakeGround(cfg.terrain, { hidePlinths: true }), cfg.layout)
        : bakeGround(cfg.terrain),
    scene: (baked, uprights) => scene(cfg.terrain, url, baked, uprights, cfg.layout, cfg.id),
  };
}
