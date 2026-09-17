/** Small inked world assets, shared by Canvas and WebGL through the sprite cache. */
import type { UnitPainter } from './units';
import { ellipse, polygon, groundShadow } from './shapes';

export const paintDiscovery: UnitPainter = (ctx, box, palette, options) => {
  ctx.save();
  groundShadow(ctx, box, 0.7);
  ctx.translate(box.x, box.y);
  ctx.scale(box.size, box.size);
  ctx.lineWidth = 0.025;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = palette.ink;
  const oval = (x: number, y: number, rx: number, ry: number, fill: string) => {
    ctx.fillStyle = fill;
    ellipse(ctx, x, y, rx, ry);
    ctx.fill();
    ctx.stroke();
  };
  if (options.variant === 'ducks') {
    // Low shell, raised head and flat bill stay distinct at small tile sizes.
    oval(0.46, 0.72, 0.31, 0.12, palette.dark);
    oval(0.43, 0.58, 0.24, 0.17, palette.base);
    ctx.beginPath();
    ctx.moveTo(0.27, 0.58);
    ctx.lineTo(0.43, 0.47);
    ctx.lineTo(0.57, 0.59);
    ctx.lineTo(0.43, 0.7);
    ctx.closePath();
    ctx.stroke();
    oval(0.69, 0.43, 0.115, 0.14, palette.accent);
    ctx.fillStyle = palette.light;
    polygon(ctx, [
      [0.77, 0.43],
      [0.91, 0.47],
      [0.77, 0.51],
    ]);
    ctx.fill();
    ctx.stroke();
    oval(0.72, 0.4, 0.012, 0.012, palette.ink);
    oval(0.25, 0.78, 0.07, 0.055, palette.light);
    oval(0.45, 0.81, 0.065, 0.05, palette.light);
  } else if (options.variant === 'marker') {
    ctx.fillStyle = palette.base;
    polygon(ctx, [
      [0.28, 0.85],
      [0.31, 0.25],
      [0.54, 0.16],
      [0.68, 0.31],
      [0.72, 0.85],
    ]);
    ctx.fill();
    ctx.stroke();
    for (const y of [0.4, 0.53, 0.66]) {
      ctx.beginPath();
      ctx.moveTo(0.36, y);
      ctx.lineTo(0.53, y);
      ctx.stroke();
    }
    ctx.strokeStyle = palette.light;
    ctx.beginPath();
    ctx.moveTo(0.6, 0.78);
    ctx.quadraticCurveTo(0.72, 0.43, 0.78, 0.23);
    ctx.stroke();
  } else {
    ctx.fillStyle = palette.dark;
    ctx.fillRect(0.13, 0.73, 0.74, 0.12);
    oval(0.51, 0.37, 0.16, 0.15, palette.dark);
    oval(0.51, 0.57, 0.22, 0.19, palette.base);
    ctx.fillStyle = palette.light;
    polygon(ctx, [
      [0.32, 0.55],
      [0.17, 0.44],
      [0.22, 0.66],
      [0.35, 0.68],
    ]);
    ctx.fill();
    ctx.stroke();
    oval(0.51, 0.41, 0.16, 0.045, palette.light);
    oval(0.51, 0.35, 0.035, 0.035, palette.dark);
    oval(0.79, 0.72, 0.075, 0.06, palette.accent);
  }
  ctx.restore();
};
