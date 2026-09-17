/** Held ink shapes: a water ribbon turns round the body; fire snaps from the hand. */
import type { Vec2 } from '../../core/types';
import type { VillageActor } from './layer';
import { paletteFor } from '../palettes';
import { drawingTime, formBeat } from './poses';

export function paintForm(
  c: CanvasRenderingContext2D,
  actor: VillageActor,
  box: { x: number; y: number; size: number },
  front: boolean,
): void {
  const water = actor.motion === 'water';
  const beat = formBeat(drawingTime(actor.elapsed), water);
  if (beat.energy <= 0) return;
  const { t, gather, release, energy, weight } = beat;
  const palette = water
    ? paletteFor('water')
    : {
        dark: '#ac3825',
        base: '#f57724',
        light: '#ffcd59',
        accent: '#fff3bd',
      };
  c.save();
  c.translate(box.x + box.size * 0.5, box.y + box.size * 0.04);
  c.scale(box.size * actor.facing, box.size);
  c.translate(weight, 0);
  c.globalAlpha = beat.plume;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (water) {
    // Split the orbit around the torso: its far half is genuinely behind it.
    const points: Vec2[] = [];
    for (let i = 0; i <= 32; i++) {
      const u = i / 32;
      const a = Math.PI * (u + (front ? 0 : 1)) + t * 2;
      points.push({
        x: Math.cos(a) * (0.55 + gather * 0.3) * (1 - release * 0.65) + release * u * 3.1,
        y: Math.sin(a) * 0.55 - 0.15 - Math.sin(u * Math.PI) * release * 0.55,
      });
    }
    for (const [color, width] of [
      [palette.dark, 0.13],
      [palette.base, 0.09],
      [palette.light, 0.035],
    ] as const) {
      c.fillStyle = color;
      c.beginPath();
      for (const side of [1, -1]) {
        for (let j = 0; j <= 32; j++) {
          const i = side === 1 ? j : 32 - j;
          const p = points[i];
          if (!p) continue;
          const next = points[Math.min(32, i + 1)] ?? p;
          const prev = points[Math.max(0, i - 1)] ?? p;
          const dx = next.x - prev.x,
            dy = next.y - prev.y;
          const length = Math.hypot(dx, dy) || 1;
          const taper = Math.sin((i / 32) * Math.PI) * width;
          const x = p.x - (dy / length) * taper * side;
          const y = p.y + (dx / length) * taper * side;
          if (side === 1 && j === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
      }
      c.closePath();
      c.fill();
    }
  } else if (front) {
    // One flame silhouette, with a pointed breaking edge and a nested hot core.
    const length = 0.2 + release * 2.5;
    const height = 0.12 + Math.sin(release * Math.PI * 0.75) * 0.42;
    const flutter = Math.sin(Math.floor(t * 46) * 2.4) * 0.05;
    for (const [color, scale] of [
      [palette.dark, 1.08],
      [palette.base, 1],
      [palette.light, 0.66],
      [palette.accent, 0.28],
    ] as const) {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0.3, 0);
      c.bezierCurveTo(
        0.6,
        -height * scale,
        0.8 + length * 0.38,
        -height * scale * 1.6,
        0.35 + length * scale,
        -0.06 + flutter,
      );
      c.lineTo(0.35 + length * scale * 0.68, 0.015);
      c.lineTo(0.35 + length * scale * 0.88, height * scale * 0.5);
      c.bezierCurveTo(0.5 + length * 0.35, height * scale, 0.5, height * scale * 0.8, 0.3, 0);
      c.fill();
    }
  }
  if (front && release > 0) {
    // A finite release travels and falls away; particles don't orbit forever.
    const age = Math.max(0, (t - (water ? 0.42 : 0.46)) / 0.46);
    for (let i = 0; i < 10; i++) {
      const spread = Math.sin(i * 7.3);
      c.globalAlpha = energy * Math.max(0, 1 - age * 0.7);
      c.fillStyle = i % 2 ? palette.light : palette.accent;
      c.beginPath();
      c.ellipse(
        0.4 + age * (2.7 + (i % 4) * 0.45),
        spread * age * 0.5 + (water ? age * age * 0.8 : -age * 0.75),
        0.018 + (i % 3) * 0.009,
        water ? 0.055 : 0.022,
        -0.7,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  }
  c.restore();
}
