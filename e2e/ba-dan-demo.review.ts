/**
 * Review captures for the Ba Dan art-direction demo (issue #284): one bounded
 * slice of the village, the canal market corner, photographed the same way for
 * every route so a before and an after line up frame for frame.
 *
 * Slice: tiles x 0..13, y 0..9. Gao's house and shopfront, the market display
 * by the canal and its canopy tree, the bench and fence, the bridge, the canal
 * bank, the road, the south market display and its baskets, and Mira's midday
 * table at the slice's east edge.
 *
 * For each backend it writes, under FNT_DEMO_REVIEW_DIR (default
 * .shots/ba-dan-demo/<label>/<renderer>):
 * - slice-1x.png: the whole slice at game zoom (77 px tiles), the party in it;
 * - stop-NN-<name>.png and -walking.png: fixed walk beats through the slice;
 * - crop-<name>-4x.png: nearest-neighbour 4x enlargements of fixed regions;
 * - practice-ready.png, then practice-<character>-gather.png, -release.png and
 *   -impact.png: the bending practice on the south canal bank, each bender
 *   frozen mid wind-up, at their bend's first release and at its impact (the
 *   video shows it in real time first);
 * - provenance.json: revision, renderer, seed, tile size, day phase, errors.
 * Playwright records the run as video (see the config) for the walk-through clip.
 *
 * Local review fixture only: not a playthrough, not a CI check.
 *
 * FNT_DEMO_LABEL=before npx playwright test -c playwright.ba-dan-demo.config.ts
 * (FNT_DEMO_PRACTICE_ONLY=1 skips the walk stops and re-shoots only the practice.)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import type * as ChoreoModule from '../src/app/anim/bendChoreo';

const TILE_PX = 77;

async function zoom(page: Page, target: number): Promise<void> {
  const current = await page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx);
  const box = await page.locator('.map-canvas').boundingBox();
  if (!current || !box) throw new Error('Missing camera');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, Math.log(current / target) / 0.002);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.rendererCamera()?.tilePx))
    .toBeCloseTo(target, 0);
  await settleLayout(page);
}

/** Canvas-relative pixel centre of a tile, through the camera the tap handler reads. */
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

async function place(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([x, y]) => {
      const app = window.fnt!.app;
      const state = app.state!;
      app.adoptSave({ ...state, location: { ...state.location, pos: { x, y } } }, undefined);
    },
    [x, y] as const,
  );
  await waitForIdle(page);
}

/**
 * Stand the party on `from`, keep the camera on the slice centre, tap `to`,
 * photograph it on the way and at the stop. The stop is re-framed on the slice
 * centre, so every beat frames the same ground and a before and an after compare.
 */
async function walk(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
  shot: string,
): Promise<void> {
  await place(page, from[0], from[1]);
  await centerTile(page, ...SLICE_CENTRE);
  await page
    .locator('.map-canvas')
    .click({ position: await tilePoint(page, to[0], to[1]), timeout: 5_000 });
  await page.waitForTimeout(450);
  await page.locator('.map-canvas').screenshot({ path: `${shot}-walking.png` });
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos), { timeout: 10_000 })
    .toEqual({ x: to[0], y: to[1] });
  await waitForIdle(page);
  // Walking pans the camera after the party; frame the slice again so every stop compares.
  await centerTile(page, ...SLICE_CENTRE);
  await page.waitForTimeout(600);
  await page.locator('.map-canvas').screenshot({ path: `${shot}.png` });
}

const SLICE_CENTRE = [7, 5] as const;

/** Walk beats through the slice; endpoints stay off resident anchors. */
const STOPS = [
  ['road-past-market', [1, 8], [8, 8]],
  ['over-bridge-to-shopfront', [9, 8], [8, 4]],
  ['behind-market-table', [8, 4], [3, 4]],
  ['back-to-the-bridge', [3, 4], [9, 5]],
  ['toward-mira', [11, 8], [10, 5]],
] as const;

/** 4x crop regions: a tile to centre on, and the crop's size in screen px before enlargement. */
const CROPS = [
  ['market-table', [6.5, 5], 200, 150],
  ['shopfront-and-door', [9, 3], 220, 160],
  ['south-display-and-baskets', [3, 9], 200, 150],
  ['canal-bank-and-bridge', [9, 6], 200, 150],
  ['tree-and-bench', [4.5, 5], 200, 160],
] as const;

function crop4x(source: string, cx: number, cy: number, w: number, h: number, out: string): void {
  const src = PNG.sync.read(readFileSync(source));
  const x0 = Math.max(0, Math.min(src.width - w, Math.round(cx - w / 2)));
  const y0 = Math.max(0, Math.min(src.height - h, Math.round(cy - h / 2)));
  const scale = 4;
  const dst = new PNG({ width: w * scale, height: h * scale });
  for (let y = 0; y < h * scale; y++) {
    for (let x = 0; x < w * scale; x++) {
      const s = ((y0 + Math.floor(y / scale)) * src.width + x0 + Math.floor(x / scale)) * 4;
      const d = (y * w * scale + x) * 4;
      dst.data[d] = src.data[s]!;
      dst.data[d + 1] = src.data[s + 1]!;
      dst.data[d + 2] = src.data[s + 2]!;
      dst.data[d + 3] = src.data[s + 3]!;
    }
  }
  writeFileSync(out, PNG.sync.write(dst));
}

/**
 * Makes `performance.now` pausable, so a still can be taken at an exact moment
 * of a bend without a fake clock: frozen, every frame draws that moment; let
 * go, time resumes from it. Presentation reads only this clock.
 */
async function installPausableClock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const real = performance.now.bind(performance);
    const clock = { offset: 0, frozen: null as number | null };
    (window as unknown as { reviewClock: unknown }).reviewClock = {
      freeze(at: number) {
        clock.frozen = at;
      },
      resume() {
        if (clock.frozen === null) return;
        clock.offset = real() - clock.frozen;
        clock.frozen = null;
      },
    };
    performance.now = () => clock.frozen ?? real() - clock.offset;
  });
}

/** Sets the frozen page clock to `at` (performance.now ms) and waits for that frame to draw. */
async function freezeAt(page: Page, at: number): Promise<void> {
  await page.evaluate(async (at) => {
    const clock = (window as unknown as { reviewClock: { freeze: (t: number) => void } })
      .reviewClock;
    clock.freeze(at);
    for (let i = 0; i < 3; i++) await new Promise((done) => requestAnimationFrame(done));
  }, at);
}

async function resumeClock(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { reviewClock: { resume: () => void } }).reviewClock.resume(),
  );
}

/**
 * The practice ground (`BA_DAN_PRACTICE.anchor`), walked to from the east so
 * the followers trail along the open road, and the tile the beat is framed on.
 */
const PRACTICE_AT = [10, 8] as const;
const PRACTICE_FROM = [14, 8] as const;
const PRACTICE_FRAME = [9, 6] as const;

/**
 * The practice beat: stand the party on the south bank, wait for the bends to
 * load, practise once in real time for the video, then again with each bender
 * frozen at their first release and at their impact.
 */
async function practice(page: Page, folder: string): Promise<string[]> {
  await place(page, ...PRACTICE_FROM);
  await centerTile(page, ...PRACTICE_FRAME);
  await page
    .locator('.map-canvas')
    .click({ position: await tilePoint(page, ...PRACTICE_AT), timeout: 5_000 });
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos), { timeout: 20_000 })
    .toEqual({ x: PRACTICE_AT[0], y: PRACTICE_AT[1] });
  await waitForIdle(page, 30_000);
  await centerTile(page, ...PRACTICE_FRAME);
  const button = page.getByRole('button', { name: /^Practice/ });
  await expect(button).toBeEnabled({ timeout: 60_000 });
  await page.screenshot({ path: `${folder}/practice-ready.png` });
  await button.click();
  await waitForIdle(page, 30_000);
  await page.waitForTimeout(400);

  // Press Practice and stop the clock in the same tick, so a slow software
  // WebGL frame cannot carry the first bend past its release before the still.
  const plan = await page.evaluate(async () => {
    const choreo = (await import(
      /* @vite-ignore */ `/src/app/anim/${'bendChoreo'}.ts`
    )) as typeof ChoreoModule;
    const app = window.fnt!.app;
    const clock = (window as unknown as { reviewClock: { freeze: (t: number) => void } })
      .reviewClock;
    document.querySelector<HTMLButtonElement>('.practice-button')!.click();
    clock.freeze(performance.now());
    const { tracks } = (
      app.animator as unknown as {
        timeline: {
          tracks: {
            kind: string;
            unitId: string;
            start: number;
            plan: ChoreoModule.BendPlan;
          }[];
        };
      }
    ).timeline;
    return tracks
      .filter((t) => t.kind === 'bend')
      .map((t) => {
        const last = t.plan.shot.releases.length - 1;
        const first = t.plan.shot.releases[0]!.launchAt;
        const arrival = t.plan.arrivals[last] ?? t.plan.shot.releases[last]!.launchAt;
        const member = app.state!.party.find((m) => m.id === t.unitId)!;
        const release = t.start + choreo.bendSceneAt(t.plan, first);
        return {
          name: member.characterId,
          // Halfway through the wind-up, when Sura's water is on its way up from the canal.
          gather: t.start + (release - t.start) * 0.55,
          release: release + 10,
          impact: t.start + choreo.bendSceneAt(t.plan, arrival) + 10,
        };
      });
  });
  expect(plan.map((p) => p.name)).toEqual(['kaya', 'sura', 'bo']);
  const shots: string[] = [];
  for (const bend of plan)
    for (const moment of ['gather', 'release', 'impact'] as const) {
      await freezeAt(page, bend[moment]);
      const file = `${folder}/practice-${bend.name}-${moment}.png`;
      await page.locator('.map-canvas').screenshot({ path: file });
      shots.push(file);
    }
  await resumeClock(page);
  await waitForIdle(page, 30_000);
  return shots;
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} Ba Dan demo slice`, async ({ page }) => {
    test.setTimeout(300_000);
    const revision =
      process.env.FNT_DEMO_REVISION ??
      execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
    const label = process.env.FNT_DEMO_LABEL ?? 'current';
    const folder = `${process.env.FNT_DEMO_REVIEW_DIR ?? '.shots/ba-dan-demo'}/${label}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'ba-dan-demo', {
      reduceMotion: false,
    });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);

    await zoom(page, TILE_PX);
    await place(page, 8, 8);
    await centerTile(page, ...SLICE_CENTRE);
    await page.waitForTimeout(600);
    const slice = `${folder}/slice-1x.png`;
    await page.locator('.map-canvas').screenshot({ path: slice });
    await page.screenshot({ path: `${folder}/slice-with-ui.png` });

    for (const [name, tile, w, h] of CROPS) {
      const p = await tilePoint(page, tile[0], tile[1]);
      crop4x(slice, p.x, p.y, w, h, `${folder}/crop-${name}-4x.png`);
    }

    // FNT_DEMO_PRACTICE_ONLY=1 re-shoots the practice beat without the walk-through.
    const stops = process.env.FNT_DEMO_PRACTICE_ONLY ? [] : STOPS;
    for (const [index, [name, from, to]] of stops.entries()) {
      await walk(page, from, to, `${folder}/stop-${String(index + 1).padStart(2, '0')}-${name}`);
    }

    await installPausableClock(page);
    const practiceShots = await practice(page, folder);

    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          issue: 284,
          label,
          revision,
          renderer,
          seed: 'ba-dan-demo',
          tilePx: TILE_PX,
          slice: { x: [0, 13], y: [0, 9], centre: SLICE_CENTRE },
          practice: { at: PRACTICE_AT, shots: practiceShots.map((f) => f.split('/').pop()) },
          dayPhase: await page.evaluate(() => {
            const s = window.fnt!.app.state as unknown as Record<string, unknown>;
            return s.dayPhase ?? (s.world as Record<string, unknown> | undefined)?.phase ?? null;
          }),
          diff: execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }),
          errors,
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
  });
}
