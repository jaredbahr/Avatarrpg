import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

// #687: preserve Map context across a deferred cross-map walk without blocking same-map use.
test.describe.configure({ retries: 0, timeout: 60_000 });

const VILLAGE = 'ba_dan_village';
const FOREST = 'forest_road';
const EXIT = { x: 23, y: 7 };

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    const scene = (app as unknown as { scene?: { drawnMapId?: () => string | null } }).scene;
    const dialog = document.querySelector('[role="dialog"][aria-label="Local map"]');
    return {
      state: structuredClone(app.state!),
      session: app.session.toMeta(),
      drawnMapId: scene?.drawnMapId?.() ?? null,
      busy: app.boardBusy(),
      playbackRemainingMs: app.animator.finishesAt - performance.now(),
      dialogCount: document.querySelectorAll('[role="dialog"][aria-label="Local map"]').length,
      dialogMap: dialog?.querySelector('svg')?.getAttribute('aria-label') ?? null,
      dialogRoutes: [...(dialog?.querySelectorAll('[role="navigation"] button') ?? [])].map(
        (button) => button.textContent?.trim(),
      ),
      settings: { reduceMotion: app.settings.reduceMotion },
    };
  });
}

type Observation = Awaited<ReturnType<typeof snapshot>>;

function core(observation: Observation) {
  return { state: observation.state, session: observation.session };
}

async function setup(page: Page) {
  await resetStorage(page, '?renderer=canvas&style=topdown');
  await startGame(page, ['Mapper'], ['kaya'], 'local-map-exit-private', {
    reduceMotion: false,
  });
  // Supported controlled setup: skip opening narration only. No adoptSave,
  // direct state/location edits, invented map, flags, clock or ballot mutation.
  await enterNode(page, 'village_explore');
  await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
  await waitForIdle(page);
  await settleLayout(page);
  const initial = await snapshot(page);
  expect(initial.state.screen).toBe('explore');
  expect(initial.state.location.mapId).toBe(VILLAGE);
  expect(initial.drawnMapId).toBe(VILLAGE);
  expect(initial.settings.reduceMotion).toBe(false);
  const preview = apply(CONTENT, initial.state, { type: 'walkTo', pos: EXIT });
  expect(preview.state.screen).toBe('explore');
  expect(preview.state.location.mapId).toBe(FOREST);
  const walked = preview.events.find((event) => event.type === 'partyWalked');
  if (!walked || walked.type !== 'partyWalked') throw new Error('Exit has no legal walk');
  expect(walked.path.length).toBeGreaterThanOrEqual(12);
  // Keep eight real tiles of normal-motion playback for the trusted Map tap.
  const approach = walked.path[walked.path.length - 9];
  if (!approach) throw new Error('No legal approach before the exit');
  return { initial, approach };
}

async function dispatchWalk(page: Page, pos: { x: number; y: number }) {
  const before = await snapshot(page);
  const expected = apply(CONTENT, before.state, { type: 'walkTo', pos });
  expect(expected.events.some((event) => event.type === 'partyWalked')).toBe(true);
  await page.evaluate((target) => window.fnt!.app.dispatch({ type: 'walkTo', pos: target }), pos);
  const after = await snapshot(page);
  expect(core(after)).toEqual({ state: expected.state, session: before.session });
  return { before, after, expected };
}

async function tapMap(page: Page) {
  const map = page.getByRole('button', { name: 'Map', exact: true });
  await expect(map).toBeVisible();
  // HUD rendering can replace the button between separate locator reads.
  // Read one attached element's geometry atomically, then send a real touch.
  const box = await page.evaluate(() => {
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      '.explore-hud button[title="Local map and routes"]',
    );
    if (buttons.length !== 1) throw new Error('Map control is not unique');
    const element = buttons[0];
    if (!element) throw new Error('Map control has no visible target');
    const { x, y, width, height } = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (
      !element.isConnected ||
      width <= 0 ||
      height <= 0 ||
      style.visibility !== 'visible' ||
      style.display === 'none'
    )
      throw new Error('Map control has no visible target');
    return { x, y, width, height };
  });
  // Trusted touch also works if a future narrow fix disables this control
  // during map replacement; it never invokes an application handler directly.
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  return snapshot(page);
}

async function saveEvidence(testInfo: TestInfo, observations: unknown, errors: string[]) {
  await testInfo.attach('map-context-observations', {
    body: JSON.stringify({ observations, errors }, null, 2),
    contentType: 'application/json',
  });
}

test('Map does not open a source-area dialog during a real exit walk', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  const observations: Record<string, unknown> = {};
  try {
    const { initial, approach } = await setup(page);
    observations.initial = initial;
    const prepared = await dispatchWalk(page, approach);
    expect(prepared.after.state.location.mapId).toBe(VILLAGE);
    expect(prepared.after.state.location.pos).toEqual(approach);
    await waitForIdle(page);
    await settleLayout(page);
    const crossing = await dispatchWalk(page, EXIT);
    observations.crossing = crossing;
    expect(crossing.after.state.location.mapId).toBe(FOREST);
    expect(crossing.after.drawnMapId).toBe(VILLAGE);
    expect(crossing.after.busy).toBe(true);
    expect(crossing.after.playbackRemainingMs).toBeGreaterThan(1_500);
    const afterTap = await tapMap(page);
    observations.afterTap = afterTap;
    // The actual tap must land inside the deferred map-arrival window.
    expect(afterTap.drawnMapId).toBe(VILLAGE);
    expect(afterTap.busy).toBe(true);
    expect(core(afterTap)).toEqual(core(crossing.after));
    await page.screenshot({ path: testInfo.outputPath('exit-walk-after-map-tap.png') });
    await waitForIdle(page);
    await expect.poll(async () => (await snapshot(page)).drawnMapId).toBe(FOREST);
    const settled = await snapshot(page);
    observations.settled = settled;
    expect(core(settled)).toEqual(core(crossing.after));
    expect(errors).toEqual([]);
    // Intended baseline RED: a Ba Dan dialog must not open while the actual
    // campaign has already entered Forest Road. No replacement UI is prescribed.
    expect(afterTap.dialogCount).toBe(0);
    expect(settled.dialogCount).toBe(0);

    // Once the destination is drawn, the same control must work again using
    // Forest Road's real map and routes, without changing the campaign.
    await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled();
    const destinationMap = await tapMap(page);
    observations.destinationMap = destinationMap;
    expect(core(destinationMap)).toEqual(core(crossing.after));
    expect(destinationMap.drawnMapId).toBe(FOREST);
    expect(destinationMap.dialogCount).toBe(1);
    expect(destinationMap.dialogMap).toBe('The Forest Road: north-up local map');
    const dialog = page.getByRole('dialog', { name: 'Local map', exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'West → Ba Dan Village', exact: true }),
    ).toBeEnabled();
    await dialog.getByRole('button', { name: 'Close map', exact: true }).tap();
    await expect(dialog).toHaveCount(0);
    const afterClose = await snapshot(page);
    observations.afterDestinationMapClose = afterClose;
    expect(core(afterClose)).toEqual(core(crossing.after));
    expect(afterClose.drawnMapId).toBe(FOREST);
    expect(errors).toEqual([]);
  } finally {
    await saveEvidence(testInfo, observations, errors);
  }
});

test('Map stays usable during an ordinary same-area walk', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  const observations: Record<string, unknown> = {};
  try {
    const { initial, approach } = await setup(page);
    observations.initial = initial;
    const walking = await dispatchWalk(page, approach);
    observations.walking = walking;
    expect(walking.after.state.location.mapId).toBe(VILLAGE);
    expect(walking.after.state.location.pos).toEqual(approach);
    expect(walking.after.drawnMapId).toBe(VILLAGE);
    expect(walking.after.busy).toBe(true);
    expect(walking.after.playbackRemainingMs).toBeGreaterThan(1_500);
    const afterTap = await tapMap(page);
    observations.afterTap = afterTap;
    expect(afterTap.busy).toBe(true);
    expect(core(afterTap)).toEqual(core(walking.after));
    const dialog = page.getByRole('dialog', { name: 'Local map', exact: true });
    await expect(dialog).toBeVisible();
    expect(afterTap.dialogCount).toBe(1);
    expect(afterTap.dialogMap).toBe('Ba Dan Village: north-up local map');
    await expect(
      dialog.getByRole('button', { name: 'East road → Forest Road', exact: true }),
    ).toBeEnabled();
    await expect(
      dialog.getByRole('button', { name: 'River path → Riverside', exact: true }),
    ).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('same-map-walk-map-open.png') });
    await dialog.getByRole('button', { name: 'Close map', exact: true }).tap();
    await expect(dialog).toHaveCount(0);
    await waitForIdle(page);
    const settled = await snapshot(page);
    observations.settled = settled;
    expect(settled.drawnMapId).toBe(VILLAGE);
    expect(core(settled)).toEqual(core(walking.after));
    expect(errors).toEqual([]);
  } finally {
    await saveEvidence(testInfo, observations, errors);
  }
});
