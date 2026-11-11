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
  /** Plate pixels any object's sprite covers (uprights and flats). */
  readonly cover: Uint8Array;
  /** Plate pixels the board's frame darkens toward its edge, which the shadow check leaves out. */
  readonly frame?: Uint8Array;
  readonly shadows: readonly ShadowRecord[];
  /** A bridge's grounding (its abutment's seam and its cast on the water), for the seating check. */
  readonly bridgeShadows: readonly ShadowRecord[];
  readonly uprights: readonly Upright[];
  readonly placed: readonly Placed[];
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
  readonly scene: (baked: Baked, uprights: readonly UprightData[]) => MapScene;
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
  const items = [...baked.uprights]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((u) => ({ name: u.id, image: asImage(u.image) }));
  const { placed, height } = shelfPack(items, ATLAS_WIDTH, GUTTER);
  // a board with nothing standing on it yet (its ground alone) ships no atlas
  if (items.length > 0) {
    const atlas = composeAtlas(items, placed, ATLAS_WIDTH, height, GUTTER);
    files.set(`${board.out}/uprights.webp`, await encodeWebpLossless(atlas, 6));
  }
  const rects = new Map(placed.map((p) => [p.name, p]));
  const uprights = [...baked.uprights]
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
  files.set(sceneFile(board), `${JSON.stringify(board.scene(baked, uprights))}\n`);
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
