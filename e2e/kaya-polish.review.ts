/**
 * Review recordings for Kaya's polished world sheet (art/source/party-world/README.md, "Kaya polish"). Canvas backend,
 * 1280x800, real time; Playwright records each test as video and timing.json says where the load ends, so the clip can
 * be cut with ffmpeg.
 *
 * - `ba dan walk`: Kaya alone in Ba Dan at close zoom (256 px tiles asked for), walking a route with one leg in each of
 *   the eight headings and stopping after each so the idle shows.
 * - `forest fight`: the first fight; Kaya in her stance, a Fire Jab at the bandit beside her, then his club swing at
 *   her (his turn, dispatched straight after, so it plays on camera).
 *
 * Local review fixture only: not a playthrough, not a CI check.
 *
 * FNT_KP_LABEL=after FNT_KP_QUERY='&style=world' npx playwright test -c playwright.kaya-polish.config.ts
 * (FNT_KP_ONLY=walk|fight runs one; FNT_KP_TILE_PX and FNT_KP_FIGHT_TILE_PX set the zooms.)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, takeTurn, waitForIdle } from './helpers';

const LABEL = process.env.FNT_KP_LABEL ?? 'current';
const QUERY = process.env.FNT_KP_QUERY ?? '&style=world';
const FOLDER = `${process.env.FNT_KP_DIR ?? '.shots/kaya-polish'}/${LABEL}`;
const ONLY = process.env.FNT_KP_ONLY;

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
  // Start in a corner so the drag never begins on a figure and opens its sheet.
  const start = { x: box.x + 24, y: box.y + 24 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + box.width / 2 - point.x, start.y + box.height / 2 - point.y, {
    steps: 8,
  });
  await page.mouse.up();
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible()) await close.click();
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

/** Two-tile legs on Ba Dan's open ground, one in each screen heading (grid step -> heading on the oblique board). */
const START = [6, 6] as const;
const LEGS = [
  ['south-east', [8, 6]],
  ['south', [10, 8]],
  ['north-east', [10, 6]],
  ['east', [12, 4]],
  ['south-west', [12, 6]],
  ['west', [10, 8]],
  ['north-west', [8, 8]],
  ['north', [6, 6]],
] as const;

function timing(name: string, t0: number, ready: number, extra: object = {}): void {
  mkdirSync(FOLDER, { recursive: true });
  writeFileSync(
    `${FOLDER}/${name}-timing.json`,
    JSON.stringify(
      { label: LABEL, query: QUERY, cutSeconds: (ready - t0) / 1000, ...extra },
      null,
      2,
    ),
  );
}

test('ba dan walk', async ({ page }) => {
  test.skip(Boolean(ONLY) && ONLY !== 'walk');
  test.setTimeout(300_000);
  const t0 = Date.now();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await resetStorage(page, `?renderer=canvas${QUERY}`);
  // The objective card covers the top-left of the map at this size; the review is about the figure.
  await page.addStyleTag({ content: '.explore-objective { display: none !important; }' });
  await startGame(page, ['Kaya'], ['kaya'], 'ba-dan-demo', { reduceMotion: false });
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  await settleLayout(page);
  expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe('canvas');
  // The explore camera stops at N = 3 (192 px tiles); the review asks for N = 4, so lift its cap for this fixture only.
  await page.evaluate(() => {
    const scene = (
      window.fnt!.app as unknown as { scene: { renderer: { camera: { maxScale: number } } } }
    ).scene;
    scene.renderer.camera.maxScale = 4;
  });
  await zoom(page, Number(process.env.FNT_KP_TILE_PX ?? 256));
  const tilePx = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
  await place(page, ...START);
  await centerTile(page, ...START);
  await page.waitForTimeout(800);
  const ready = Date.now();
  await page.waitForTimeout(1500);
  let at: readonly [number, number] = START;
  for (const [, to] of LEGS) {
    // Frame the leg (the camera on its midpoint) so its end is on screen at this zoom.
    await centerTile(page, (at[0] + to[0]) / 2, (at[1] + to[1]) / 2);
    await page.waitForTimeout(400);
    await page
      .locator('.map-canvas')
      .click({ position: await tilePoint(page, to[0], to[1]), timeout: 5_000 });
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state!.location.pos), { timeout: 10_000 })
      .toEqual({ x: to[0], y: to[1] });
    await waitForIdle(page);
    await page.waitForTimeout(1300);
    at = to;
  }
  await page.waitForTimeout(1500);
  timing('walk', t0, ready, { tilePx, legs: LEGS });
  expect(errors).toEqual([]);
});

/** Kaya where the forest review stands her, a bandit beside her: she jabs him, he swings back. */
const KAYA_AT = { x: 13, y: 7 } as const;
const BANDIT_AT = { x: 14, y: 7 } as const;

test('forest fight', async ({ page }) => {
  test.skip(Boolean(ONLY) && ONLY !== 'fight');
  test.setTimeout(600_000);
  const t0 = Date.now();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await resetStorage(page, `?renderer=canvas${QUERY}`);
  await startGame(
    page,
    ['Sura', 'Riko', 'Kaya', 'Bo', 'Nima', 'Wen'],
    ['sura', 'riko', 'kaya', 'bo', 'nima', 'wen'],
    'forest-g1',
    { reduceMotion: false },
  );
  await enterNode(page, 'battle_forest_road');
  await page.waitForFunction(() => Boolean(window.fnt?.app.state?.battle));
  await page.evaluate(
    ([at, bandit]) => {
      const app = window.fnt!.app;
      const state = app.state!;
      const battle = state.battle!;
      const kaya = battle.units.find((u) => u.characterId === 'kaya');
      const thug = battle.units.find((u) => u.faction !== 'party' && u.enemyId?.includes('thug'));
      if (!kaya || !thug) throw new Error('No Kaya or thug in the fight');
      // Kaya acts, then the thug: he is next in the order, so his turn follows hers. The slingers sit this one out (their
      // stones would hit her off camera, with the camera on them).
      const slingers = battle.units.filter((u) => u.enemyId?.includes('slinger')).map((u) => u.id);
      const order = battle.order.filter((id) => id !== thug.id && !slingers.includes(id));
      order.splice(order.indexOf(kaya.id) + 1, 0, thug.id);
      app.state = {
        ...state,
        battle: {
          ...battle,
          order,
          units: battle.units.map((u) =>
            u.id === kaya.id ? { ...u, pos: at } : u.id === thug.id ? { ...u, pos: bandit } : u,
          ),
          turnIndex: order.indexOf(kaya.id),
        },
      };
      app.resync();
    },
    [KAYA_AT, BANDIT_AT] as const,
  );
  await takeTurn(page);
  await waitForIdle(page);
  if (process.env.FNT_KP_DEBUG)
    console.log(
      await page.evaluate(() => {
        const b = window.fnt!.app.state!.battle!;
        return JSON.stringify({
          turn: b.order[b.turnIndex],
          order: b.order.map((id) => {
            const u = b.units.find((v) => v.id === id)!;
            return `${id}:${u.characterId ?? u.enemyId}@${u.pos.x},${u.pos.y}`;
          }),
        });
      }),
    );
  await zoom(page, Number(process.env.FNT_KP_FIGHT_TILE_PX ?? 192));
  const tilePx = await page.evaluate(() => window.fnt!.app.rendererCamera()!.tilePx);
  await centerTile(page, KAYA_AT.x + 0.5, KAYA_AT.y - 0.5);
  await page.waitForTimeout(600);
  const ready = Date.now();
  await page.waitForTimeout(2500); // the stance loop
  await page.getByRole('button', { name: /^Fire Jab/ }).click();
  await settleLayout(page);
  const canvas = page.locator('.map-canvas');
  await canvas.click({ position: await tilePoint(page, BANDIT_AT.x, BANDIT_AT.y) });
  const confirm = page.locator('.confirm-bar').filter({ hasText: 'Confirm' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: /Confirm/ }).click();
  await waitForIdle(page);
  await page.waitForTimeout(1200);
  const hpBefore = await page.evaluate(
    () => window.fnt!.app.state!.battle!.units.find((u) => u.characterId === 'kaya')!.hp,
  );
  // The thug's answer, played straight away and on camera: his turn, his club swing at her. (Left to the AI, he
  // steps away from the fire and the slingers' stones land on her with the camera on them.)
  await page.evaluate(() => {
    const app = window.fnt!.app;
    const state = app.state!;
    const battle = state.battle!;
    const kaya = battle.units.find((u) => u.characterId === 'kaya')!;
    const near = (u: { pos: { x: number; y: number } }) =>
      Math.abs(u.pos.x - kaya.pos.x) + Math.abs(u.pos.y - kaya.pos.y);
    const thug = battle.units
      .filter((u) => u.enemyId?.includes('thug') && u.hp > 0)
      .sort((a, b) => near(a) - near(b))[0]!;
    app.state = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((u) => (u.id === thug.id ? { ...u, ap: 4 } : u)),
        turnIndex: battle.order.indexOf(thug.id),
      },
    };
    app.resync();
    app.dispatch({
      type: 'useAbility',
      unitId: thug.id,
      abilityId: 'club_swing',
      target: kaya.pos,
    });
    // Hand the turn straight back to Kaya (no resync: the swing and her hit keep playing), so the scene neither
    // runs the rest of his turn nor passes the tablet on before her hit has played.
    const after = app.state!;
    app.state = {
      ...after,
      battle: { ...after.battle!, turnIndex: after.battle!.order.indexOf(kaya.id) },
    };
  });
  const hit = await page
    .waitForFunction(
      (before) => {
        const k = window.fnt?.app.state?.battle?.units.find((u) => u.characterId === 'kaya');
        return Boolean(k && k.hp < before);
      },
      hpBefore,
      { timeout: 20_000 },
    )
    .then(() => true)
    .catch(() => false);
  await waitForIdle(page, 60_000).catch(() => undefined);
  await page.waitForTimeout(2500);
  timing('fight', t0, ready, { tilePx, kayaHit: hit });
  expect(errors).toEqual([]);
});
