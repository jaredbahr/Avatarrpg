/**
 * An element cel at the size it draws (ADR 0086).
 *
 * The cels are 96 px pixel-art masters, but a cue draws one anywhere from 0.3
 * to 2.2 tiles. Scaled nearest, a master drawn at half size drops every other
 * pixel and comes apart into specks. So each cel is resampled once to the
 * whole number of world pixels it draws at: a target pixel is solid when at
 * least `COVER` of its box in the master is, and takes the colour most of
 * that box's solid pixels have (the ink weighted up, so a one-pixel outline
 * survives the reduction). Every colour is still one of the master's; alpha
 * stays the cel's one level. Larger than the master, it is plain nearest.
 *
 * Pure and deterministic; `atlas.ts` caches the results.
 */

/** Share of a target pixel's box that must be solid in the master. */
export const COVER = 0.4;
/** How much an ink pixel counts for in the colour vote. */
export const INK_WEIGHT = 1.5;
const INK = [0x1b, 0x14, 0x10] as const;

/**
 * `master` is `size` x `size` straight RGBA; returns `px` x `px`.
 */
export function resampleCel(
  master: Uint8ClampedArray,
  size: number,
  px: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(px * px * 4);
  const step = size / px;
  for (let ty = 0; ty < px; ty++)
    for (let tx = 0; tx < px; tx++) {
      const o = (ty * px + tx) * 4;
      if (step <= 1) {
        const s = (Math.floor((ty + 0.5) * step) * size + Math.floor((tx + 0.5) * step)) * 4;
        out.set(master.subarray(s, s + 4), o);
        continue;
      }
      const x0 = Math.floor(tx * step);
      const x1 = Math.min(size, Math.ceil((tx + 1) * step));
      const y0 = Math.floor(ty * step);
      const y1 = Math.min(size, Math.ceil((ty + 1) * step));
      const votes = new Map<number, number>();
      let solid = 0;
      let alpha = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const s = (y * size + x) * 4;
          const a = master[s + 3] ?? 0;
          if (a === 0) continue;
          solid += 1;
          alpha = Math.max(alpha, a);
          const r = master[s] ?? 0;
          const g = master[s + 1] ?? 0;
          const b = master[s + 2] ?? 0;
          const key = (r << 16) | (g << 8) | b;
          const ink = r === INK[0] && g === INK[1] && b === INK[2];
          votes.set(key, (votes.get(key) ?? 0) + (ink ? INK_WEIGHT : 1));
        }
      if (solid < COVER * (x1 - x0) * (y1 - y0)) continue;
      let best = 0;
      let count = -1;
      // Ties go to the smaller colour key, so the result never depends on visiting order.
      for (const [key, n] of votes)
        if (n > count || (n === count && key < best)) {
          best = key;
          count = n;
        }
      out[o] = (best >> 16) & 255;
      out[o + 1] = (best >> 8) & 255;
      out[o + 2] = best & 255;
      out[o + 3] = alpha;
    }
  // A reduction leaves fragments a pixel or two across: debris, not drawing.
  if (step > 1) dropOrphanPixels(out, px, px, ORPHAN);
  return out;
}

/** Pieces this small, touching nothing else, are cleared after a reduction. */
export const ORPHAN = 2;

/** Clears, in place, every 8-connected piece of at most `limit` opaque pixels. */
export function dropOrphanPixels(
  data: Uint8Array | Uint8ClampedArray,
  w: number,
  h: number,
  limit: number,
): void {
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && (data[(y * w + x) * 4 + 3] ?? 0) > 0;
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !opaque(start % w, Math.floor(start / w))) continue;
    const piece: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const at = stack.pop() ?? 0;
      piece.push(at);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = (at % w) + dx;
          const y = Math.floor(at / w) + dy;
          if (opaque(x, y) && !seen[y * w + x]) {
            seen[y * w + x] = 1;
            stack.push(y * w + x);
          }
        }
    }
    if (piece.length <= limit) for (const at of piece) data.fill(0, at * 4, at * 4 + 4);
  }
}
