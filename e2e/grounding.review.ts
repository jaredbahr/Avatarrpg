/**
 * Review captures for the grounding pass (ADR 0093): does everything that
 * stands on the ground read as standing there?
 *
 * For each backend it writes, under FNT_GROUNDING_DIR (default
 * .shots/grounding/<label>/<renderer>):
 * - badan-wide-N<n>.png: the Ba Dan market corner at integer zoom n (2 and 3),
 *   the party and the residents in it;
 * - badan-feet-<who>-N<n>-4x.png: a nearest 4x crop under every figure's feet;
 * - badan-walk-strip.png: the leader's feet every half cel of one walk east, side
 *   by side; the camera follows the leader, so the paving moves under them and a
 *   planted foot that drifts against it shows;
 * - forest-wide-<frame>-N<n>.png and forest-<frame>-<who>-N<n>-4x.png: the first
 *   fight framed on the bank, the road and the keeper's lodge: the party on the
 *   road, bandits on the tier-1 bank and the tier-2 perch (the raised-tile lift),
 *   every prop's base, and the solid roadside scenery;
 * - provenance.json: revision, renderer, zoom, every crop's ground point.
 *
 * Local review fixture only: not a playthrough, not a CI check.
 *
 * FNT_GROUNDING_LABEL=before npx playwright test -c playwright.grounding.config.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';
import type * as ElevationModule from '../src/render/geometry/elevation';

interface Foot {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

async function zoom(page: Page, target: number): Promise<number> {
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
  return page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
}

/** Canvas-relative pixel of a ground point (tiles), lifted by the tile it is on. */
async function groundPoint(page: Page, x: number, y: number, grid = true): Promise<Foot> {
  return page.evaluate(
    async ({ x, y, grid }) => {
      const elevation = (await import(
        /* @vite-ignore */ `/src/render/geometry/${'elevation'}.ts`
      )) as typeof ElevationModule;
      const app = window.fnt!.app;
      const camera = app.rendererCamera()!;
      const m = camera.groundTransform;
      const scene = app as unknown as { scene?: { grid?: Parameters<typeof elevation.liftAt>[0] } };
      const board = app.state?.battle?.grid ?? scene.scene?.grid;
      const lift =
        grid && board
          ? elevation.liftAlong(board, { x: x - 0.5, y: y - 0.5 }, camera.projection)
          : 0;
      return {
        name: '',
        x: m.a * x * 64 + m.c * y * 64 + m.tx,
        y: m.b * x * 64 + m.d * y * 64 + m.ty - lift * camera.tilePx,
      };
    },
    { x, y, grid },
  );
}

async function centerTile(page: Page, tx: number, ty: number): Promise<void> {
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  const point = await groundPoint(page, tx + 0.5, ty + 0.5, false);
  const start = { x: box.x + 24, y: box.y + 24 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + box.width / 2 - point.x, start.y + box.height / 2 - point.y, {
    steps: 6,
  });
  await page.mouse.up();
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible()) await close.click();
  await settleLayout(page);
}

async function shoot(page: Page, path: string): Promise<void> {
  const box = await page.locator('.map-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  await page.screenshot({ path, clip: box });
}

function crop(src: PNG, cx: number, cy: number, w: number, h: number, scale: number): PNG {
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - h / 2);
  const dst = new PNG({ width: w * scale, height: h * scale });
  for (let y = 0; y < h * scale; y++)
    for (let x = 0; x < w * scale; x++) {
      const sx = x0 + Math.floor(x / scale);
      const sy = y0 + Math.floor(y / scale);
      const d = (y * w * scale + x) * 4;
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) {
        dst.data[d + 3] = 255;
        continue;
      }
      const s = (sy * src.width + sx) * 4;
      for (let c = 0; c < 4; c++) dst.data[d + c] = src.data[s + c]!;
    }
  return dst;
}

/** Crops centred a little above the foot so the boots, the contact and the cast all show. */
function feetCrops(
  shot: string,
  feet: readonly Foot[],
  tilePx: number,
  out: (n: string) => string,
) {
  const src = PNG.sync.read(readFileSync(shot));
  const w = Math.round(tilePx * 1.1);
  const h = Math.round(tilePx * 0.75);
  for (const foot of feet)
    writeFileSync(
      out(foot.name),
      PNG.sync.write(crop(src, foot.x + tilePx * 0.1, foot.y - tilePx * 0.12, w, h, 4)),
    );
}

/** Side by side, left to right. */
function strip(frames: readonly PNG[]): PNG {
  const width = frames.reduce((sum, f) => sum + f.width + 4, -4);
  const height = Math.max(...frames.map((f) => f.height));
  const out = new PNG({ width, height });
  out.data.fill(255);
  let at = 0;
  for (const f of frames) {
    PNG.bitblt(f, out, 0, 0, f.width, f.height, at, 0);
    at += f.width + 4;
  }
  return out;
}

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

async function freezeAt(page: Page, at: number): Promise<void> {
  await page.evaluate(async (at) => {
    const clock = (window as unknown as { reviewClock: { freeze: (t: number) => void } })
      .reviewClock;
    clock.freeze(at);
    for (let i = 0; i < 3; i++) await new Promise((done) => requestAnimationFrame(done));
  }, at);
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

/** Every figure drawn in the village: the party where it is drawn, then the residents. */
async function villageFeet(page: Page): Promise<Foot[]> {
  const spots = await page.evaluate(() => {
    const app = window.fnt!.app;
    const party = (app.partyPositions() ?? []).map((p, i) => ({
      name: app.state!.party[i]?.characterId ?? `party${i}`,
      pos: p,
    }));
    const scene = (
      app as unknown as {
        scene?: {
          lastNpcs?: readonly {
            id: string;
            pos: { x: number; y: number };
            renderPos?: { x: number; y: number };
            alpha?: number;
          }[];
        };
      }
    ).scene;
    const npcs = (scene?.lastNpcs ?? [])
      .filter((n) => (n.alpha ?? 1) > 0 && !n.id.startsWith('trigger:'))
      .map((n) => ({ name: n.id.replace(/[^a-z0-9-]+/gi, '-'), pos: n.renderPos ?? n.pos }));
    return [...party, ...npcs];
  });
  const box = await page.locator('.map-canvas').boundingBox();
  const feet: Foot[] = [];
  for (const spot of spots) {
    const p = await groundPoint(page, spot.pos.x + 0.5, spot.pos.y + 0.5);
    if (box && p.x > 0 && p.y > 0 && p.x < box.width && p.y < box.height)
      feet.push({ ...p, name: spot.name });
  }
  return feet;
}

const BA_DAN_STAND = [8, 8] as const;
const BA_DAN_FRAME = [9, 6] as const;
const WALK_FROM = [2, 8] as const;
const WALK_TO = [8, 8] as const;

/** Bandits on the NE bank (tier 1) and the perch (tier 2); the party stays on the road. */
const FOREST_PLACES = [
  { x: 17, y: 2 },
  { x: 19, y: 2 },
  { x: 16, y: 5 },
] as const;
const FOREST_FRAME = [15, 4] as const;

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`${renderer} grounding review`, async ({ page }) => {
    test.setTimeout(1_200_000);
    const label = process.env.FNT_GROUNDING_LABEL ?? 'current';
    const folder = `${process.env.FNT_GROUNDING_DIR ?? '.shots/grounding'}/${label}/${renderer}`;
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const record: Record<string, unknown> = {};

    // --- Ba Dan ---------------------------------------------------------
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'grounding', {
      reduceMotion: false,
    });
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
    for (const n of [2, 3]) {
      await place(page, ...BA_DAN_STAND);
      // Placing the party remounts the scene and its camera: zoom after it.
      const tilePx = await zoom(page, 64 * n);
      await centerTile(page, ...BA_DAN_FRAME);
      await page.waitForTimeout(600);
      const wide = `${folder}/badan-wide-N${n}.png`;
      await shoot(page, wide);
      const feet = await villageFeet(page);
      record[`badan-N${n}`] = { tilePx, feet };
      feetCrops(wide, feet, tilePx, (who) => `${folder}/badan-feet-${who}-N${n}-4x.png`);
    }

    // The walk strip, at N = 3: the leader's feet every 57 ms (half a cel) of one walk east.
    await place(page, ...WALK_FROM);
    const tilePx = await zoom(page, 192);
    await centerTile(page, 5, 8);
    await installPausableClock(page);
    const target = await groundPoint(page, WALK_TO[0] + 0.5, WALK_TO[1] + 0.5);
    await page.locator('.map-canvas').click({ position: { x: target.x, y: target.y } });
    const t0 = await page.evaluate(() => performance.now());
    const frames: PNG[] = [];
    const walkFeet: Foot[] = [];
    for (let i = 0; i < 16; i++) {
      await freezeAt(page, t0 + 400 + i * 57);
      const shot = `${folder}/.walk-${i}.png`;
      await shoot(page, shot);
      // The camera follows the leader, so the leader is drawn at the canvas centre and the
      // paving moves under them: a planted foot should move with the paving, not with the body.
      const box = await page.locator('.map-canvas').boundingBox();
      if (!box) continue;
      const leader = { name: 'leader', x: box.width / 2, y: box.height / 2 };
      walkFeet.push(leader);
      frames.push(
        crop(
          PNG.sync.read(readFileSync(shot)),
          leader.x,
          leader.y - tilePx * 0.08,
          Math.round(tilePx * 0.6),
          Math.round(tilePx * 0.4),
          2,
        ),
      );
    }
    writeFileSync(`${folder}/badan-walk-strip.png`, PNG.sync.write(strip(frames)));
    record.walk = { tilePx, feet: walkFeet };
    await page.evaluate(() =>
      (window as unknown as { reviewClock: { resume: () => void } }).reviewClock.resume(),
    );

    // --- Forest road ----------------------------------------------------
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Sura', 'Kaya', 'Bo'], ['sura', 'kaya', 'bo'], 'grounding', {
      reduceMotion: false,
    });
    await enterNode(page, 'battle_forest_road');
    await page.waitForFunction(() => Boolean(window.fnt?.app.state?.battle));
    await page.evaluate((places) => {
      const app = window.fnt!.app;
      const state = app.state!;
      const battle = state.battle!;
      const enemies = battle.units.filter((u) => u.faction !== 'party');
      app.state = {
        ...state,
        battle: {
          ...battle,
          units: battle.units.map((u) => {
            const i = enemies.indexOf(u);
            const at = places[i];
            return at ? { ...u, pos: at } : u;
          }),
        },
      };
      app.resync();
    }, FOREST_PLACES);
    await takeTurn(page);
    await waitForIdle(page);
    const shotZooms = new Set<number>();
    for (const n of [2, 3]) {
      const tilePx = await zoom(page, 64 * n);
      // Combat may stop short of N = 3; one set of frames per zoom it reaches.
      if (shotZooms.has(tilePx)) continue;
      shotZooms.add(tilePx);
      for (const [frame, tag] of [
        [FOREST_FRAME, 'bank'],
        [[3, 5], 'road'],
        // The keeper's lodge and the roadside props on the north verge.
        [[1, 1], 'lodge'],
      ] as const) {
        await centerTile(page, frame[0], frame[1]);
        await page.waitForTimeout(500);
        const wide = `${folder}/forest-wide-${tag}-N${n}.png`;
        await shoot(page, wide);
        const spots = await page.evaluate(() => {
          const battle = window.fnt!.app.state!.battle!;
          return [
            ...battle.units
              .filter((u) => u.hp > 0)
              .map((u) => ({
                name: `${u.faction}-${u.characterId ?? u.enemyId ?? u.id}`,
                pos: u.pos,
              })),
            ...battle.props.map((p) => ({
              name: `prop-${p.propId}-${p.pos.x}-${p.pos.y}`,
              pos: p.pos,
            })),
          ];
        });
        const box = await page.locator('.map-canvas').boundingBox();
        const feet: Foot[] = [];
        for (const spot of spots) {
          const p = await groundPoint(page, spot.pos.x + 0.5, spot.pos.y + 0.5);
          if (box && p.x > 0 && p.y > 0 && p.x < box.width && p.y < box.height)
            feet.push({ ...p, name: spot.name.replace(/[^a-z0-9-]+/gi, '-') });
        }
        record[`forest-${tag}-N${n}`] = { tilePx, feet };
        feetCrops(wide, feet, tilePx, (who) => `${folder}/forest-${tag}-${who}-N${n}-4x.png`);
      }
    }

    writeFileSync(
      `${folder}/provenance.json`,
      JSON.stringify(
        {
          label,
          revision: execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
            encoding: 'utf8',
          }).trim(),
          renderer,
          dpr: await page.evaluate(() => window.devicePixelRatio),
          ...record,
          errors,
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
  });
}
