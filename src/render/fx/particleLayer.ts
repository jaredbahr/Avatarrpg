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
import {
  cellFrame,
  celAtSize,
  celPx,
  celReady,
  fxAtlas,
  onFxAtlasChange,
  rungFrame,
} from './atlas';
import { PIXEL_LADDER } from './pixelCells';
import { type FxCel, celFrameIndex } from '../../content/fxCels';
import { hexToNumber, inkedPalette, roleColor } from './colors';
import { PARTICLE_STRIDE, sampleParticles, sampleStrokes } from './simulate';
import { StrokeRasterer } from './pixelStrokes';
import type { EmitterInstance } from '../view';

/** Particles drawn per frame across every emitter of a layer. */
const MAX_PARTICLES = 400;
/** Resampled cel textures kept, like the canvases behind them (`atlas.ts`). */
const MAX_SIZED_CELS = 64;

export class ParticleLayer {
  readonly container = new Container();

  private readonly normal: ParticleContainer;
  private readonly additive: ParticleContainer;
  /** The stroke rasters (`pixelStrokes.ts`), one pooled sprite an emitter, per blend. */
  private readonly strokes = new Container();
  private readonly strokesAdd = new Container();
  private readonly rasterer = new StrokeRasterer();
  /** The element cels, one pooled sprite each, between the strokes and the shapes. */
  private readonly cels = new Container();
  private readonly sizedCels = new Map<string, Texture>();
  private rasterSlots: { sprite: Sprite; source: CanvasSource; texture: Texture }[] = [];
  private readonly cells = new Map<FxCell, Texture>();
  /** Each shape's rungs, by `${cell}/${rung}`. */
  private readonly rungs = new Map<string, Texture>();
  private readonly source: CanvasSource;
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
    const atlas = new Texture({ source: this.source });
    for (const cell of FX_CELLS)
      for (const rung of PIXEL_LADDER)
        for (const ink of [true, false]) {
          const frame = rungFrame(cell, rung, ink);
          this.rungs.set(
            `${cell}/${rung}/${ink}`,
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
    this.container.addChild(this.strokes, this.cels, this.normal, this.additive, this.strokesAdd);
  }

  destroy(): void {
    this.unsubscribe();
    this.container.destroy({ children: true });
    for (const texture of this.cells.values()) texture.destroy(false);
    for (const texture of this.rungs.values()) texture.destroy(false);
    for (const texture of this.sizedCels.values()) texture.destroy(true);
    for (const slot of this.rasterSlots) {
      slot.texture.destroy(false);
      slot.source.destroy();
    }
    this.source.destroy();
  }

  /**
   * Rebuilds the layer from the live emitters, in world pixels (tile * TILE).
   * `oblique` says the container carries the oblique ground transform.
   */
  draw(emitters: readonly EmitterInstance[], oblique = false): void {
    let rasters = 0;
    let sprites = 0;
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
        const celFrame = cel ? celFrameIndex(cel, instance.elapsed, def.duration) : 0;
        const tint = hexToNumber(roleColor(def.color, instance.palette));
        const ink = inkedPalette(instance.palette);
        const list = def.blend === 'add' ? additive : normal;
        // Stretched along the ground diagonal the oblique camera halves, so it lands round.
        const up = oblique && def.upright;
        for (let i = 0; i < n && used < MAX_PARTICLES; i++) {
          const at = i * PARTICLE_STRIDE;
          const x = (this.scratch[at] ?? 0) * TILE;
          const y = (this.scratch[at + 1] ?? 0) * TILE;
          const rotation = up ? Math.PI / 4 : (this.scratch[at + 3] ?? 0);
          const alpha = Math.max(0, Math.min(1, this.scratch[at + 4] ?? 0));
          const tiles = this.scratch[at + 2] ?? 0;
          if (cel) {
            // A cel draws its master resampled to its size, unscaled (ADR 0086): a sprite of its own.
            const texture = this.celTexture(cel, celFrame, celPx(tiles));
            if (!texture) continue;
            used += 1;
            const sprite = this.celSprite(sprites++);
            sprite.texture = texture;
            sprite.position.set(x, y);
            sprite.rotation = rotation;
            sprite.scale.set(up ? Math.SQRT2 : 1, up ? Math.SQRT1_2 : 1);
            sprite.alpha = alpha;
            sprite.blendMode = def.blend === 'add' ? 'add' : 'normal';
            sprite.visible = true;
            continue;
          }
          // A shape draws the rung nearest its size at one art px a world px.
          const rung = rungFrame(def.cell, tiles * TILE);
          const texture = this.rungs.get(`${def.cell}/${rung.rung}/${ink}`);
          if (!texture) continue;
          const particle = this.particle(used++);
          particle.texture = texture;
          particle.x = x;
          particle.y = y;
          particle.scaleX = up ? Math.SQRT2 : 1;
          particle.scaleY = up ? Math.SQRT1_2 : 1;
          particle.rotation = rotation;
          particle.tint = tint;
          particle.alpha = alpha;
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
          def.ink && inkedPalette(instance.palette) ? roleColor('ink', instance.palette) : null,
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
    this.cels.children.forEach((child, index) => {
      child.visible = index < sprites;
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

  /** Pooled cel sprite `index`, centred like a particle. */
  private celSprite(index: number): Sprite {
    const existing = this.cels.children[index];
    if (existing instanceof Sprite) return existing;
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    this.cels.addChild(sprite);
    return sprite;
  }

  /** A cel at `px` world pixels as a nearest-sampled texture, kept in a bounded LRU. */
  private celTexture(cel: FxCel, frame: number, px: number): Texture | null {
    const sized = celAtSize(cel, frame, px);
    if (!sized) return null;
    const kept = this.sizedCels.get(sized.key);
    if (kept && kept.source.resource === sized.canvas) {
      this.sizedCels.delete(sized.key);
      this.sizedCels.set(sized.key, kept);
      return kept;
    }
    kept?.destroy(true);
    const texture = new Texture({
      source: new CanvasSource({
        resource: sized.canvas,
        alphaMode: 'premultiply-alpha-on-upload',
        scaleMode: 'nearest',
      }),
    });
    this.sizedCels.set(sized.key, texture);
    while (this.sizedCels.size > MAX_SIZED_CELS) {
      const oldest = this.sizedCels.keys().next().value;
      if (oldest === undefined) break;
      const gone = this.sizedCels.get(oldest);
      this.sizedCels.delete(oldest);
      // Still on a sprite this frame? Hide it rather than draw a destroyed texture.
      for (const child of this.cels.children)
        if (child instanceof Sprite && child.texture === gone) child.texture = Texture.EMPTY;
      gone?.destroy(true);
    }
    return texture;
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
