/**
 * The set-piece review overlay (stage 5 of `docs/level-design.md`): `?boxes` on a dev build draws each set piece's
 * members over the explore board as labelled translucent boxes, one colour a piece, so the plan can be judged in the
 * game before any art exists. A footprint lies on the ground; a taller member also shows its height as a box drawn
 * upward from the footprint's south edge (a figure, 45 px, is the tall of Kaya). The ground's named tracks are
 * tinted yellow, the quiet ground outlined in red and each zone outlined and named.
 *
 * It is a plain 2D canvas over the board, positioned through the camera the game uses, so it follows every pan and
 * zoom; the WebGL and the Canvas 2D backends both sit under it. ExploreScene imports it only inside
 * `import.meta.env.DEV`, so a production build never contains it.
 */
import type { Camera } from '../../render/camera';
import { trackCells } from '../../content/ground';
import { BA_DAN_TRACKS } from '../../content/scenes/baDan.ground';
import { BA_DAN_SET_PIECE_PLAN } from '../../content/scenes/baDan.setpieces';
import type { PlanMember } from '../../content/setPieces';

/** Kaya's height in world px (1.0 in the plan). */
const FIGURE_PX = 45;

const PLAN = BA_DAN_SET_PIECE_PLAN;

/** Whether the page was opened with `?boxes`. */
export function boxesRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('boxes');
  } catch {
    return false;
  }
}

export class BoxesOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly trackCells: readonly { x: number; y: number }[];

  constructor(wrap: HTMLElement, width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.dataset.boxes = 'true';
    this.canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:var(--z-overlay)';
    wrap.appendChild(this.canvas);
    this.trackCells = BA_DAN_TRACKS.flatMap((t) => trackCells(t, width, height));
  }

  destroy(): void {
    this.canvas.remove();
  }

  /** Redraw over the board for this frame's camera. */
  draw(camera: Camera, mapId: string): void {
    const { width, height, dpr } = camera.viewport;
    const c = this.canvas;
    if (c.width !== Math.round(width * dpr) || c.height !== Math.round(height * dpr)) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (mapId !== PLAN.mapId) return;

    const cell = camera.tile * camera.scale;
    const at = (x: number, y: number) => camera.project({ x, y });
    const fontPx = Math.max(8, Math.min(12, cell * 0.3));
    ctx.font = `600 ${fontPx}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    // the ground's named tracks
    ctx.fillStyle = 'rgba(255, 214, 0, 0.16)';
    for (const t of this.trackCells) {
      const p = at(t.x, t.y);
      ctx.fillRect(p.x, p.y, cell, cell);
    }

    // zones, and the quiet ground
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    for (const z of PLAN.zones) {
      const a = at(z.rect.x0, z.rect.y0);
      const b = at(z.rect.x1 + 1, z.rect.y1 + 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      this.text(ctx, `zone ${z.id}`, a.x + 4, a.y + fontPx + 2, 'left', 'rgba(255,255,255,0.9)');
    }
    for (const q of PLAN.quiet) {
      const a = at(q.x0, q.y0);
      const b = at(q.x1 + 1, q.y1 + 1);
      ctx.strokeStyle = 'rgba(255,80,80,0.85)';
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      this.text(ctx, `quiet ${q.id}`, a.x + 4, b.y - 4, 'left', 'rgba(255,150,150,0.95)');
    }
    ctx.setLineDash([]);

    // every member, back to front by the row of its base
    const members = PLAN.pieces.flatMap((piece, i) =>
      piece.members.map((m, k) => ({ m, piece, hue: (i * 47) % 360, first: k === 0 })),
    );
    members.sort((p, q) => p.m.y + p.m.h - (q.m.y + q.m.h));
    for (const { m, piece, hue, first } of members) {
      const label = piece.bulk
        ? first
          ? `${piece.id} (${piece.members.length} trees)`
          : ''
        : `${piece.id} · ${m.name}`;
      this.box(ctx, camera, m, `hsl(${hue} 80% 55%)`, label, fontPx, piece.bulk === true);
    }
  }

  private box(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    m: PlanMember,
    colour: string,
    label: string,
    fontPx: number,
    faint: boolean,
  ): void {
    const nw = camera.project({ x: m.x, y: m.y });
    const se = camera.project({ x: m.x + m.w, y: m.y + m.h });
    const w = se.x - nw.x;
    const h = se.y - nw.y;
    const up = m.height * FIGURE_PX * camera.scale;
    ctx.save();
    ctx.globalAlpha = faint ? 0.1 : m.kind === 'flat' ? 0.28 : 0.38;
    ctx.fillStyle = colour;
    ctx.fillRect(nw.x, nw.y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colour;
    ctx.lineWidth = m.solid ? 2 : 1;
    ctx.strokeRect(nw.x, nw.y, w, h);
    if (m.kind !== 'flat' && up > 0 && !faint) {
      // the height: a front face standing on the footprint's south edge, and the top outline
      ctx.globalAlpha = m.overhead ? 0.12 : 0.22;
      ctx.fillStyle = colour;
      ctx.fillRect(nw.x, se.y - up, w, up);
      ctx.globalAlpha = 1;
      ctx.setLineDash(m.kind === 'fades' ? [4, 3] : []);
      ctx.strokeRect(nw.x, nw.y - up, w, h);
      ctx.beginPath();
      ctx.moveTo(nw.x, se.y);
      ctx.lineTo(nw.x, se.y - up);
      ctx.moveTo(se.x, se.y);
      ctx.lineTo(se.x, se.y - up);
      ctx.moveTo(nw.x, se.y - up);
      ctx.lineTo(se.x, se.y - up);
      ctx.stroke();
    }
    ctx.restore();
    if (label) this.text(ctx, label, nw.x + w / 2, nw.y - up - 3, 'center', '#fff', fontPx);
  }

  private text(
    ctx: CanvasRenderingContext2D,
    s: string,
    x: number,
    y: number,
    align: CanvasTextAlign,
    fill: string,
    fontPx?: number,
  ): void {
    ctx.textAlign = align;
    if (fontPx) ctx.font = `600 ${fontPx}px sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(s, x, y);
  }
}
