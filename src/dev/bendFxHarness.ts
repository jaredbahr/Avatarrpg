/**
 * Dev-only bend harness (ADR 0055, steps 5 and 6).
 *
 * Served by `vite` at `/dev/bend-fx.html` and never built: the production
 * build's only entry is `index.html`, and nothing in the game imports this.
 * It plays one character's whole bend choreography on either backend (the
 * cels on the freeze clock, the painted effect, every hold and the board
 * kick) through the game's animator, frozen at a scene time the caller
 * gives, so `scripts/bend-fx-capture.ts` can capture it for review:
 *
 *   /dev/bend-fx.html?element=fire&range=3&dir=southEast&renderer=canvas
 *
 * `dir` is the screen heading the character throws toward; `cardinal` is
 * `southEast` (a grid axis, the prototype's `3se`/`5se`) and `diagonal` is
 * `east` (a grid diagonal, the prototype's `5e`). `range` is the rules' range
 * in grid steps. The caster draws at the party's oblique combat scale, as a
 * sprite in the effect list between the under- and over-actor layers, facing
 * as authored and never mirrored.
 */

import { partyScale } from '../app/anim/actorScale';
import { bendSceneAt, planBend } from '../app/anim/bendChoreo';
import { Animator } from '../app/animator';
import type { Heading } from '../content/assets/clips';
import { HEADINGS } from '../content/assets/clips';
import { BEND_FX } from '../content/fxCels';
import { distance } from '../core/rules/grid';
import type { ContentIndex, Grid, Tile, Vec2 } from '../core/types';
import { loadBendFx } from '../render/fx/bendFx';
import { bendFxPages } from '../render/fx/bendFxDraw';
import { BEND_FX_PX_PER_TILE } from '../render/fx/bendFxSample';
import { projectGround } from '../render/projection';
import { Renderer } from '../render/renderer';
import { FOOT_LINE } from '../render/sheets/bake';
import { sheets } from '../render/sheets/store';
import type { BendFxSprite, MapView } from '../render/view';

const CASTERS: Readonly<Record<string, string>> = {
  fire: 'unit.fire.kaya',
  water: 'unit.water.sura',
  earth: 'unit.earth.bo',
};

/** One grid step toward each screen heading on the oblique board. */
const GRID_STEP: Readonly<Record<Heading, Vec2>> = {
  east: { x: 1, y: -1 },
  southEast: { x: 1, y: 0 },
  south: { x: 1, y: 1 },
  southWest: { x: 0, y: 1 },
  west: { x: -1, y: 1 },
  northWest: { x: -1, y: 0 },
  north: { x: -1, y: -1 },
  northEast: { x: 0, y: -1 },
};

const params = new URLSearchParams(window.location.search);
const element = params.get('element') ?? 'fire';
const key = CASTERS[element] ?? 'unit.fire.kaya';
const range = Number(params.get('range') ?? 3);
const dir = params.get('dir') ?? 'cardinal';
const heading: Heading =
  dir === 'diagonal'
    ? 'east'
    : (HEADINGS as readonly string[]).includes(dir)
      ? (dir as Heading)
      : 'southEast';
const SIZE = 8;
const step = GRID_STEP[heading];
// Stood back from the edge the throw goes toward, so a range-5 throw fits the board.
const along = (d: number) => (d > 0 ? 1 : d < 0 ? SIZE - 2 : 4);
const caster: Vec2 = { x: along(step.x), y: along(step.y) };
const target: Vec2 = { x: caster.x + step.x * range, y: caster.y + step.y * range };
const SCALE = partyScale('oblique');

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
  const from = foot(caster);
  const landing = foot(target);
  const plan = planBend(fx, {
    heading,
    facing,
    attack,
    effect,
    cel: (i) => sheets.bendFrame(key, heading, i),
    foot: from,
    to: {
      x: landing.x + (effect.impact.offsetPx.x / BEND_FX_PX_PER_TILE) * SCALE,
      y: landing.y + (effect.impact.offsetPx.y / BEND_FX_PX_PER_TILE) * SCALE,
    },
    scale: SCALE,
    tiles: distance(caster, target),
  });
  // The game's animator plays it, from scene time 0.
  const animator = new Animator({} as ContentIndex, { motionReduced: () => false });
  animator.pushBend(0, 'caster', plan, fx);
  const pages = new Set(effect.layers.map((l) => fx.layerCel(l, 0)?.image ?? ''));
  const bendPage = (cel(0).source as HTMLImageElement).src;
  await Promise.all([...pages, bendPage].map((url) => bendFxPages.whenLoaded(url)));

  /** Draws the choreography `t` scene ms in; without `effects`, the caster alone, unkicked. */
  const draw = (t: number, effects = true) => {
    const pose = animator.bendPose(t, 'caster');
    const c = cel(pose?.index ?? 0);
    const body: BendFxSprite = {
      image: bendPage,
      frame: c.frame,
      pivot: { x: c.anchor.x * c.frame.w, y: c.anchor.y * c.frame.h },
      at: from,
      width: (c.frame.w / c.pixelsPerTile) * SCALE,
      height: (c.frame.h / c.pixelsPerTile) * SCALE,
      turn: 0,
      alpha: 1,
      blend: 'normal',
      flash: 0,
      z: 'underActor',
    };
    const drawn = effects ? animator.bendFx(t) : [];
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
      cameraNudge: effects ? animator.cameraNudge(t) : { x: 0, y: 0 },
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
    return {
      sprites: drawn.length,
      flipped: drawn.filter((s) => s.flipY).length,
      index: pose?.index ?? -1,
      held: pose?.held ?? false,
    };
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
    const x = Math.floor(Math.min(a.x, b.x) - 1.2 * t);
    const y = Math.floor(Math.min(a.y, b.y) - 2.2 * t);
    return {
      x,
      y,
      width: Math.ceil(Math.max(a.x, b.x) + 1.2 * t) - x,
      height: Math.ceil(Math.max(a.y, b.y) + 0.7 * t) - y,
    };
  };

  return {
    backend: renderer.backendName,
    heading,
    duration: plan.duration,
    /** Every hold, in scene ms from the start, with what called it. */
    holds: plan.holds.map((hold) => ({
      at: bendSceneAt(plan, hold.at),
      ms: hold.ms,
      causes: hold.causes,
    })),
    /** When each release lands, in scene ms; null for one that does not travel. */
    arrivals: plan.arrivals.map((p) => (p === undefined ? null : bendSceneAt(plan, p))),
    draw,
    crop,
  };
}

declare global {
  interface Window {
    bendFx?: Promise<Awaited<ReturnType<typeof setup>>>;
  }
}
window.bendFx = setup();
