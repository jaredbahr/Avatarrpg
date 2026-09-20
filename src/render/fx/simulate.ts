/**
 * Particles and strokes, sampled rather than simulated.
 *
 * An effect is a function of its age: every particle's birth, life, speed
 * and spin come from a generator seeded per instance, and its position at
 * any moment is closed-form. Nothing carries state from frame to frame, so
 * both backends draw the identical picture from the same seed, a filmstrip
 * can ask for the frame at 200 ms directly, and a dropped frame costs
 * nothing. Positions are in tile units at tile centres; the backends scale.
 */

import type { Vec2 } from '../../core/types';
import type { ParticleEmitterDef, StrokeEmitterDef } from '../../content/fx';
import { hashSeed, mulberry32 } from './rng';
import { flowingWhip, movingElement, taperedRibbon } from './elementalStrokes';
import { celAnchorY } from '../../content/fxCels';
import { FOOT_LINE } from '../sheets/bake';

/** Floats per particle in the output: x, y, size, rotation, alpha. */
export const PARTICLE_STRIDE = 5;

/** Ms an emitter stays alive: its own duration plus the longest particle it can bear. */
export function particleSpan(def: ParticleEmitterDef): number {
  return def.duration + def.life[1];
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Where the projectile head is at fraction `u` of the flight, with the lob. */
export function headAt(from: Vec2, to: Vec2, u: number, arc: number): Vec2 {
  const clamped = u < 0 ? 0 : u > 1 ? 1 : u;
  return {
    x: lerp(from.x, to.x, clamped),
    y: lerp(from.y, to.y, clamped) - arc * 4 * clamped * (1 - clamped),
  };
}

function heading(from: Vec2, to: Vec2, fallback: number): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx === 0 && dy === 0 ? fallback : Math.atan2(dy, dx);
}

/**
 * Writes the live particles of one emitter at `elapsed` ms into `out`, five
 * floats each, starting at `offset`. Returns how many it wrote. `arc` is the
 * lob height for a projectile flight, 0 otherwise.
 */
export function sampleParticles(
  def: ParticleEmitterDef,
  elapsed: number,
  seed: number,
  from: Vec2,
  to: Vec2,
  out: Float32Array,
  offset = 0,
  arc = 0,
): number {
  let written = 0;
  if (elapsed < 0 || elapsed > particleSpan(def)) return 0;
  const aim = heading(from, to, -Math.PI / 2);

  for (let i = 0; i < def.count; i++) {
    const r = mulberry32(hashSeed(seed, i));
    const birth = lerp(def.delay[0], def.delay[1], r());
    const life = Math.max(1, lerp(def.life[0], def.life[1], r()));
    const speed = lerp(def.speed[0], def.speed[1], r());
    const size0 = lerp(def.size[0], def.size[1], r());
    const spinSign = r() < 0.5 ? -1 : 1;
    const rot0 = r() * Math.PI * 2;
    const a = r();
    const b = r();
    const c = r();

    const age = elapsed - birth;
    if (age < 0 || age > life) continue;
    const t = age / life;
    const s = age / 1000;

    let x = from.x;
    let y = from.y;
    let vx = 0;
    let vy = 0;
    let free = true;
    let rotBase = def.cel === 'flame' || def.cel === 'wind' ? aim : def.cel ? 0 : rot0;

    switch (def.shape) {
      case 'burst': {
        const angle = aim + (a - 0.5) * 2 * def.spread;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
        break;
      }
      case 'ring': {
        const angle = a * Math.PI * 2;
        x += Math.cos(angle) * 0.08;
        y += Math.sin(angle) * 0.08 * 0.6;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed * 0.6;
        break;
      }
      case 'rise': {
        x += (a - 0.5) * 2 * def.spread;
        y += (b - 0.5) * def.spread;
        vx = (c - 0.5) * 0.4;
        vy = -speed;
        break;
      }
      case 'fall': {
        x += (a - 0.5) * 2 * def.spread;
        y -= 1.2 + b * 0.6;
        vy = speed;
        break;
      }
      case 'stream': {
        const head = headAt(from, to, birth / Math.max(1, def.duration), arc);
        x = head.x + (a - 0.5) * 0.16;
        y = head.y + (b - 0.5) * 0.16;
        const angle = c * Math.PI * 2;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
        break;
      }
      case 'projectile': {
        const head = headAt(from, to, elapsed / Math.max(1, def.duration), arc);
        x = head.x;
        y = head.y;
        // Points along the flight, so a streak reads as a streak; `spin` still turns a stone.
        rotBase = aim;
        free = false;
        break;
      }
      case 'spiral': {
        const radius = def.spread * (0.3 + 0.7 * t);
        const angle = a * Math.PI * 2 + spinSign * (speed * s);
        x += Math.cos(angle) * radius;
        y += Math.sin(angle) * radius * 0.6 - 0.35 * t;
        free = false;
        break;
      }
      case 'sheet': {
        const across = (a - 0.5) * 1.0;
        x += Math.cos(aim + Math.PI / 2) * across;
        y += Math.sin(aim + Math.PI / 2) * across;
        const angle = aim + (b - 0.5) * 2 * def.spread;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
        break;
      }
      case 'drift': {
        // Born anywhere in the rectangle from `from` to `to`, carried along
        // the heading `spread` names with a slow sway across it: leaves on
        // the wind, dust in a shaft of light.
        x = lerp(from.x, to.x, a);
        y = lerp(from.y, to.y, b);
        const angle = def.spread + (c - 0.5) * 0.6;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
        const sway = Math.sin(s * 1.8 + rot0) * 0.12;
        x += Math.cos(angle + Math.PI / 2) * sway;
        y += Math.sin(angle + Math.PI / 2) * sway;
        break;
      }
    }

    if (free) {
      const travel = def.drag > 0 ? (1 - Math.exp(-def.drag * s)) / def.drag : s;
      x += vx * travel;
      y += vy * travel + 0.5 * def.gravity * s * s;
    }

    const size = size0 * (1 + (def.grow - 1) * t);
    if (def.cel && def.shape !== 'projectile') {
      const anchor = celAnchorY(def.cel);
      y -= (anchor - 0.5) * size;
      // Emitters aim at tile centres; ground eruptions stand on the same
      // foot line as the character instead of floating behind its feet.
      if (anchor > 0.5) y += FOOT_LINE - 0.5;
    }
    const rotation = rotBase + spinSign * def.spin * s;
    const alpha =
      def.cel && def.shape !== 'projectile'
        ? Math.min(1, (1 - t) * 5)
        : def.fade === 'out'
          ? 1 - t
          : def.fade === 'in-out'
            ? Math.sin(Math.PI * t)
            : 1;

    const at = offset + written * PARTICLE_STRIDE;
    if (at + PARTICLE_STRIDE > out.length) break;
    out[at] = x;
    out[at + 1] = y;
    out[at + 2] = size;
    out[at + 3] = rotation;
    const air = def.cel === 'wind' || def.cel === 'cyclone' || def.cel === 'cushion';
    out[at + 4] = alpha * (air ? 0.62 : 1);
    written += 1;
  }
  return written;
}

/* ------------------------------------------------------------------ */
/* Strokes                                                             */
/* ------------------------------------------------------------------ */

export interface Stroke {
  /** Flat x, y pairs in tile units. */
  readonly points: number[];
  /** Line width in tiles, or the outline width for a filled shape. */
  readonly width: number;
  readonly alpha: number;
  readonly closed: boolean;
  readonly fill: boolean;
}

/** The strokes of one emitter at `elapsed` ms, none once it is over. */
export function sampleStrokes(
  def: StrokeEmitterDef,
  elapsed: number,
  seed: number,
  from: Vec2,
  to: Vec2,
  arc = 0,
): Stroke[] {
  if (elapsed < 0 || elapsed > def.duration) return [];
  const t = elapsed / def.duration;
  const aim = heading(from, to, -Math.PI / 2);
  const strokes: Stroke[] = [];

  switch (def.shape) {
    case 'gust':
    case 'flame':
      return movingElement(def, t, from, to, arc);
    case 'bolt': {
      boltStrokes(def, elapsed, t, seed, from, to, aim, strokes);
      break;
    }

    case 'strike': {
      // Down out of the sky onto the point: a storm's bolt on one tile.
      const r = mulberry32(hashSeed(seed, 9));
      const sky = { x: from.x + (r() - 0.5) * 0.9, y: from.y - 1.5 - r() * 0.6 };
      boltStrokes(def, elapsed, t, seed, sky, from, Math.PI / 2, strokes);
      break;
    }

    case 'ribbon': {
      for (let i = 0; i < def.count; i++) {
        const r = mulberry32(hashSeed(seed, i));
        const angle = aim + (r() - 0.5) * 1.4;
        const length = def.reach * (0.6 + r() * 0.4);
        const wobble = 0.5 + r();
        const phase = r() * Math.PI * 2;
        // Grows out over the first half, then fades away.
        const grown = Math.min(1, t * 2);
        const alpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
        const points: number[] = [];
        const steps = 8;
        for (let k = 0; k <= steps; k++) {
          const u = (k / steps) * grown;
          const along = u * length;
          const sway = Math.sin(u * Math.PI * 2 * wobble + phase + t * 6) * 0.12 * u;
          points.push(
            from.x + Math.cos(angle) * along + Math.cos(angle + Math.PI / 2) * sway,
            from.y + Math.sin(angle) * along + Math.sin(angle + Math.PI / 2) * sway,
          );
        }
        strokes.push({
          points,
          width: def.width * (1 - t * 0.5),
          alpha,
          closed: false,
          fill: false,
        });
      }
      break;
    }

    case 'whip': {
      // Water has moving surface detail; the dark grappling cord keeps its taut arc.
      if (def.color === 'base' || def.color === 'accent') {
        strokes.push(...flowingWhip(def, t, from, to));
        break;
      }
      // Reaches the target at the midpoint and snaps back.
      const reach = Math.sin(Math.PI * t);
      // Bends up the screen whichever way it is aimed, so two strands of
      // different widths from two emitters lie on the same curve.
      const side = Math.sin(aim + Math.PI / 2) <= 0 ? 1 : -1;
      const tip = { x: lerp(from.x, to.x, reach), y: lerp(from.y, to.y, reach) };
      const mid = { x: (from.x + tip.x) / 2, y: (from.y + tip.y) / 2 };
      const bend = 0.6 * reach * side;
      const control = {
        x: mid.x + Math.cos(aim + Math.PI / 2) * bend,
        y: mid.y + Math.sin(aim + Math.PI / 2) * bend,
      };
      const points: number[] = [];
      const steps = 14;
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        const w = 1 - u;
        points.push(
          w * w * from.x + 2 * w * u * control.x + u * u * tip.x,
          w * w * from.y + 2 * w * u * control.y + u * u * tip.y,
        );
      }
      strokes.push({
        points: taperedRibbon(points, def.width * reach * 0.5),
        width: 0.01,
        alpha: t > 0.8 ? (1 - t) * 5 : 1,
        closed: true,
        fill: true,
      });
      break;
    }

    case 'crack': {
      const grown = Math.min(1, t / 0.4);
      const alpha = t < 0.6 ? 1 : 1 - (t - 0.6) * 2.5;
      for (let i = 0; i < def.count; i++) {
        const r = mulberry32(hashSeed(seed, i));
        const angle = (i / def.count) * Math.PI * 2 + r() * 0.8;
        const length = def.reach * (0.6 + r() * 0.4) * grown;
        const end = {
          x: from.x + Math.cos(angle) * length,
          y: from.y + Math.sin(angle) * length * 0.7,
        };
        strokes.push({
          points: jaggedLine(from, end, hashSeed(seed, 50 + i), 0.15),
          width: def.width,
          alpha,
          closed: false,
          fill: false,
        });
      }
      break;
    }

    case 'slab': {
      // Rise over the first third, hold, sink over the last third.
      const height = t < 0.35 ? t / 0.35 : t > 0.7 ? (1 - t) / 0.3 : 1;
      for (let i = 0; i < def.count; i++) {
        const r = mulberry32(hashSeed(seed, i));
        const cx = from.x + (r() - 0.5) * 2 * def.reach;
        const base = from.y + (r() - 0.5) * def.reach * 0.6;
        const half = def.width * (0.6 + r() * 0.5);
        const top = base - (0.35 + r() * 0.3) * height;
        strokes.push({
          points: [cx - half, base, cx + half, base, cx + half * 0.85, top, cx - half * 0.85, top],
          width: 0.03,
          alpha: 1,
          closed: true,
          fill: true,
        });
      }
      break;
    }

    case 'arc': {
      const alpha = 1 - t;
      for (let i = 0; i < def.count; i++) {
        const radius = def.reach * (0.3 + (0.7 * i) / Math.max(1, def.count - 1)) + 0.5 * t;
        const points: number[] = [];
        const steps = 10;
        for (let k = 0; k <= steps; k++) {
          const angle = aim + ((k / steps) * 2 - 1) * (Math.PI / 3);
          points.push(from.x + Math.cos(angle) * radius, from.y + Math.sin(angle) * radius * 0.7);
        }
        strokes.push({
          points,
          width: def.width * (1 - t * 0.6),
          alpha,
          closed: false,
          fill: false,
        });
      }
      break;
    }
  }
  return strokes;
}

/**
 * A jagged main bolt from `a` to `b` with `count - 1` branches off it,
 * re-jittered every 50 ms so it flickers, fading over its second half.
 * `aim` is the direction the branches lean.
 */
function boltStrokes(
  def: StrokeEmitterDef,
  elapsed: number,
  t: number,
  seed: number,
  a: Vec2,
  b: Vec2,
  aim: number,
  out: Stroke[],
): void {
  const flicker = Math.floor(elapsed / 50);
  const alpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
  const main = jaggedLine(a, b, hashSeed(seed, flicker), 0.28);
  out.push({ points: main, width: def.width, alpha, closed: false, fill: false });
  for (let i = 1; i < def.count; i++) {
    const r = mulberry32(hashSeed(seed, 100 + i, flicker));
    const startIndex = Math.floor(r() * (main.length / 2 - 1)) * 2;
    const sx = main[startIndex] ?? a.x;
    const sy = main[startIndex + 1] ?? a.y;
    const angle = aim + (r() - 0.5) * 2.2;
    const length = 0.4 + r() * 0.8;
    const end = { x: sx + Math.cos(angle) * length, y: sy + Math.sin(angle) * length };
    out.push({
      points: jaggedLine({ x: sx, y: sy }, end, hashSeed(seed, 200 + i, flicker), 0.2),
      width: def.width * 0.55,
      alpha: alpha * 0.8,
      closed: false,
      fill: false,
    });
  }
}

/** A line from `a` to `b` with its midpoints displaced sideways, three levels deep. */
function jaggedLine(a: Vec2, b: Vec2, seed: number, amount: number): number[] {
  const r = mulberry32(seed);
  let points: Vec2[] = [a, b];
  for (let level = 0; level < 3; level++) {
    const next: Vec2[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i];
      const q = points[i + 1];
      if (!p || !q) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const jitter = (r() - 0.5) * 2 * amount * len;
      next.push(p, {
        x: (p.x + q.x) / 2 + (-dy / len) * jitter,
        y: (p.y + q.y) / 2 + (dx / len) * jitter,
      });
    }
    const last = points[points.length - 1];
    if (last) next.push(last);
    points = next;
  }
  return points.flatMap((p) => [p.x, p.y]);
}
