/**
 * Effects on WebGL.
 *
 * Two particle containers per layer, one per blend mode, all drawing from
 * the one effects atlas, nearest-sampled, so each is a single draw call: a
 * shape draws its pixel rung at one art px a world px, a cel scales its
 * master (ADR 0086). The strokes are hardened rasters (`pixelStrokes.ts`),
 * one pooled sprite an emitter in a container per blend. Particles are
 * re-sampled every frame from the emitter's age and written straight into
 * pooled particles, so nothing is allocated once the pool has warmed up.
 */

import { Container, Particle, ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';
import { CanvasSource } from 'pixi.js';
import type { Vec2 } from '../../core/types';
import type { FxCell } from '../../content/fx';
import { FX_CELLS } from '../../content/fx';
import { TILE } from '../camera';
import { cellFrame, fxAtlas, celAtlasFrame, celReady, onFxAtlasChange, rungFrame } from './atlas';
import { PIXEL_LADDER } from './pixelCells';
import { CEL_FRAMES, CEL_SIZE, FX_CELS, celFrameIndex } from '../../content/fxCels';
import { hexToNumber, roleColor } from './colors';
import { PARTICLE_STRIDE, sampleParticles, sampleStrokes } from './simulate';
import { StrokeRasterer } from './pixelStrokes';
import type { EmitterInstance } from '../view';

/** Particles drawn per frame across every emitter of a layer. */
const MAX_PARTICLES = 400;

export class ParticleLayer {
  readonly container = new Container();

  private readonly normal: ParticleContainer;
  private readonly additive: ParticleContainer;
  /** The stroke rasters (`pixelStrokes.ts`), one pooled sprite an emitter, per blend. */
  private readonly strokes = new Container();
  private readonly strokesAdd = new Container();
  private readonly rasterer = new StrokeRasterer();
  private rasterSlots: { sprite: Sprite; source: CanvasSource; texture: Texture }[] = [];
  private readonly cells = new Map<FxCell, Texture>();
  /** Each shape's rungs, by `${cell}/${rung}`. */
  private readonly rungs = new Map<string, Texture>();
  private readonly source: CanvasSource;
  private readonly celTextures = new Map<string, Texture>();
  private readonly unsubscribe: () => void;
  private pool: Particle[] = [];
  private scratch = new Float32Array(MAX_PARTICLES * PARTICLE_STRIDE);

  constructor(private readonly layer: 'under' | 'over') {
    // Created before the containers that bind it, so the bind group is right
    // from the first frame (see the note on filter resources in pixi.ts).
    this.source = new CanvasSource({
      resource: fxAtlas(),
      alphaMode: 'premultiply-alpha-on-upload',
      // Pixel art at the world's grain (ADR 0086): never blended between texels.
      scaleMode: 'nearest',
    });
    this.unsubscribe = onFxAtlasChange(() => this.source.update());
    for (const cel of FX_CELS)
      for (let i = 0; i < CEL_FRAMES; i++) {
        const frame = celAtlasFrame(cel, i);
        this.celTextures.set(
          `${cel}/${i}`,
          new Texture({
            source: this.source,
            frame: new Rectangle(frame.x, frame.y, frame.size, frame.size),
          }),
        );
      }
    const atlas = new Texture({ source: this.source });
    for (const cell of FX_CELLS)
      for (const rung of PIXEL_LADDER) {
        const frame = rungFrame(cell, rung);
        this.rungs.set(
          `${cell}/${rung}`,
          new Texture({
            source: this.source,
            frame: new Rectangle(frame.x, frame.y, frame.size, frame.size),
          }),
        );
      }
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
    this.unsubscribe();
    this.container.destroy({ children: true });
    for (const texture of this.cells.values()) texture.destroy(false);
    for (const texture of this.rungs.values()) texture.destroy(false);
    for (const slot of this.rasterSlots) {
      slot.texture.destroy(false);
      slot.source.destroy();
    }
    for (const texture of this.celTextures.values()) texture.destroy(false);
    this.source.destroy();
  }

  /**
   * Rebuilds the layer from the live emitters, in world pixels (tile * TILE).
   * `oblique` says the container carries the oblique ground transform.
   */
  draw(emitters: readonly EmitterInstance[], oblique = false): void {
    let rasters = 0;
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
        const cel = def.cel && celReady(def.cel) ? def.cel : undefined;
        const celTexture = cel
          ? this.celTextures.get(`${cel}/${celFrameIndex(cel, instance.elapsed, def.duration)}`)
          : undefined;
        if (cel && !celTexture) continue;
        const tint = cel ? 0xffffff : hexToNumber(roleColor(def.color, instance.palette));
        const list = def.blend === 'add' ? additive : normal;
        // Stretched along the ground diagonal the oblique camera halves, so it lands round.
        const up = oblique && def.upright;
        for (let i = 0; i < n && used < MAX_PARTICLES; i++) {
          const at = i * PARTICLE_STRIDE;
          const particle = this.particle(used++);
          const px = (this.scratch[at + 2] ?? 0) * TILE;
          // A shape draws the rung nearest its size at one art px a world px; a cel scales its master.
          const rung = celTexture ? null : rungFrame(def.cell, px);
          const texture = celTexture ?? (rung ? this.rungs.get(`${def.cell}/${rung.rung}`) : null);
          if (!texture) continue;
          particle.texture = texture;
          particle.x = (this.scratch[at] ?? 0) * TILE;
          particle.y = (this.scratch[at + 1] ?? 0) * TILE;
          const scale = rung ? 1 : px / CEL_SIZE;
          particle.scaleX = up ? scale * Math.SQRT2 : scale;
          particle.scaleY = up ? scale * Math.SQRT1_2 : scale;
          particle.rotation = up ? Math.PI / 4 : (this.scratch[at + 3] ?? 0);
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
        const raster = this.rasterer.raster(
          rasters,
          shapes,
          roleColor(def.color, instance.palette),
          def.ink ? roleColor('ink', instance.palette) : null,
        );
        if (!raster) continue;
        const slot = this.rasterSlot(rasters++, raster.canvas);
        slot.texture.frame.width = raster.width;
        slot.texture.frame.height = raster.height;
        slot.texture.update();
        slot.source.update();
        slot.sprite.position.set(raster.x, raster.y);
        const parent = def.blend === 'add' ? this.strokesAdd : this.strokes;
        if (slot.sprite.parent !== parent) parent.addChild(slot.sprite);
        slot.sprite.visible = true;
      }
    }
    this.rasterSlots.forEach((slot, index) => {
      slot.sprite.visible = index < rasters;
    });

    this.normal.particleChildren = normal;
    this.additive.particleChildren = additive;
    this.normal.update();
    this.additive.update();
  }

  /** Slot `index`'s sprite, its texture bound to `canvas` (rebuilt when the pooled canvas grew). */
  private rasterSlot(index: number, canvas: HTMLCanvasElement) {
    let slot = this.rasterSlots[index];
    if (
      slot &&
      (slot.source.resource !== canvas ||
        slot.source.pixelWidth !== canvas.width ||
        slot.source.pixelHeight !== canvas.height)
    ) {
      slot.texture.destroy(false);
      slot.source.destroy();
      slot = undefined;
    }
    if (!slot) {
      const source = new CanvasSource({
        resource: canvas,
        alphaMode: 'premultiply-alpha-on-upload',
        scaleMode: 'nearest',
      });
      const texture = new Texture({
        source,
        frame: new Rectangle(0, 0, canvas.width, canvas.height),
      });
      const existing = this.rasterSlots[index]?.sprite;
      const sprite = existing ?? new Sprite();
      sprite.texture = texture;
      slot = { sprite, source, texture };
      this.rasterSlots[index] = slot;
    }
    return slot;
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
