/**
 * Effects on Canvas 2D.
 *
 * The same sampled particles and strokes as the WebGL layer, drawn with
 * `drawImage` from tinted copies of the atlas cells and plain paths. Bounded
 * by a per-frame cap, because this is the fallback for machines without a
 * GPU: the board stays correct and the effects stay legible, and that is
 * what ADR 0002 asks of it.
 */

import type { Vec2 } from '../../core/types';
import type { FxCell } from '../../content/fx';
import { ATLAS_CELL, cellFrame, fxAtlas, celAtlasFrame, celReady } from './atlas';
import { celFrameIndex } from '../../content/fxCels';
import { roleColor } from './colors';
import { PARTICLE_STRIDE, sampleParticles, sampleStrokes } from './simulate';
import type { EmitterInstance } from '../view';

/** Particles drawn per frame, across every emitter. */
const MAX_PARTICLES = 96;
/** Stroke segments drawn per frame. */
const MAX_STROKES = 60;
/** Tinted cells kept; a cell per (shape, colour) so the map stays small. */
const MAX_TINTED = 96;
/** Still samples kept: a loop per chimney is a handful. */
const MAX_STILL = 16;

export class CanvasFxLayer {
  constructor() {
    fxAtlas();
  }
  private tinted = new Map<string, HTMLCanvasElement>();
  private scratch = new Float32Array(MAX_PARTICLES * PARTICLE_STRIDE);
  /** A still emitter's particles, sampled once rather than every frame, by instance key. */
  private stills = new Map<string, { readonly def: EmitterInstance['def']; data: Float32Array }>();

  /**
   * Draws one layer's worth of live emitters. `origin` is the screen position
   * of tile (0, 0) and `size` the tile size in CSS pixels. `oblique` says
   * the context carries the oblique ground transform.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    emitters: readonly EmitterInstance[],
    layer: 'under' | 'over',
    origin: Vec2,
    size: number,
    oblique = false,
  ): void {
    let particles = 0;
    let strokes = 0;

    for (const instance of emitters) {
      const { def } = instance;
      if (def.layer !== layer) continue;

      if (def.kind === 'particles') {
        if (particles >= MAX_PARTICLES) continue;
        const room = MAX_PARTICLES - particles;
        const sampled = instance.still ? this.still(instance) : null;
        const data = sampled ?? this.scratch;
        const n = sampled
          ? sampled.length / PARTICLE_STRIDE
          : sampleParticles(
              def,
              instance.elapsed,
              instance.seed,
              instance.from,
              instance.to,
              this.scratch,
              0,
              instance.arc,
            );
        const frame =
          def.cel && celReady(def.cel)
            ? celAtlasFrame(def.cel, celFrameIndex(def.cel, instance.elapsed, def.duration))
            : null;
        const cell = frame
          ? fxAtlas()
          : this.cell(def.cell, roleColor(def.color, instance.palette));
        ctx.save();
        ctx.globalCompositeOperation = def.blend === 'add' ? 'lighter' : 'source-over';
        for (let i = 0; i < Math.min(n, room); i++) {
          const at = i * PARTICLE_STRIDE;
          const px = origin.x + (data[at] ?? 0) * size;
          const py = origin.y + (data[at + 1] ?? 0) * size;
          const s = (data[at + 2] ?? 0) * size;
          const rotation = data[at + 3] ?? 0;
          ctx.globalAlpha = Math.max(0, Math.min(1, data[at + 4] ?? 0));
          const base = ctx.getTransform();
          // Stretched along the ground diagonal the oblique camera halves, so it lands round.
          const up = oblique && def.upright;
          ctx.setTransform(
            base
              .translate(px, py)
              .rotate(up ? Math.PI / 4 : rotation)
              .scale(up ? Math.SQRT2 : 1, up ? Math.SQRT1_2 : 1),
          );
          if (frame)
            ctx.drawImage(cell, frame.x, frame.y, frame.size, frame.size, -s / 2, -s / 2, s, s);
          else ctx.drawImage(cell, -s / 2, -s / 2, s, s);
          ctx.setTransform(base);
        }
        ctx.restore();
        particles += Math.min(n, room);
      } else {
        if (strokes >= MAX_STROKES) continue;
        const shapes = sampleStrokes(
          def,
          instance.elapsed,
          instance.seed,
          instance.from,
          instance.to,
          instance.arc,
        );
        const color = roleColor(def.color, instance.palette);
        const ink = roleColor('ink', instance.palette);
        ctx.save();
        ctx.globalCompositeOperation = def.blend === 'add' ? 'lighter' : 'source-over';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const shape of shapes) {
          if (strokes >= MAX_STROKES) break;
          strokes += 1;
          ctx.beginPath();
          for (let i = 0; i < shape.points.length; i += 2) {
            const x = origin.x + (shape.points[i] ?? 0) * size;
            const y = origin.y + (shape.points[i + 1] ?? 0) * size;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          if (shape.closed) ctx.closePath();
          ctx.globalAlpha = Math.max(0, Math.min(1, shape.alpha));
          if (def.ink) {
            ctx.strokeStyle = ink;
            ctx.lineWidth = (shape.width + 0.05) * size;
            ctx.stroke();
          }
          if (shape.fill) {
            ctx.fillStyle = color;
            ctx.fill();
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1, shape.width * size);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
  }

  /** A still emitter's particles, sampled the first time it is drawn and kept. */
  private still(instance: EmitterInstance): Float32Array {
    const { def, seed, elapsed, from, to, arc } = instance;
    const key = `${seed}|${elapsed}|${from.x},${from.y}|${to.x},${to.y}|${arc}`;
    const kept = this.stills.get(key);
    if (kept?.def === def) return kept.data;
    if (def.kind !== 'particles') return this.scratch.subarray(0, 0);
    const n = sampleParticles(def, elapsed, seed, from, to, this.scratch, 0, arc);
    const data = this.scratch.slice(0, n * PARTICLE_STRIDE);
    this.stills.set(key, { def, data });
    if (this.stills.size > MAX_STILL) {
      const oldest = this.stills.keys().next().value;
      if (oldest !== undefined) this.stills.delete(oldest);
    }
    return data;
  }

  /** A cell of the atlas with its white fill turned `hex`, ink edge kept. */
  private cell(cell: FxCell, hex: string): HTMLCanvasElement {
    const key = `${cell}|${hex}`;
    const existing = this.tinted.get(key);
    if (existing) return existing;

    const frame = cellFrame(cell);
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_CELL;
    canvas.height = ATLAS_CELL;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        fxAtlas(),
        frame.x,
        frame.y,
        frame.size,
        frame.size,
        0,
        0,
        ATLAS_CELL,
        ATLAS_CELL,
      );
      // Multiply keeps the ink edge dark and turns the white fill the colour;
      // the alpha pass afterwards restores the cell's own transparency.
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, ATLAS_CELL, ATLAS_CELL);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(
        fxAtlas(),
        frame.x,
        frame.y,
        frame.size,
        frame.size,
        0,
        0,
        ATLAS_CELL,
        ATLAS_CELL,
      );
    }

    this.tinted.set(key, canvas);
    if (this.tinted.size > MAX_TINTED) {
      const oldest = this.tinted.keys().next().value;
      if (oldest !== undefined) this.tinted.delete(oldest);
    }
    return canvas;
  }
}
