import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

// #690: do not advertise an enabled Visit that the departing scene cannot deliver.
test.describe.configure({ retries: 0, timeout: 60_000 });

const VILLAGE = 'ba_dan_village';
const FOREST = 'forest_road';
const EXIT = { x: 23, y: 7 };
const VISIT = 'Visit Dema, road keeper';

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    const scene = (app as unknown as { scene?: { drawnMapId?: () => string | null } }).scene;
    const dialog = document.querySelector('[role="dialog"][aria-label="Look around"]');
    const look = document.querySelector<HTMLButtonElement>(
      '.explore-hud button[title="Find nearby people and places along this path"]',
    );
    return {
      state: structuredClone(app.state!),
      session: app.session.toMeta(),
      drawnMapId: scene?.drawnMapId?.() ?? null,
      busy: app.boardBusy(),
      playbackRemainingMs: app.animator.finishesAt - performance.now(),
      dialogCount: document.querySelectorAll('[role="dialog"][aria-label="Look around"]').length,
      places: [...(dialog?.querySelectorAll('button') ?? [])].map((button) => ({
        text: button.textContent?.trim(),
        disabled: button.disabled,
      })),
      look: look ? { disabled: look.disabled, connected: look.isConnected } : null,
      feedback: document.querySelector('.walk-feedback')?.textContent?.trim() ?? null,
      toasts: [...document.querySelectorAll('.toast')].map((node) => node.textContent?.trim()),
      dialogue: document.querySelector('.dialogue-panel')?.textContent?.trim() ?? null,
      settings: { reduceMotion: app.settings.reduceMotion },
      clicks: structuredClone(
        (window as unknown as { nearbyExitClicks?: unknown[] }).nearbyExitClicks ?? [],
      ),
    };
  });
}

type Observation = Awaited<ReturnType<typeof snapshot>>;

function core(observation: Observation) {
  return { state: observation.state, session: observation.session };
}

function trustedLook(observation: Observation) {
  const clicks = observation.clicks as {
    kind: string;
    trusted: boolean;
    disabled: boolean;
    drawnMapId: string;
    busy: boolean;
    playbackRemainingMs: number;
    state: Observation['state'];
    session: Observation['session'];
  }[];
  const matches = clicks.filter((click) => click.kind === 'look');
  expect(matches).toHaveLength(1);
  const delivered = matches[0];
  if (!delivered) throw new Error('Trusted Look click was not delivered');
  expect(delivered.trusted).toBe(true);
  expect(delivered.disabled).toBe(false);
  return delivered;
}

async function setup(page: Page) {
  await resetStorage(page, '?renderer=canvas&style=topdown');
  await startGame(page, ['Mapper'], ['kaya'], 'local-map-exit-private', {
    reduceMotion: false,
  });
  // Reuse #687's controlled public setup and actual legal exit route. This skips
  // opening narration only; no adoptSave, location/flags/clock/cache mutation.
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
  expect(preview.state.location.mapId).toBe(FOREST);
  const walked = preview.events.find((event) => event.type === 'partyWalked');
  if (!walked || walked.type !== 'partyWalked') throw new Error('Exit has no legal walk');
  expect(walked.path.length).toBeGreaterThanOrEqual(12);
  const approach = walked.path[walked.path.length - 9];
  if (!approach) throw new Error('No legal approach before the exit');

  // Passive capture proves which real trusted click reached an enabled Visit
  // and exactly which logical/drawn context existed before its handler ran.
  await page.evaluate(() => {
    const target = window as unknown as { nearbyExitClicks: unknown[] };
    target.nearbyExitClicks = [];
    document.addEventListener(
      'click',
      (event) => {
        const button = event.target instanceof Element ? event.target.closest('button') : null;
        if (!button) return;
        const label = button.textContent?.trim() ?? '';
        const kind =
          button.title === 'Find nearby people and places along this path'
            ? 'look'
            : label === 'Visit Dema, road keeper'
              ? 'visit'
              : null;
        if (!kind) return;
        const app = window.fnt!.app;
        const scene = (app as unknown as { scene?: { drawnMapId?: () => string | null } }).scene;
        target.nearbyExitClicks.push({
          kind,
          trusted: event.isTrusted,
          disabled: button.disabled,
          label,
          drawnMapId: scene?.drawnMapId?.() ?? null,
          busy: app.boardBusy(),
          playbackRemainingMs: app.animator.finishesAt - performance.now(),
          state: structuredClone(app.state!),
          session: app.session.toMeta(),
        });
      },
      { capture: true, passive: true },
    );
  });
  return { initial, approach };
}

async function dispatchWalk(page: Page, pos: { x: number; y: number }) {
  const before = await snapshot(page);
  const expected = apply(CONTENT, before.state, { type: 'walkTo', pos });
  expect(expected.events.some((event) => event.type === 'partyWalked')).toBe(true);
  await page.evaluate((target) => window.fnt!.app.dispatch({ type: 'walkTo', pos: target }), pos);
  // The existing scene loop publishes the busy HUD on its next real frame.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const after = await snapshot(page);
  expect(core(after)).toEqual({ state: expected.state, session: before.session });
  return { before, after, expected };
}

async function crossFromVillage(page: Page) {
  const { initial, approach } = await setup(page);
  const prepared = await dispatchWalk(page, approach);
  expect(prepared.after.state.location.mapId).toBe(VILLAGE);
  expect(prepared.after.state.location.pos).toEqual(approach);
  await waitForIdle(page);
  await settleLayout(page);
  const crossing = await dispatchWalk(page, EXIT);
  expect(crossing.after.state.location.mapId).toBe(FOREST);
  expect(crossing.after.drawnMapId).toBe(VILLAGE);
  expect(crossing.after.busy).toBe(true);
  expect(crossing.after.playbackRemainingMs).toBeGreaterThan(1_500);
  return { initial, crossing };
}

async function touch(page: Page, kind: 'look' | 'visit') {
  // One live-DOM query/geometry read avoids the replaced-HUD boundingBox race.
  // A disabled Look control is allowed: no new queue policy is prescribed.
  const target = await page.evaluate((kind) => {
    const candidates =
      kind === 'look'
        ? [
            ...document.querySelectorAll<HTMLButtonElement>(
              '.explore-hud button[title="Find nearby people and places along this path"]',
            ),
          ]
        : [
            ...document.querySelectorAll<HTMLButtonElement>(
              '[role="dialog"][aria-label="Look around"] button',
            ),
          ].filter((button) => button.textContent?.trim() === 'Visit Dema, road keeper');
    if (candidates.length !== 1) throw new Error(`${kind} control is not unique`);
    const element = candidates[0];
    if (!element) throw new Error(`${kind} control is absent`);
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (
      !element.isConnected ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      style.visibility !== 'visible' ||
      style.display === 'none'
    )
      throw new Error(`${kind} control has no visible target`);
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      disabled: element.disabled,
      label: element.textContent?.trim(),
    };
  }, kind);
  await page.touchscreen.tap(target.x, target.y);
  return { target, after: await snapshot(page) };
}

function expectedDema(before: Observation) {
  const dema = CONTENT.maps.get(FOREST)?.npcs?.find((npc) => npc.id === 'dema');
  if (!dema?.pos) throw new Error('Authored Forest Road Dema is missing');
  const expected = apply(CONTENT, before.state, { type: 'walkTo', pos: dema.pos });
  expect(expected.state.story.nodeId).toBe('forest_dema');
  return { state: expected.state, session: before.session };
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function attach(testInfo: TestInfo, observations: unknown, errors: string[]) {
  await testInfo.attach('nearby-exit-observations', {
    body: JSON.stringify({ observations, errors }, null, 2),
    contentType: 'application/json',
  });
}

test('an enabled departure Visit is honored instead of silently discarded', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  const observations: Record<string, unknown> = {};
  try {
    const { initial, crossing } = await crossFromVillage(page);
    observations.initial = initial;
    observations.crossing = crossing;
    const look = await touch(page, 'look');
    observations.look = look;
    expect(look.after.drawnMapId).toBe(VILLAGE);
    expect(look.after.busy).toBe(true);
    expect(look.after.playbackRemainingMs).toBeGreaterThan(1_500);
    expect(core(look.after)).toEqual(core(crossing.after));
    if (!look.target.disabled) {
      const delivered = trustedLook(look.after);
      expect(delivered.drawnMapId).toBe(VILLAGE);
      expect(delivered.state.location.mapId).toBe(FOREST);
      expect(delivered.busy).toBe(true);
      expect(delivered.playbackRemainingMs).toBeGreaterThan(1_500);
      expect({ state: delivered.state, session: delivered.session }).toEqual(core(crossing.after));
    }

    let promised: ReturnType<typeof expectedDema> | null = null;
    if (look.after.dialogCount === 1) {
      const dialog = page.getByRole('dialog', { name: 'Look around', exact: true });
      await expect(dialog).toBeVisible();
      const visit = dialog.getByRole('button', { name: VISIT, exact: true });
      const offered = look.after.places.some((place) => place.text === VISIT);
      if (offered && (await visit.isEnabled())) {
        await expect(visit).toBeVisible();
        const beforeVisit = await snapshot(page);
        observations.beforeVisit = beforeVisit;
        expect(beforeVisit.drawnMapId).toBe(VILLAGE);
        expect(beforeVisit.busy).toBe(true);
        expect(beforeVisit.playbackRemainingMs).toBeGreaterThan(1_500);
        promised = expectedDema(beforeVisit);
        observations.expectedVisit = promised;
        const visited = await touch(page, 'visit');
        observations.visited = visited;
        expect(visited.target.disabled).toBe(false);
        expect(visited.after.dialogCount).toBe(0);
        const clicks = visited.after.clicks as {
          kind: string;
          trusted: boolean;
          disabled: boolean;
          drawnMapId: string;
          busy: boolean;
          playbackRemainingMs: number;
          state: Observation['state'];
          session: Observation['session'];
        }[];
        const delivered = clicks.find((click) => click.kind === 'visit');
        if (!delivered) throw new Error('Trusted Visit click was not delivered');
        expect(delivered.trusted).toBe(true);
        expect(delivered.disabled).toBe(false);
        expect(delivered.drawnMapId).toBe(VILLAGE);
        expect(delivered.state.location.mapId).toBe(FOREST);
        expect(delivered.busy).toBe(true);
        expect(delivered.playbackRemainingMs).toBeGreaterThan(1_500);
        expect({ state: delivered.state, session: delivered.session }).toEqual(core(beforeVisit));
        await page.screenshot({ path: testInfo.outputPath('departure-after-visit.png') });
      } else {
        observations.refusal = 'Visit was absent or disabled; no enabled-action promise made';
        await dialog.getByRole('button', { name: 'Back to the path', exact: true }).tap();
      }
    } else {
      expect(look.after.dialogCount).toBe(0);
      observations.refusal = 'Look did not open during the replacement; no Visit promise made';
    }

    await waitForIdle(page);
    await expect.poll(async () => (await snapshot(page)).drawnMapId).toBe(FOREST);
    const settled = await snapshot(page);
    observations.settled = settled;
    expect(settled.dialogCount).toBe(0);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('departure-settled.png') });
    if (promised) {
      // Intended source-hypothesis RED: an actual enabled Visit closed its
      // dialog, so it must eventually deliver its ordinary destination action.
      // Guards/refusal before advertising an enabled action are also valid.
      await expect.poll(async () => (await snapshot(page)).state.story.nodeId).toBe('forest_dema');
      const arrived = await snapshot(page);
      observations.arrived = arrived;
      expect(core(arrived)).toEqual(promised);
      await expect(page.locator('.dialogue-panel')).toBeVisible();
    } else {
      expect(core(settled)).toEqual(core(crossing.after));
    }
    expect(errors).toEqual([]);
  } finally {
    observations.final = await snapshot(page);
    await attach(testInfo, observations, errors);
  }
});

test('the same destination Visit works through real controls after arrival', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  const observations: Record<string, unknown> = {};
  try {
    const { initial, crossing } = await crossFromVillage(page);
    observations.initial = initial;
    observations.crossing = crossing;
    await waitForIdle(page);
    await expect.poll(async () => (await snapshot(page)).drawnMapId).toBe(FOREST);
    const arrival = await snapshot(page);
    observations.arrival = arrival;
    expect(core(arrival)).toEqual(core(crossing.after));
    const look = await touch(page, 'look');
    observations.look = look;
    expect(look.target.disabled).toBe(false);
    expect(core(look.after)).toEqual(core(arrival));
    const lookClick = trustedLook(look.after);
    expect(lookClick.drawnMapId).toBe(FOREST);
    expect({ state: lookClick.state, session: lookClick.session }).toEqual(core(arrival));
    const dialog = page.getByRole('dialog', { name: 'Look around', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: VISIT, exact: true })).toBeEnabled();
    const beforeVisit = await snapshot(page);
    observations.beforeVisit = beforeVisit;
    const expected = expectedDema(beforeVisit);
    observations.expectedVisit = expected;
    const visited = await touch(page, 'visit');
    observations.visited = visited;
    expect(visited.target.disabled).toBe(false);
    expect(visited.after.dialogCount).toBe(0);
    const clicks = visited.after.clicks as {
      kind: string;
      trusted: boolean;
      drawnMapId: string;
      state: Observation['state'];
      session: Observation['session'];
    }[];
    const delivered = clicks.find((click) => click.kind === 'visit');
    if (!delivered) throw new Error('Positive-control Visit click was not delivered');
    expect(delivered.trusted).toBe(true);
    expect(delivered.drawnMapId).toBe(FOREST);
    expect({ state: delivered.state, session: delivered.session }).toEqual(core(beforeVisit));
    await waitForIdle(page);
    await expect.poll(async () => (await snapshot(page)).state.story.nodeId).toBe('forest_dema');
    const conversation = await snapshot(page);
    observations.conversation = conversation;
    expect(core(conversation)).toEqual(expected);
    await expect(page.locator('.dialogue-panel')).toBeVisible();
    await expect(page.locator('.dialogue-panel')).toContainText(
      'Mind your feet. There are ducklings under that fern.',
    );
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('arrival-visit-dema.png') });
  } finally {
    observations.final = await snapshot(page);
    await attach(testInfo, observations, errors);
  }
});

test('ordinary same-area walking keeps Look around and Back usable', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
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
    const look = await touch(page, 'look');
    observations.look = look;
    expect(look.target.disabled).toBe(false);
    expect(look.after.busy).toBe(true);
    expect(look.after.dialogCount).toBe(1);
    expect(core(look.after)).toEqual(core(walking.after));
    const delivered = trustedLook(look.after);
    expect(delivered.drawnMapId).toBe(VILLAGE);
    expect(delivered.state.location.mapId).toBe(VILLAGE);
    expect(delivered.busy).toBe(true);
    expect(delivered.playbackRemainingMs).toBeGreaterThan(1_500);
    expect({ state: delivered.state, session: delivered.session }).toEqual(core(walking.after));
    const dialog = page.getByRole('dialog', { name: 'Look around', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Walk over and see what you find.');
    await page.screenshot({ path: testInfo.outputPath('same-area-walking-look-open.png') });
    await dialog.getByRole('button', { name: 'Back to the path', exact: true }).tap();
    await expect(dialog).toHaveCount(0);
    const closed = await snapshot(page);
    observations.closed = closed;
    expect(core(closed)).toEqual(core(walking.after));
    await waitForIdle(page);
    const settled = await snapshot(page);
    observations.settled = settled;
    expect(settled.drawnMapId).toBe(VILLAGE);
    expect(core(settled)).toEqual(core(walking.after));
    expect(errors).toEqual([]);
  } finally {
    observations.final = await snapshot(page);
    await attach(testInfo, observations, errors);
  }
});
