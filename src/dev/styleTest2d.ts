/**
 * Dev-only art-direction test, 2D side (docs/style-test/layout.md, 2d-report.md).
 *
 * Served by `vite` at `/dev/style-test-2d.html` and never built: the production build's only entry
 * is `index.html`, and nothing in the game imports this. One small courtyard cut from the shipped Ba
 * Dan scene (its calm ground plates and uprights, drawn by the real Renderer on either backend), one
 * earthbender (Bo, on his G sheets and his `bo-g-bend` clip) and one practice target. Everything that
 * moves goes through the game's own modules: the Animator walks him by the stroll timing and plays
 * `rock_throw` through the choreography (the bend plan, its holds, the board kick, the dust), and
 * the village ambience (canopy leaves, chimney smoke, motes) is the exploration scene's.
 *
 *   /dev/style-test-2d.html?renderer=canvas|webgl&debug=1&stats=1
 *
 * Tap or click to walk; arrow keys or WASD walk a step; Space or the button strikes the target.
 */

import { ambientEmitters, waterCells } from '../app/anim/ambience';
import { partyScale } from '../app/anim/actorScale';
import { Animator, partyWalkPhase } from '../app/animator';
import type { BendSources } from '../app/anim/bendHandoff';
import { CONTENT } from '../content';
import { ambienceFx } from '../content/fx';
import { BEND_FX } from '../content/fxCels';
import { BA_DAN_VILLAGE } from '../content/maps/village';
import { sheetLocomotion } from '../content/assets/manifest';
import type { Heading } from '../content/assets/clips';
import { buildGrid } from '../core/rules/grid';
import type { Grid, GameEvent, MapScene, SceneScenery, Unit, Vec2 } from '../core/types';
import { loadBendFx } from '../render/fx/bendFx';
import type { BendFxIndex } from '../render/fx/bendFx';
import { TILE } from '../render/camera';
import { Renderer } from '../render/renderer';
import { sheets } from '../render/sheets/store';
import type { MapView, NpcMarker, RenderUnit } from '../render/view';

/** The courtyard: cells of the shipped Ba Dan grid, inclusive (layout.md). */
export const COURT = { x0: 2, y0: 5, x1: 9, y1: 12 } as const;
/** Bo's spawn, the practice target's cell and the target's art (dev/assets/style-test/, outside public/ so it never ships). */
export const SPAWN: Vec2 = { x: 3, y: 7 };
export const TARGET_CELL: Vec2 = { x: 6, y: 7 };
const PLAYER = 'bo';
const BO_SPRITE = 'unit.earth.bo';
const DUMMY = 'dummy';

const params = new URLSearchParams(window.location.search);
const debug = params.get('debug') === '1';
const showStats = params.get('stats') === '1';
const zoomParam = Number(params.get('zoom') ?? 0);

const map = BA_DAN_VILLAGE;
const grid: Grid = buildGrid(map);
const projection = 'oblique';
const SCALE = partyScale(projection);
const inCourt = (c: Vec2) =>
  c.x >= COURT.x0 && c.x <= COURT.x1 && c.y >= COURT.y0 && c.y <= COURT.y1;

/** Walkable for this test: open in the shipped grid, inside the courtyard, not the target's cell. */
const free = (c: Vec2) => {
  if (!inCourt(c)) return false;
  const tile = grid.tiles[c.y * grid.width + c.x];
  return !!tile && !tile.blocked && !(c.x === TARGET_CELL.x && c.y === TARGET_CELL.y);
};

/** 8-neighbour breadth-first path, no corner cutting; the cells after `from`, or null. */
function route(from: Vec2, to: Vec2): Vec2[] | null {
  if (!free(to)) return null;
  const key = (c: Vec2) => c.y * 100 + c.x;
  const prev = new Map<number, Vec2 | null>([[key(from), null]]);
  const queue: Vec2[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    if (at.x === to.x && at.y === to.y) break;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const next = { x: at.x + dx, y: at.y + dy };
        if (prev.has(key(next)) || !free(next)) continue;
        if (dx && dy && (!free({ x: at.x + dx, y: at.y }) || !free({ x: at.x, y: at.y + dy })))
          continue;
        prev.set(key(next), at);
        queue.push(next);
      }
  }
  if (!prev.has(key(to))) return null;
  const path: Vec2[] = [];
  for (let c: Vec2 | null | undefined = to; c && prev.get(key(c)); c = prev.get(key(c)))
    path.unshift(c);
  return path;
}

const canvas = document.getElementById('board') as HTMLCanvasElement;
const renderer = new Renderer(canvas, { width: map.width, height: map.height });
renderer.resize({ width: map.width, height: map.height });
renderer.camera.projection = projection;
renderer.camera.centreMargin = map.cameraCentreMargin;
if (map.scene) renderer.camera.viewExtent = map.scene.paintExtent;

/** The courtyard's centre cell; the camera rests on it and never pans (fixed view). */
const CENTRE: Vec2 = { x: (COURT.x0 + COURT.x1 + 1) / 2, y: (COURT.y0 + COURT.y1 + 1) / 2 };
const frameCamera = () => {
  const cam = renderer.camera;
  cam.fitExplore(zoomParam || 96);
  cam.centreOn({ x: CENTRE.x - 0.5, y: CENTRE.y - 0.5 });
};
renderer.onViewportChange = frameCamera;
frameCamera();

const until = async (ok: () => boolean, ms = 20000) => {
  for (let i = 0; i < ms / 25 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
  if (!ok()) throw new Error('Timed out loading.');
};

// ---- the practice target: a scenery piece (the game's own mechanism for an upright prop) ----
const TARGET_ART = {
  url: 'dev/assets/style-test/dummy.png',
  // 96x128 art drawn at 0.8 world px per art px (a figure and a fifth tall); its foot is the slab centre (48, 112).
  widthPx: Number(params.get('dw') ?? 88),
  heightPx: Number(params.get('dh') ?? 117),
};

function targetScenery(offset: Vec2): SceneScenery {
  // The foot is the middle of the cell's lower tip; the art's bottom centre stands on it.
  // Scene art is placed in the camera's world pixels (unscaled), the same space the plates use.
  const ground = renderer.camera.groundPoint({ x: TARGET_CELL.x + 0.5, y: TARGET_CELL.y + 0.5 });
  const footX = ground.x + offset.x * TILE;
  const footY = ground.y + offset.y * TILE;
  return {
    id: 'practice-target',
    url: TARGET_ART.url,
    x: footX - TARGET_ART.widthPx * (48 / 96),
    y: footY - TARGET_ART.heightPx * (112 / 128),
    width: TARGET_ART.widthPx,
    height: TARGET_ART.heightPx,
    footprint: [TARGET_CELL],
    depth: { x: TARGET_CELL.x + 0.5, y: TARGET_CELL.y + 0.5 },
  };
}

const baseScene = map.scene as MapScene;
const sceneRest: MapScene = {
  ...baseScene,
  scenery: [...baseScene.scenery, targetScenery({ x: 0, y: 0 })],
};
const sceneWith = (offset: Vec2): MapScene =>
  offset.x === 0 && offset.y === 0
    ? sceneRest
    : { ...baseScene, scenery: [...baseScene.scenery, targetScenery(offset)] };

// ---- units and the animator ----
let bendFx: BendFxIndex | undefined;
const animator = new Animator(CONTENT, {
  sheetClips: (sprite) => sheets.clips(sprite),
  bends: (): BendSources | undefined =>
    bendFx
      ? {
          fx: bendFx,
          setOf: (sprite) =>
            sheets.bendState(sprite) === 'loaded' ? sheets.bendSet(sprite) : undefined,
          frameOf: (sprite, heading, index) => sheets.bendFrame(sprite, heading, index),
        }
      : undefined,
});
animator.setProjection(projection);

let pos: Vec2 = { ...SPAWN };
let walkingTo: Vec2 | null = null;
let walkEndsAt = 0;
const now = () => performance.now();

const dummyUnit = (): Unit =>
  ({
    id: DUMMY,
    name: 'Practice target',
    faction: 'enemy',
    element: 'earth',
    characterId: null,
    enemyId: null,
    disciplineId: null,
    level: 1,
    xp: 0,
    pos: TARGET_CELL,
    size: 1,
    hp: 99,
    ap: 0,
    move: 0,
    bankedAp: 0,
    pendingAp: 0,
    base: { maxHp: 99 },
    abilities: [],
    cooldowns: {},
    statuses: [],
    ai: 'passive',
    temporary: false,
    sprite: 'unit.enemy.thug',
  }) as unknown as Unit;
const boUnit = (): Unit =>
  ({
    ...dummyUnit(),
    id: PLAYER,
    name: 'Bo',
    faction: 'party',
    pos,
    hp: 99,
    sprite: BO_SPRITE,
  }) as Unit;

function walkTo(cell: Vec2): boolean {
  if (animator.busy(now())) return false;
  const path = route(pos, cell);
  if (!path || path.length === 0) return false;
  const event: GameEvent = { type: 'partyWalked', unitId: PLAYER, from: pos, path };
  animator.push(now(), [event], [], { walkPhase: partyWalkPhase(0) });
  pos = path[path.length - 1]!;
  walkingTo = pos;
  walkEndsAt = animator.finishesAt;
  return true;
}

/** Nearest of the eight screen headings to the way the target lies from Bo. */
function strike(): boolean {
  const t = now();
  if (animator.busy(t)) return false;
  const dx = TARGET_CELL.x - pos.x;
  const dy = TARGET_CELL.y - pos.y;
  const tiles = Math.max(Math.abs(dx), Math.abs(dy));
  if (tiles < 2 || tiles > 5) {
    note(`Stand 2 to 5 cells from the target (now ${tiles}).`);
    return false;
  }
  const events: GameEvent[] = [
    {
      type: 'abilityUsed',
      unitId: PLAYER,
      abilityId: 'rock_throw',
      target: TARGET_CELL,
      tiles: [TARGET_CELL],
    },
    {
      type: 'damaged',
      unitId: DUMMY,
      amount: 6,
      crit: false,
      damageType: 'earth',
      sourceId: PLAYER,
    },
  ];
  animator.push(t, events, [boUnit(), dummyUnit()]);
  strikes++;
  return true;
}

let strikes = 0;
let noteText = '';
let noteUntil = 0;
function note(text: string) {
  noteText = text;
  noteUntil = now() + 2200;
}

// ---- frame ----
const frameTimes: number[] = [];
const strikeFrameTimes: number[] = [];
let last = performance.now();

function view(t: number): MapView {
  const reduced = false;
  const walkPos = animator.renderPos(t, PLAYER);
  const pose = animator.unitPose(t, PLAYER, BO_SPRITE);
  const bend = animator.bendPose(t, PLAYER);
  const fields: Partial<RenderUnit> = bend
    ? {
        facing: 1,
        clip: 'stance',
        bend: { heading: bend.heading as Heading, index: bend.index },
        scale: SCALE,
      }
    : {
        scale: SCALE,
        offset: animator.offset(t, PLAYER, BO_SPRITE),
        clipTime: pose?.clipTime,
        ...animator.locomotion(t, PLAYER, 'rest', BO_SPRITE),
      };
  const bo: RenderUnit = {
    id: PLAYER,
    pos,
    size: 1,
    sprite: BO_SPRITE,
    name: 'Bo',
    faction: 'party',
    hp: 99,
    maxHp: 99,
    statuses: [],
    fallen: false,
    showHealth: false,
    shadow: true,
    ...(walkPos ? { renderPos: walkPos } : {}),
    ...fields,
  } as RenderUnit;
  const hit = animator.offset(t, DUMMY) ?? pose?.offset;
  const dummyOffset = animator.unitPose(t, DUMMY)?.offset ?? hit ?? { x: 0, y: 0 };
  const ambient = ambientEmitters(
    ambienceFx(map.ambience ?? ''),
    grid,
    t,
    map.scene?.chimneys,
    reduced,
    map.scene?.paintedWater ? waterCells(grid) : [],
    map.scene?.canopies,
  );
  const npcs: NpcMarker[] = [];
  return {
    scene: sceneWith(dummyOffset),
    grid,
    units: [bo],
    npcs,
    props: [],
    overlays: [],
    path: [],
    pathFrom: null,
    calmPath: true,
    aimArc: null,
    emitters: [...ambient, ...animator.emitters(t)],
    bendFx: animator.bendFx(t),
    floaters: [],
    cameraNudge: animator.cameraNudge(t),
    activeUnitId: null,
    selectedUnitId: null,
    hoverTile: null,
    exit: null,
    hatch: false,
    gridLines: false,
    crispOverlays: false,
    atmosphere: true,
    backdrop: null,
    time: t,
    reducedMotion: reduced,
  };
}

const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;left:8px;top:8px;color:#fff;font:12px monospace;text-shadow:0 1px 2px #000;white-space:pre;pointer-events:none';
document.body.appendChild(hud);
const overlay = document.createElement('div');
overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:10px monospace;color:#fff';
document.body.appendChild(overlay);

function drawDebugCells() {
  if (!debug) return;
  const cam = renderer.camera;
  const html: string[] = [];
  for (let y = 0; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++) {
      const p = cam.project({ x: x + 0.5, y: y + 0.5 });
      if (p.x < -40 || p.y < -40 || p.x > cam.viewport.width + 40 || p.y > cam.viewport.height + 40)
        continue;
      const tile = grid.tiles[y * grid.width + x];
      const colour = inCourt({ x, y }) ? '#ff0' : '#fff8';
      html.push(
        `<div style="position:absolute;left:${p.x - 14}px;top:${p.y - 6}px;color:${colour}">${x},${y}${tile?.blocked ? '#' : ''}</div>`,
      );
    }
  overlay.innerHTML = html.join('');
}

function loop() {
  const t = now();
  const dt = t - last;
  last = t;
  frameTimes.push(dt);
  if (animator.busy(t)) strikeFrameTimes.push(dt);
  if (frameTimes.length > 600) frameTimes.shift();
  if (walkingTo && t >= walkEndsAt) walkingTo = null;
  const started = performance.now();
  renderer.draw(view(t));
  const cost = performance.now() - started;
  animator.prune(t);
  if (showStats) {
    const recent = frameTimes.slice(-60);
    const avg = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
    hud.textContent = `${renderer.backendName}  ${(1000 / avg).toFixed(0)} fps  ${avg.toFixed(1)} ms/frame  draw ${cost.toFixed(1)} ms\n${noteUntil > t ? noteText : ''}`;
  } else hud.textContent = noteUntil > t ? noteText : '';
  drawDebugCells();
  requestAnimationFrame(loop);
}

// ---- input ----
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const cell = renderer.camera.pickTile(e.clientX - rect.left, e.clientY - rect.top, grid);
  if (!walkTo(cell)) note(free(cell) ? 'Wait for the current move.' : 'Out of the courtyard.');
});
const STEPS: Record<string, Vec2> = {
  ArrowUp: { x: -1, y: -1 },
  w: { x: -1, y: -1 },
  ArrowDown: { x: 1, y: 1 },
  s: { x: 1, y: 1 },
  ArrowLeft: { x: -1, y: 1 },
  a: { x: -1, y: 1 },
  ArrowRight: { x: 1, y: -1 },
  d: { x: 1, y: -1 },
};
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    strike();
    return;
  }
  const step = STEPS[e.key];
  if (step) {
    e.preventDefault();
    walkTo({ x: pos.x + step.x, y: pos.y + step.y });
  }
});
document.getElementById('strike')?.addEventListener('click', () => strike());

// ---- setup ----
async function setup() {
  bendFx = await loadBendFx(BEND_FX, import.meta.env.BASE_URL);
  sheets.preloadBend(BO_SPRITE);
  await until(() => sheets.bendState(BO_SPRITE) === 'loaded');
  requestAnimationFrame(loop);
  return {
    backend: renderer.backendName,
    camera: () => ({
      scale: renderer.camera.scale,
      ox: renderer.camera.offsetX,
      oy: renderer.camera.offsetY,
    }),
    /** Screen point of a cell's centre, CSS px, for the capture script. */
    screenOf: (c: Vec2) => renderer.camera.project({ x: c.x + 0.5, y: c.y + 0.5 }),
    walkTo,
    strike,
    pos: () => ({ ...pos }),
    busy: () => animator.busy(now()),
    strikes: () => strikes,
    stats: () => ({
      frames: frameTimes.slice(),
      strikeFrames: strikeFrameTimes.slice(),
    }),
    resetStats: () => {
      frameTimes.length = 0;
      strikeFrameTimes.length = 0;
    },
    sheetLocomotion: sheetLocomotion(BO_SPRITE),
  };
}

declare global {
  interface Window {
    styleTest?: Promise<Awaited<ReturnType<typeof setup>>>;
  }
}
window.styleTest = setup();
