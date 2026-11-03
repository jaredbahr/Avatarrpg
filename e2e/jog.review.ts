/**
 * Review captures for the jog (ADR 0095): the party jogging through the Ba Dan
 * demo slice, and Kaya's move in the forest fight, each photographed frame by
 * frame on a stepped clock so the cadence in the GIF is the game's, however
 * slowly this container draws.
 *
 * For the canvas backend it writes, under FNT_JOG_DIR (default .shots/jog/<label>):
 * - gao-door.png: Gao at his shopfront beside his door, before the party sets off;
 * - ba-dan/NNN.png: the slice (as e2e/ba-dan-demo.review.ts frames it) every
 *   40 ms while the party crosses it, road to bridge;
 * - forest/NNN.png: Kaya's longest straight move from beside the oil flask,
 *   at 96 px tiles, every 40 ms;
 * - provenance.json: revision, frame step, tile sizes, the move's path.
 * `art/source/jog-g1/tools/gifs.sh` turns each folder into a GIF.
 *
 * Local review fixture only: not a playthrough, not a CI check.
 *
 * FNT_JOG_ZOOM sets the Ba Dan zoom asked for (default 77 px tiles; `default` keeps the
 * scene's own fit). FNT_JOG_VIDEO=1 records the run (playwright.jog.config.ts), and the
 * party first crosses the slice once in real time, so the video plays at the game's speed;
 * provenance.json's `videoCrossingMs` is where that crossing starts and ends in the video,
 * for cutting the load. `baDanLeader` is the leader's screen point in each Ba Dan frame,
 * relative to the frame. FNT_JOG_NO_FOREST=1 skips the forest fight.
 *
 * FNT_JOG_LABEL=after npx playwright test -c playwright.jog.config.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { BattleDraft } from '../src/core/state/battleDraft';
import { RngCursor } from '../src/core/rng';
import { reachable } from '../src/core/rules/grid';
import type { GameState, Vec2 } from '../src/core/types';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

const STEP_MS = 40;

async function zoom(page: Page, target: number): Promise<void> {
  const current = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!current || !box) throw new Error('Missing camera');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, Math.log(current / target) / 0.002);
  let last = 0;
  await expect
    .poll(async () => {
      const now = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx ?? 0);
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
  await settleLayout(page);
}

async function tilePoint(page: Page, x: number, y: number) {
  return page.evaluate(
    ({ x, y }) => {
      const m = window.fnt!.app.rendererCamera()!.groundTransform;
      return {
        x: m.a * (x + 0.5) * 64 + m.c * (y + 0.5) * 64 + m.tx,
        y: m.b * (x + 0.5) * 64 + m.d * (y + 0.5) * 64 + m.ty,
      };
    },
    { x, y },
  );
}

async function centerTile(page: Page, tx: number, ty: number): Promise<void> {
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  const point = await tilePoint(page, tx, ty);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + box.width / 2 - point.x, start.y + box.height / 2 - point.y, {
    steps: 6,
  });
  await page.mouse.up();
  await settleLayout(page);
}

/** Pausable `performance.now`, as e2e/ba-dan-demo.review.ts installs it. */
async function installPausableClock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const real = performance.now.bind(performance);
    const clock = { offset: 0, frozen: null as number | null };
    (window as unknown as { reviewClock: unknown }).reviewClock = {
      freeze(at: number) {
        clock.frozen = at;
      },
    };
    performance.now = () => clock.frozen ?? real() - clock.offset;
  });
}

async function freezeAt(page: Page, at: number): Promise<void> {
  await page.evaluate(async (at) => {
    const clock = (window as unknown as { reviewClock: { freeze: (t: number) => void } })
      .reviewClock;
    clock.freeze(at);
    for (let i = 0; i < 3; i++) await new Promise((done) => requestAnimationFrame(done));
  }, at);
}

/** Steps the frozen clock from `t0` and photographs `clip` each step until `done`, then `tail` more. */
async function film(
  page: Page,
  folder: string,
  t0: number,
  clip: { x: number; y: number; width: number; height: number },
  done: () => Promise<boolean>,
  max = 220,
  tail = 8,
  probe?: (i: number) => Promise<void>,
): Promise<number> {
  mkdirSync(folder, { recursive: true });
  let after = -1;
  let i = 0;
  for (; i < max; i++) {
    await freezeAt(page, t0 + i * STEP_MS);
    await page.screenshot({ path: `${folder}/${String(i).padStart(3, '0')}.png`, clip });
    await probe?.(i);
    if (after < 0 && (await done())) after = i;
    if (after >= 0 && i - after >= tail) break;
  }
  return i + 1;
}

test('canvas jog captures', async ({ page }) => {
  test.setTimeout(1_800_000);
  // The recording starts with the page, just before the test body.
  const videoStart = Date.now();
  const label = process.env.FNT_JOG_LABEL ?? 'current';
  const folder = `${process.env.FNT_JOG_DIR ?? '.shots/jog'}/${label}`;
  mkdirSync(folder, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const provenance: Record<string, unknown> = {
    revision: execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim(),
    stepMs: STEP_MS,
  };

  // Ba Dan: the demo slice, the party from the road's west end to the bridge.
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'ba-dan-demo', {
    reduceMotion: false,
  });
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  await settleLayout(page);
  const zoomTo = process.env.FNT_JOG_ZOOM ?? '77';
  if (zoomTo !== 'default') await zoom(page, Number(zoomTo));
  const tilePx = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
  const startAt = async () => {
    await page.evaluate(() => {
      const app = window.fnt!.app;
      const state = app.state!;
      app.adoptSave({ ...state, location: { ...state.location, pos: { x: 1, y: 8 } } }, undefined);
    });
    await waitForIdle(page);
    await centerTile(page, 5, 7);
  };
  // Gao at his shopfront (9, 4), his door up the steps behind him.
  await startAt();
  await centerTile(page, 9, 3.5);
  await page.waitForTimeout(600);
  const view = await page.locator('.map-canvas').boundingBox();
  if (!view) throw new Error('No canvas');
  await page.screenshot({
    path: `${folder}/gao-door.png`,
    clip: {
      x: Math.round(view.x + view.width / 2 - tilePx * 1.75),
      y: Math.round(view.y + view.height / 2 - tilePx * 1.75),
      width: Math.round(tilePx * 3.5),
      height: Math.round(tilePx * 3),
    },
  });
  if (process.env.FNT_JOG_VIDEO) {
    // The party crosses the slice once at the game's own pace, for the recording.
    await startAt();
    await page.waitForTimeout(600);
    const crossing = Date.now() - videoStart;
    await page.locator('.map-canvas').click({ position: await tilePoint(page, 9, 8) });
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos.x), { timeout: 20_000 })
      .toBe(9);
    await waitForIdle(page);
    await page.waitForTimeout(800);
    provenance.videoCrossingMs = [crossing, Date.now() - videoStart];
  }
  await startAt();
  await page.waitForTimeout(600);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  provenance.baDanTilePx = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
  await installPausableClock(page);
  const t0 = await page.evaluate(() => performance.now());
  await freezeAt(page, t0);
  await page.locator('.map-canvas').click({ position: await tilePoint(page, 9, 8) });
  const slice = {
    x: box.x + box.width * 0.1,
    y: box.y + box.height * 0.2,
    width: Math.round(box.width * 0.8),
    height: Math.round(box.height * 0.6),
  };
  const leader: { i: number; x: number; y: number }[] = [];
  provenance.baDanFrames = await film(
    page,
    `${folder}/ba-dan`,
    t0,
    slice,
    async () =>
      page.evaluate(
        () =>
          window.fnt!.app.state!.location.pos.x === 9 &&
          !window.fnt!.app.animator.busy(performance.now()),
      ),
    220,
    8,
    async (i) => {
      const at = await page.evaluate(() => {
        const app = window.fnt!.app;
        const id = app.state!.party[0]?.id ?? '';
        return app.animator.renderPos(performance.now(), id) ?? app.state!.location.pos;
      });
      const point = await tilePoint(page, at.x, at.y);
      // tilePoint is canvas-relative; the frame is a page clip.
      leader.push({
        i,
        x: Math.round(box.x + point.x - slice.x),
        y: Math.round(box.y + point.y - slice.y),
      });
    },
  );
  provenance.baDanLeader = leader;
  if (process.env.FNT_JOG_NO_FOREST) {
    writeFileSync(`${folder}/provenance.json`, JSON.stringify({ ...provenance, errors }, null, 2));
    expect(errors).toEqual([]);
    return;
  }

  // The forest fight: Kaya's longest straight move from beside the oil flask.
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    ['Sura', 'Riko', 'Kaya', 'Bo', 'Nima', 'Wen'],
    ['sura', 'riko', 'kaya', 'bo', 'nima', 'wen'],
    'forest-g1',
    { reduceMotion: false },
  );
  await enterNode(page, 'battle_forest_road');
  await page.waitForFunction(() => Boolean(window.fnt?.app.state?.battle));
  await page.evaluate(() => {
    const app = window.fnt!.app;
    const state = app.state!;
    const battle = state.battle!;
    const kaya = battle.units.find((u) => u.characterId === 'kaya');
    if (!kaya) throw new Error('No Kaya in the fight');
    app.state = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((u) => (u.id === kaya.id ? { ...u, pos: { x: 13, y: 7 } } : u)),
        turnIndex: battle.order.indexOf(kaya.id),
      },
    };
    app.resync();
  });
  await takeTurn(page);
  await waitForIdle(page);
  const state = (await page.evaluate(() => window.fnt!.app.state)) as GameState;
  const battle = state.battle!;
  const kaya = battle.units.find((u) => u.characterId === 'kaya')!;
  const draft = new BattleDraft(CONTENT, battle, new RngCursor(state.rng));
  const straight = (path: readonly Vec2[]) => {
    let prev = kaya.pos;
    const steps = path.map((p) => {
      const s = `${p.x - prev.x},${p.y - prev.y}`;
      prev = p;
      return s;
    });
    return new Set(steps).size === 1;
  };
  const moves = [...reachable(draft.moveContext(kaya), kaya.pos, kaya.move).values()].filter(
    (c) => c.path.length > 0,
  );
  const best =
    moves.filter((c) => straight(c.path)).sort((a, b) => b.path.length - a.path.length)[0] ??
    moves.sort((a, b) => b.path.length - a.path.length)[0];
  if (!best) throw new Error('Kaya has no move');
  provenance.forestPath = [kaya.pos, ...best.path];
  await zoom(page, 96);
  provenance.forestTilePx = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
  const mid = best.path[Math.floor((best.path.length - 1) / 2)]!;
  await centerTile(page, (kaya.pos.x + mid.x) / 2, (kaya.pos.y + mid.y) / 2);
  await page.waitForTimeout(600);
  const tile = (provenance.forestTilePx as number) ?? 96;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const clip = {
    x: Math.round(centre.x - tile * 3.5),
    y: Math.round(centre.y - tile * 2.5),
    width: Math.round(tile * 7),
    height: Math.round(tile * 4.5),
  };
  await installPausableClock(page);
  const f0 = await page.evaluate(() => performance.now());
  await freezeAt(page, f0);
  await page.evaluate((c) => window.fnt!.app.dispatch(c), {
    type: 'move' as const,
    unitId: kaya.id,
    path: best.path,
  });
  provenance.forestFrames = await film(page, `${folder}/forest`, f0, clip, async () =>
    page.evaluate(() => !window.fnt!.app.animator.busy(performance.now())),
  );

  provenance.errors = errors;
  writeFileSync(`${folder}/provenance.json`, JSON.stringify(provenance, null, 2));
  expect(errors).toEqual([]);
});
