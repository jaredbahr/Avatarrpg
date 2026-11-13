/**
 * The quarry's top-down boards (ADR 0104 §3, phase T5): the prototype's quarry bake
 * (`prototypes/topdown/src/b3/world_quarry.js` `bakeQuarry`, owner-approved in `tutorial-demo.html`)
 * re-implemented over RGBA buffers on the game's rows, one board per map: the quarry gate
 * (`quarry_gate`), the Cutting (`ambush_road`) and the Driller floor (`quarry_floor`). Packed by
 * `pack-ground.ts --map <id>` under `public/art/topdown/<board>/`.
 *
 * The plate, in the prototype's order:
 * 1. the levels and classes (`quarry.topdown.terrain.ts`: the floor's sand, the road, grass, the
 *    pool, the pit, the shelves' rock, the void), and every shelf's cut face, 13 px a tier;
 * 2. the paint: the rim's face under the mass falling into the void, the cut face (its lit lip and
 *    dark foot), the shelf rock quilted from four plain rock tiles, the road and the sand quilted
 *    from one tile each with a slow drift, the pool, the grass and moss, the pit;
 * 3. the road fraying into the sand in specks, and the wheel ruts running on past a stub's end;
 * 4. the edges: a shelf's dark right side and lit left, the short hard cast to the lower right of
 *    every face foot and right side, the verge, the grass edge, the pit's lip, the pool's bank;
 * 5. grass tufts creeping onto the road, hairline cracks, scree chips, loose stones and dry tufts
 *    on the shelves, and pale grit on the floor, densest under the faces.
 *
 * Then the objects (`quarry.topdown.ts`): the flat rails on the plate, and every standing piece
 * grounded with the shared `hardShadowMask` grounding and seated, in one upright atlas. With the
 * terrain's guard off, the plate's terrain is the prototype's to the byte (`quarry-board.test.ts`).
 *
 * The tiles are the page's own (`build_b3.py`): `q_floor32b`'s sand and road, `q_terrace32`'s and
 * `q_rim32`'s cut faces stacked to their foot line, `q_rock_var`'s four plain rocks, the forest's
 * creek, floor and moss.
 */
import { readdirSync } from 'node:fs';
import type { MapScene, SceneScenery } from '../../../../src/core/types';
import type { TopDownLayout, TopDownObject } from '../../../../src/content/topdownLayout';
import {
  CUTTING_TOPDOWN_LAYOUT,
  QUARRY_FLOOR_TOPDOWN_LAYOUT,
  QUARRY_GATE_TOPDOWN_LAYOUT,
} from '../../../../src/content/topdownLayouts';
import {
  CELL,
  GH,
  GRID,
  GW,
  ORIGIN,
  PLATE_H,
  PLATE_W,
  QUARRY,
  QUARRY_FLOOR_TERRAIN,
  QUARRY_GATE_TERRAIN,
  CUTTING_TERRAIN,
  TILE as T,
  hash2,
  quarryGround,
  vnoise,
  type QuarryGround,
  type QuarryTerrainConfig,
} from '../../../../src/content/scenes/quarry.topdown.terrain';
import type { RgbaImage } from '../../../../src/render/shadow/hardShadowMask';
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
import { at, blank, crop, draw, fill, hex, load, trim, type Rgb } from '../lib/raster';
import { tileStrip } from './forestRoad';

const GR = ['#243d33', '#35593f', '#4f7d4a', '#7aa05a', '#a9c46f', '#c9d98a'] as const;
const SH: Rgb = [0x32, 0x21, 0x25];

/* ------------------------------------------------------------------ */
/* The tiles                                                           */
/* ------------------------------------------------------------------ */

/** The quarry's tiles as the page embeds them (`build_b3.py` `qtiles`), by the page's names. */
export type QuarryTiles = ReadonlyMap<string, RgbaImage>;

/** A Wang tile by its corner key (`build_b3.py` `t()`: the one file named `*_<key>.png`). */
function wang(folder: string, key: string): RgbaImage {
  const dir = `${ASSETS}/tiles/${folder}`;
  const files = readdirSync(dir).filter((f) => f.endsWith(`_${key}.png`));
  if (files.length !== 1) throw new Error(`${dir} has ${files.length} tiles keyed ${key}`);
  return load(`${dir}/${files[0] ?? ''}`);
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

const tile32 = (path: string): RgbaImage => crop(load(path), 0, 0, T, T);
const byIndex = (a: string, b: string): number =>
  Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''));

export function quarryTiles(): QuarryTiles {
  const [grass, , water, ...forestVar] = tileStrip();
  if (!grass || !water) throw new Error('no forest tiles');
  const uutt = wang('q_terrace32', 'UUTT'),
    ttll = wang('q_terrace32', 'TTLL');
  // 42 rows: the cut face, ending on the set's own foot line
  const face = vstack([crop(uutt, 0, 14, T, 18), crop(ttll, 0, 0, T, 24)]);
  const rim = vstack([
    crop(wang('q_rim32', 'UUTT'), 0, 14, T, 18),
    crop(wang('q_rim32', 'TTLL'), 0, 0, T, 23),
  ]);
  const tiles = new Map<string, RgbaImage>([
    ['moss0', forestVar[0] ?? grass],
    ['moss1', forestVar[3] ?? forestVar[0] ?? grass],
    ['floor', wang('q_floor32b', 'LLLL')],
    ['road', wang('q_floor32b', 'UUUU')],
    ['top', wang('q_terrace32', 'UUUU')],
    ['face', face],
    ['rim', rim],
    ['water', water],
    ['grass', grass],
  ]);
  const vdir = `${ASSETS}/tiles/q_var_floor`;
  readdirSync(vdir)
    .filter((f) => /^tile_\d+\.png$/.test(f))
    .sort(byIndex)
    .forEach((f, i) => tiles.set(`var${i}`, tile32(`${vdir}/${f}`)));
  // polish pass: plain rock variants for the raised shelves (the Wang set's own top repeats a tuft motif)
  ['tile_0.png', 'tile_2.png', 'clean_12.png', 'clean_14.png'].forEach((f, i) =>
    tiles.set(`rock${i}`, tile32(`${ASSETS}/tiles/q_rock_var/${f}`)),
  );
  return tiles;
}

/* ------------------------------------------------------------------ */
/* The samplers                                                        */
/* ------------------------------------------------------------------ */

type Px = [number, number, number];

class Sampler {
  constructor(private readonly tiles: QuarryTiles) {}

  sample(key: string, x: number, y: number): Px {
    const t = this.tiles.get(key);
    if (!t) throw new Error(`no quarry tile ${key}`);
    const i =
      ((((y % t.height) + t.height) % t.height) * t.width + (((x % t.width) + t.width) % t.width)) *
      4;
    return [at(t.data, i), at(t.data, i + 1), at(t.data, i + 2)];
  }

  /**
   * The shelf rock is not one tile repeated: a warped Voronoi quilt of regions about `R` px across,
   * each drawn from one of `keys` with its own flip, turn and offset; the borders dither over 3 px.
   */
  quilt(keys: readonly string[], x: number, y: number, R: number, sk: number): Px {
    const wx = x + vnoise(x, y, sk + 1, 22) * 18 + vnoise(x, y, sk + 2, 7) * 4,
      wy = y + vnoise(x, y, sk + 3, 22) * 18 + vnoise(x, y, sk + 4, 7) * 4;
    let best = 1e9,
      second = 1e9,
      bi = 0,
      bj = 0,
      sj = 0,
      sk2 = 0;
    const cx = Math.floor(wx / R),
      cy = Math.floor(wy / R);
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const gx = cx + j,
          gy = cy + k,
          px = (gx + 0.15 + hash2(gx, gy, sk + 11) * 0.7) * R,
          py = (gy + 0.15 + hash2(gx, gy, sk + 12) * 0.7) * R,
          d = (wx - px) ** 2 + (wy - py) ** 2;
        if (d < best) {
          second = best;
          sj = bi;
          sk2 = bj;
          best = d;
          bi = gx;
          bj = gy;
        } else if (d < second) {
          second = d;
          sj = gx;
          sk2 = gy;
        }
      }
    let gx = bi,
      gy = bj;
    // a dithered border
    if (Math.sqrt(second) - Math.sqrt(best) < 3 && hash2(x, y, sk + 13) < 0.5) {
      gx = sj;
      gy = sk2;
    }
    const t = Math.floor(hash2(gx, gy, sk + 14) * keys.length),
      f = Math.floor(hash2(gx, gy, sk + 15) * 8),
      ox = Math.floor(hash2(gx, gy, sk + 16) * 32),
      oy = Math.floor(hash2(gx, gy, sk + 17) * 32);
    let u = (x + ox) & 31,
      v = (y + oy) & 31;
    if (f & 1) u = 31 - u;
    if (f & 2) v = 31 - v;
    if (f & 4) {
      const q = u;
      u = v;
      v = q;
    }
    return this.sample(keys[t] ?? '', u, v);
  }

  rockTop(x: number, y: number): Px {
    const c = this.quilt(['rock0', 'rock1', 'rock2', 'rock3'], x, y, 58, 300),
      b = 1 + vnoise(x, y, 321, 70) * 0.12 + vnoise(x, y, 322, 24) * 0.05;
    return c.map((a) => Math.max(0, Math.min(255, a * b))) as Px;
  }

  /** The sand: one plain tile, quilted, with a slow warm/cool drift and pale dust drifts. */
  sandFloor(x: number, y: number): Px {
    const c = this.quilt(['floor'], x, y, 74, 400),
      n1 = vnoise(x, y, 421, 90),
      n2 = vnoise(x, y, 422, 34),
      dust = vnoise(x, y, 423, 26) > 0.42 ? 1.045 : 1;
    const warm = 0.012 + n1 * 0.016 + n2 * 0.008,
      b = (1 + n1 * 0.04 + n2 * 0.025) * dust;
    return [c[0] * b * (1 + warm), c[1] * b, c[2] * b * (1 - warm * 1.6)].map((a) =>
      Math.max(0, Math.min(255, a)),
    ) as Px;
  }
}

/* ------------------------------------------------------------------ */
/* The bake                                                            */
/* ------------------------------------------------------------------ */

/** A board's plate and what it is made of: the prototype's `bakeQuarry` on the board's terrain. */
export function bakePlate(
  ground: QuarryGround,
  tiles: QuarryTiles = quarryTiles(),
): { plate: RgbaImage; ground: QuarryGround } {
  const PW = PLATE_W,
    PH = PLATE_H;
  const { lev, cls, face, faceH } = ground;
  const S = new Sampler(tiles);
  const g = blank(PW, PH),
    d = g.data;
  const L = (i: number): number => lev[i] ?? -1;
  const C = (i: number): number => cls[i] ?? QUARRY.void;
  const F = (i: number): number => face[i] ?? 0;

  // 3. paint
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x;
      let c: Px;
      const ci = C(i);
      if (ci === QUARRY.void) {
        // the void, and the rim's face where the mass ends above it
        let k = 0;
        while (k < 40 && y - k - 1 >= 0 && C((y - k - 1) * PW + x) === QUARRY.void) k++;
        const above = y - k - 1 >= 0 ? C((y - k - 1) * PW + x) : QUARRY.void;
        if (above !== QUARRY.void && k < 34) {
          c = S.sample('rim', x, Math.min(40, k));
          const f = 1 - k / 40;
          const dark = [20, 14, 17] as const;
          c = c.map((v, j) => v * f + at(dark, j) * (1 - f)) as Px;
        } else c = [27, 20, 23];
      } else if (F(i)) {
        const k = F(i),
          H = faceH[i] ?? 1;
        // the strip ends on the set's own foot line
        c = S.sample('face', x, Math.max(0, 41 - (H - k)));
        const sh = 1 - (0.22 * k) / H;
        c = c.map((v) => v * sh) as Px;
        if (k === 1) c = c.map((v) => Math.min(255, v * 1.22 + 10)) as Px; // the lit lip
        if (k === H) c = c.map((v, j) => v * 0.55 + at(SH, j) * 0.45) as Px; // the foot's occlusion line
      } else if (ci === QUARRY.rock) c = S.rockTop(x, y);
      else if (ci === QUARRY.road) {
        const n = vnoise(x, y, 441, 60);
        c = S.quilt(['road'], x, y, 70, 440).map((a) => a * (1 + n * 0.07)) as Px;
      } else if (ci === QUARRY.water) c = S.sample('water', x, y);
      else if (ci === QUARRY.grass)
        c =
          vnoise(x, y, 41, 46) + vnoise(x, y, 43, 9) * 0.25 > 0.98
            ? S.sample('grass', x, y)
            : S.sample(
                hash2(Math.floor(x / T), Math.floor(y / T), 245) < 0.5 ? 'moss0' : 'moss1',
                x,
                y,
              );
      else if (ci === QUARRY.pit) c = vnoise(x, y, 251, 5) > 0.3 ? [40, 30, 32] : [27, 20, 23];
      else c = S.sandFloor(x, y);
      d[i * 4] = c[0];
      d[i * 4 + 1] = c[1];
      d[i * 4 + 2] = c[2];
      d[i * 4 + 3] = 255;
    }

  // 3b. the road frays into the sand (worn ground a few px further out, in specks, never a line)
  // and, where a stub ends inside the board, its two wheel ruts carry on a short way, fading
  {
    const RAD = 9,
      tmp = new Float32Array(PW * PH),
      fld = new Float32Array(PW * PH);
    for (let y = 0; y < PH; y++) {
      let acc = 0;
      for (let x = -RAD; x < PW; x++) {
        if (x + RAD < PW) acc += C(y * PW + x + RAD) === QUARRY.road ? 1 : 0;
        if (x - RAD - 1 >= 0) acc -= C(y * PW + x - RAD - 1) === QUARRY.road ? 1 : 0;
        if (x >= 0) tmp[y * PW + x] = acc / (2 * RAD + 1);
      }
    }
    for (let x = 0; x < PW; x++) {
      let acc = 0;
      for (let y = -RAD; y < PH; y++) {
        if (y + RAD < PH) acc += tmp[(y + RAD) * PW + x] ?? 0;
        if (y - RAD - 1 >= 0) acc -= tmp[(y - RAD - 1) * PW + x] ?? 0;
        if (y >= 0) fld[y * PW + x] = acc / (2 * RAD + 1);
      }
    }
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const i = y * PW + x,
          f = fld[i] ?? 0;
        if (C(i) !== QUARRY.floor || F(i) || f < 0.03) continue;
        if (hash2(x, y, 461) < f * 1.1 + vnoise(x, y, 462, 5) * 0.2 - 0.05) {
          const c = S.quilt(['road'], x, y, 70, 440);
          const a = 0.8;
          for (let k = 0; k < 3; k++)
            d[i * 4 + k] = at(d, i * 4 + k) * (1 - a) + c[k as 0 | 1 | 2] * a;
        }
      }
    for (const bd of ground.rows.roadStubs) {
      const dir = bd.side ? -1 : 1,
        yr = Math.round(bd.yc);
      let x0 = bd.side ? PW - 1 : 0;
      while (x0 >= 0 && x0 < PW && C(yr * PW + x0) !== QUARRY.road) x0 += dir;
      while (x0 >= 0 && x0 < PW && C(yr * PW + x0) === QUARRY.road) x0 += dir;
      for (const off of [-8, 8]) {
        let yy = bd.yc + off;
        for (let s = 0; s < 130; s++) {
          const x = x0 + dir * (s + 6);
          yy += vnoise(s, off, 471, 14) * 0.4;
          const Y = Math.round(yy);
          if (x < 2 || x >= PW - 2) break;
          if (s % 17 > 12 - Math.floor(s / 22) || hash2(s, off, 472) < s / 150) continue;
          for (let h = 0; h < 2; h++) {
            const i = (Y + h) * PW + x;
            if (F(i) || C(i) === QUARRY.road || C(i) === QUARRY.void) continue;
            const m = h ? 0.7 : 0.8;
            d[i * 4] = at(d, i * 4) * m;
            d[i * 4 + 1] = at(d, i * 4 + 1) * (m * 0.95);
            d[i * 4 + 2] = at(d, i * 4 + 2) * (m * 0.84);
          }
        }
      }
    }
  }

  // 4. edges: a shelf's sides (dark on the right, lit on the left), the cast of a face and a right
  // side on the lower ground, the floor darkening into the road's verge and the grass edge, the pit's lip
  const mix = (i: number, col: Rgb, a: number): void => {
    for (let k = 0; k < 3; k++) d[i * 4 + k] = at(d, i * 4 + k) * (1 - a) + at(col, k) * a;
  };
  const LIT: Rgb = [246, 238, 214];
  for (let y = 1; y < PH - 1; y++)
    for (let x = 2; x < PW - 2; x++) {
      const i = y * PW + x,
        ci = C(i);
      if (ci === QUARRY.void || F(i)) continue;
      const Lv = L(i);
      // the shelf's right side, in shade
      if (L(i - 1) > Lv && !F(i - 1)) mix(i, SH, 0.5);
      else if (L(i - 2) > Lv && !F(i - 2)) mix(i, SH, 0.3);
      if (L(i + 1) > Lv && !F(i + 1)) mix(i, LIT, 0.18); // its left side, lit
      if (L(i) > 0 && L(i + 1) < Lv && !F(i + 1)) mix(i, SH, 0.25);
      // the cast: a short band to the lower right of every face foot and every right side
      let cast = false;
      for (let k = 1; k <= 6 && !cast; k++) {
        const j = (y - k) * PW + (x - Math.round(k * 0.6));
        if (j > 0 && F(j) && F(j) === faceH[j]) cast = true;
      }
      for (let k = 1; k <= 5 && !cast; k++) {
        const j = (y - Math.round(k * 0.4)) * PW + x - k;
        if (j > 0 && L(j) > Lv && !F(j)) cast = true;
      }
      if (cast) mix(i, SH, ci === QUARRY.road || ci === QUARRY.floor ? 0.42 : 0.36);
      const n4 = (k: number): boolean =>
        C(i - 1) === k || C(i + 1) === k || C(i - PW) === k || C(i + PW) === k;
      if (ci === QUARRY.floor && n4(QUARRY.road)) mix(i, [90, 61, 43], 0.28);
      if (ci === QUARRY.floor && n4(QUARRY.grass)) mix(i, SH, 0.22);
      if (ci !== QUARRY.pit && (C(i + PW) === QUARRY.pit || C(i - 1) === QUARRY.pit))
        mix(i, SH, 0.55);
      // the pool's bank throws a dark lip
      if (ci === QUARRY.water && (C(i - PW) !== QUARRY.water || C(i - 1) !== QUARRY.water))
        mix(i, SH, 0.45);
      // wet ground at the edge
      if (ci !== QUARRY.water && ci !== QUARRY.void && !L(i) && n4(QUARRY.water))
        mix(i, [58, 46, 44], 0.5);
    }

  const dot = (x: number, y: number, col: string | Rgb, w = 1, h = 1): void =>
    fill(g, x, y, w, h, typeof col === 'string' ? hex(col) : col);
  // grass tufts creeping onto the road and the gravel
  for (let k = 0; k < 1400; k++) {
    const x = 2 + Math.floor(hash2(k, 1, 271) * (PW - 4)),
      y = 2 + Math.floor(hash2(k, 2, 271) * (PH - 4)),
      i = y * PW + x;
    if (!(C(i) === QUARRY.road || C(i) === QUARRY.floor)) continue;
    if (![-2, 2].some((o) => C(i + o) === QUARRY.grass || C(i + o * PW) === QUARRY.grass)) continue;
    for (let b = 0; b < 3; b++) {
      const len = 2 + Math.floor(hash2(k, b, 272) * 3),
        lean = b - 1;
      for (let s = 0; s < len; s++)
        dot(x + Math.round(lean * s * 0.5), y + 1 - s, s >= len - 1 ? GR[4] : GR[2]);
    }
  }
  // sparse hairline cracks, scree chips and the odd dry tuft on the shelf rock (each on its own
  // spot, never a lattice)
  for (let gy = 0; gy < PH / 70; gy++)
    for (let gx = 0; gx < PW / 70; gx++) {
      if (hash2(gx, gy, 331) > 0.55) continue;
      let x = Math.floor((gx + hash2(gx, gy, 332)) * 70),
        y = Math.floor((gy + hash2(gx, gy, 333)) * 70),
        ang = hash2(gx, gy, 334) * 6.283;
      const len = 12 + Math.floor(hash2(gx, gy, 335) * 22);
      for (let s = 0; s < len; s++) {
        ang += (hash2(gx, s, 336) - 0.5) * 0.9;
        x += Math.cos(ang) * 1.2;
        y += Math.sin(ang) * 1.2;
        const X = Math.round(x),
          Y = Math.round(y),
          i = Y * PW + X;
        if (X < 1 || Y < 1 || X >= PW - 1 || Y >= PH - 1 || C(i) !== QUARRY.rock || F(i)) break;
        dot(X, Y, s > len - 4 ? '#6f666b' : '#4f464c');
        if (s % 5 === 2) dot(X + 1, Y + 1, '#9d979a');
      }
    }
  for (let k = 0; k < 420; k++) {
    const x = 3 + Math.floor(hash2(k, 1, 341) * (PW - 6)),
      y = 3 + Math.floor(hash2(k, 2, 341) * (PH - 6)),
      i = y * PW + x;
    if (C(i) !== QUARRY.rock || F(i) || F(i - PW * 3)) continue;
    // a few scree chips, each with its dark foot and a pale top
    const sz = hash2(k, 3, 341),
      grp = sz < 0.3 ? 3 : 1;
    for (let c = 0; c < grp; c++) {
      const cx = x + Math.round((hash2(k, c, 342) - 0.5) * 8),
        cy = y + Math.round((hash2(k, c, 343) - 0.5) * 5),
        w = 2 + (hash2(k, c, 344) < 0.4 ? 1 : 0);
      dot(cx, cy + 1, '#4a4147', w + 1, 1);
      dot(cx, cy, '#6b6469', w, 1);
      dot(cx, cy - 1, '#b4aeab', w - 1, 1);
    }
  }
  // loose stones, 4-6 px, each with a pale lit top-left, a dark right side and a hard foot
  for (let k = 0; k < 150; k++) {
    const x = 4 + Math.floor(hash2(k, 1, 361) * (PW - 8)),
      y = 6 + Math.floor(hash2(k, 2, 361) * (PH - 12)),
      i = y * PW + x;
    if (C(i) !== QUARRY.rock || F(i) || F(i - PW * 4) || C(i + PW * 3) !== QUARRY.rock) continue;
    const w = 3 + Math.floor(hash2(k, 3, 361) * 3),
      h = w - 1;
    dot(x + 1, y + h, '#322125', w, 1);
    dot(x, y, '#6a6368', w, h);
    dot(x + w - 1, y, '#4f484e', 1, h);
    dot(x, y, '#aaa5a6', w - 1, 1);
  }
  // a dry tuft: three blades in the old shelf tone
  for (let k = 0; k < 26; k++) {
    const x = 4 + Math.floor(hash2(k, 1, 351) * (PW - 8)),
      y = 6 + Math.floor(hash2(k, 2, 351) * (PH - 12)),
      i = y * PW + x;
    if (C(i) !== QUARRY.rock || F(i) || C(i + PW * 3) !== QUARRY.rock) continue;
    for (let b = -1; b <= 1; b++) {
      const len = 3 + Math.floor(hash2(k, b, 352) * 3);
      for (let s = 0; s < len; s++)
        dot(x + b + Math.round(b * s * 0.4), y - s, s === len - 1 ? '#c98f3e' : '#8d6b3a');
    }
    dot(x - 1, y + 1, '#4a4147', 3, 1);
  }
  // pale grit and chips scattered over the floor, densest under the faces (detail near walls, calm centre)
  for (let k = 0; k < 2600; k++) {
    const x = Math.floor(hash2(k, 5, 281) * PW),
      y = Math.floor(hash2(k, 6, 281) * PH),
      i = y * PW + x;
    if (C(i) !== QUARRY.floor || F(i)) continue;
    let near = 0;
    for (let q = 1; q < 14; q++) {
      const j = (y - q) * PW + x;
      if (j >= 0 && (F(j) || L(j) > 0)) {
        near = q;
        break;
      }
    }
    if (!near && hash2(k, 7, 281) < 0.8) continue;
    const big = hash2(k, 8, 281) < 0.25;
    dot(x, y + 1, '#5d5b63', big ? 3 : 2, 1);
    dot(x, y, hash2(k, 9, 281) < 0.5 ? '#e8d8b0' : '#aea89c', big ? 2 : 1, 1);
  }
  return { plate: g, ground };
}

/* ------------------------------------------------------------------ */
/* The board                                                           */
/* ------------------------------------------------------------------ */

/** The packer's classes: the hard ground (sand, road, rock) and the soft (grass) for the shadows. */
const CLASS_OF: Readonly<Record<number, number>> = {
  [QUARRY.floor]: CLASS.C,
  [QUARRY.road]: CLASS.C,
  [QUARRY.rock]: CLASS.C,
  [QUARRY.grass]: CLASS.G,
  [QUARRY.water]: CLASS.W,
  [QUARRY.pit]: CLASS.void,
  [QUARRY.void]: CLASS.void,
};

/**
 * The terrain as the eye reads its edges: each class on each level, and the faces. The prototype's
 * own straightness key (`straightQ`: `cls * 4 + lev + 1`, the void apart).
 */
export function edgeKeys(ground: QuarryGround): Uint8Array {
  const out = new Uint8Array(ground.cls.length);
  for (let i = 0; i < out.length; i++) {
    const c = ground.cls[i] ?? QUARRY.void;
    out[i] = c === QUARRY.void ? 99 : c * 4 + (ground.lev[i] ?? 0) + 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The objects                                                         */
/* ------------------------------------------------------------------ */

/**
 * Where each sprite comes from: the quarry set (`objects13`, `tutorial-demo.html`'s board), and the
 * Ba Dan pieces the gate's low cover borrows (`objects12`, the same page's village).
 */
const BORROWED: Readonly<Record<string, string>> = { sack: 'objects12', crate: 'objects12' };

/**
 * A prototype object as the page embeds it (`build_b3.py`): alpha under 128 cleared and the rest
 * made opaque, trimmed.
 */
export function quarryObject(name: string): RgbaImage {
  const img = load(`${ASSETS}/${BORROWED[name] ?? 'objects13'}/${name}.png`);
  const d = new Uint8ClampedArray(img.data);
  for (let i = 0; i < d.length; i += 4) {
    if (at(d, i + 3) > 0 && at(d, i + 3) < 128) d.fill(0, i, i + 4);
    else if (at(d, i + 3)) d[i + 3] = 255;
  }
  return trim({ width: img.width, height: img.height, data: d }).image;
}

/** Mirrored left to right (the prototype draws some of its dressing flipped). */
export function mirror(img: RgbaImage): RgbaImage {
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

/** The shadow's strength on the quarry's grass (the prototype's 1.45: the dark moss needs it). */
const GRASS_SCALE = 1.45;

export function bake(config: QuarryTerrainConfig, objects: readonly TopDownObject[]): Baked {
  const ground = quarryGround(config);
  const { plate: g } = bakePlate(ground);
  const classes = new Uint8Array(PLATE_W * PLATE_H);
  for (let i = 0; i < classes.length; i++)
    classes[i] = ground.face[i]
      ? CLASS.face
      : (CLASS_OF[ground.cls[i] ?? QUARRY.void] ?? CLASS.void);
  const copy = (): RgbaImage => ({
    width: PLATE_W,
    height: PLATE_H,
    data: new Uint8ClampedArray(g.data),
  });
  const clean = copy(),
    bare = copy();

  const sprites = new Map<string, RgbaImage>();
  const sprite = (o: TopDownObject): RgbaImage => {
    const key = `${o.sprite}${o.flip ? '~' : ''}`;
    let img = sprites.get(key);
    if (!img) {
      const raw = cleanSprite(quarryObject(o.sprite));
      img = o.flip ? mirror(raw) : raw;
      sprites.set(key, img);
    }
    return img;
  };
  const placed: Placed[] = objects.map((o) => {
    const img = sprite(o);
    const base = o.base - ORIGIN.y;
    return {
      o,
      img,
      x: Math.round(o.x - ORIGIN.x - img.width / 2),
      y: base - img.height,
      w: img.width,
      h: img.height,
      base,
    };
  });
  // the flat pieces (the rails) lie on the ground; then each standing piece's own grounding
  for (const p of placed)
    if (FLAT_KINDS.has(p.o.kind)) {
      draw(g, p.img, p.x, p.y);
      draw(bare, p.img, p.x, p.y);
    }
  const shadows: Baked['shadows'][number][] = [];
  const fringes = new Map<Placed, RgbaImage>();
  for (const p of placed) {
    if (FLAT_KINDS.has(p.o.kind)) continue;
    const ux = Math.max(0, Math.min(PLATE_W - 1, p.x + (p.w >> 1))),
      uy = Math.max(0, Math.min(PLATE_H - 1, p.base - 2));
    const soft = classes[uy * PLATE_W + ux] === CLASS.G;
    const { record, fringe } = groundObject(g, p, classes, soft, shadowOptions(p), {
      softScale: GRASS_SCALE,
    });
    shadows.push(record);
    if (fringe) {
      seatFringe(fringe, p, record.m, classes, soft ? GRASS_SCALE : 1.3, g);
      fringes.set(p, fringe);
    }
  }
  const { cover, uprights } = standingUprights(placed, fringes, g, ORIGIN);
  return {
    origin: ORIGIN,
    ground: g,
    clean,
    bare,
    classes,
    edges: edgeKeys(ground),
    cover,
    shadows,
    bridgeShadows: [],
    uprights,
    placed,
  };
}

/**
 * The cells whose foot point (a figure's feet, the prototype's `cellY`) is on hard ground: sand,
 * road or rock. Their feet blob is drawn at the harder strength, as the prototype's is everywhere
 * on a quarry board but its grass (`MapScene.pavedCells`).
 */
export function pavedCells(baked: Baked): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let cy = 0; cy < GH; cy++)
    for (let cx = 0; cx < GW; cx++) {
      const X = GRID.x + cx * CELL + CELL / 2,
        Y = GRID.y + cy * CELL + CELL - 9;
      if (baked.classes[Y * PLATE_W + X] === CLASS.C) out.push({ x: cx, y: cy });
    }
  return out;
}

/**
 * A quarry board's top-down scene as the runtime reads it: the baked plate and each standing piece,
 * cut from the upright atlas and laid out by the placed objects, sorted by its base. Every static
 * shadow is in the plate, and the Cutting's pool is painted, so the rules' permanent water there
 * draws no film. The map's own `paintedRubble` comes across with the rules' scene fields.
 */
export function quarryScene(url: string, objects: readonly TopDownObject[]) {
  return (baked: Baked, uprights: readonly UprightData[]): MapScene => {
    const byId = new Map(uprights.map((u) => [u.id, u]));
    const scenery: SceneScenery[] = objects.flatMap((o) => {
      const art = byId.get(o.id);
      if (!art) return [];
      return [
        {
          id: `quarry.td.${o.id}`,
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
          contactShadow: false,
          castShadow: false,
        },
      ];
    });
    return {
      paintedWater: true,
      paintExtent: { x: ORIGIN.x, y: ORIGIN.y, width: PLATE_W, height: PLATE_H },
      actorGrounding: { contact: 205 / 255, ink: { r: 0x32, g: 0x21, b: 0x25 } },
      pavedCells: pavedCells(baked),
      ground: [
        { url: `${url}/ground.webp`, x: ORIGIN.x, y: ORIGIN.y, width: PLATE_W, height: PLATE_H },
      ],
      scenery,
    };
  };
}

function board(layout: TopDownLayout, config: QuarryTerrainConfig, folder: string): TopDownBoard {
  const url = `art/topdown/${folder}`;
  return {
    id: config.mapId,
    out: `public/${url}`,
    url,
    bake: () => {
      if (layout.terrain.kind !== 'quarry-terrace')
        throw new Error(`${config.mapId} bakes quarry-terrace terrain`);
      return bake(config, layout.objects);
    },
    scene: quarryScene(url, layout.objects),
  };
}

export const QUARRY_GATE_BOARD = board(
  QUARRY_GATE_TOPDOWN_LAYOUT,
  QUARRY_GATE_TERRAIN,
  'quarry-gate',
);
export const CUTTING_BOARD = board(CUTTING_TOPDOWN_LAYOUT, CUTTING_TERRAIN, 'cutting');
export const QUARRY_FLOOR_BOARD = board(
  QUARRY_FLOOR_TOPDOWN_LAYOUT,
  QUARRY_FLOOR_TERRAIN,
  'quarry-floor',
);

export const QUARRY_BOARDS: readonly TopDownBoard[] = [
  QUARRY_GATE_BOARD,
  CUTTING_BOARD,
  QUARRY_FLOOR_BOARD,
];

/** The grid's px in the plate, for the overlays. */
export const QUARRY_GRID = { ...GRID, w: GW, h: GH } as const;
