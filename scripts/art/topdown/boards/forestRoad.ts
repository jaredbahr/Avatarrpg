/**
 * The Forest Road's top-down board (ADR 0104 §3, phase T4): the prototype's forest bake
 * (`prototypes/topdown/src/b3/world_forest.js` `bakeForest`, owner-approved in
 * `forest-combat.html`) re-implemented over RGBA buffers on the game's rows and the layout
 * (`src/content/scenes/forestRoad.topdown.ts`), packed by `pack-ground.ts --map forest_road` under
 * `public/art/topdown/forest-road/`.
 *
 * - **Plate**: the forest floor's dark moss and fern tiles (sunlit grass only in dapples), the road,
 *   the creek and the muddy puddle, each pixel by the terrain classifier; the floor darkening into
 *   the road's verge, a mud bank along the water, the puddle's wet rim; tufts creeping over the
 *   road's edge; the dark under the trees deepening toward the frame in hard steps; the flat
 *   dressing (tufts, flowers); every standing object's static grounding (`lib/grounding.ts`).
 * - **Uprights**: the pines, alders and bushes, the bank's boulders and rubble, and the roadside
 *   pieces, each with its grass fringe over its foot, in one atlas.
 *
 * The sprites are the prototype page's own: `prototypes/topdown/fc/obj_*.png` for the forest set,
 * `assets/objects8/` for the Ba Dan pieces it borrows (alpha cut at 128, trimmed, as `build_b3.py`
 * does), and the alders and dark bushes recoloured from Ba Dan's tree and bush the same way.
 */
import { readdirSync } from 'node:fs';
import type { MapScene, SceneScenery } from '../../../../src/core/types';
import type { TopDownObject } from '../../../../src/content/topdownLayout';
import { FOREST_TOPDOWN_LAYOUT } from '../../../../src/content/topdownLayouts';
import {
  CELL,
  FOREST,
  GH,
  GRID,
  GW,
  ORIGIN,
  PLATE_H,
  PLATE_W,
  TILE as T,
  forestClass,
  hash2,
  vnoise,
  type ForestClass,
} from '../../../../src/content/scenes/forestRoad.topdown.terrain';
import type { RgbaImage } from '../../../../src/render/shadow/hardShadowMask';
import {
  ASSETS,
  CLASS,
  type Baked,
  type Placed,
  type TopDownBoard,
  type UprightData,
} from '../lib/board';
import { groundObject, seatFringe, shadowOptions, standingUprights } from '../lib/grounding';
import { at, blank, crop, draw, fill, hex, load } from '../lib/raster';
import { cleanSprite } from '../lib/sprites';

export const OUT = 'public/art/topdown/forest-road';
export const URL_ROOT = 'art/topdown/forest-road';
/** The approved page's forest objects (`forest-objects.test.ts` holds them to the page). */
export const FC = 'prototypes/topdown/fc';

/**
 * The shadow's strength on the forest floor: the moss is dark, so the one shadow colour at soft
 * ground's strength (1) barely shows on it (`art-lessons.md`: the colour has a floor) and the
 * prototype's casts fell short of the contrast the floor allows. 1.6 is the least that brings every
 * visible cast to it (`shadowTable`); the road keeps paving's 1.3.
 */
const FLOOR_SCALE = 1.6;
const GR = ['#243d33', '#35593f', '#4f7d4a', '#7aa05a', '#a9c46f', '#c9d98a'] as const;
/** The forest set the prototype drew (`fc/`), and the Ba Dan pieces it borrowed (`objects8/`). */
const FOREST_SET = new Set([
  'boulder',
  'cart_wheel',
  'hay_bale',
  'log',
  'milestone',
  'oil_flask',
  'pine_a',
  'pine_b',
  'pine_c',
  'puddle',
  'rubble',
  'stump',
]);
/** The creek's alders and bushes: Ba Dan's own sprites, darkened and cooled to sit in the pines. */
const RECOLOURED: Readonly<Record<string, string>> = { alder: 'tree', bush_dark: 'bush' };
const BRIGHTNESS = Math.fround(0.62);

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

const mean = (img: RgbaImage): [number, number, number] => {
  const s = [0, 0, 0];
  for (let i = 0; i < img.data.length; i += 4)
    for (let c = 0; c < 3; c++) s[c] = (s[c] ?? 0) + at(img.data, i + c);
  const n = img.width * img.height;
  return [(s[0] ?? 0) / n, (s[1] ?? 0) / n, (s[2] ?? 0) / n];
};

/**
 * The tile strip the prototype samples (`build_b3.py`): 0 the sunlit floor, 1 the road, 2 the
 * creek, then the 16 floor variants (moss, fern, leaf litter, roots).
 */
export function tileStrip(): RgbaImage[] {
  const pure = (dir: string, key: string): RgbaImage => load(`${ASSETS}/tiles/${dir}/c${key}.png`);
  const green = (im: RgbaImage): number => {
    const [r, g, b] = mean(im);
    return g - (r + b) / 2;
  };
  const blue = (im: RgbaImage): number => {
    const [r, , b] = mean(im);
    return b - r;
  };
  const g0 = pure('fc_road32', '0000'),
    g1 = pure('fc_road32', '1111');
  const [floor, road] = green(g0) > green(g1) ? [g0, g1] : [g1, g0];
  const w0 = pure('fc_creek32', '0000'),
    w1 = pure('fc_creek32', '1111');
  const water = blue(w0) > blue(w1) ? w0 : w1;
  const dir = `${ASSETS}/tiles/fc_var_floor`;
  const variants = readdirSync(dir)
    .filter((f) => /^tile_\d+\.png$/.test(f))
    .sort((a, b) => Number(a.slice(5, -4)) - Number(b.slice(5, -4)))
    .map((f) => crop(load(`${dir}/${f}`), 0, 0, T, T));
  return [floor, road, water, ...variants].map((t) => crop(t, 0, 0, T, T));
}

/** Trimmed to the opaque pixels' box (PIL's `getbbox` on the alpha). */
function bbox(img: RgbaImage): RgbaImage {
  let x0 = img.width,
    y0 = img.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (at(img.data, (y * img.width + x) * 4 + 3)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return x1 < 0 ? img : crop(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

/**
 * A prototype object as the page embeds it (`build_b3.py`): the forest set as drawn; a borrowed Ba
 * Dan piece with alpha under 128 cleared and the rest made opaque, trimmed; an alder or a dark bush
 * from Ba Dan's tree or bush at 0.62 brightness (PIL's truncating blend with black), red at 0.9 and
 * blue at 1.08, its alpha kept, trimmed.
 */
export function prototypeObject(name: string): RgbaImage {
  if (FOREST_SET.has(name)) return load(`${FC}/obj_${name}.png`);
  const recolour = RECOLOURED[name];
  const img = load(`${ASSETS}/objects8/${recolour ?? name}.png`);
  const d = new Uint8ClampedArray(img.data);
  for (let i = 0; i < d.length; i += 4) {
    if (recolour) {
      // PIL's `Image.blend` with black multiplies in single precision and truncates
      const dim = (v: number): number => Math.trunc(Math.fround(BRIGHTNESS * v));
      const r = dim(at(d, i)),
        g = dim(at(d, i + 1)),
        b = dim(at(d, i + 2));
      d[i] = Math.trunc(r * 0.9);
      d[i + 1] = g;
      d[i + 2] = Math.min(255, Math.trunc(b * 1.08));
    } else if (at(d, i + 3) > 0 && at(d, i + 3) < 128) d.fill(0, i, i + 4);
    else if (at(d, i + 3)) d[i + 3] = 255;
  }
  return bbox({ width: img.width, height: img.height, data: d });
}

/* ------------------------------------------------------------------ */
/* The bake                                                            */
/* ------------------------------------------------------------------ */

const CLASS_OF: Readonly<Record<ForestClass, number>> = {
  [FOREST.floor]: CLASS.G,
  [FOREST.road]: CLASS.D,
  [FOREST.water]: CLASS.W,
  [FOREST.puddle]: CLASS.W,
};

export function bake(objects: readonly TopDownObject[] = FOREST_TOPDOWN_LAYOUT.objects): Baked {
  const PW = PLATE_W,
    PH = PLATE_H;
  const strip = tileStrip();
  const sprites = new Map<string, RgbaImage>();
  for (const o of objects)
    if (!sprites.has(o.sprite)) sprites.set(o.sprite, cleanSprite(prototypeObject(o.sprite)));
  const placed: Placed[] = objects.map((o) => {
    const img = sprites.get(o.sprite);
    if (!img) throw new Error(`no sprite ${o.sprite}`);
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

  const g = blank(PW, PH);
  const d = g.data;
  const cls = new Uint8Array(PW * PH);
  const tile = (i: number): RgbaImage => strip[i] ?? strip[0] ?? blank(T, T);

  // 1. terrain per pixel: the floor's moss and fern tiles (now and then leaf litter or a root), the
  // road, the creek, the puddle (the creek's water, silted, with rare glints); sunlit grass in dapples
  const MOSS = [0, 3, 12, 13, 14, 15];
  for (let ty = 0; ty * T < PH; ty++)
    for (let tx = 0; tx * T < PW; tx++) {
      const hv = hash2(tx, ty, 17);
      // the prototype's rare root tiles drew four variants; three of them have a lighter ground that
      // shows each as a square (art-lessons: never swap per-tile variants on a flat floor), so the
      // root on the moss's own ground stands for all four
      const fv = 3 + (hv < 0.05 ? 8 : (MOSS[Math.floor(hash2(tx, ty, 18) * MOSS.length)] ?? 0));
      for (let py = 0; py < T; py++)
        for (let px = 0; px < T; px++) {
          const wx = tx * T + px,
            wy = ty * T + py;
          if (wx >= PW || wy >= PH) continue;
          const c = forestClass(wx, wy);
          const i = wy * PW + wx;
          cls[i] = c;
          const j = (py * T + px) * 4;
          if (c === FOREST.puddle) {
            const w = tile(2).data,
              k = 0.42;
            if (hash2(wx, wy, 77) < 0.0025) d.set([150, 168, 164, 255], i * 4);
            else {
              d[i * 4] = at(w, j) * (1 - k) + 112 * k;
              d[i * 4 + 1] = at(w, j + 1) * (1 - k) + 104 * k;
              d[i * 4 + 2] = at(w, j + 2) * (1 - k) + 86 * k;
              d[i * 4 + 3] = 255;
            }
          } else {
            const dap =
              c === FOREST.floor && vnoise(wx, wy, 41, 46) + vnoise(wx, wy, 43, 9) * 0.25 > 0.72;
            const t = tile(c === FOREST.road ? 1 : c === FOREST.water ? 2 : dap ? 0 : fv).data;
            d[i * 4] = at(t, j);
            d[i * 4 + 1] = at(t, j + 1);
            d[i * 4 + 2] = at(t, j + 2);
            d[i * 4 + 3] = 255;
          }
        }
    }

  // 2. edges: the floor darkens into the road's verge, a mud bank runs along the water, the puddle
  // gets a wet dark rim (the prototype's `near` returns the first hit in scan order, not the nearest)
  const near = (x: number, y: number, want: number, r: number): number => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx,
          yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < PW && yy < PH && cls[yy * PW + xx] === want)
          return Math.abs(dx) + Math.abs(dy) || 1;
      }
    return 0;
  };
  const mix = (i: number, col: readonly number[], a: number): void => {
    for (let k = 0; k < 3; k++) d[i * 4 + k] = at(d, i * 4 + k) * (1 - a) + at(col, k) * a;
  };
  for (let y = 1; y < PH - 1; y++)
    for (let x = 1; x < PW - 1; x++) {
      const i = y * PW + x,
        c = cls[i];
      if (c === FOREST.floor) {
        if (near(x, y, FOREST.road, 1)) mix(i, [50, 33, 37], 0.32);
        const w = near(x, y, FOREST.water, 2);
        if (w) mix(i, w === 1 ? [58, 46, 44] : [90, 61, 43], 0.55);
      }
      if (c === FOREST.road) {
        if (near(x, y, FOREST.water, 2)) mix(i, [58, 46, 44], 0.5);
        if (near(x, y, FOREST.puddle, 1)) mix(i, [58, 46, 44], 0.55);
      }
      if (c === FOREST.puddle && near(x, y, FOREST.road, 1)) mix(i, [50, 33, 37], 0.45);
    }

  // 3. tufts creeping over the road's edge
  for (let k = 0; k < 900; k++) {
    const x = 2 + Math.floor(hash2(k, 1, 71) * (PW - 4)),
      y = 2 + Math.floor(hash2(k, 2, 71) * (PH - 4));
    if (cls[y * PW + x] !== FOREST.road || !near(x, y, FOREST.floor, 2)) continue;
    for (let b = 0; b < 3; b++) {
      const len = 2 + Math.floor(hash2(k, b, 72) * 3),
        lean = b - 1;
      for (let s = 0; s < len; s++)
        fill(g, x + Math.round(lean * s * 0.5), y + 1 - s, 1, 1, hex(s >= len - 1 ? GR[4] : GR[2]));
    }
  }

  const frame = new Uint8Array(PW * PH);
  // 4. the world's edge: the dark under the trees deepens toward the frame in hard steps. The
  // prototype lays it last, over the shadows; here it is ground, so the shadows and the seating
  // checks measure against the ground as it is drawn.
  for (let y = 0; y < PH; y += 4)
    for (let x = 0; x < PW; x += 4) {
      const e = Math.min(x, y * 1.4, PW - x, (PH - y) * 3);
      const a = e < 24 ? 0.42 : e < 48 ? 0.26 : e < 72 ? 0.12 : 0;
      if (!a) continue;
      fill(g, x, y, 4, 4, [20, 14, 16], a);
      for (let yy = y; yy < Math.min(PH, y + 4); yy++)
        frame.fill(1, yy * PW + x, yy * PW + Math.min(PW, x + 4));
    }

  const classes = new Uint8Array(PW * PH);
  for (let i = 0; i < classes.length; i++)
    classes[i] = CLASS_OF[(cls[i] ?? 0) as ForestClass] ?? CLASS.G;
  const clean: RgbaImage = { width: PW, height: PH, data: new Uint8ClampedArray(d) };
  const bare: RgbaImage = { width: PW, height: PH, data: new Uint8ClampedArray(d) };

  // 5. every object: the flat dressing first, then each one's own grounding, the grass kit on the floor
  for (const p of placed)
    if (p.o.kind === 'flat') {
      draw(g, p.img, p.x, p.y);
      draw(bare, p.img, p.x, p.y);
    }
  const shadows: Baked['shadows'][number][] = [];
  const fringes = new Map<Placed, RgbaImage>();
  for (const p of placed) {
    if (p.o.kind === 'flat') continue;
    const ux = Math.max(0, Math.min(PW - 1, p.x + (p.w >> 1))),
      uy = Math.min(PH - 1, p.base - 2);
    const soft = cls[uy * PW + ux] === FOREST.floor;
    const { record, fringe } = groundObject(g, p, classes, soft, shadowOptions(p), {
      softScale: FLOOR_SCALE,
      dryKit: true,
    });
    shadows.push(record);
    if (fringe) {
      seatFringe(fringe, p, record.m, classes, soft ? FLOOR_SCALE : 1.3, g);
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
    cover,
    frame,
    shadows,
    bridgeShadows: [],
    uprights,
    placed,
  };
}

/**
 * The cells whose foot point (a figure's feet, the prototype's `cellY`) is on the road: their feet
 * blob is drawn at the harder strength, as the prototype's is on the road (`MapScene.pavedCells`).
 */
export function pavedCells(baked: Baked): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let cy = 0; cy < GH; cy++)
    for (let cx = 0; cx < GW; cx++) {
      const X = GRID.x + cx * CELL + CELL / 2,
        Y = GRID.y + cy * CELL + CELL - 9;
      if (baked.classes[Y * PLATE_W + X] === CLASS.D) out.push({ x: cx, y: cy });
    }
  return out;
}

/**
 * The Forest Road's top-down scene (ADR 0104, T4) as the runtime reads it: the baked plate and each
 * standing piece, cut from the upright atlas and laid out by the placed objects, sorted by its base;
 * the trees and the tall roadside pieces fade over a figure behind them. Every static shadow is in
 * the plate, and the puddle is painted, so the rules' permanent water there draws no film.
 */
export function topdownScene(baked: Baked, uprights: readonly UprightData[]): MapScene {
  const byId = new Map(uprights.map((u) => [u.id, u]));
  const scenery: SceneScenery[] = FOREST_TOPDOWN_LAYOUT.objects.flatMap((o) => {
    const art = byId.get(o.id);
    if (!art) return [];
    return [
      {
        id: `forest.td.${o.id}`,
        url: `${URL_ROOT}/uprights.webp`,
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
      { url: `${URL_ROOT}/ground.webp`, x: ORIGIN.x, y: ORIGIN.y, width: PLATE_W, height: PLATE_H },
    ],
    scenery,
  };
}

/** The Forest Road's board: the forest map's plate, uprights and scene under `forest-road/`. */
export const FOREST_ROAD_BOARD: TopDownBoard = {
  id: 'forest_road',
  out: OUT,
  url: URL_ROOT,
  bake: () => {
    if (FOREST_TOPDOWN_LAYOUT.terrain.kind !== 'forest-floor')
      throw new Error('the Forest Road bakes forest-floor terrain');
    return bake();
  },
  scene: topdownScene,
};
