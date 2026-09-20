/**
 * Where each pose goes in an atlas.
 *
 * One pure layout serves the runtime baker (painter poses into a canvas) and
 * the art scripts (normalised PNGs into a sheet), so a baked sheet and a
 * generated one have the same shape and the same frame names. Frames are laid
 * row-major in clip order; the atlas is as wide as fits `maxWidth` and as
 * tall as it needs to be, rounded up to a whole frame.
 */

import type { ClipName } from '../../content/assets/clips';
import { CLIP_NAMES } from '../../content/assets/clips';
import type { AtlasFrame } from './atlasJson';

export interface SheetLayout {
  readonly width: number;
  readonly height: number;
  readonly frames: ReadonlyMap<string, AtlasFrame>;
  /** Frame names per clip, in pose order, as a manifest `clips` block wants them. */
  readonly clips: Partial<Record<ClipName, readonly string[]>>;
}

/** `<key>/<clip>/<index>`: what ADR 0003 names a frame. */
export function frameName(key: string, clip: ClipName, index: number): string {
  return `${key}/${clip}/${index}`;
}

/**
 * Lays out `counts[clip]` frames of `frameWidth` x `frameHeight` pixels per
 * clip present, at most `maxWidth` pixels across. Throws if a single frame is
 * wider than the atlas may be, or the sheet would exceed `maxHeight`.
 */
export function layoutSheet(
  key: string,
  counts: Partial<Record<ClipName, number>>,
  frameWidth: number,
  frameHeight: number,
  maxWidth = 2048,
  maxHeight = 2048,
): SheetLayout {
  if (frameWidth > maxWidth)
    throw new Error(`A ${frameWidth} px frame does not fit a ${maxWidth} px atlas.`);
  const names: [ClipName, string][] = [];
  const clips: Partial<Record<ClipName, string[]>> = {};
  for (const clip of CLIP_NAMES) {
    const count = counts[clip] ?? 0;
    if (count <= 0) continue;
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = frameName(key, clip, i);
      list.push(name);
      names.push([clip, name]);
    }
    clips[clip] = list;
  }

  const perRow = Math.max(1, Math.floor(maxWidth / frameWidth));
  const columns = Math.min(perRow, Math.max(1, names.length));
  const rows = Math.max(1, Math.ceil(names.length / perRow));
  const width = columns * frameWidth;
  const height = rows * frameHeight;
  if (height > maxHeight) {
    throw new Error(
      `${names.length} frames of ${frameWidth}x${frameHeight} need ${height} px; the atlas may be ${maxHeight}.`,
    );
  }

  const frames = new Map<string, AtlasFrame>();
  names.forEach(([, name], index) => {
    frames.set(name, {
      x: (index % perRow) * frameWidth,
      y: Math.floor(index / perRow) * frameHeight,
      w: frameWidth,
      h: frameHeight,
    });
  });
  return { width, height, frames, clips };
}
