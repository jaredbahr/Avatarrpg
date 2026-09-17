/**
 * The atlas JSON, parsed.
 *
 * Sheets arrive in the TexturePacker "JSON hash" layout, which every packer
 * and the art scripts can write: a `frames` object keyed by frame name, each
 * with its `frame` rectangle, and a `meta` block naming the image. Parsed
 * here once for both backends rather than through Pixi's `Spritesheet`, so
 * the Canvas 2D fallback reads the same file and the loader stays one code
 * path (ADR 0003, amended).
 */

export interface AtlasFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface AtlasJson {
  readonly frames: ReadonlyMap<string, AtlasFrame>;
  /** The image file, relative to the JSON. */
  readonly image: string;
  readonly width: number;
  readonly height: number;
}

interface RawFrame {
  readonly frame: { x: number; y: number; w: number; h: number };
}

interface RawAtlas {
  readonly frames: Record<string, RawFrame>;
  readonly meta: { image: string; size: { w: number; h: number } };
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Throws on anything that is not an atlas; a bad file must never draw as nothing silently. */
export function parseAtlasJson(input: unknown): AtlasJson {
  const raw = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
  if (!raw || typeof raw !== 'object') throw new Error('Atlas JSON is not an object.');
  const atlas = raw as Partial<RawAtlas>;
  if (!atlas.frames || typeof atlas.frames !== 'object') {
    throw new Error('Atlas JSON has no frames.');
  }
  const meta = atlas.meta;
  if (!meta || typeof meta.image !== 'string' || meta.image.trim() === '' || !meta.size) {
    throw new Error('Atlas JSON has no meta.image or meta.size.');
  }
  if (!isFinitePositive(meta.size.w) || !isFinitePositive(meta.size.h)) {
    throw new Error('Atlas meta.size is not a size.');
  }

  const frames = new Map<string, AtlasFrame>();
  for (const [name, entry] of Object.entries(atlas.frames)) {
    const f = entry?.frame;
    if (
      !f ||
      !isFiniteNonNegative(f.x) ||
      !isFiniteNonNegative(f.y) ||
      !isFinitePositive(f.w) ||
      !isFinitePositive(f.h)
    ) {
      throw new Error(`Atlas frame "${name}" has no rectangle.`);
    }
    if (f.x + f.w > meta.size.w || f.y + f.h > meta.size.h) {
      throw new Error(`Atlas frame "${name}" runs off the image.`);
    }
    frames.set(name, { x: f.x, y: f.y, w: f.w, h: f.h });
  }
  return { frames, image: meta.image, width: meta.size.w, height: meta.size.h };
}

/** The JSON-hash text for a set of frames, as the packer and the baker write it. */
export function atlasJsonText(
  frames: ReadonlyMap<string, AtlasFrame>,
  image: string,
  width: number,
  height: number,
): string {
  const out: Record<string, unknown> = {};
  for (const [name, f] of frames) {
    out[name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h },
    };
  }
  return JSON.stringify(
    {
      frames: out,
      meta: {
        app: 'four-nations-tactics',
        version: '1',
        image,
        format: 'RGBA8888',
        size: { w: width, h: height },
        scale: '1',
      },
    },
    null,
    2,
  );
}
