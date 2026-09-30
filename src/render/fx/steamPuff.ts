/**
 * One soft, warm-white vapour puff shared by the Canvas and Pixi backends.
 * Keep this as a small procedural canvas: both renderers reuse the same
 * radial-falloff texture rather than building per-tile cloud geometry.
 */
let cached: HTMLCanvasElement | null = null;

export function steamPuffCanvas(): HTMLCanvasElement {
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available for the steam puff texture');

  // Overlapping soft ellipses give the sprite a loose billowing edge while
  // each radial gradient fades fully into transparency at its perimeter.
  const puffs = [
    { x: 38, y: 77, rx: 33, ry: 36, a: 0.52 },
    { x: 83, y: 75, rx: 36, ry: 39, a: 0.58 },
    { x: 63, y: 49, rx: 35, ry: 39, a: 0.88 },
    { x: 39, y: 48, rx: 24, ry: 27, a: 0.66 },
    { x: 87, y: 43, rx: 25, ry: 28, a: 0.72 },
  ];
  for (const puff of puffs) {
    ctx.save();
    ctx.translate(puff.x, puff.y);
    ctx.scale(puff.rx, puff.ry);
    const gradient = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
    gradient.addColorStop(0, `rgba(255, 252, 242, ${puff.a})`);
    gradient.addColorStop(0.48, `rgba(207, 202, 190, ${puff.a * 0.66})`);
    gradient.addColorStop(1, 'rgba(207, 202, 190, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  cached = canvas;
  return canvas;
}

/** Coordinate-seeded composition shared by static and moving renderers. */
export function steamSeed(x: number, y: number, puff: number): number {
  let hash = (x * 73856093) ^ (y * 19349663) ^ (puff * 83492791);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}
