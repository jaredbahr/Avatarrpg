/** A shared transparent stage above either board backend; it never reads game state. */
import type { MapBackdrop, Vec2 } from '../../core/types';
import type { Camera } from '../camera';
import { paletteFor } from '../palettes';
import { figureFor } from '../painters/cast';
import { drawFigure } from '../painters/figure';
import { formBeat, villagePose } from './poses';
import type { VillageMotion } from './poses';
import { backdrops } from '../backdrops';
import { sheets } from '../sheets/store';
import type { ResolvedFrame } from '../sheets/store';
import { RIVERSIDE_SCENERY, behindScenery, sceneryShade } from './scenery';
import type { SceneryLayer } from './scenery';
import { paintForm } from './forms';

export interface VillageActor {
  readonly id: string;
  readonly pos: Vec2;
  readonly variant: string;
  readonly sprite?: string;
  readonly palette: string;
  readonly villager?: boolean;
  readonly facing: 1 | -1;
  readonly motion: VillageMotion;
  readonly elapsed: number;
  readonly label: string;
}
export interface VillageView {
  readonly time: number;
  readonly reduced: boolean;
  readonly backdrop: MapBackdrop | null;
  readonly actors: readonly VillageActor[];
  readonly creature: Vec2;
  readonly friendly: boolean;
  readonly creatureLabel: boolean;
  readonly pet: boolean;
  readonly fireflies: boolean;
}

const INK = '#382b26';
const LIGHT = '#edf7e5';
const CREAM = '#d8c9a4';

export class VillageLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** One small reusable compositing surface; no per-frame texture cache. */
  private tint = document.createElement('canvas');
  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'village-life-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('The village animation stage could not start.');
    this.ctx = ctx;
  }
  destroy(): void {
    this.canvas.remove();
  }
  draw(view: VillageView, camera: Camera): void {
    const { width, height } = camera.viewport;
    const dpr = Math.min(camera.viewport.dpr, 2);
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, width, height);
    const t = view.reduced ? 0 : view.time / 1000;
    this.river(camera, t);
    const painting = view.backdrop ? backdrops.get(view.backdrop.url) : null;
    for (const actor of view.actors) this.groundContact(actor, camera, view.reduced);
    const entities = [
      ...view.actors.map((actor) => ({
        y: actor.pos.y + 0.86,
        draw: () => this.actor(actor, camera, view.reduced),
      })),
      { y: view.creature.y + 0.86, draw: () => this.otter(view, camera, t) },
      ...(painting
        ? RIVERSIDE_SCENERY.map((layer) => ({
            y: layer.depth,
            draw: () => this.scenery(layer, painting, camera),
          }))
        : []),
    ].sort((a, b) => a.y - b.y);
    for (const entity of entities) entity.draw();
    this.canvas.dataset.illustratedActors = String(
      view.actors.filter((a) => a.sprite && sheets.loadedFor(a.sprite)).length,
    );
    this.canvas.dataset.occludedActors = String(
      painting
        ? view.actors.filter((a) => a.sprite && behindScenery(a.pos.x + 0.5, a.pos.y + 0.3)).length
        : 0,
    );
    // Names remain usable even when an actor is behind a foreground branch.
    for (const actor of view.actors) {
      if (!actor.label) continue;
      const box = camera.toScreen(actor.pos);
      const hidden =
        painting && actor.sprite && behindScenery(actor.pos.x + 0.5, actor.pos.y + 0.3);
      // The party names live in the HUD. Floating cards made every figure
      // read as a token; show them here only during an action or when hidden.
      if (actor.sprite && !hidden && (actor.motion === 'idle' || actor.motion === 'walk')) continue;
      if (hidden) {
        c.strokeStyle = '#ffe4a2';
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(
          box.x + box.size / 2,
          box.y + box.size * 0.86,
          box.size * 0.22,
          box.size * 0.07,
          0,
          0,
          Math.PI * 2,
        );
        c.stroke();
      }
      this.label(actor.label, box.x + box.size / 2, box.y + box.size * 1.16, box.size);
    }
    if (!view.reduced) this.butterflies(camera, t, view.fireflies);
  }
  private scenery(layer: SceneryLayer, painting: HTMLImageElement, camera: Camera): void {
    const c = this.ctx;
    const origin = camera.toScreen({ x: 0, y: 0 });
    c.save();
    c.beginPath();
    for (const points of layer.outlines) {
      points.forEach(([x, y], i) => {
        const px = origin.x + x * origin.size,
          py = origin.y + y * origin.size;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      });
      c.closePath();
    }
    c.clip();
    c.drawImage(painting, origin.x, origin.y, 36 * origin.size, 24 * origin.size);
    c.restore();
  }
  private groundContact(actor: VillageActor, camera: Camera, reduced: boolean): void {
    const c = this.ctx,
      box = camera.toScreen(actor.pos),
      s = box.size;
    const x = box.x + s * 0.5,
      y = box.y + s * 0.86;
    c.save();
    // The environment's afternoon light comes from the upper right.
    const shade = sceneryShade(actor.pos.x + 0.5, actor.pos.y + 0.86);
    const frame = this.actorFrame(actor, s, camera.viewport.dpr, reduced);
    if (frame && !frame.placeholder) {
      const ink = this.copyFrame(frame);
      ink.globalCompositeOperation = 'source-in';
      ink.fillStyle = '#344236';
      ink.fillRect(0, 0, this.tint.width, this.tint.height);
      ink.globalCompositeOperation = 'source-over';
      const factor = (s * 1.45) / frame.pixelsPerTile;
      c.save();
      c.globalAlpha = 0.19 * (1 - shade * 0.65);
      const casting = actor.motion === 'water' || actor.motion === 'fire';
      const weight =
        casting && !reduced ? formBeat(actor.elapsed, actor.motion === 'water').weight : 0;
      c.translate(x + weight * s * actor.facing, y);
      // Project the actual silhouette, keeping both boot contacts attached.
      c.transform(actor.facing, 0, 0.52, -0.19, 0, 0);
      c.drawImage(
        this.tint,
        -frame.frame.w * factor * frame.anchor.x,
        -frame.frame.h * factor * frame.anchor.y,
        frame.frame.w * factor,
        frame.frame.h * factor,
      );
      c.restore();
    }
    c.fillStyle = 'rgba(42,40,27,0.27)';
    c.beginPath();
    c.ellipse(x, y, s * 0.25, s * 0.06, 0, 0, Math.PI * 2);
    c.fill();
    if (!reduced && (actor.motion === 'fire' || actor.motion === 'water')) {
      const beat = formBeat(actor.elapsed, actor.motion === 'water');
      const alpha = beat.energy * 0.22;
      const light = c.createRadialGradient(x, y, 0, x, y, s * 1.8);
      light.addColorStop(
        0,
        actor.motion === 'fire' ? `rgba(255,161,54,${alpha})` : `rgba(132,226,239,${alpha})`,
      );
      light.addColorStop(1, 'rgba(255,211,139,0)');
      c.fillStyle = light;
      c.fillRect(x - s * 1.8, y - s * 1.8, s * 3.6, s * 3.6);
    }
    c.restore();
  }
  private actorFrame(
    actor: VillageActor,
    size: number,
    dpr: number,
    reduced: boolean,
  ): ResolvedFrame | null {
    if (!actor.sprite) return null;
    const elapsed = reduced ? 0 : Math.floor(actor.elapsed / (1000 / 12)) * (1000 / 12);
    const casting = actor.motion === 'water' || actor.motion === 'fire';
    const beat = formBeat(elapsed, actor.motion === 'water');
    const clip =
      reduced || (casting && (beat.t < 0.1 || beat.t > 0.96))
        ? 'idle'
        : casting
          ? 'cast'
          : actor.motion;
    return sheets.frame(
      actor.sprite,
      clip,
      elapsed,
      casting && !reduced ? beat.frame : undefined,
      size * dpr,
      1,
    );
  }
  private copyFrame(frame: ResolvedFrame): CanvasRenderingContext2D {
    if (this.tint.width !== frame.frame.w || this.tint.height !== frame.frame.h) {
      this.tint.width = frame.frame.w;
      this.tint.height = frame.frame.h;
    }
    const ink = this.tint.getContext('2d');
    if (!ink) throw new Error('The character lighting stage could not start.');
    ink.clearRect(0, 0, this.tint.width, this.tint.height);
    ink.drawImage(
      frame.source,
      frame.frame.x,
      frame.frame.y,
      frame.frame.w,
      frame.frame.h,
      0,
      0,
      this.tint.width,
      this.tint.height,
    );
    return ink;
  }
  private actor(actor: VillageActor, camera: Camera, reduced: boolean): void {
    const box = camera.toScreen(actor.pos);
    const c = this.ctx;
    if (
      box.x < -200 ||
      box.y < -200 ||
      box.x > camera.viewport.width + 200 ||
      box.y > camera.viewport.height + 200
    )
      return;
    const s = box.size;
    const palette = paletteFor(actor.palette);
    // Twelve held drawings a second keeps the motion's deliberate animated feel.
    const elapsed = reduced ? 0 : Math.floor(actor.elapsed / (1000 / 12)) * (1000 / 12);
    const pose = villagePose(reduced ? 'idle' : actor.motion, elapsed);
    const spec = figureFor(actor.villager ? 'villager' : 'bender', actor.variant, palette);
    const casting = actor.motion === 'water' || actor.motion === 'fire';
    const beat = formBeat(elapsed, actor.motion === 'water');
    const frame = this.actorFrame(actor, s, camera.viewport.dpr, reduced);
    if (casting && !reduced) paintForm(c, actor, box, false);
    if (frame && !frame.placeholder) {
      const factor = (s * 1.45) / frame.pixelsPerTile;
      const w = frame.frame.w * factor,
        h = frame.frame.h * factor;
      const ink = this.copyFrame(frame);
      ink.globalCompositeOperation = 'source-atop';
      ink.fillStyle = 'rgba(242,202,133,0.09)';
      ink.fillRect(0, 0, this.tint.width, this.tint.height);
      const shade = sceneryShade(actor.pos.x + 0.5, actor.pos.y + 0.86);
      ink.fillStyle = `rgba(37,65,68,${shade * 0.32})`;
      ink.fillRect(0, 0, this.tint.width, this.tint.height);
      if (casting && !reduced) {
        ink.fillStyle =
          actor.motion === 'fire'
            ? `rgba(255,184,71,${beat.energy * 0.17})`
            : `rgba(169,235,243,${beat.energy * 0.14})`;
        ink.fillRect(this.tint.width / 2, 0, this.tint.width / 2, this.tint.height);
      }
      ink.globalCompositeOperation = 'source-over';
      c.save();
      c.translate(box.x + s * 0.5, box.y + s * 0.86);
      c.scale(actor.facing, 1);
      if (casting && !reduced) {
        c.translate(beat.weight * s, 0);
        c.scale(1, 1 - beat.gather * (1 - beat.release) * 0.018);
      }
      c.drawImage(
        this.tint,
        0,
        0,
        frame.frame.w,
        frame.frame.h,
        -w * frame.anchor.x,
        -h * frame.anchor.y,
        w,
        h,
      );
      c.restore();
    } else
      drawFigure(
        c,
        { x: box.x - s * 0.1, y: box.y - s * 0.182, size: s * 1.2 },
        spec,
        pose,
        palette,
        actor.facing,
        0.36,
      );
    if (casting && !reduced) paintForm(c, actor, box, true);
  }
  private label(text: string, x: number, y: number, size: number): void {
    const c = this.ctx;
    c.font = `600 ${Math.max(10, size * 0.22)}px system-ui`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const width = c.measureText(text).width + 14;
    c.fillStyle = 'rgba(250,244,225,0.92)';
    c.beginPath();
    c.roundRect(x - width / 2, y - 9, width, 19, 6);
    c.fill();
    c.fillStyle = INK;
    c.fillText(text, x, y + 1);
  }
  private river(camera: Camera, time: number): void {
    const c = this.ctx;
    c.save();
    const origin = camera.toScreen({ x: 0, y: 0 });
    c.translate(origin.x, origin.y);
    c.scale(origin.size, origin.size);
    c.lineCap = 'round';
    for (let i = 0; i < 38; i++) {
      const y = (i * 0.67 + time * 0.48) % 24;
      if (y > 10.65 && y < 13.2) continue;
      const centre = y < 11 ? 25.05 : 24.4 + Math.max(0, y - 17) * 0.4;
      const x = centre + Math.sin(i * 8.31) * 1.2;
      c.strokeStyle = i % 3 ? 'rgba(213,250,238,0.25)' : 'rgba(250,255,232,0.48)';
      c.lineWidth = 0.025 + (i % 3) * 0.012;
      c.beginPath();
      c.moveTo(x - 0.2, y);
      c.quadraticCurveTo(x, y - 0.08, x + 0.35, y);
      c.stroke();
    }
    // Falling spray at the top waterfall and at the little drop below the bridge.
    for (let i = 0; i < 12; i++) {
      const y = (time * 1.2 + i * 0.17) % 2.0;
      c.globalAlpha = Math.sin((y / 2) * Math.PI) * 0.5;
      c.fillStyle = LIGHT;
      c.beginPath();
      c.ellipse(25.1 + Math.sin(i * 5) * 0.9, 0.9 + y, 0.04, 0.1, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
  private otter(view: VillageView, camera: Camera, time: number): void {
    const box = camera.toScreen(view.creature);
    const c = this.ctx;
    const s = box.size;
    c.save();
    c.translate(box.x + s * 0.5, box.y + s * 0.6);
    c.scale(s, s);
    const bounce = view.reduced ? 0 : Math.sin(time * (view.pet ? 9 : 3)) * 0.025;
    c.fillStyle = 'rgba(31,47,33,0.22)';
    c.beginPath();
    c.ellipse(0, 0.24, 0.58, 0.14, 0, 0, Math.PI * 2);
    c.fill();
    c.translate(0, bounce);
    c.strokeStyle = INK;
    c.lineWidth = 0.035;
    c.lineJoin = 'round';
    const oval = (x: number, y: number, rx: number, ry: number, color: string, angle = 0) => {
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    };
    oval(-0.46, 0.15, 0.37, 0.11, '#8f6847', Math.sin(time * 3) * 0.1);
    oval(-0.23, 0.21, 0.12, 0.075, '#8f6847');
    oval(0.22, 0.22, 0.13, 0.075, '#8f6847');
    oval(-0.04, -0.02, 0.44, 0.29, '#6c8060');
    oval(-0.07, -0.07, 0.31, 0.18, '#96a378');
    c.lineWidth = 0.025;
    c.beginPath();
    c.moveTo(-0.33, -0.14);
    c.lineTo(-0.12, -0.04);
    c.lineTo(0.04, -0.23);
    c.moveTo(-0.12, -0.04);
    c.lineTo(-0.02, 0.18);
    c.lineTo(0.24, 0.08);
    c.stroke();
    oval(0.31, -0.03, 0.25, 0.23, '#97714e');
    oval(0.2, -0.22, 0.065, 0.07, '#97714e');
    oval(0.45, -0.2, 0.065, 0.07, '#97714e');
    oval(0.4, 0.07, 0.19, 0.105, CREAM);
    c.fillStyle = INK;
    for (const x of [0.28, 0.46]) {
      c.beginPath();
      c.ellipse(x, -0.05, 0.025, view.pet || time % 5 < 0.12 ? 0.009 : 0.034, 0, 0, Math.PI * 2);
      c.fill();
    }
    oval(0.52, 0.04, 0.038, 0.025, INK);
    c.lineWidth = 0.015;
    for (const dy of [-0.035, 0.035]) {
      c.beginPath();
      c.moveTo(0.4, 0.09 + dy);
      c.lineTo(0.68, 0.07 + dy * 2);
      c.stroke();
    }
    if (view.pet) {
      c.fillStyle = '#bb5e59';
      c.font = '0.32px serif';
      c.scale(0.01, 0.01);
      c.font = '32px serif';
      c.fillText('♥', 10, -50 - Math.sin(time * 3) * 8);
    }
    c.restore();
    if (view.creatureLabel)
      this.label(
        view.friendly ? 'Pebble · your new friend' : 'A very curious otter-turtle',
        box.x + s / 2,
        box.y + s * 1.16,
        s,
      );
  }
  private butterflies(camera: Camera, time: number, fireflies: boolean): void {
    const c = this.ctx;
    for (let i = 0; i < 8; i++) {
      const origin = camera.toScreen({
        x: 13 + Math.sin(time * 0.18 + i * 2) * 6,
        y: 12 + Math.cos(time * 0.23 + i) * 5,
      });
      const wing = Math.abs(Math.sin(time * 9 + i)) * 3 + 1;
      c.fillStyle = i % 2 ? '#f2d3a0' : '#b4dae3';
      c.beginPath();
      c.ellipse(origin.x, origin.y, wing, 2.5, -0.5, 0, Math.PI * 2);
      c.fill();
    }
    if (fireflies) {
      const b = camera.toScreen({ x: 31, y: 5 });
      for (let i = 0; i < 9; i++) {
        c.globalAlpha = 0.3 + (Math.sin(time * 2 + i) + 1) * 0.3;
        c.fillStyle = '#ffe7a1';
        c.beginPath();
        c.arc(
          b.x + Math.sin(i * 7 + time * 0.2) * b.size,
          b.y + Math.cos(i * 2 + time * 0.3) * b.size,
          2.5,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      c.globalAlpha = 1;
    }
  }
}
