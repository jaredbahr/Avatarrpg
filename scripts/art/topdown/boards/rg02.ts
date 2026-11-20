/**
 * Saltstep and Emberwatch's top-down boards (RG-02, ADR 0104 §3): one baker for the region, a config per map, packed
 * by `pack-ground.ts --map <id>` under `public/art/topdown/<board>/`.
 *
 * The plate:
 * 1. the terrain per pixel (`rg02.topdown.terrain.ts`), each class drawn from its own RG-02 Wang set
 *    (`tools/rg02tiles.py`): the harbour and the quay's sand (`rg02_quay`), the planks (`rg02_planks2`), packed earth
 *    and flagstones (`rg02_parade`), the power yard's mud and puddles (`rg02_yard`). A plain tile is never repeated
 *    as wallpaper: it is quilted in warped regions about 56 px across, each with its own offset and flip
 *    (art-lessons, the quarry polish);
 * 2. the edges: a deck's dark timber lip over the water and the short hard shadow it lays on the water to its lower
 *    right, the quay's wet sand at the waterline, a puddle's mud rim, and the rim's earth face falling into the void;
 * 3. the flat dressing (a barge or the ferry moored on the water, beans drying on canvas);
 * 4. every standing piece grounded with the shared `hardShadowMask` grounding (`lib/grounding.ts`), in one upright
 *    atlas. The pieces are RG-02's own (`tools/rg02obj.py`), cut at alpha 128 and trimmed
 *    (`assets/objects_rg02/`).
 */
import { existsSync, readdirSync } from 'node:fs';
import type { MapScene, SceneScenery } from '../../../../src/core/types';
import type { TopDownLayout } from '../../../../src/content/topdownLayout';
import {
  CELL,
  FACE_TIER,
  GRID,
  RG,
  hash2,
  vnoise,
  type Rg02Terrain,
  type RgClass,
} from '../../../../src/content/scenes/rg02.topdown.terrain';
import type { RgbaImage } from '../../../../src/render/shadow/hardShadowMask';
import {
  ASSETS,
  CLASS,
  type Baked,
  type Placed,
  type TopDownBoard,
  type UprightData,
} from '../lib/board';
import { FLAT_KINDS, groundObject, shadowOptions, standingUprights } from '../lib/grounding';
import { at, blank, draw, load } from '../lib/raster';
import { cleanSprite } from '../lib/sprites';

/**
 * Per-sprite shadow options for the harbour's props (`shadowOptions`' `propFoot`). The lobster pots sat
 * exactly on the 25 % contrast floor; the sweep of Imagination ecfcea1 (ADR 0104 amendment, 2026-11-17)
 * moved a few of their cast pixels and dropped them just under it, so they take the long contact band a
 * tall prop already takes at runtime (`objectShadowMask`): more of the shadow is the dark seam and band.
 */
const RG02_PROP_FOOT = { lobster_pots: { band: 6 } } as const;

/**
 * Where a piece's sprite lives: the region's own objects (`assets/objects_rg02/`), the river road's kit
 * (`assets/objects_rr/`, `tools/rrobj.py`), or Ba Dan's valley set, whose hill trees and trough the river road reuses
 * (`assets/objects_bd20/`). The first folder holding the name wins.
 */
const OBJECT_DIRS = ['objects_rg02', 'objects_rr', 'objects_bd20'] as const;

function objectFile(sprite: string): string {
  for (const dir of OBJECT_DIRS) {
    const file = `${ASSETS}/${dir}/${sprite}.png`;
    if (existsSync(file)) return file;
  }
  throw new Error(`RG-02 piece "${sprite}" is in none of ${OBJECT_DIRS.join(', ')}`);
}

const T = 32;
type Rgb = readonly [number, number, number];

/** A Wang tile by its corner key (the one file named `*_<key>.png` in the set). */
function wang(folder: string, key: string): RgbaImage {
  const dir = `${ASSETS}/tiles/${folder}`;
  const files = readdirSync(dir).filter((f) => f.endsWith(`_${key}.png`));
  if (files.length !== 1) throw new Error(`${dir} has ${files.length} tiles keyed ${key}`);
  return load(`${dir}/${files[0] ?? ''}`);
}

/** Each class's plain tile; a board may draw its earth from another set (the power yard's mud). */
export type Rg02Tiles = Readonly<Record<RgClass, RgbaImage | undefined>>;

export function rg02Tiles(
  earth: 'parade' | 'yard' | 'road' = 'parade',
  stone: 'parade' | 'rise' = 'parade',
): Rg02Tiles {
  // The countryside's own sets (`tools/rrtiles.py`): the river road's cart road on meadow, its slow river, the ford's
  // gravel over shallows, and the lookout's grey rock. The coast's boards keep the harbour, quay and parade sets.
  const country = earth === 'road';
  return {
    [RG.water]: country ? wang('rg02_river', 'LLLL') : wang('rg02_quay', 'LLLL'),
    [RG.deck]: wang('rg02_planks2', 'UUUU'),
    [RG.sand]: country ? wang('rg02_ford', 'UUUU') : wang('rg02_quay', 'UUUU'),
    [RG.earth]: wang(
      earth === 'road' ? 'rg02_road' : earth === 'yard' ? 'rg02_yard' : 'rg02_parade',
      'LLLL',
    ),
    [RG.stone]: stone === 'rise' ? wang('rg02_rise', 'UUUU') : wang('rg02_parade', 'UUUU'),
    // the yard's puddle, or in the country the ford's clear shallows over pebbles
    [RG.puddle]: country ? wang('rg02_ford', 'LLLL') : wang('rg02_yard', 'UUUU'),
    [RG.void]: undefined,
    // the countryside's meadow grass (the coast never lays it)
    [RG.grass]: country ? wang('rg02_road', 'UUUU') : load(`${ASSETS}/tiles/gc32/c0000.png`),
  };
}

const VOID: Rgb = [0x1c, 0x17, 0x19];
/** The river bank's wet earth under the grass, and the road's trodden verge (the countryside's grass only). */
const BANK: Rgb = [0x5a, 0x4a, 0x2e];
const VERGE: Rgb = [0x6e, 0x6a, 0x3a];
const SHADE: Rgb = [0x32, 0x21, 0x25];
const LIP: Rgb = [0x3a, 0x2e, 0x2c];
const FACE: readonly Rgb[] = [
  [0x7d, 0x54, 0x34],
  [0x5a, 0x3d, 0x2b],
  [0x3a, 0x2e, 0x2c],
];

/** The plain tile's pixel at plate px (x, y): warped regions about 56 px across, each offset and flipped its own way. */
function quilt(tile: RgbaImage, x: number, y: number, k: number, ragged = false): Rgb {
  // `ragged` lets each pixel pick its region from a coordinate jittered a few px, so a region's seam is a grainy,
  // organic edge instead of a straight, square one (the market's sand)
  const jx = ragged ? (hash2(x, y, k + 6) - 0.5) * 9 : 0,
    jy = ragged ? (hash2(x, y, k + 7) - 0.5) * 9 : 0;
  const wx = x + jx + vnoise(x, y, k + 1, 19) * 14,
    wy = y + jy + vnoise(x, y, k + 2, 19) * 14;
  const rx = Math.floor(wx / 56),
    ry = Math.floor(wy / 56);
  const ox = Math.floor(hash2(rx, ry, k + 3) * T),
    oy = Math.floor(hash2(rx, ry, k + 4) * T);
  const flip = hash2(rx, ry, k + 5) < 0.5;
  let tx = (((x + ox) % T) + T) % T;
  const ty = (((y + oy) % T) + T) % T;
  if (flip) tx = T - 1 - tx;
  const i = (ty * tile.width + tx) * 4;
  return [at(tile.data, i), at(tile.data, i + 1), at(tile.data, i + 2)];
}

/**
 * The planks' pixel at plate px (x, y). The quilt's warp breaks the boards' lines into a two-tone camouflage at board
 * scale, so the deck keeps the tile's rows whole and only staggers its board ends: each tile-high band runs in lengths
 * of about three tiles, each length offset its own way, as a laid deck's are.
 */
function planks(tile: RgbaImage, x: number, y: number, k: number): Rgb {
  const band = Math.floor(y / T),
    run = Math.floor((x + hash2(band, 0, k + 1) * 96) / 96);
  const ox = Math.floor(hash2(run, band, k + 3) * T);
  const tx = (((x + ox) % T) + T) % T,
    ty = ((y % T) + T) % T;
  const i = (ty * tile.width + tx) * 4;
  return [at(tile.data, i), at(tile.data, i + 1), at(tile.data, i + 2)];
}

/** The game's terrain class for the shadows and the checks (`CLASS`). */
const CLASS_OF: Readonly<Record<RgClass, number>> = {
  [RG.water]: CLASS.W,
  [RG.deck]: CLASS.C,
  [RG.sand]: CLASS.D,
  [RG.earth]: CLASS.D,
  [RG.stone]: CLASS.C,
  [RG.puddle]: CLASS.W,
  [RG.void]: CLASS.void,
  [RG.grass]: CLASS.G,
};

export interface Rg02BoardConfig {
  readonly id: string;
  readonly folder: string;
  readonly terrain: Rg02Terrain;
  readonly layout: TopDownLayout;
  readonly earth?: 'parade' | 'yard' | 'road';
  /** What the stone class is drawn as: the coast's flagstones (the default) or the river road's grey rock. */
  readonly stone?: 'parade' | 'rise';
  /** The ground's wear: cells walked into a lighter path, and how much of the open ground lies wet. */
  readonly wear?: {
    readonly paths?: readonly (readonly [number, number])[];
    readonly wet?: number;
    /** Organic edges for the colour drift, the wet patches and the quilt's seams: per-pixel, not stepped and square. */
    readonly soft?: boolean;
  };
  /**
   * Deck cells one step up (the map's elevation 1), as `[x, y, ramp]`: the top a shade lighter, a plank-high face along
   * each south edge that drops to ordinary deck, half height on a ramp cell. SF-2.2's north step on the platform.
   */
  readonly raised?: readonly (readonly [number, number, boolean])[];
}

export function bake(cfg: Rg02BoardConfig): Baked {
  const tr = cfg.terrain;
  const PW = tr.plateW,
    PH = tr.plateH;
  const tiles = rg02Tiles(cfg.earth, cfg.stone);
  const g = blank(PW, PH);
  const d = g.data;
  const cls = new Uint8Array(PW * PH);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) cls[y * PW + x] = tr.classAt(x, y);
  const c = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= PW || y >= PH ? RG.void : (cls[y * PW + x] ?? RG.void);
  const set = (i: number, col: Rgb): void => {
    d[i * 4] = col[0];
    d[i * 4 + 1] = col[1];
    d[i * 4 + 2] = col[2];
    d[i * 4 + 3] = 255;
  };
  const mix = (i: number, col: Rgb, a: number): void => {
    for (let k = 0; k < 3; k++) d[i * 4 + k] = at(d, i * 4 + k) * (1 - a) + (col[k] ?? 0) * a;
  };

  // 1. terrain
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const k = c(x, y) as RgClass;
      const t = tiles[k];
      set(
        y * PW + x,
        !t
          ? VOID
          : k === RG.deck
            ? planks(t, x, y, 31 + k * 13)
            : quilt(t, x, y, 31 + k * 13, cfg.wear?.soft && (k === RG.sand || k === RG.earth)),
      );
    }

  // 2. edges: the rim's earth face hangs under ground into the void; a deck's dark lip and its shadow on the water;
  // the quay's wet sand at the waterline; a puddle's mud rim
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x,
        k = c(x, y);
      if (k === RG.void) {
        let up = 0;
        while (up < 12 && c(x, y - up - 1) === RG.void) up++;
        const face = 6 + Math.round((vnoise(x, 0, 91, 9) + 1) * 3);
        if (up < 12 && up < face && c(x, y - up - 1) !== RG.water)
          set(i, FACE[Math.min(2, Math.floor((up / face) * 3))] ?? VOID);
        continue;
      }
      if (k === RG.water) {
        // a deck or the quay lays a short hard shadow on the water to its lower right
        for (let s = 1; s <= 4; s++) {
          const o = c(x - Math.ceil(s * 0.6), y - s);
          if (o === RG.deck || o === RG.sand || o === RG.stone || o === RG.grass) {
            mix(i, SHADE, s <= 2 ? 0.55 : 0.4);
            break;
          }
        }
        continue;
      }
      if (k === RG.deck && (c(x, y + 1) === RG.water || c(x, y + 2) === RG.water)) mix(i, LIP, 0.6);
      if (k === RG.sand) {
        let wet = 0;
        for (let r = 1; r <= 3 && !wet; r++)
          if (c(x + r, y) === RG.water || c(x - r, y) === RG.water || c(x, y + r) === RG.water)
            wet = r;
        if (wet) mix(i, [0x5a, 0x3d, 0x2b], wet === 1 ? 0.45 : 0.28);
      }
      if (k === RG.grass) {
        // a bank of dark earth at the waterline, the grass thinning into it, and a trodden verge along the road
        let bank = 0;
        for (let r = 1; r <= 4 && !bank; r++)
          if (c(x + r, y) === RG.water || c(x - r, y) === RG.water || c(x, y + r) === RG.water)
            bank = r;
        if (bank) mix(i, BANK, bank === 1 ? 0.7 : bank === 2 ? 0.5 : 0.22);
        else {
          let verge = 0;
          for (let r = 1; r <= 2 && !verge; r++)
            if (
              c(x + r, y) === RG.earth ||
              c(x - r, y) === RG.earth ||
              c(x, y + r) === RG.earth ||
              c(x, y - r) === RG.earth
            )
              verge = r;
          if (verge) mix(i, VERGE, verge === 1 ? 0.3 : 0.15);
        }
      }
      if (
        k !== RG.puddle &&
        (c(x, y + 1) === RG.puddle || c(x + 1, y) === RG.puddle || c(x - 1, y) === RG.puddle)
      )
        mix(i, SHADE, 0.35);
    }

  // 2b. variation, so no two stretches of the same ground read alike: a slow colour drift, the paths feet wear
  // lighter, wet patches, and a scatter of pebbles and shells with a highlight on their upper left
  const paths = new Set((cfg.wear?.paths ?? []).map(([x, y]) => `${x},${y}`));
  const wet = cfg.wear?.wet ?? 0.25;
  const soft = cfg.wear?.soft ?? false;
  const WORN: Rgb = [0xd9, 0xbf, 0x93];
  const TRODDEN: Rgb = [0x9c, 0x80, 0x62];
  const MUD: Rgb = [0x4a, 0x35, 0x2a];
  const PEBBLE: Rgb = [0x5a, 0x4a, 0x42];
  const GLINT: Rgb = [0xe8, 0xdc, 0xc4];
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x,
        k = c(x, y);
      if (k === RG.void || k === RG.water || k === RG.puddle) continue;
      // in three steps, not a smooth ramp, so the plate keeps a pixel artist's few tones per ground
      const t = vnoise(x, y, 77, 56) + vnoise(x, y, 78, 17) * 0.5;
      // soft: a finer noise and a per-pixel jitter carry each step's edge, so a patch's border is a grain, not a line
      const tt = soft ? t + vnoise(x, y, 79, 6) * 0.22 + (hash2(x, y, 92) - 0.5) * 0.22 : t;
      const drift = tt > 0.35 ? (soft ? 1.04 : 1.05) : tt < -0.35 ? (soft ? 0.96 : 0.95) : 1;
      for (let n = 0; n < 3; n++) d[i * 4 + n] = Math.min(255, at(d, i * 4 + n) * drift);
      if (k === RG.deck) continue;
      if (paths.size && soft) {
        // the trodden ground's border: the distance to the nearest worn cell's rectangle, broken by a slow noise and a
        // per-pixel jitter, so the path ends in a grain of its own, not along the cells' straight edges
        const gx = Math.floor((x - GRID.x) / CELL),
          gy = Math.floor((y - GRID.y) / CELL);
        let dist = 1e9;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            if (!paths.has(`${gx + ox},${gy + oy}`)) continue;
            const x0 = GRID.x + (gx + ox) * CELL,
              y0 = GRID.y + (gy + oy) * CELL;
            const ex = Math.max(x0 - x, 0, x - (x0 + CELL - 1)),
              ey = Math.max(y0 - y, 0, y - (y0 + CELL - 1));
            dist = Math.min(dist, Math.hypot(ex, ey));
          }
        const edge = dist + vnoise(x, y, 86, 14) * 8 + (hash2(x, y, 87) - 0.5) * 6;
        if (edge < 3)
          mix(
            i,
            k === RG.sand ? TRODDEN : WORN,
            (edge < 0 ? 0.22 : 0.12) * (k === RG.stone ? 0.55 : 1),
          );
      } else if (paths.size) {
        const qx = Math.floor((x - GRID.x + vnoise(x, y, 83, 13) * 9) / CELL),
          qy = Math.floor((y - GRID.y + vnoise(x, y, 84, 13) * 9) / CELL);
        if (paths.has(`${qx},${qy}`) && vnoise(x, y, 85, 5) > -0.6)
          mix(i, k === RG.sand ? TRODDEN : WORN, k === RG.stone ? 0.12 : 0.22);
      }
      const damp = vnoise(x, y, 81, 30) + vnoise(x, y, 82, 9) * 0.3;
      if (soft) {
        // a damp patch in two tones, its border dithered per pixel as a Wang tile's edge is
        const w = damp - (1 - wet) + (hash2(x, y, 93) - 0.5) * 0.2 + vnoise(x, y, 94, 5) * 0.08;
        if (w > 0) mix(i, MUD, w > 0.12 ? 0.24 : 0.14);
      } else if (damp > 1 - wet) mix(i, MUD, Math.min(0.3, (damp - (1 - wet)) * 1.2));
      const h = hash2(x, y, 91);
      if (h < 0.0035 && c(x, y - 1) === k && c(x - 1, y) === k) {
        mix(i, PEBBLE, 0.7);
        const up = (y - 1) * PW + x - 1;
        mix(up, GLINT, 0.45);
      }
    }

  // 2c. a raised deck (`cfg.raised`): the step's top lighter, and its front face of one dark plank with a lit top edge
  const STEP_TOP: Rgb = [0xe8, 0xd2, 0xa8];
  const STEP_FACE: Rgb = [0x6b, 0x4a, 0x33];
  const up = new Map((cfg.raised ?? []).map(([cx, cy, ramp]) => [`${cx},${cy}`, ramp]));
  for (const [cx, cy, ramp] of cfg.raised ?? []) {
    const x0 = GRID.x + cx * CELL,
      y0 = GRID.y + cy * CELL;
    const drop = !up.has(`${cx},${cy + 1}`);
    const face = drop ? (ramp ? 5 : 9) : 0;
    for (let y = y0; y < y0 + CELL; y++)
      for (let x = x0; x < x0 + CELL; x++) {
        // only the deck itself: the plank edge's organic outline over the water stays as baked
        if (c(x, y) !== RG.deck) continue;
        const i = y * PW + x,
          fy = y - (y0 + CELL - face);
        if (fy < 0) mix(i, STEP_TOP, 0.16);
        else if (fy === 0) set(i, STEP_TOP);
        else if (fy === face - 1) set(i, LIP);
        else mix(i, STEP_FACE, 0.85);
      }
  }

  // 2d. raised rock (`terrain.raised`): the cliff and the lookout's rise
  const faces = tr.config.raised ? paintMasses(tr, tiles, c, set, mix, PW, PH) : null;

  const classes = new Uint8Array(PW * PH);
  for (let i = 0; i < classes.length; i++)
    classes[i] = faces?.[i] ? CLASS.face : (CLASS_OF[(cls[i] ?? 0) as RgClass] ?? CLASS.void);
  const clean: RgbaImage = { width: PW, height: PH, data: new Uint8ClampedArray(d) };
  const bare: RgbaImage = { width: PW, height: PH, data: new Uint8ClampedArray(d) };

  // 3. the pieces
  const sprites = new Map<string, RgbaImage>();
  const placed: Placed[] = cfg.layout.objects.map((o) => {
    let img = sprites.get(o.sprite);
    if (!img) {
      img = cleanSprite(load(objectFile(o.sprite)));
      sprites.set(o.sprite, img);
    }
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
  for (const p of placed)
    if (FLAT_KINDS.has(p.o.kind)) {
      draw(g, p.img, p.x, p.y);
      draw(bare, p.img, p.x, p.y);
    }
  const shadows: Baked['shadows'][number][] = [];
  for (const p of placed) {
    if (FLAT_KINDS.has(p.o.kind)) continue;
    const { record } = groundObject(g, p, classes, false, shadowOptions(p, RG02_PROP_FOOT));
    shadows.push(record);
  }
  const { cover, uprights } = standingUprights(placed, new Map(), g, tr.origin);
  // The edge check's key. A deck's side over the harbour is built timber, ruled as straight as its boards, so it is
  // left out as the canal's kerbs are (`terrainEdge`): the planks and the water share a key, and every other
  // boundary counts.
  const edges = cls.map((k, i) => (faces?.[i] ? 250 : k === RG.deck ? RG.water : k));
  return {
    origin: tr.origin,
    ground: g,
    clean,
    bare,
    classes,
    edges,
    cover,
    shadows,
    bridgeShadows: [],
    uprights,
    placed,
  };
}

/** The terrace's cut face as one strip, 42 px from its lit lip to its foot (`q_terrace32`, as the quarry's and Ba Dan's). */
function faceStrip(): (x: number, row: number) => Rgb {
  const top = wang('q_terrace32', 'UUTT'),
    foot = wang('q_terrace32', 'TTLL');
  return (x, row) => {
    const r = Math.max(0, Math.min(41, row));
    const img = r < 18 ? top : foot;
    const ty = r < 18 ? 14 + r : r - 18;
    const tx = ((x % T) + T) % T;
    const i = (ty * img.width + tx) * 4;
    return [at(img.data, i), at(img.data, i + 1), at(img.data, i + 2)];
  };
}

/** The mean colour of a tile. */
function meanOf(tile: RgbaImage): Rgb {
  const m = [0, 0, 0];
  const n = tile.width * tile.height;
  for (let i = 0; i < n; i++)
    for (let k = 0; k < 3; k++) m[k] = (m[k] ?? 0) + at(tile.data, i * 4 + k) / n;
  return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0];
}

/**
 * The raised rock (`Rg02Terrain.massAt`): each mass's top keeps the stone it was drawn with, ringed by a 1 px outline
 * in a darker tone of the rock, lit along its left side and shaded along its right (the light comes from the upper
 * left); its cut face is the terrace's strip, tinted to the rock and stratified, lit at the lip and darkening to a foot
 * that meets the ground in the hard shadow tone; and it casts a short hard band on the ground to its lower right, a
 * tier at a time. A ramp's stone (a raised character's flat neighbour, the lookout's `S`) falls gently to the road in
 * three worn steps. Returns which plate pixels are face.
 */
function paintMasses(
  tr: Rg02Terrain,
  tiles: Rg02Tiles,
  c: (x: number, y: number) => number,
  set: (i: number, col: Rgb) => void,
  mix: (i: number, col: Rgb, a: number) => void,
  PW: number,
  PH: number,
): Uint8Array {
  const rock = tiles[RG.stone];
  const strip = faceStrip();
  // the strip's grey is the quarry's; scale it to the rock's own, so the face is the same stone as the top
  const want = rock ? meanOf(rock) : ([150, 145, 135] as Rgb);
  const have = meanOf(wang('q_terrace32', 'UUTT'));
  const tint = [0, 1, 2].map((k) => (want[k] ?? 1) / Math.max(1, have[k] ?? 1));
  const DARK: Rgb = [0x4a, 0x44, 0x40];
  const LIGHT: Rgb = [0xe2, 0xdc, 0xcc];
  const faces = new Uint8Array(PW * PH);
  const mass = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= PW || y >= PH ? 0 : tr.massAt(x, y).tiers;
  const top = (x: number, y: number): boolean => {
    const m = x < 0 || y < 0 || x >= PW || y >= PH ? null : tr.massAt(x, y);
    return !!m && m.tiers > 0 && !m.face;
  };
  // the top or a ramp running up onto it: the lit and shaded rims follow where the rock drops, not the ramp's seam
  const level = (x: number, y: number): boolean =>
    top(x, y) || (!mass(x, y) && c(x, y) === RG.stone);
  const ramp = new Set(
    tr.config.rows.flatMap((row, y) =>
      [...row].flatMap((ch, x) =>
        tr.config.chars[ch] === RG.stone && !(tr.config.raised ?? {})[ch] ? [`${x},${y}`] : [],
      ),
    ),
  );
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x;
      const m = tr.massAt(x, y);
      if (m.face) {
        faces[i] = 1;
        const H = m.faceH,
          row = m.face;
        const s = strip(x + Math.floor(hash2(Math.floor(x / 23), H, 151) * 32), 42 - (H - row) - 1);
        // the face is turned from the light: a step darker than the top at its lip, darker still to its foot
        const sh = 0.8 - (0.26 * row) / H;
        let col: Rgb = [
          Math.min(255, s[0] * (tint[0] ?? 1) * sh),
          Math.min(255, s[1] * (tint[1] ?? 1) * sh),
          Math.min(255, s[2] * (tint[2] ?? 1) * sh),
        ];
        // vertical cracks: a dark seam down part of the face, lit on its left
        const seam = hash2(x, 0, 153) < 0.07 && row > 2 && row < H - 1;
        const seamL = hash2(x + 1, 0, 153) < 0.07 && row > 2 && row < H - 1;
        if (seam) col = mixRgb(col, SHADE, 0.45);
        else if (seamL) col = mixRgb(col, LIGHT, 0.18);
        // a ledge at each tier of a tall face: a lit line with its shadow under it
        for (let k = 1; H - k * FACE_TIER > 6; k++) {
          const ledge = H - k * FACE_TIER;
          if (row === ledge) col = mixRgb(col, LIGHT, 0.3);
          else if (row === ledge + 1) col = mixRgb(col, SHADE, 0.35);
        }
        if (row === 1) col = mixRgb(col, LIGHT, 0.55);
        else if (row === 2) col = mixRgb(col, LIGHT, 0.15);
        if (row >= H - 1) col = mixRgb(col, SHADE, row === H ? 0.6 : 0.35);
        // the face's ends: lit on the left, dark on the right
        if (!mass(x - 1, y) && c(x - 1, y) !== RG.stone) col = mixRgb(col, LIGHT, 0.25);
        else if (!mass(x + 1, y) && c(x + 1, y) !== RG.stone) col = mixRgb(col, DARK, 0.5);
        set(i, col);
        continue;
      }
      if (m.tiers) {
        // the smoothing's added pixels: the rock, not the ground the noise had there
        if (c(x, y) !== RG.stone && rock) set(i, quilt(rock, x, y, 31 + RG.stone * 13));
        // the top: a 1 px outline of darker rock where it meets lower ground, lit inside its left and top edges
        // (a ramp's stone runs up onto the top with no edge)
        const low = (X: number, Y: number): boolean => !mass(X, Y) && c(X, Y) !== RG.stone;
        const edgeL = low(x - 1, y),
          edgeR = low(x + 1, y),
          edgeT = low(x, y - 1);
        if (edgeL || edgeR || edgeT) {
          mix(i, DARK, 0.6);
          continue;
        }
        if (!level(x - 1, y - 1) || !level(x - 2, y)) mix(i, LIGHT, 0.3);
        else if (!level(x + 2, y) || !level(x + 1, y + 1)) mix(i, SHADE, 0.2);
        continue;
      }
      if (c(x, y) === RG.stone) {
        // a ramp: three worn steps falling to the south
        const cx = Math.floor((x - GRID.x) / CELL),
          cy = Math.floor((y - GRID.y) / CELL);
        if (ramp.has(`${cx},${cy}`)) {
          const ly = y - (GRID.y + cy * CELL) + Math.round(vnoise(x, y, 155, 7) * 1.5);
          const step = [11, 23, 34].find((v) => ly === v || ly === v + 1);
          if (step !== undefined) mix(i, ly === step ? LIGHT : SHADE, ly === step ? 0.22 : 0.3);
          else mix(i, SHADE, Math.max(0, (ly - 6) / 40) * 0.12);
        }
      }
      // the mass's cast: a short hard band on the ground to its lower right, a tier at a time
      if (c(x, y) === RG.water || c(x, y) === RG.void) continue;
      for (let s = 1; s <= 7; s++) {
        const t = mass(x - Math.floor(s / 2), y - s);
        if (t && s <= 3 + t * 2) {
          mix(i, SHADE, s <= 2 ? 0.5 : 0.36);
          break;
        }
      }
    }
  // the tops: sparse dry tufts on both, and on the cliff low outcrops of its own stone, lit on the upper left and
  // casting to the lower right, clear of the edges
  const clearOf = (x: number, y: number, r: number): boolean => {
    for (let oy = -r; oy <= r; oy++)
      for (let ox = -r; ox <= r; ox++) if (!top(x + ox, y + oy)) return false;
    return true;
  };
  const DRY: readonly Rgb[] = [
    [0x6b, 0x6a, 0x3a],
    [0x8d, 0x88, 0x4a],
    [0xb4, 0xa8, 0x62],
  ];
  const box = tr.massBox();
  if (!box) return faces;
  // the cliff's top is high ground gone to grass in patches, the rock showing between; a patch keeps clear of the
  // rim and thins to a 1 px soil edge on its lower right
  const grass = tiles[RG.grass];
  const sod = (x: number, y: number): boolean =>
    mass(x, y) >= 2 &&
    top(x, y) &&
    vnoise(x, y, 181, 26) + vnoise(x, y, 182, 7) * 0.35 + (hash2(x, y, 183) - 0.5) * 0.12 > 0.38 &&
    clearOf(x, y, 5);
  const sodded = new Uint8Array(PW * PH);
  if (grass)
    for (let y = box.y0; y < box.y1; y++)
      for (let x = box.x0; x < box.x1; x++) {
        if (!sod(x, y)) continue;
        const i = y * PW + x;
        sodded[i] = 1;
        set(i, quilt(grass, x, y, 31 + RG.grass * 13));
        if (!sod(x + 1, y) || !sod(x, y + 1)) mix(i, BANK, 0.55);
        else if (!sod(x - 1, y) || !sod(x, y - 1)) mix(i, LIGHT, 0.12);
      }
  for (let y = box.y0; y < box.y1; y++)
    for (let x = box.x0; x < box.x1; x++) {
      if (!top(x, y) || sodded[y * PW + x] || hash2(x, y, 161) > 0.004 || !clearOf(x, y, 3))
        continue;
      const len = 2 + Math.floor(hash2(x, y, 162) * 2);
      for (let b = 0; b < 3; b++)
        for (let st = 0; st < len; st++) {
          const X = x + Math.round((b - 1) * st * 0.5),
            Y = y - st;
          if (top(X, Y)) set(Y * PW + X, DRY[st >= len - 1 ? 2 : st ? 1 : 0] ?? SHADE);
        }
    }
  for (let cy = Math.floor(box.y0 / 24); cy <= box.y1 / 24; cy++)
    for (let cx = Math.floor(box.x0 / 24); cx <= box.x1 / 24; cx++) {
      if (hash2(cx, cy, 171) > 0.22) continue;
      const ox = (cx + 0.2 + hash2(cx, cy, 172) * 0.6) * 24,
        oy = (cy + 0.2 + hash2(cx, cy, 173) * 0.6) * 24;
      const rx = 6 + hash2(cx, cy, 174) * 12,
        ry = 4 + hash2(cx, cy, 175) * 6;
      if (mass(Math.round(ox), Math.round(oy)) < 2) continue;
      const inside = (x: number, y: number): boolean =>
        Math.hypot((x - ox) / rx, (y - oy) / ry) +
          vnoise(x, y, 176, 5) * 0.35 +
          vnoise(x, y, 177, 2) * 0.1 <
        1;
      let clear = true;
      for (let y = Math.floor(oy - ry - 3); y <= oy + ry + 9 && clear; y++)
        for (let x = Math.floor(ox - rx - 3); x <= ox + rx + 6; x++)
          if (!top(x, y) || sodded[y * PW + x]) {
            clear = false;
            break;
          }
      if (!clear) continue;
      for (let y = Math.floor(oy - ry - 1); y <= oy + ry + 4; y++)
        for (let x = Math.floor(ox - rx - 1); x <= ox + rx + 4; x++) {
          const i = y * PW + x;
          if (inside(x, y)) {
            const lit = !inside(x - 1, y - 1),
              dark = !inside(x + 1, y + 1);
            const edge =
              !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
            if (edge && !lit) mix(i, DARK, 0.55);
            else if (lit) mix(i, LIGHT, 0.4);
            else if (dark) mix(i, SHADE, 0.3);
            else mix(i, LIGHT, 0.08);
          } else if (inside(x - 2, y - 2) || inside(x - 1, y - 3)) mix(i, SHADE, 0.3);
        }
    }
  return faces;
}

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] * (1 - t) + b[0] * t,
  a[1] * (1 - t) + b[1] * t,
  a[2] * (1 - t) + b[2] * t,
];

/** The cells whose foot point is on the planks or the flagstones: their feet blob is drawn at paving's strength. */
function pavedCells(cfg: Rg02BoardConfig, baked: Baked): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const tr = cfg.terrain;
  for (let cy = 0; cy < tr.gh; cy++)
    for (let cx = 0; cx < tr.gw; cx++) {
      const X = GRID.x + cx * CELL + CELL / 2,
        Y = GRID.y + cy * CELL + CELL - 9;
      if (baked.classes[Y * tr.plateW + X] === CLASS.C) out.push({ x: cx, y: cy });
    }
  return out;
}

function scene(cfg: Rg02BoardConfig, baked: Baked, uprights: readonly UprightData[]): MapScene {
  const url = `art/topdown/${cfg.folder}`;
  const byId = new Map(uprights.map((u) => [u.id, u]));
  const scenery: SceneScenery[] = cfg.layout.objects.flatMap((o) => {
    const art = byId.get(o.id);
    if (!art) return [];
    return [
      {
        id: `${cfg.id}.td.${o.id}`,
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
  const tr = cfg.terrain;
  return {
    paintedWater: true,
    paintExtent: { x: tr.origin.x, y: tr.origin.y, width: tr.plateW, height: tr.plateH },
    actorGrounding: { contact: 205 / 255, ink: { r: 0x32, g: 0x21, b: 0x25 } },
    pavedCells: pavedCells(cfg, baked),
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
  };
}

export function rg02Board(cfg: Rg02BoardConfig): TopDownBoard {
  return {
    id: cfg.id,
    out: `public/art/topdown/${cfg.folder}`,
    url: `art/topdown/${cfg.folder}`,
    bake: () => bake(cfg),
    scene: (baked, uprights) => scene(cfg, baked, uprights),
  };
}
