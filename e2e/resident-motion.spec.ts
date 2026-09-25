import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, pauseClock, resetStorage, startGame, waitForIdle } from './helpers';
import type { GameState } from '../src/core/types';
import type { NpcMarker } from '../src/render/view';

/**
 * Residents walk between their places (ADR 0047 §7, W8): a phase change walks
 * each person across the map instead of popping them, a walking resident
 * keeps one sprite on WebGL, the midday relief watch holds the gate, and a
 * tap on someone walking takes the party to where they are going, once they
 * are there.
 */

type Scene = {
  lastNpcs: readonly NpcMarker[];
  renderer: { backend: { unitSprites?: Map<string, { visible: boolean }> } };
};

type Marker = {
  id: string;
  pos: { x: number; y: number };
  at: { x: number; y: number };
  alpha: number;
  quiet: boolean;
};

const markers = (page: Page) =>
  page.evaluate(() =>
    (window.fnt!.app as unknown as { scene: Scene }).scene.lastNpcs.map((npc) => ({
      id: npc.id,
      pos: npc.pos,
      at: npc.renderPos ?? npc.pos,
      alpha: npc.alpha ?? 1,
      quiet: Boolean(npc.quiet),
    })),
  );

/** Sample after a fake-clock frame, including the WebGL sprite cache's visible entries. */
const residentFrame = (page: Page) =>
  page.evaluate(() => {
    const app = window.fnt!.app as unknown as {
      scene: Scene;
      residents: { moving(): boolean };
    };
    const sprites = app.scene.renderer.backend.unitSprites;
    const visible = [...(sprites?.entries() ?? [])].filter(([, sprite]) => sprite.visible);
    return {
      moving: app.residents.moving(),
      markers: app.scene.lastNpcs.map((npc) => ({
        id: npc.id,
        pos: npc.pos,
        at: npc.renderPos ?? npc.pos,
        alpha: npc.alpha ?? 1,
        quiet: Boolean(npc.quiet),
      })),
      // The coordinate key is the old contract this regression guards against.
      dorinSprites: visible.filter(([key]) => key === 'npc:lw.npc.dorin' || key === 'npc:17,6')
        .length,
      // Any tile-keyed entry, hidden or not, means the old contract is back.
      coordinateSprites: [...(sprites?.keys() ?? [])].filter((key) => /^npc:\d+,\d+$/.test(key))
        .length,
    };
  });

/** A new game's village at `phase`, the leader at `pos`, after Mira's briefing. */
async function village(page: Page, renderer: string, phase: string, pos: { x: number; y: number }) {
  await resetStorage(page, `?renderer=${renderer}`);
  await startGame(page, ['Jared'], ['kaya', 'sura'], 'resident-motion', { reduceMotion: false });
  await enterNode(page, 'village_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await waitForIdle(page);
  await page.evaluate(
    ({ phase, pos }) => {
      const app = window.fnt!.app;
      const state = app.state!;
      app.adoptSave(
        {
          ...state,
          story: { ...state.story, visited: [...state.story.visited, 'mira_intro'] },
          location: { mapId: 'ba_dan_village', pos },
          world: { ...state.world, clock: { day: 1, phase: phase as 'midday' } },
        },
        undefined,
      );
    },
    { phase, pos },
  );
  await waitForIdle(page);
  // A load on the same map keeps the camera where it was: bring the party into view.
  await page.getByRole('button', { name: 'Follow party' }).click();
}

for (const renderer of ['canvas', 'webgl'] as const) {
  test(`a phase change walks residents across the village, one sprite each (${renderer})`, async ({
    page,
  }) => {
    allowSoftwareWebgl(test, renderer);
    await village(page, renderer, 'midday', { x: 10, y: 5 });
    await expect.poll(async () => (await markers(page)).map((m) => m.id)).toContain('lw.npc.mira');
    await pauseClock(page);
    await page.evaluate(() => window.fnt!.app.dispatch({ type: 'wait', until: 'afternoon' }));
    const trail: { x: number; y: number }[] = [];
    const dorinSprites: number[] = [];
    let end: Marker[] = [];
    let coordinateSprites = 0;
    // Sixty ms steps: at 280 ms a tile an even walk moves about 0.21 tile a step.
    // Stop on the rendered settled state, rather than assuming 80 fake-clock
    // advances produced 80 animation frames in every browser.
    for (let step = 0; step < 120; step++) {
      await page.clock.runFor(60);
      const frame = await residentFrame(page);
      end = frame.markers;
      const mira = end.find((m) => m.id === 'lw.npc.mira');
      if (mira && mira.alpha === 1) trail.push(mira.at);
      if (renderer === 'webgl') {
        dorinSprites.push(frame.dorinSprites);
        coordinateSprites = Math.max(coordinateSprites, frame.coordinateSprites);
      }
      const dorin = end.find((m) => m.id === 'lw.npc.dorin');
      if (!frame.moving && !mira && dorin?.at.x === 17 && dorin.at.y === 6 && dorin.alpha === 1)
        break;
    }
    await page.clock.resume();
    // Mira was seen part-way along her walk to the river path, never jumping a tile.
    expect(new Set(trail.map((p) => `${p.x},${p.y}`)).size).toBeGreaterThan(6);
    expect(trail.some((p) => !Number.isInteger(p.x) || !Number.isInteger(p.y))).toBe(true);
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1]!;
      const b = trail[i]!;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.25);
    }
    expect(end.find((m) => m.id === 'lw.npc.mira')).toBeUndefined();
    expect(end.find((m) => m.id === 'lw.npc.dorin')).toMatchObject({
      pos: { x: 17, y: 6 },
      at: { x: 17, y: 6 },
      alpha: 1,
    });
    if (renderer === 'webgl') {
      // A resident may be absent before their entering frame, and Pixi retains
      // hidden cache entries. The invariant is one visible sprite at most while
      // moving, and exactly one identity-keyed sprite once the frame settles.
      expect(Math.max(...dorinSprites)).toBeLessThanOrEqual(1);
      expect(dorinSprites.at(-1)).toBe(1);
      expect(coordinateSprites).toBe(0);
    }
  });
}

test('the relief watch holds the gate at midday, and the party stops beside them', async ({
  page,
}) => {
  await village(page, 'canvas', 'midday', { x: 13, y: 7 });
  const watch = (await markers(page)).find((m) => m.id === 'bg.relief_watch');
  expect(watch).toMatchObject({ pos: { x: 17, y: 6 }, alpha: 1, quiet: true });
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 17, y: 6 } }));
  await waitForIdle(page);
  const after = await page.evaluate(() => {
    const state = window.fnt!.app.state!;
    return { screen: state.screen, pos: state.location.pos };
  });
  expect(after.screen).toBe('explore');
  expect(Math.max(Math.abs(after.pos.x - 17), Math.abs(after.pos.y - 6))).toBe(1);
});

test('a tap on someone walking takes the party to them once they arrive', async ({ page }) => {
  await village(page, 'canvas', 'midday', { x: 17, y: 11 });
  await pauseClock(page);
  // Let the afternoon arrive without a wait at the seat: Dorin comes up from the river.
  await page.evaluate(() => {
    const app = window.fnt!.app as unknown as { state: GameState };
    app.state = {
      ...app.state,
      world: { ...app.state.world, clock: { day: 1, phase: 'afternoon' } },
    };
  });
  let dorin: Marker | undefined;
  for (let step = 0; step < 40; step++) {
    await page.clock.runFor(60);
    const candidate = (await markers(page)).find((m) => m.id === 'lw.npc.dorin');
    if (
      candidate?.pos.x === 17 &&
      candidate.pos.y === 6 &&
      (candidate.at.x !== candidate.pos.x || candidate.at.y !== candidate.pos.y)
    ) {
      dorin = candidate;
      break;
    }
  }
  expect(dorin?.pos).toEqual({ x: 17, y: 6 });
  expect(dorin?.at).not.toEqual(dorin?.pos);
  // Tap his body where it is drawn, not the tile he is heading for.
  const point = await page.evaluate((at) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map-canvas')!;
    const camera = window.fnt!.app.rendererCamera()!;
    const m = camera.groundTransform;
    const x = (at.x + 0.5) * 64;
    const y = (at.y + 0.5) * 64;
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + m.a * x + m.c * y + m.tx,
      y: rect.top + m.b * x + m.d * y + m.ty - camera.tilePx * 0.5,
    };
  }, dorin!.at);
  const start = await page.evaluate(() => window.fnt!.app.state!.location.pos);
  await page.mouse.click(point.x, point.y);
  await page.clock.runFor(50);
  // The party sets off at once for the tile beside his post; the talk waits for him.
  const set = await page.evaluate(() => {
    const state = window.fnt!.app.state!;
    return { screen: state.screen, pos: state.location.pos };
  });
  expect(set.screen).toBe('explore');
  expect(set.pos).not.toEqual(start);
  expect(Math.max(Math.abs(set.pos.x - 17), Math.abs(set.pos.y - 6))).toBe(1);
  await expect(page.locator('.walk-feedback')).toContainText(/Next: .*Dorin/);
  // No conversation opens while he is still walking.
  let opened = false;
  for (let step = 0; step < 80 && !opened; step++) {
    await page.clock.runFor(100);
    const now = await page.evaluate(() => ({
      screen: window.fnt!.app.state!.screen,
      dorin: window.fnt!.app.residents.figures().find((f) => f.id === 'lw.npc.dorin')?.drawPos,
    }));
    opened = now.screen === 'dialogue';
    if (opened) expect(now.dorin).toEqual({ x: 17, y: 6 });
  }
  await page.clock.resume();
  expect(opened).toBe(true);
  expect(await page.evaluate(() => window.fnt!.app.state!.world.talk?.npcId)).toBe('guard_dorin');
  // The speaker is on his tile, and stays there while they talk.
  const drawn = () =>
    page.evaluate(
      () => window.fnt!.app.residents.figures().find((f) => f.id === 'lw.npc.dorin')?.drawPos,
    );
  expect(await drawn()).toEqual({ x: 17, y: 6 });
  await page.waitForTimeout(500);
  expect(await drawn()).toEqual({ x: 17, y: 6 });
});
