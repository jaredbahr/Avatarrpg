/**
 * Local review of the feel pass, on both backends: frame strips of the
 * moments it touches, read off a paused clock so before and after line up
 * frame for frame. Every event is pushed straight at the animator, as
 * combat-clips.review.ts does, so the rules and the RNG are untouched and the
 * same staging replays on any commit.
 *
 * Writes `<out>/<backend>-<moment>.png` contact strips (one row of frames) and
 * `<out>/sounds.json`, the cue keys each moment put through the bus.
 *
 * Run: npx playwright test -c playwright.feel-pass.config.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { pauseClock, resetStorage, settleLayout, startGame } from './helpers';

const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const OUT = join(process.env.FNT_REVIEW_OUT ?? 'test-results/feel-pass', revision);

/** A tile centre on the page, in CSS pixels. */
async function tilePoint(page: Page, tile: { x: number; y: number }) {
  return page.evaluate((at) => {
    const camera = window.fnt!.app.rendererCamera()!;
    const m = camera.groundTransform;
    const x = (at.x + 0.5) * 64;
    const y = (at.y + 0.5) * 64;
    const rect = document.querySelector('.map-canvas')!.getBoundingClientRect();
    return { x: rect.left + m.a * x + m.c * y + m.tx, y: rect.top + m.b * x + m.d * y + m.ty };
  }, tile);
}

/** Frames `every` ms apart around a tile, laid side by side in one PNG. */
async function strip(
  page: Page,
  name: string,
  tile: { x: number; y: number },
  frames: number,
  every: number,
  w = 300,
  h = 260,
): Promise<void> {
  const at = await tilePoint(page, tile);
  const size = page.viewportSize()!;
  const clip = {
    x: Math.max(0, Math.min(size.width - w, at.x - w / 2)),
    y: Math.max(0, Math.min(size.height - h, at.y - h * 0.65)),
    width: w,
    height: h,
  };
  const shots: PNG[] = [];
  for (let i = 0; i < frames; i++) {
    shots.push(PNG.sync.read(await page.screenshot({ clip })));
    await page.clock.fastForward(every);
  }
  const first = shots[0]!;
  const sheet = new PNG({ width: first.width * shots.length, height: first.height });
  shots.forEach((shot, i) =>
    PNG.bitblt(shot, sheet, 0, 0, shot.width, shot.height, i * first.width, 0),
  );
  writeFileSync(join(OUT, `${name}.png`), PNG.sync.write(sheet));
}

/** Pushes events at the animator from a staged roster, returning the cue keys the bus saw. */
async function play(page: Page, events: unknown[]): Promise<void> {
  await page.evaluate((events) => {
    const app = window.fnt!.app;
    const w = window as unknown as { feelCues: string[] };
    w.feelCues = [];
    app.animator.push(performance.now(), events as never, app.state!.battle!.units);
  }, events);
}

const cues = (page: Page) =>
  page.evaluate(() => (window as unknown as { feelCues: string[] }).feelCues.slice());

for (const backend of ['canvas', 'webgl'] as const) {
  test(`feel pass review (${backend})`, async ({ page }) => {
    test.setTimeout(600_000);
    mkdirSync(OUT, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install();
    await resetStorage(page, `?renderer=${backend}`);
    await startGame(page, ['Ana'], ['kaya', 'sura', 'bo'], 'feel-pass', { reduceMotion: false });
    await page.evaluate(() => {
      const app = window.fnt!.app;
      // Log every cue key the bus is handed, UI taps included.
      const w = window as unknown as { feelCues: string[] };
      w.feelCues = [];
      const play = app.audio.play.bind(app.audio);
      app.audio.play = (list, now) => {
        for (const cue of list) w.feelCues.push(cue.key);
        return play(list, now);
      };
      app.dispatch({ type: 'enterNode', nodeId: 'battle_forest_road' });
    });
    await settleLayout(page);

    // Stage one enemy beside Kaya; positions only.
    const ids = await page.evaluate(() => {
      const app = window.fnt!.app;
      const state = app.state!;
      const battle = state.battle!;
      const kaya = battle.units.find((u) => u.faction === 'party')!;
      const foe = battle.units.find((u) => u.faction === 'enemy')!;
      const foePos = { x: kaya.pos.x + 1, y: kaya.pos.y };
      app.state = {
        ...state,
        battle: {
          ...battle,
          units: battle.units.map((u) => (u.id === foe.id ? { ...u, pos: foePos } : u)),
        },
      };
      app.resync();
      app.animator.clear();
      return { kaya: kaya.id, kayaPos: kaya.pos, foe: foe.id, foePos };
    });
    const ready = page.getByRole('button', { name: "I'm ready" });
    if (await ready.isVisible()) await ready.click();
    await settleLayout(page);
    await pauseClock(page);
    await page.clock.runFor(500);
    await page.clock.fastForward(3000);
    writeFileSync(join(OUT, `${backend}-00-full.png`), await page.screenshot());
    const sounds: Record<string, string[]> = {};

    // 1. A critical strike: wind-up, contact, number, recoil.
    await play(page, [
      {
        type: 'abilityUsed',
        unitId: ids.kaya,
        abilityId: 'strike',
        target: ids.foePos,
        tiles: [ids.foePos],
      },
      {
        type: 'damaged',
        unitId: ids.foe,
        amount: 9,
        crit: true,
        damageType: 'physical',
        sourceId: ids.kaya,
      },
    ]);
    await strip(page, `${backend}-01-crit`, ids.foePos, 14, 70);
    sounds.crit = await cues(page);
    await page.clock.fastForward(1500);

    // 2. A three-tile walk away from the foe.
    const walk = [
      { x: ids.kayaPos.x, y: ids.kayaPos.y + 1 },
      { x: ids.kayaPos.x, y: ids.kayaPos.y + 2 },
      { x: ids.kayaPos.x - 1, y: ids.kayaPos.y + 2 },
    ];
    await play(page, [{ type: 'unitMoved', unitId: ids.kaya, path: walk, cost: 3 }]);
    await strip(page, `${backend}-02-walk`, walk[1]!, 12, 90);
    sounds.walk = await cues(page);
    await page.clock.fastForward(1500);

    // 3. The foe shoved a tile east, no damage.
    const shoved = { x: ids.foePos.x + 1, y: ids.foePos.y };
    await play(page, [{ type: 'unitPushed', unitId: ids.foe, to: shoved }]);
    await strip(page, `${backend}-03-shove`, shoved, 10, 50);
    sounds.shove = await cues(page);
    await page.clock.fastForward(1500);

    // 4. A turn starts on Kaya, and a round on the table.
    await play(page, [
      { type: 'roundStarted', round: 2 },
      { type: 'turnStarted', unitId: ids.kaya, round: 2 },
    ]);
    await strip(page, `${backend}-04-turn`, ids.kayaPos, 8, 80);
    sounds.turn = await cues(page);
    await page.clock.fastForward(1500);

    // 5. Status and surface: burning applied, the tile catching.
    await play(page, [
      { type: 'statusApplied', unitId: ids.foe, status: 'burning', duration: 2 },
      { type: 'surfaceChanged', pos: shoved, from: null, to: 'fire', label: 'catches fire' },
    ]);
    await strip(page, `${backend}-05-ignite`, shoved, 8, 80);
    sounds.ignite = await cues(page);
    await page.clock.fastForward(1500);

    // 6. The fight ends.
    await play(page, [{ type: 'battleEnded', outcome: 'victory' }]);
    await page.clock.fastForward(400);
    sounds.victory = await cues(page);

    writeFileSync(join(OUT, `${backend}-sounds.json`), JSON.stringify(sounds, null, 2));
    expect(errors).toEqual([]);
  });
}
