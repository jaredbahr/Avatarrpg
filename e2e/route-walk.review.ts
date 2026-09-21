/**
 * Real-input route walk: the opening of the shipped route driven with taps.
 *
 * Every other harness enters a scene through a story fixture and then either
 * frames it or dispatches commands. This one taps the map canvas the way a
 * player does — one pointer click per step toward the exit — so the walk
 * exercises picking, pathing, the walk animation and the scene transition for
 * real. It stops at the first fight it cannot win by tapping (combat is not
 * what this harness is about) and records what it reached.
 *
 * It is review evidence, not a playthrough, an accessibility signoff or a
 * substitute for listening or a physical device.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleMapCanvas, startGame, waitForIdle } from './helpers';

type Point = { x: number; y: number };

const SEED = 'route-walk';
const PARTY = ['Sura', 'Riko', 'Kaya'];
const CHARACTERS = ['sura', 'riko', 'kaya'];

interface Goal {
  readonly mapId?: string;
  readonly encounterId?: string;
  readonly screen?: string;
}

interface Leg {
  readonly name: string;
  readonly target: Point;
  readonly goal: Goal;
}

interface LegResult {
  name: string;
  target: Point;
  goal: Goal;
  reached: boolean;
  taps: number;
  reason: string;
  mapId: string | null;
  screen: string | null;
  node: string | null;
  encounterId: string | null;
  elapsedMs: number;
}

async function legState(
  page: Page,
): Promise<{ mapId: string; screen: string; node: string; encounterId: string }> {
  return page.evaluate(() => {
    const state = window.fnt?.app.state;
    return {
      mapId: state?.location.mapId ?? '',
      screen: state?.screen ?? '',
      node: state?.story.nodeId ?? '',
      encounterId: state?.battle?.encounterId ?? '',
    };
  });
}

async function reached(page: Page, goal: Goal): Promise<boolean> {
  const state = await legState(page);
  if (goal.mapId !== undefined && state.mapId !== goal.mapId) return false;
  if (goal.encounterId !== undefined && state.encounterId !== goal.encounterId) return false;
  if (goal.screen !== undefined && state.screen !== goal.screen) return false;
  return true;
}

/**
 * One tap toward the target: step out along the party→target ray in tile space
 * and tap the furthest walkable tile that is still on screen. Aiming straight
 * at an off-screen exit lands on blocked tiles, so the tap is refused and the
 * party never moves; stepping along the ray keeps every tap legal. Returns
 * false when there is no legal tile to tap.
 */
async function tapToward(page: Page, target: Point): Promise<string | null> {
  const decision = await page.evaluate((t) => {
    const app = window.fnt?.app;
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas');
    const camera = app?.rendererCamera();
    const state = app?.state;
    const map = state ? app?.content.maps.get(state.location.mapId) : null;
    if (!app) return 'no app';
    if (!canvas) return 'no canvas';
    if (!camera) return 'no camera';
    if (!state) return 'no state';
    if (!map) return 'no map';
    // `location.pos` is the leader's authoritative tile in explore; the party
    // units' own `pos` is a battle field and still reads (0,0) out of combat.
    const party = { pos: state.location.pos };
    const dpr = window.devicePixelRatio || 1;
    const size = { width: canvas.width / dpr, height: canvas.height / dpr };
    const m = camera.groundTransform;
    const local = (gx: number, gy: number) => ({
      x: m.a * gx * 64 + m.c * gy * 64 + m.tx,
      y: m.b * gx * 64 + m.d * gy * 64 + m.ty,
    });
    const walkable = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
      const key = map.rows[y]?.[x];
      if (key === undefined) return false;
      return !map.legend[key]?.blocked;
    };
    const inset = 16;
    const onScreen = (p: { x: number; y: number }) =>
      p.x >= inset && p.y >= inset && p.x <= size.width - inset && p.y <= size.height - inset;
    const centre = (x: number, y: number) => local(Math.floor(x) + 0.5, Math.floor(y) + 0.5);

    const dx = t.x + 0.5 - (party.pos.x + 0.5);
    const dy = t.y + 0.5 - (party.pos.y + 0.5);
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps < 0.5) return 'on the target tile';
    let furthest: { x: number; y: number } | null = null;
    for (let step = 1; step <= steps; step++) {
      const wx = party.pos.x + 0.5 + (dx / steps) * step;
      const wy = party.pos.y + 0.5 + (dy / steps) * step;
      if (!walkable(Math.floor(wx), Math.floor(wy))) break;
      const p = centre(wx, wy);
      if (!onScreen(p)) break;
      furthest = p;
    }
    if (furthest) return { point: furthest };
    // Otherwise take one legal step in the target's general direction.
    const neighbours = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const;
    for (const [ox, oy] of neighbours) {
      const tile = { x: Math.floor(party.pos.x) + ox, y: Math.floor(party.pos.y) + oy };
      if (!walkable(tile.x, tile.y)) continue;
      const p = centre(tile.x, tile.y);
      if (onScreen(p)) return { point: p };
    }
    return `no legal tap from (${party.pos.x},${party.pos.y}) tx=${m.tx} ty=${m.ty} canvas=${size.width}x${size.height}`;
  }, target);
  if (typeof decision === 'string') return decision;
  if (!decision) return 'no decision';
  await page.locator('.map-canvas').click({ position: decision.point });
  await page.waitForTimeout(200);
  return null;
}

/** Taps toward `target` until `goal` holds, the trap fires, or the budget ends. */
async function walkLeg(page: Page, leg: Leg, maxTaps = 80): Promise<LegResult> {
  const started = Date.now();
  let taps = 0;
  let reason = '';
  for (; taps < maxTaps; taps++) {
    if (await reached(page, leg.goal)) break;
    await waitForIdle(page);
    const refusal = await tapToward(page, leg.target);
    if (refusal) {
      reason = `tap refused: ${refusal}`;
      break;
    }
  }
  const state = await legState(page);
  const ok =
    (await reached(page, leg.goal)) ||
    (leg.goal.encounterId !== undefined && Boolean(state.encounterId));
  if (!ok && !reason) reason = `budget of ${maxTaps} taps ended without the goal`;
  return {
    name: leg.name,
    target: leg.target,
    goal: leg.goal,
    reached: ok,
    taps,
    reason,
    mapId: state.mapId,
    screen: state.screen,
    node: state.node,
    encounterId: state.encounterId,
    elapsedMs: Date.now() - started,
  };
}

const LEGS: readonly Leg[] = [
  { name: 'village-east-exit', target: { x: 23, y: 7 }, goal: { mapId: 'forest_road' } },
  {
    name: 'forest-road-roadblock',
    target: { x: 19, y: 4 },
    goal: { encounterId: 'enc_forest_road' },
  },
];

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} route walk with real taps`, async ({ page }) => {
    test.setTimeout(600_000);
    const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const modified = execFileSync('git', ['diff', 'HEAD', '--name-only'], {
      encoding: 'utf8',
    }).trim();
    const build = `${revision}${modified ? '-modified' : ''}`;
    const folder = `${process.env.FNT_ROUTE_WALK_DIR ?? '.shots/route-walk'}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    const results: LegResult[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await resetStorage(page, `?renderer=${renderer}`);
    await expect(page.locator('[aria-label^="Game version"]')).toHaveText(
      new RegExp(`build ${build}$`),
    );
    await startGame(page, PARTY, CHARACTERS, SEED, { reduceMotion: false });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await settleMapCanvas(page);
    await page.screenshot({ path: `${folder}/00-village-spawn.png` });

    for (const [index, leg] of LEGS.entries()) {
      await page.screenshot({ path: `${folder}/${index + 1}0-${leg.name}-before.png` });
      const result = await walkLeg(page, leg);
      results.push(result);
      await page.screenshot({ path: `${folder}/${index + 1}1-${leg.name}-after.png` });
      if (!result.reached) break;
    }

    const report = {
      build,
      renderer,
      viewport: page.viewportSize(),
      seed: SEED,
      party: PARTY,
      legs: results,
      errors,
      note: 'Taps only; no story fixture after the village entry node.',
    };
    writeFileSync(`${folder}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
    expect(errors).toEqual([]);
  });
}
