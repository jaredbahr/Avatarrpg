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
import { readdirSync } from 'node:fs';
import type { MapScene, SceneScenery } from '../../../../src/core/types';
import type { TopDownLayout } from '../../../../src/content/topdownLayout';
import {
  CELL,
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

export function rg02Tiles(earth: 'parade' | 'yard' = 'parade'): Rg02Tiles {
  return {
    [RG.water]: wang('rg02_quay', 'LLLL'),
    [RG.deck]: wang('rg02_planks2', 'UUUU'),
    [RG.sand]: wang('rg02_quay', 'UUUU'),
    [RG.earth]: wang(earth === 'yard' ? 'rg02_yard' : 'rg02_parade', 'LLLL'),
    [RG.stone]: wang('rg02_parade', 'UUUU'),
    [RG.puddle]: wang('rg02_yard', 'UUUU'),
    [RG.void]: undefined,
  };
}

const VOID: Rgb = [0x1c, 0x17, 0x19];
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
};

export interface Rg02BoardConfig {
  readonly id: string;
  readonly folder: string;
  readonly terrain: Rg02Terrain;
  readonly layout: TopDownLayout;
  readonly earth?: 'parade' | 'yard';
  /** The ground's wear: cells walked into a lighter path, and how much of the open ground lies wet. */
  readonly wear?: {
    readonly paths?: readonly (readonly [number, number])[];
    readonly wet?: number;
    /** Organic edges for the colour drift, the wet patches and the quilt's seams: per-pixel, not stepped and square. */
    readonly soft?: boolean;
  };
}

export function bake(cfg: Rg02BoardConfig): Baked {
  const tr = cfg.terrain;
  const PW = tr.plateW,
    PH = tr.plateH;
  const tiles = rg02Tiles(cfg.earth);
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
          if (o === RG.deck || o === RG.sand || o === RG.stone) {
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

  const classes = new Uint8Array(PW * PH);
  for (let i = 0; i < classes.length; i++)
    classes[i] = CLASS_OF[(cls[i] ?? 0) as RgClass] ?? CLASS.void;
  const clean: RgbaImage = { width: PW, height: PH, data: new Uint8ClampedArray(d) };
  const bare: RgbaImage = { width: PW, height: PH, data: new Uint8ClampedArray(d) };

  // 3. the pieces
  const sprites = new Map<string, RgbaImage>();
  const placed: Placed[] = cfg.layout.objects.map((o) => {
    let img = sprites.get(o.sprite);
    if (!img) {
      img = cleanSprite(load(`${ASSETS}/objects_rg02/${o.sprite}.png`));
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
  const edges = cls.map((k) => (k === RG.deck ? RG.water : k));
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
