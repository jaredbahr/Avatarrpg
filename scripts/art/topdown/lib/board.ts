/**
 * One top-down board as the ground packer sees it (ADR 0104 §3, #461): a config (the map, where its
 * files go, its baker and its scene) and what a baker returns. The library packs any board the same
 * way: the baked plate as one lossless page, the standing objects in one upright atlas, and the
 * scene the runtime draws (`scene.json`, a `MapScene`) beside them. Adding a board is a config and a
 * baker under `boards/`; nothing here changes.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { composeAtlas, shelfPack } from '../../lib/atlas';
import { encodeWebpLossless } from '../../lib/webp';
import type { MapScene, Vec2 } from '../../../../src/core/types';
import type { TopDownObject } from '../../../../src/content/topdownLayout';
import type { RgbaImage, ShadowMask } from '../../../../src/render/shadow/hardShadowMask';
import { asImage, lossless } from './raster';

/** Where the PixelLab sources live (never copied to `public/`). */
export const ASSETS = 'prototypes/topdown/assets';
/** The margin round an upright for its fringe (the grass kit's `m`). */
export const FRINGE_MARGIN = 10;
const GUTTER = 1;
const ATLAS_WIDTH = 1024;

/** Each pixel's terrain class as the bake laid it, for the edge checks. */
export const CLASS = { G: 0, C: 1, W: 2, D: 3, face: 4, void: 5 } as const;

/** A placed object in the board's plate px: its sprite's top-left, size and base. */
export interface Placed {
  readonly o: TopDownObject;
  readonly img: RgbaImage;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly base: number;
}

export interface ShadowRecord {
  readonly id: string;
  readonly m: ShadowMask;
  readonly dx: number;
  readonly dy: number;
}

export interface Upright {
  readonly id: string;
  readonly image: RgbaImage;
  /** Top-left in game world px. */
  readonly x: number;
  readonly y: number;
}

export interface Baked {
  /** The plate's top-left in game world px. */
  readonly origin: Vec2;
  readonly ground: RgbaImage;
  /** The plate before any object was grounded on it (no cast, apron or kit): clean ground. */
  readonly clean: RgbaImage;
  /**
   * The ground each object stands on, unshaded: the clean plate with the flat dressing (and, on a
   * board that has them, the bridge, the house aprons' earth and the doorsteps), and no seam,
   * contact, cast or kit. What a seat's shadow tone is measured against.
   */
  readonly bare: RgbaImage;
  /** Terrain class per plate pixel (`CLASS`), before any object or shadow. */
  readonly classes: Uint8Array;
  /**
   * A finer terrain key per plate pixel for the straight-edge check, where `classes` lumps grounds
   * together for the shadows (the quarry's sand, road and shelf rock are all hard ground). Every
   * boundary between two keys counts.
   */
  readonly edges?: Uint8Array;
  /**
   * Plate pixels of made edges (a dug canal and its kerb, a terrace, a plinth): straight is allowed there (core G8),
   * so the natural-edge check leaves them out, as it does what objects cover.
   */
  readonly made?: Uint8Array;
  /** Plate pixels any object's sprite covers (uprights and flats). */
  readonly cover: Uint8Array;
  /** Plate pixels the board's frame darkens toward its edge, which the shadow check leaves out. */
  readonly frame?: Uint8Array;
  readonly shadows: readonly ShadowRecord[];
  /** A bridge's grounding (its abutment's seam and its cast on the water), for the seating check. */
  readonly bridgeShadows: readonly ShadowRecord[];
  readonly uprights: readonly Upright[];
  /** The pieces always on the board (a gated piece is not among them: its ground is an overlay). */
  readonly placed: readonly Placed[];
  /**
   * The ground of each gate's pieces (ADR 0123): the plate's pixels that grounding them changes (their flat art,
   * cast and contact), whole and opaque, nothing else. Laid over the plate while the gate holds, it gives the
   * plate the pieces would have been baked into.
   */
  readonly overlays?: readonly Overlay[];
}

/** One gate's ground, cut to the pixels it changes (top-left in game world px), and the gate's own pieces. */
export interface Overlay {
  readonly gate: string;
  readonly image: RgbaImage;
  readonly x: number;
  readonly y: number;
  /** The gate's pieces, their grounding and their uprights, for the checks of every state and the atlas. */
  readonly placed: readonly Placed[];
  readonly shadows: readonly ShadowRecord[];
  readonly uprights: readonly Upright[];
}

/**
 * The board as it stands with these gates open (ADR 0123): the plate with their overlays laid on it, and their
 * pieces among the board's own, so every check that reads a bake reads each state as the runtime shows it.
 */
export function bakedWith(b: Baked, gates: ReadonlySet<string>): Baked {
  const open = (b.overlays ?? []).filter((o) => gates.has(o.gate));
  if (open.length === 0) return b;
  const ground: RgbaImage = {
    width: b.ground.width,
    height: b.ground.height,
    data: new Uint8ClampedArray(b.ground.data),
  };
  const bare: RgbaImage = {
    width: b.bare.width,
    height: b.bare.height,
    data: new Uint8ClampedArray(b.bare.data),
  };
  for (const o of open) {
    layOver(ground, o.image, o.x - b.origin.x, o.y - b.origin.y);
    for (const p of o.placed) if (FLAT.has(p.o.kind)) layOver(bare, p.img, p.x, p.y);
  }
  return {
    ...b,
    ground,
    bare,
    placed: [...b.placed, ...open.flatMap((o) => o.placed)],
    shadows: [...b.shadows, ...open.flatMap((o) => o.shadows)],
    uprights: [...b.uprights, ...open.flatMap((o) => o.uprights)],
  };
}

const FLAT: ReadonlySet<string> = new Set(['flat', 'bridge', 'walkway', 'steps']);

/** Every opaque pixel of `src` over `dst` at (x, y), whole (alpha 128 and up, as the sprites are cut). */
function layOver(dst: RgbaImage, src: RgbaImage, x0: number, y0: number): void {
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const si = (y * src.width + x) * 4;
      if ((src.data[si + 3] ?? 0) < 128) continue;
      const X = x0 + x,
        Y = y0 + y;
      if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
      const di = (Y * dst.width + X) * 4;
      dst.data[di] = src.data[si] ?? 0;
      dst.data[di + 1] = src.data[si + 1] ?? 0;
      dst.data[di + 2] = src.data[si + 2] ?? 0;
      dst.data[di + 3] = 255;
    }
}

/** Where a gate's overlay sits in the overlay atlas and in the world. */
export interface OverlayData extends UprightData {
  gate: string;
}

/** Where an upright sits in the atlas and in the world, as the scene lays it out. */
export interface UprightData {
  id: string;
  sourceRect: { x: number; y: number; width: number; height: number };
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A board the packer bakes: one map's top-down presentation. */
export interface TopDownBoard {
  /** The map id (`MapDef.id`) the scene presents. */
  readonly id: string;
  /** The folder its files are written to, e.g. `public/art/topdown/ba-dan`. */
  readonly out: string;
  /** The same folder as the site serves it, e.g. `art/topdown/ba-dan`. */
  readonly url: string;
  readonly bake: () => Baked;
  /** The runtime's scene: the plate and every upright, with whatever else the board's scene says. */
  readonly scene: (
    baked: Baked,
    uprights: readonly UprightData[],
    overlays: readonly OverlayData[],
  ) => MapScene;
}

/** The scene file a board writes beside its plates. */
export const sceneFile = (board: Pick<TopDownBoard, 'out'>): string => `${board.out}/scene.json`;

/** Every file a board ships, by path: `ground.webp`, `uprights.webp` (when anything stands) and `scene.json`. */
export async function packBoard(
  board: TopDownBoard,
  baked: Baked = board.bake(),
): Promise<Map<string, Uint8Array | string>> {
  const files = new Map<string, Uint8Array | string>();
  files.set(`${board.out}/ground.webp`, await lossless(baked.ground));
  // the board's own uprights and every gate's (ADR 0123), in the one atlas
  const standing = [...baked.uprights, ...(baked.overlays ?? []).flatMap((o) => o.uprights)];
  const items = [...standing]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((u) => ({ name: u.id, image: asImage(u.image) }));
  const { placed, height } = shelfPack(items, ATLAS_WIDTH, GUTTER);
  // a board with nothing standing on it yet (its ground alone) ships no atlas
  if (items.length > 0) {
    const atlas = composeAtlas(items, placed, ATLAS_WIDTH, height, GUTTER);
    files.set(`${board.out}/uprights.webp`, await encodeWebpLossless(atlas, 6));
  }
  const rects = new Map(placed.map((p) => [p.name, p]));
  const uprights = [...standing]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((u): UprightData => {
      const r = rects.get(u.id);
      if (!r) throw new Error(`unplaced ${u.id}`);
      return {
        id: u.id,
        sourceRect: { x: r.x, y: r.y, width: r.width, height: r.height },
        x: u.x,
        y: u.y,
        width: r.width,
        height: r.height,
      };
    });
  // each gate's ground, in its own atlas beside the plate (ADR 0123)
  const gated = [...(baked.overlays ?? [])].sort((a, b) => a.gate.localeCompare(b.gate));
  const sheet = shelfPack(
    gated.map((o) => ({ name: o.gate, image: asImage(o.image) })),
    ATLAS_WIDTH,
    GUTTER,
  );
  if (gated.length > 0) {
    const atlas = composeAtlas(
      gated.map((o) => ({ name: o.gate, image: asImage(o.image) })),
      sheet.placed,
      ATLAS_WIDTH,
      sheet.height,
      GUTTER,
    );
    files.set(`${board.out}/overlays.webp`, await encodeWebpLossless(atlas, 6));
  }
  const at = new Map(sheet.placed.map((p) => [p.name, p]));
  const overlays = gated.map((o): OverlayData => {
    const r = at.get(o.gate);
    if (!r) throw new Error(`unplaced overlay ${o.gate}`);
    return {
      id: o.gate,
      gate: o.gate,
      sourceRect: { x: r.x, y: r.y, width: r.width, height: r.height },
      x: o.x,
      y: o.y,
      width: r.width,
      height: r.height,
    };
  });
  files.set(sceneFile(board), `${JSON.stringify(board.scene(baked, uprights, overlays))}\n`);
  return files;
}

/**
 * Writes a board's files (or, with `check`, compares them with what is shipped). Returns the number
 * of stale files and the shipped files under the board's folder that the packer did not make.
 */
export function writeOrCheck(
  board: Pick<TopDownBoard, 'out'>,
  files: ReadonlyMap<string, Uint8Array | string>,
  check: boolean,
): { stale: string[]; extra: string[]; bytes: number } {
  const stale: string[] = [];
  if (!check) mkdirSync(board.out, { recursive: true });
  for (const [path, content] of files) {
    const bytes = Buffer.from(content);
    const same = existsSync(path) && Buffer.compare(readFileSync(path), bytes) === 0;
    if (same) continue;
    stale.push(path);
    if (!check) writeFileSync(path, bytes);
  }
  const shipped = existsSync(board.out)
    ? readdirSync(board.out).map((f) => `${board.out}/${f}`)
    : [];
  const extra = shipped.filter((p) => !files.has(p));
  const bytes = [...files]
    .filter(([p]) => p.startsWith(board.out))
    .reduce((sum, [, c]) => sum + (typeof c === 'string' ? Buffer.byteLength(c) : c.length), 0);
  return { stale, extra, bytes };
}
