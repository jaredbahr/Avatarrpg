/**
 * Dev-only bend effect harness (ADR 0055, step 5).
 *
 * Served by `vite` at `/dev/bend-fx.html` and never built: the production
 * build's only entry is `index.html`, and nothing in the game imports this.
 * It plays one character's bend with its painted effect on either backend,
 * frozen at a time the caller gives, so `scripts/bend-fx-capture.ts` can
 * capture frames for review:
 *
 *   /dev/bend-fx.html?element=fire&range=3&dir=cardinal&renderer=canvas
 *
 * `dir=cardinal` throws along a grid axis (south-east on screen, the
 * prototype's `3se`/`5se`), `dir=diagonal` along a grid diagonal (east on
 * screen, the prototype's `5e` direction). `range` is the rules' range.
 *
 * The timing is a stand-in for the choreography (step 6): the bend's cels on
 * their authored `frameMs` from 0, with no holds and no shake, each release
 * leaving on its `launchFrame`. The caster is drawn as a sprite in the effect
 * list, between the under- and over-actor layers, facing as authored.
 */

import type { Heading } from '../content/assets/clips';
import { BEND_FX } from '../content/fxCels';
import type { Grid, Tile, Vec2 } from '../core/types';
import { loadBendFx } from '../render/fx/bendFx';
import { bendFxPages } from '../render/fx/bendFxDraw';
import { BEND_FX_PX_PER_TILE, sampleBendFx } from '../render/fx/bendFxSample';
import type { BendFxShot } from '../render/fx/bendFxSample';
import { boardStep } from '../render/fx/trajectory';
import { projectGround } from '../render/projection';
import { Renderer } from '../render/renderer';
import { FOOT_LINE } from '../render/sheets/bake';
import { celOffset } from '../render/sheets/placement';
import { sheets } from '../render/sheets/store';
import type { BendFxSprite, MapView } from '../render/view';

const CASTERS: Readonly<Record<string, string>> = {
  fire: 'unit.fire.kaya',
  water: 'unit.water.sura',
  earth: 'unit.earth.bo',
};

const params = new URLSearchParams(window.location.search);
const element = params.get('element') ?? 'fire';
const key = CASTERS[element] ?? 'unit.fire.kaya';
const range = Number(params.get('range') ?? 3);
const diagonal = params.get('dir') === 'diagonal';
const heading: Heading = diagonal ? 'east' : 'southEast';
const SIZE = 8;
const caster: Vec2 = { x: 1, y: 6 };
const target: Vec2 = diagonal ? { x: 1 + range, y: 6 - range } : { x: 1 + range, y: 6 };

const tile: Tile = {
  terrain: 'grass',
  elevation: 0,
  blocked: false,
  blocksSight: false,
  cover: false,
  surface: null,
};
const grid: Grid = {
  width: SIZE,
  height: SIZE,
  tiles: Array.from({ length: SIZE * SIZE }, () => tile),
};

/** A unit's foot on the board: its tile's centre, less the sheet's foot line (as `spriteBox` places it). */
const foot = (pos: Vec2): Vec2 => {
  const p = projectGround({ x: pos.x + 0.5, y: pos.y + 0.5 }, 'oblique');
  return { x: p.x, y: p.y + FOOT_LINE - 0.86 };
};

const canvas = document.getElementById('board') as HTMLCanvasElement;
const renderer = new Renderer(canvas, grid);
renderer.camera.projection = 'oblique';
renderer.resize();
renderer.camera.fit();

const until = async (ok: () => boolean) => {
  for (let i = 0; i < 400 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
  if (!ok()) throw new Error('Timed out loading the bend.');
};

async function setup() {
  const fx = await loadBendFx(BEND_FX, import.meta.env.BASE_URL);
  sheets.preloadBend(key);
  await until(() => sheets.bendFrame(key, heading, 0) !== null);
  const set = sheets.bendSet(key);
  const facing = set?.facings[heading];
  const attack = facing?.attacks[0];
  const effect = attack && fx.effect(attack.effectId);
  if (!facing || !attack || !effect) throw new Error(`No bend for ${key}.`);
  const cel = (i: number) => {
    const found = sheets.bendFrame(key, heading, i);
    if (!found) throw new Error(`No cel ${i}.`);
    return found;
  };
  const starts = facing.frameMs.map((_, i) =>
    facing.frameMs.slice(0, i).reduce((a, b) => a + b, 0),
  );
  const from = foot(caster);
  const socket = (i: number, name: keyof ReturnType<typeof cel>['sockets']): Vec2 => {
    const c = cel(i);
    const point = c.sockets[name];
    if (!point) throw new Error(`No ${name} on cel ${i}.`);
    const o = celOffset(c, point);
    return { x: from.x + o.x, y: from.y + o.y };
  };
  const landing = foot(target);
  const shot: BendFxShot = {
    effect,
    releases: attack.releases.map((release) => ({
      launchAt: starts[release.launchFrame] ?? 0,
      socket: Array.from({ length: release.launchFrame + 1 }, (_, i) => socket(i, release.socket)),
      ...(release.flash === undefined ? {} : { flash: release.flash }),
    })),
    from,
    to: {
      x: landing.x + effect.impact.offsetPx.x / BEND_FX_PX_PER_TILE,
      y: landing.y + effect.impact.offsetPx.y / BEND_FX_PX_PER_TILE,
    },
    step: boardStep('oblique'),
  };
  const pages = new Set(effect.layers.map((l) => fx.layerCel(l, 0)?.image ?? ''));
  const bendPage = (cel(0).source as HTMLImageElement).src;
  await Promise.all([...pages, bendPage].map((url) => bendFxPages.whenLoaded(url)));

  /** Draws the bend at `t`; without `effects`, the caster alone, for a difference. */
  const draw = (t: number, effects = true): BendFxSprite[] => {
    let index = starts.findIndex((start, i) => t >= start && t < start + (facing.frameMs[i] ?? 0));
    if (index < 0) index = t < 0 ? 0 : starts.length - 1;
    const c = cel(index);
    const body: BendFxSprite = {
      image: bendPage,
      frame: c.frame,
      pivot: { x: c.anchor.x * c.frame.w, y: c.anchor.y * c.frame.h },
      at: from,
      width: c.frame.w / c.pixelsPerTile,
      height: c.frame.h / c.pixelsPerTile,
      turn: 0,
      alpha: 1,
      blend: 'normal',
      flash: 0,
      z: 'underActor',
    };
    const drawn = effects ? sampleBendFx(fx, shot, t) : [];
    const bendFx = [
      ...drawn.filter((s) => s.z !== 'overActor'),
      body,
      ...drawn.filter((s) => s.z === 'overActor'),
    ];
    const view: MapView = {
      grid,
      units: [],
      overlays: [],
      npcs: [],
      props: [],
      path: [],
      pathFrom: null,
      aimArc: null,
      emitters: [],
      bendFx,
      floaters: [],
      cameraNudge: { x: 0, y: 0 },
      activeUnitId: null,
      selectedUnitId: null,
      hoverTile: { ...target },
      exit: null,
      hatch: false,
      gridLines: true,
      crispOverlays: false,
      atmosphere: false,
      backdrop: null,
      time: 0,
      reducedMotion: true,
    };
    renderer.draw(view);
    return drawn;
  };

  /** The screen box round the caster and the landing point, in CSS px. */
  const crop = () => {
    const camera = renderer.camera;
    const screen = (p: Vec2) => {
      const w = camera.boardPoint(p);
      return { x: w.x * camera.scale - camera.offsetX, y: w.y * camera.scale - camera.offsetY };
    };
    const a = screen(from);
    const b = screen(landing);
    const t = 64 * camera.scale;
    const x = Math.floor(Math.min(a.x, b.x) - 1.1 * t);
    const y = Math.floor(Math.min(a.y, b.y) - 2 * t);
    return {
      x,
      y,
      width: Math.ceil(Math.max(a.x, b.x) + 1.1 * t) - x,
      height: Math.ceil(Math.max(a.y, b.y) + 0.6 * t) - y,
    };
  };

  return {
    backend: renderer.backendName,
    frames: starts,
    frameMs: facing.frameMs,
    draw: (t: number, effects = true) => draw(t, effects).length,
    crop,
  };
}

declare global {
  interface Window {
    bendFx?: Promise<Awaited<ReturnType<typeof setup>>>;
  }
}
window.bendFx = setup();
