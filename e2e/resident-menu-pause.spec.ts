import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { enterNode, pauseClock, resetStorage, startGame, waitForIdle } from './helpers';
import type { DayPhase, Vec2 } from '../src/core/types';
import type { MapView, NpcMarker } from '../src/render/view';

/** ADR 0047 §7: actual menus hold a resident mid-stride on its presentation clock. */
const HOLD_MS = 2_000;
const LIVE_STEP_MS = 100;
const RESUME_STEP_MS = 32;

const fixtures = [
  {
    name: 'Gao morning errand',
    id: 'lw.npc.gao',
    phase: 'morning',
    party: { x: 13, y: 7 },
  },
  {
    name: 'Mira midday-to-afternoon placement walk',
    id: 'lw.npc.mira',
    phase: 'midday',
    party: { x: 10, y: 5 },
  },
] as const;

type Fixture = (typeof fixtures)[number];

/** Read the full figure and the marker actually submitted by the scene. */
const sample = (page: Page, id: string) =>
  page.evaluate((residentId) => {
    const app = window.fnt!.app;
    const residents = app.residents as unknown as { clock: number };
    const scene = (
      app as unknown as {
        scene: {
          lastNpcs: readonly NpcMarker[];
          renderer: { lastView: MapView | null };
        };
      }
    ).scene;
    return {
      // Browser time deliberately stays outside the equality snapshot: frames
      // must keep rendering during the hold while the resident clock stands still.
      now: performance.now(),
      renderedAt: scene.renderer.lastView?.time,
      frozen: {
        clock: residents.clock,
        figure: app.residents.figures().find((figure) => figure.id === residentId),
        marker: scene.lastNpcs.find((marker) => marker.id === residentId),
        submitted: scene.renderer.lastView?.npcs.find((marker) => marker.id === residentId),
        game: app.state,
        session: app.session.toMeta(),
        camera: app.rendererCamera(),
      },
    };
  }, id);

type Sample = Awaited<ReturnType<typeof sample>>;

async function capture(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
  // Retain the actual rendered map as well: the dialog can obscure its resident.
  const canvas = await page
    .locator('.explore-scene .map-canvas')
    .evaluate((element) => (element as HTMLCanvasElement).toDataURL('image/png'));
  await info.attach(`${name}-canvas`, {
    body: Buffer.from(canvas.slice(canvas.indexOf(',') + 1), 'base64'),
    contentType: 'image/png',
  });
}

function expectSubmittedWalk(frame: Sample) {
  const { figure, marker, submitted } = frame.frozen;
  expect(figure, 'the selected resident must be present').toBeDefined();
  expect(figure?.walking).toBe(true);
  expect(figure?.alpha).toBe(1);
  expect(marker, 'the scene must submit the walking resident to the renderer').toBeDefined();
  expect(marker?.renderPos).toEqual(figure?.drawPos);
  expect(marker?.clipTime).toBe(figure?.clipTime);
  expect(marker?.walking).toBe(true);
  expect(marker?.alpha).toBe(1);
  expect(submitted, "the renderer must receive this frame's resident marker").toEqual(marker);
}

/** A paused no-op cannot satisfy either clock or submitted-position progression. */
function expectContinuousProgress(before: Sample, after: Sample, browserStepMs: number) {
  expectSubmittedWalk(before);
  expectSubmittedWalk(after);
  const clockAdvance = after.frozen.clock - before.frozen.clock;
  expect(clockAdvance).toBeGreaterThan(0);
  expect(after.now - before.now).toBe(browserStepMs);
  expect(before.renderedAt).toBeDefined();
  expect(after.renderedAt).toBeDefined();
  // Samples may fall between rAFs: 100 browser ms can include 112 ms between
  // the surrounding submitted frames. Match the actual rendered interval,
  // rather than adding tolerance to the requested step or allowing catch-up.
  expect(clockAdvance).toBeCloseTo(after.renderedAt! - before.renderedAt!, 6);
  const from = before.frozen.marker!.renderPos!;
  const to = after.frozen.marker!.renderPos!;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  expect(distance, 'resumption must make visible progress').toBeGreaterThan(0);
  expect(distance, 'resumption must continue the stride without a catch-up jump').toBeLessThan(
    0.25,
  );
  expect(after.frozen.figure?.clipTime).not.toBe(before.frozen.figure?.clipTime);
  expect(after.frozen.game).toEqual(before.frozen.game);
  expect(after.frozen.session).toEqual(before.frozen.session);
  expect(after.frozen.camera).toEqual(before.frozen.camera);
}

/** Adopt only fixture state; every observed resident advance comes from rendered frames. */
async function village(page: Page, phase: DayPhase, pos: Vec2) {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Resident menu'], ['kaya', 'sura'], 'resident-menu-pause', {
    reduceMotion: false,
  });
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
          world: { ...state.world, clock: { day: 1, phase } },
        },
        undefined,
      );
    },
    { phase, pos },
  );
  await waitForIdle(page);
  await page.getByRole('button', { name: 'Follow party', exact: true }).click();
}

async function activeWalk(page: Page, fixture: Fixture): Promise<Sample> {
  if (fixture.phase === 'midday') {
    // The native fixture's legal wait spot; the actual reducer starts the new placements.
    await page.evaluate(() => window.fnt!.app.dispatch({ type: 'wait', until: 'afternoon' }));
    expect(await page.evaluate(() => window.fnt!.app.state!.world.clock?.phase)).toBe('afternoon');
  } else {
    // Include the shop's initial hold in real rendered browser time. Do not
    // directly tick residents or fast-forward past the leg being asserted.
    await page.clock.runFor(6_400);
  }
  let frame = await sample(page, fixture.id);
  for (let step = 0; step < 100; step++) {
    const figure = frame.frozen.figure;
    if (
      figure?.walking &&
      figure.alpha === 1 &&
      (!Number.isInteger(figure.drawPos.x) || !Number.isInteger(figure.drawPos.y))
    ) {
      expectSubmittedWalk(frame);
      return frame;
    }
    await page.clock.runFor(LIVE_STEP_MS);
    frame = await sample(page, fixture.id);
  }
  throw new Error(`${fixture.name} never reached a rendered, fully visible mid-stride frame`);
}

for (const menu of ['Pause', 'Travel journal'] as const) {
  for (const fixture of fixtures) {
    test(`${menu} freezes and continuously resumes ${fixture.name}`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const evidence: Record<string, Sample> = {};
      let holdFrames = 0;
      await village(page, fixture.phase, fixture.party);
      await pauseClock(page);
      try {
        const active = await activeWalk(page, fixture);
        evidence.active = active;
        await page.clock.runFor(LIVE_STEP_MS);
        const before = await sample(page, fixture.id);
        evidence.beforeMenu = before;
        expectContinuousProgress(active, before, LIVE_STEP_MS);

        // Actual-menu hold boundary (#546): external negative-control insertion point.
        // Pause is genuinely keyboard activated. Journal is genuinely pointer
        // activated. The browser clock being paused does not stop DOM controls.
        const opener = page.getByRole('button', { name: menu, exact: true });
        if (menu === 'Pause') {
          await opener.focus();
          await page.keyboard.press('Enter');
        } else {
          await opener.click();
        }
        const dialog = page.getByRole('dialog', {
          name: menu === 'Pause' ? 'Paused' : 'Travel journal',
          exact: true,
        });
        await expect(dialog).toHaveCount(1);
        await page.clock.runFor(RESUME_STEP_MS);
        const held = await sample(page, fixture.id);
        evidence.held = held;
        expectSubmittedWalk(held);
        expect(held.frozen).toEqual(before.frozen);

        // Independently witness browser rAF callbacks during this runFor window.
        // This observes frame scheduling; lastNpcs above/below observes what the
        // game submitted. No production method or clock is replaced.
        [holdFrames] = await Promise.all([
          page.evaluate(
            (duration) =>
              new Promise<number>((resolve) => {
                let frames = 0;
                let request = 0;
                const count = () => {
                  frames++;
                  request = requestAnimationFrame(count);
                };
                request = requestAnimationFrame(count);
                setTimeout(() => {
                  cancelAnimationFrame(request);
                  resolve(frames);
                }, duration);
              }),
            HOLD_MS,
          ),
          page.clock.runFor(HOLD_MS),
        ]);
        const afterHold = await sample(page, fixture.id);
        evidence.afterHold = afterHold;
        expect(holdFrames, 'browser frames must continue while the menu is open').toBeGreaterThan(
          1,
        );
        expect(afterHold.now - held.now).toBeGreaterThanOrEqual(HOLD_MS);
        expect(held.renderedAt, 'the scene must have rendered before the hold').toBeDefined();
        expect(
          afterHold.renderedAt!,
          'the game must submit new frames under the menu',
        ).toBeGreaterThan(held.renderedAt!);
        expect(afterHold.frozen).toEqual(held.frozen);
        await expect(dialog).toHaveCount(1);
        await capture(page, info, 'held');

        if (menu === 'Pause') await page.keyboard.press('Escape');
        else await dialog.getByRole('button', { name: 'Return to the path', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.clock.runFor(RESUME_STEP_MS);
        const resumed = await sample(page, fixture.id);
        evidence.resumed = resumed;
        expectContinuousProgress(afterHold, resumed, RESUME_STEP_MS);
        await page.clock.runFor(LIVE_STEP_MS);
        const continued = await sample(page, fixture.id);
        evidence.continued = continued;
        expectContinuousProgress(resumed, continued, LIVE_STEP_MS);
        await capture(page, info, 'resumed');
        expect(errors).toEqual([]);
      } finally {
        await info.attach('resident-menu-samples', {
          body: JSON.stringify(
            { menu, fixture, holdMs: HOLD_MS, holdFrames, errors, evidence },
            null,
            2,
          ),
          contentType: 'application/json',
        });
        await page.clock.resume();
      }
    });
  }
}
