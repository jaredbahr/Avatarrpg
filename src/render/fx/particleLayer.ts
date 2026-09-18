/**
 * Effects on WebGL.
 *
 * Two particle containers per layer, one per blend mode, all drawing from
 * the one effects atlas so each is a single draw call; two graphics objects
 * for the strokes, again one per blend. Particles are re-sampled every frame
 * from the emitter's age and written straight into pooled particles, so
 * nothing is allocated once the pool has warmed up.
 */

import { Container, Graphics, Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js';
import { CanvasSource } from 'pixi.js';
import type { Vec2 } from '../../core/types';
import type { FxCell } from '../../content/fx';
import { FX_CELLS } from '../../content/fx';
import { TILE } from '../camera';
import { ATLAS_CELL, cellFrame, fxAtlas } from './atlas';
import { hexToNumber, roleColor } from './colors';
import { PARTICLE_STRIDE, sampleParticles, sampleStrokes } from './simulate';
import type { EmitterInstance } from '../view';

/** Particles drawn per frame across every emitter of a layer. */
const MAX_PARTICLES = 400;

export class ParticleLayer {
  readonly container = new Container();

  private readonly normal: ParticleContainer;
  private readonly additive: ParticleContainer;
  private readonly strokes = new Graphics();
  private readonly strokesAdd = new Graphics();
  private readonly cells = new Map<FxCell, Texture>();
  private readonly source: CanvasSource;
  private pool: Particle[] = [];
  private scratch = new Float32Array(MAX_PARTICLES * PARTICLE_STRIDE);

  constructor(private readonly layer: 'under' | 'over') {
    // Created before the containers that bind it, so the bind group is right
    // from the first frame (see the note on filter resources in pixi.ts).
    this.source = new CanvasSource({
      resource: fxAtlas(),
      alphaMode: 'premultiply-alpha-on-upload',
    });
    const atlas = new Texture({ source: this.source });
    for (const cell of FX_CELLS) {
      const frame = cellFrame(cell);
      this.cells.set(
        cell,
        new Texture({
          source: this.source,
          frame: new Rectangle(frame.x, frame.y, frame.size, frame.size),
        }),
      );
    }
    const dynamicProperties = {
      position: true,
      scale: true,
      rotation: true,
      color: true,
      uvs: true,
    };
    this.normal = new ParticleContainer({ texture: atlas, dynamicProperties });
    this.additive = new ParticleContainer({ texture: atlas, dynamicProperties });
    this.additive.blendMode = 'add';
    this.strokesAdd.blendMode = 'add';
    this.container.addChild(this.strokes, this.normal, this.additive, this.strokesAdd);
  }

  destroy(): void {
    this.container.destroy({ children: true });
    for (const texture of this.cells.values()) texture.destroy(false);
    this.source.destroy();
  }

  /** Rebuilds the layer from the live emitters, in world pixels (tile * TILE). */
  draw(emitters: readonly EmitterInstance[]): void {
    this.strokes.clear();
    this.strokesAdd.clear();
    const normal: Particle[] = [];
    const additive: Particle[] = [];
    let used = 0;

    for (const instance of emitters) {
      const { def } = instance;
      if (def.layer !== this.layer) continue;

      if (def.kind === 'particles') {
        if (used >= MAX_PARTICLES) continue;
        const n = sampleParticles(
          def,
          instance.elapsed,
          instance.seed,
          instance.from,
          instance.to,
          this.scratch,
          0,
          instance.arc,
        );
        const texture = this.cells.get(def.cell);
        if (!texture) continue;
        const tint = hexToNumber(roleColor(def.color, instance.palette));
        const list = def.blend === 'add' ? additive : normal;
        for (let i = 0; i < n && used < MAX_PARTICLES; i++) {
          const at = i * PARTICLE_STRIDE;
          const particle = this.particle(used++);
          particle.texture = texture;
          particle.x = (this.scratch[at] ?? 0) * TILE;
          particle.y = (this.scratch[at + 1] ?? 0) * TILE;
          const scale = ((this.scratch[at + 2] ?? 0) * TILE) / ATLAS_CELL;
          particle.scaleX = scale;
          particle.scaleY = scale;
          particle.rotation = this.scratch[at + 3] ?? 0;
          particle.tint = tint;
          particle.alpha = Math.max(0, Math.min(1, this.scratch[at + 4] ?? 0));
          list.push(particle);
        }
      } else {
        const shapes = sampleStrokes(
          def,
          instance.elapsed,
          instance.seed,
          instance.from,
          instance.to,
          instance.arc,
        );
        const g = def.blend === 'add' ? this.strokesAdd : this.strokes;
        const color = roleColor(def.color, instance.palette);
        const ink = roleColor('ink', instance.palette);
        for (const shape of shapes) {
          const points = shape.points.map((v) => v * TILE);
          const alpha = Math.max(0, Math.min(1, shape.alpha));
          if (def.ink) {
            g.poly(points, shape.closed).stroke({
              width: (shape.width + 0.05) * TILE,
              color: ink,
              alpha,
              cap: 'round',
              join: 'round',
            });
          }
          if (shape.fill) {
            g.poly(points, true).fill({ color, alpha });
          } else {
            g.poly(points, shape.closed).stroke({
              width: Math.max(1, shape.width * TILE),
              color,
              alpha,
              cap: 'round',
              join: 'round',
            });
          }
        }
      }
    }

    this.normal.particleChildren = normal;
    this.additive.particleChildren = additive;
    this.normal.update();
    this.additive.update();
  }

  private particle(index: number): Particle {
    let particle = this.pool[index];
    if (!particle) {
      const texture = this.cells.get('disc') ?? Texture.WHITE;
      particle = new Particle({ texture, anchorX: 0.5, anchorY: 0.5 });
      this.pool[index] = particle;
    }
    return particle;
  }
}

/** World-pixel position of a tile-unit point. */
export function worldPx(p: Vec2): Vec2 {
  return { x: p.x * TILE, y: p.y * TILE };
}
