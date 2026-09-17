/** A shared transparent stage above either board backend; it never reads game state. */
import type { Vec2 } from '../../core/types';
import type { Camera } from '../camera';
import { paletteFor } from '../palettes';
import { figureFor } from '../painters/cast';
import { drawFigure } from '../painters/figure';
import { FORM_DURATION, villagePose } from './poses';
import type { VillageMotion } from './poses';

export interface VillageActor {
  readonly id: string;
  readonly pos: Vec2;
  readonly variant: string;
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
    const entities = [
      ...view.actors.map((actor) => ({
        y: actor.pos.y,
        draw: () => this.actor(actor, camera, view.reduced),
      })),
      { y: view.creature.y, draw: () => this.otter(view, camera, t) },
    ].sort((a, b) => a.y - b.y);
    for (const entity of entities) entity.draw();
    if (!view.reduced) this.butterflies(camera, t, view.fireflies);
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
    drawFigure(
      c,
      { x: box.x - s * 0.1, y: box.y - s * 0.182, size: s * 1.2 },
      spec,
      pose,
      palette,
      actor.facing,
      0.36,
    );
    if (actor.motion === 'water' || actor.motion === 'fire') this.form(actor, camera, reduced);
    if (actor.label) this.label(actor.label, box.x + s / 2, box.y + s * 1.06, s);
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
      const centre = y < 11 ? 25.05 : 24.0 + Math.sin(y * 0.28) * 0.7;
      const x = centre + Math.sin(i * 8.31) * 1.45;
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
  private form(actor: VillageActor, camera: Camera, reduced: boolean): void {
    const c = this.ctx;
    const box = camera.toScreen(actor.pos);
    const p = Math.max(0, Math.min(1, actor.elapsed / FORM_DURATION));
    if (reduced || p < 0.13 || p > 0.91) return;
    c.save();
    c.translate(box.x + box.size / 2, box.y + box.size * 0.05);
    c.scale(box.size * actor.facing, box.size);
    const water = actor.motion === 'water';
    const palette = paletteFor(water ? 'water' : 'fire');
    const alpha = Math.min(1, (p - 0.13) / 0.1, (0.91 - p) / 0.16);
    c.globalAlpha = alpha;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const progress = Math.max(0, (p - 0.43) / 0.43);
    const points: Vec2[] = [];
    if (water) {
      const end = Math.PI * (1.1 + Math.min(1, (p - 0.13) / 0.3) * 1.55);
      for (let i = 0; i <= 45; i++) {
        const u = i / 45;
        const angle = -Math.PI / 2 + u * end + p * 2;
        points.push({
          x: Math.cos(angle) * (0.66 + progress * 0.35) + progress * u * 3.5,
          y: Math.sin(angle) * 0.75 - 0.25 + Math.sin(u * 5 + p * 10) * progress * 0.27,
        });
      }
    } else {
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        points.push({
          x: -0.15 + u * (0.5 + progress * 4.5),
          y: -0.1 + Math.sin(u * 8 - p * 32) * (0.15 + u * 0.33) - u * 0.3,
        });
      }
    }
    const stroke = (color: string, width: number) => {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.beginPath();
      points.forEach((pt, i) => (i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
      c.stroke();
    };
    stroke(palette.dark, water ? 0.22 : 0.32);
    stroke(palette.base, water ? 0.17 : 0.25);
    stroke(palette.light, water ? 0.075 : 0.14);
    stroke(palette.accent, 0.03);
    // Droplets and embers carry the motion beyond the silhouette.
    for (let i = 0; i < 12; i++) {
      const q = points[Math.min(points.length - 1, i * 3)];
      if (!q) continue;
      const drift = Math.sin(p * 15 + i * 2);
      c.fillStyle = i % 2 ? palette.light : palette.accent;
      c.beginPath();
      c.ellipse(
        q.x + progress * (i % 3) * 0.2,
        q.y + drift * 0.28,
        0.025 + progress * 0.025,
        water ? 0.055 : 0.035,
        -0.6,
        0,
        Math.PI * 2,
      );
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
