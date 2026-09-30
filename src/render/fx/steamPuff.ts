/**
 * One soft, warm-white vapour puff shared by the Canvas and Pixi backends.
 * Keep this as a small procedural canvas: both renderers reuse the same
 * radial-falloff texture rather than building per-tile cloud geometry.
 */
let cached: HTMLCanvasElement | null = null;

export function steamPuffCanvas(): HTMLCanvasElement {
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available for the steam puff texture');

  // Overlapping soft ellipses give the sprite a loose billowing edge while
  // each radial gradient fades fully into transparency at its perimeter.
  const puffs = [
    { x: 24, y: 43, rx: 18, ry: 16, a: 0.36 },
    { x: 42, y: 32, rx: 20, ry: 20, a: 0.42 },
    { x: 61, y: 41, rx: 20, ry: 17, a: 0.38 },
    { x: 76, y: 48, rx: 12, ry: 12, a: 0.28 },
    { x: 46, y: 52, rx: 25, ry: 13, a: 0.3 },
  ];
  for (const puff of puffs) {
    ctx.save();
    ctx.translate(puff.x, puff.y);
    ctx.scale(puff.rx, puff.ry);
    const gradient = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
    gradient.addColorStop(0, `rgba(253, 246, 227, ${puff.a})`);
    gradient.addColorStop(0.55, `rgba(232, 220, 192, ${puff.a * 0.66})`);
    gradient.addColorStop(1, 'rgba(232, 220, 192, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  cached = canvas;
  return canvas;
}
