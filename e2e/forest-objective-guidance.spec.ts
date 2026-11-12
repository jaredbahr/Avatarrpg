import { expect, test, type Page } from '@playwright/test';
import { CONTENT, STORY_ENTRY } from '../src/content';
import { INTERLUDES } from '../src/content/story/interludes';
import { distance } from '../src/core/rules/grid';
import { serialize, type SessionMeta } from '../src/core/save/serialize';
import { createGame } from '../src/core/state/createGame';
import { apply } from '../src/core/state/reducer';
import { evaluate } from '../src/core/story/conditions';
import { exitCells, worldObjective } from '../src/core/story/world';
import type { Command, GameState } from '../src/core/types';
import { loadQuarryCheckpoint } from '../scripts/e2e/quarry-checkpoints';
import { returningWorkerCheckpoint } from '../scripts/e2e/returning-worker-checkpoint';
import { allowSoftwareWebgl } from './budget';
import { resetStorage, settleLayout, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

interface Fixture {
  state: GameState;
  session: SessionMeta;
  transcript: readonly Command[];
  limits: string;
}

function issue(state: GameState, command: Command): GameState {
  const result = apply(CONTENT, state, command);
  if (result.state === state)
    throw new Error(`Fixture command refused: ${JSON.stringify(command)}`);
  return result.state;
}

function finishDialogue(fixture: Fixture): Fixture {
  let { state } = fixture;
  const transcript = [...fixture.transcript];
  for (let guard = 0; state.screen === 'dialogue' && guard < 20; guard++) {
    const node = CONTENT.story.get(state.story.nodeId ?? '');
    if (!node || node.kind !== 'dialogue') throw new Error('Unexpected fixture conversation');
    const command: Command = INTERLUDES[node.id]
      ? { type: 'enterNode', nodeId: node.next }
      : { type: 'advanceDialogue' };
    state = issue(state, command);
    transcript.push(command);
  }
  if (state.screen !== 'explore') throw new Error('Fixture did not return to exploration');
  return { ...fixture, state, transcript };
}

function travel(fixture: Fixture, mapId: string): Fixture {
  const exit = CONTENT.maps
    .get(fixture.state.location.mapId)
    ?.exits?.find((candidate) => candidate.toMapId === mapId);
  if (!exit) throw new Error(`Missing fixture exit to ${mapId}`);
  const cells = [...exitCells(exit)].sort(
    (a, b) => distance(fixture.state.location.pos, a) - distance(fixture.state.location.pos, b),
  );
  const pos = cells[0];
  if (!pos) throw new Error('Exit has no authored mouth');
  const command: Command = { type: 'walkTo', pos };
  const state = issue(fixture.state, command);
  if (state.location.mapId !== mapId) throw new Error(`Fixture failed to reach ${mapId}`);
  return { ...fixture, state, transcript: [...fixture.transcript, command] };
}

function outbound(source: 'map' | 'legacy'): Fixture {
  const initial = createGame(CONTENT, {
    seed: 'forest-objective-629',
    party: [{ characterId: 'kaya' }],
    startNode: STORY_ENTRY,
  });
  const entry: Command = { type: 'enterNode', nodeId: STORY_ENTRY };
  let fixture: Fixture = {
    state: issue(initial, entry),
    session: { players: [{ name: 'Guide', unitId: 'p0' }], soloPlay: true },
    transcript: [entry],
    limits:
      'Public reducer opening/Mira/road commands; interlude entry skips presentation only. ' +
      'Serialized setup fixture, not a browser-earned campaign or physical-input acceptance.',
  };
  fixture = finishDialogue(fixture);
  const mira: Command = { type: 'walkTo', pos: { x: 11, y: 5 } };
  fixture = {
    ...fixture,
    state: issue(fixture.state, mira),
    transcript: [...fixture.transcript, mira],
  };
  fixture = travel(finishDialogue(fixture), 'forest_road');
  if (source === 'legacy') {
    const command: Command = { type: 'enterNode', nodeId: 'forest_explore' };
    fixture = {
      ...fixture,
      state: issue(fixture.state, command),
      transcript: [...fixture.transcript, command],
      limits: fixture.limits + ' Explicit supported legacy forest_explore entry.',
    };
  }
  return fixture;
}

function controls(): { name: string; fixture: Fixture; returning: boolean }[] {
  const arrival = outbound('map');
  const after: Command = { type: 'enterNode', nodeId: 'after_forest' };
  const postFight = finishDialogue({
    ...arrival,
    state: issue(arrival.state, after),
    transcript: [...arrival.transcript, after],
    limits: 'Supported post-forest story-entry fixture; no earned forest battle is claimed.',
  });
  const earned = returningWorkerCheckpoint('trade');
  const returning: Fixture = {
    state: earned.state,
    session: earned.session,
    transcript: earned.transcript,
    limits: 'Existing legally earned trade-route checkpoint through the Driller and return road.',
  };
  // Real map transitions clear the legacy node. This exercises the map's
  // returning-worker objective variant without fabricating flags or profiles.
  const mapReturn = travel(travel(returning, 'quarry_gate'), 'forest_road');
  return [
    { name: 'post-roadblock legacy node', fixture: postFight, returning: false },
    { name: 'earned return legacy node', fixture: returning, returning: true },
    { name: 'earned return map variant', fixture: mapReturn, returning: true },
  ];
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt!.app;
    if (!app.state) throw new Error('No live game state');
    return { state: app.state, session: app.session.toMeta(), camera: app.rendererCamera() };
  });
}

async function load(page: Page, renderer: string, fixture: Fixture): Promise<void> {
  const json = serialize(fixture.state, {
    label: 'Slot 1',
    summary: 'Forest objective guidance',
    savedAt: 1_700_000_000_000,
    session: fixture.session,
  });
  expect(loadQuarryCheckpoint(json)).toEqual(fixture.state);
  await page.setViewportSize({ width: 1180, height: 820 });
  await resetStorage(page, `?style=topdown&renderer=${renderer}`);
  await page.evaluate((saved) => {
    window.fnt!.app.updateSettings({ reduceMotion: true });
    localStorage.setItem('fnt.save.slot1', saved);
  }, json);
  await page.getByRole('button', { name: 'Load a save', exact: true }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: 'Load', exact: true })
    .click();
  await waitForIdle(page);
  await settleLayout(page);
  expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(renderer);
  const actual = await snapshot(page);
  expect(actual.state).toEqual(fixture.state);
  expect(actual.session).toEqual(fixture.session);
  expect(actual.camera?.projection).toBe('topdown');
}

async function readObjective(page: Page) {
  const button = page.getByRole('button', { name: /^Current objective:/ });
  await expect(button).toBeVisible();
  await expect(page.locator('.explore-dock')).toBeVisible();
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  await settleLayout(page);
  const reading = await button.evaluate((node) => {
    const text = node.querySelector('.title-plate-objective');
    const dock = document.querySelector('.explore-dock');
    if (!text || !dock) throw new Error('Missing actual objective or exploration dock');
    const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (let parent: Element | null = text; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const r = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        clip.left = Math.max(clip.left, r.left);
        clip.right = Math.min(clip.right, r.right);
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        clip.top = Math.max(clip.top, r.top);
        clip.bottom = Math.min(clip.bottom, r.bottom);
      }
    }
    const fragments = [];
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let part = walker.nextNode(); part; part = walker.nextNode()) {
      for (let index = 0; index < (part.textContent?.length ?? 0); index++) {
        const glyph = part.textContent?.[index] ?? '';
        if (/\s/.test(glyph)) continue;
        const range = document.createRange();
        range.setStart(part, index);
        range.setEnd(part, index + 1);
        fragments.push({
          glyph,
          boxes: [...range.getClientRects()].map((r) => ({
            ...box(r),
            width: r.width,
            height: r.height,
            receivesCentre: node.contains(
              document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2),
            ),
          })),
        });
      }
    }
    return {
      text: text.textContent?.trim() ?? '',
      clip,
      fragments,
      dock: box(dock.getBoundingClientRect()),
      viewport: { width: innerWidth, height: innerHeight },
      font: getComputedStyle(text).fontSize,
    };
  });
  expect(reading.fragments.length).toBeGreaterThan(0);
  expect(reading.fragments.map((f) => f.glyph).join('')).toBe(reading.text.replace(/\s/g, ''));
  // A fixed 1 CSS-pixel allowance covers fractional layout rounding only;
  // every real glyph box must remain positive and receive its centre hit.
  expect(
    reading.fragments.every(
      (f) =>
        f.boxes.length > 0 &&
        f.boxes.every(
          (r) =>
            r.width > 0 &&
            r.height > 0 &&
            r.left >= reading.clip.left - 1 &&
            r.right <= reading.clip.right + 1 &&
            r.top >= reading.clip.top - 1 &&
            r.bottom <= reading.clip.bottom + 1 &&
            r.receivesCentre,
        ),
    ),
  ).toBe(true);
  expect(reading.dock.left).toBeGreaterThanOrEqual(-1);
  expect(reading.dock.right).toBeLessThanOrEqual(reading.viewport.width + 1);
  expect(reading.dock.top).toBeGreaterThanOrEqual(-1);
  expect(reading.dock.bottom).toBeLessThanOrEqual(reading.viewport.height + 1);
  return reading;
}

async function mapControl(page: Page) {
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Local map', exact: true });
  await expect(dialog.locator('svg')).toBeVisible();
  const exit = CONTENT.maps.get('forest_road')?.exits?.find((e) => e.toMapId === 'quarry_gate');
  if (!exit) throw new Error('Missing east quarry exit');
  const eastAllowed = evaluate(before.state, exit.requires);
  const east = dialog.getByRole('button', { name: 'East → Quarry Gate', exact: true });
  if (eastAllowed) await expect(east).toBeEnabled();
  else await expect(east).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'West → Ba Dan Village', exact: true }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Close map', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await settleLayout(page);
  const after = await snapshot(page);
  expect(after).toEqual(before);
  return { before, after, eastAllowed };
}

test('the locked east route has an off-screen cue that follows the exploration camera', async ({
  page,
}) => {
  const fixture = outbound('map');
  await load(page, 'canvas', fixture);
  const exit = CONTENT.maps.get('forest_road')?.exits?.find((e) => e.toMapId === 'quarry_gate');
  if (!exit) throw new Error('Missing east quarry exit');
  expect(evaluate(fixture.state, exit.requires)).toBe(false);

  const canvas = page.locator('.map-canvas');
  const follow = page.getByRole('button', { name: 'Follow party', exact: true });
  const cue = page.getByRole('img', { name: /Quarry Gate is off screen/ });
  const readTarget = async () => {
    const box = await canvas.boundingBox();
    const target = await paintedTileCentre(page, exit.pos);
    if (!box || !target) throw new Error('Missing painted road');
    return { box, target };
  };
  const initial = await readTarget();
  await canvas.dispatchEvent('wheel', {
    clientX: initial.box.x + initial.box.width / 2,
    clientY: initial.box.y + initial.box.height / 2,
    deltaY: -500,
    bubbles: true,
    cancelable: true,
  });
  await follow.click();

  for (const width of [1_000, 820]) {
    await page.setViewportSize({ width, height: 700 });
    await settleLayout(page);
    const { box, target } = await readTarget();
    expect(target.x).toBeGreaterThan(box.x + box.width);
    await expect(cue).toBeVisible();
    await expect(cue).toHaveAccessibleName(/to the east\.$/);
    const arrow = await cue.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const rotation = new DOMMatrix(getComputedStyle(node, '::before').transform);
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        dx: rotation.a,
        dy: rotation.b,
        right: rect.right,
        top: rect.top,
      };
    });
    const minimap = await follow.boundingBox();
    if (!minimap) throw new Error('Missing follow-party map');
    expect(arrow.right).toBeLessThanOrEqual(box.x + box.width);
    expect(box.x + box.width - arrow.x).toBeLessThan(64);
    const dx = target.x - arrow.x;
    const dy = target.y - arrow.y;
    expect((dx * arrow.dx + dy * arrow.dy) / Math.hypot(dx, dy)).toBeGreaterThan(0.99);
    expect(arrow.right <= minimap.x || arrow.top >= minimap.y + minimap.height).toBe(true);
  }

  await page.getByRole('button', { name: 'Map', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Local map', exact: true });
  await expect(dialog).toBeVisible();
  await expect(cue).toBeHidden();
  await dialog.getByRole('button', { name: 'Close map', exact: true }).click();
  await expect(cue).toBeVisible();

  const { box } = await readTarget();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  for (let pan = 0; pan < 8; pan++) {
    if ((await readTarget()).target.x < box.x + box.width - 20) break;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - box.width / 3, y, { steps: 5 });
    await page.mouse.up();
    await settleLayout(page);
  }
  const visible = (await readTarget()).target;
  expect(visible.x).toBeGreaterThan(box.x);
  expect(visible.x).toBeLessThan(box.x + box.width);
  expect(visible.y).toBeGreaterThan(box.y);
  expect(visible.y).toBeLessThan(box.y + box.height);
  await expect(cue).toBeHidden();
  expect((await snapshot(page)).state).toEqual(fixture.state);
});

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const source of ['map', 'legacy'] as const) {
    test(`forest outbound ${source} objective gives a visible eastward roadblock goal: ${renderer}`, async ({
      page,
    }, info) => {
      allowSoftwareWebgl(test, renderer);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const fixture = outbound(source);
      await load(page, renderer, fixture);
      expect(fixture.state.location).toMatchObject({ mapId: 'forest_road', pos: { x: 1, y: 4 } });
      expect(fixture.state.story.nodeId).toBe(source === 'map' ? null : 'forest_explore');
      const exit = CONTENT.maps.get('forest_road')?.exits?.find((e) => e.toMapId === 'quarry_gate');
      if (!exit) throw new Error('Missing east quarry exit');
      expect(exit.pos.x).toBeGreaterThan(fixture.state.location.pos.x);
      expect(evaluate(fixture.state, exit.requires)).toBe(false);
      const before = await snapshot(page);
      const reading = await readObjective(page);
      expect(reading.text).toBe(worldObjective(CONTENT, before.state));
      expect(reading.text).toMatch(/\beast\b/i);
      expect(reading.text).toMatch(/\bquarry\b/i);
      // This independent semantic expectation is the intended original RED.
      // Keep it soft so baseline captures and real-control evidence complete.
      expect.soft(reading.text).toMatch(/\broadblock\b/i);
      const map = await mapControl(page);
      const pos = { x: 2, y: 4 };
      const point = await paintedTileCentre(page, pos);
      if (!point) throw new Error('Safe road tile has no painted projection');
      expect(
        await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.matches('.map-canvas') ?? false,
          point,
        ),
      ).toBe(true);
      const expected = apply(CONTENT, map.after.state, { type: 'walkTo', pos });
      expect(expected.state.location.pos).toEqual(pos);
      expect(expected.events.some((event) => event.type === 'partyWalked')).toBe(true);
      await page.mouse.click(point.x, point.y);
      await waitForIdle(page);
      await settleLayout(page);
      const after = await snapshot(page);
      expect(after.state).toEqual(expected.state);
      expect(after.session).toEqual(before.session);
      expect(after.state.rng).toBe(before.state.rng);
      expect(after.state.story).toEqual(before.state.story);
      expect(after.camera?.projection).toBe('topdown');
      const movedReading = await readObjective(page);
      expect(movedReading.text).toBe(reading.text);
      await info.attach('forest-objective-route-and-state', {
        body: JSON.stringify({
          renderer,
          source,
          fixture,
          reading,
          map,
          point,
          expected,
          after,
          movedReading,
        }),
        contentType: 'application/json',
      });
      await page.screenshot({ path: info.outputPath('outbound-objective.png') });
      expect(errors).toEqual([]);
    });
  }

  test(`post-roadblock and earned return objectives keep their directions: ${renderer}`, async ({
    page,
  }, info) => {
    allowSoftwareWebgl(test, renderer);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const observations = [];
    for (const { name, fixture, returning } of controls()) {
      await load(page, renderer, fixture);
      const before = await snapshot(page);
      const reading = await readObjective(page);
      expect(reading.text).toBe(worldObjective(CONTENT, fixture.state));
      if (returning) {
        expect(fixture.state.flags.act1_complete).toBe(true);
        expect(reading.text).toMatch(/\breturning\b/i);
        expect(reading.text).toMatch(/\bwest\b/i);
        expect(reading.text).toMatch(/Ba Dan/);
      } else {
        expect(fixture.state.story.visited).toContain('after_forest');
        expect(reading.text).toMatch(/\bopen\b/i);
        expect(reading.text).toMatch(/\beast\b/i);
        expect(reading.text).toMatch(/\bquarry\b/i);
      }
      const map = await mapControl(page);
      expect(map.after.state).toEqual(before.state);
      expect(map.after.session).toEqual(before.session);
      observations.push({ name, fixture, before, reading, map });
      await page.screenshot({ path: info.outputPath(`${name.replaceAll(' ', '-')}.png`) });
    }
    await info.attach('forest-objective-direction-controls', {
      body: JSON.stringify({ renderer, observations }),
      contentType: 'application/json',
    });
    expect(errors).toEqual([]);
  });
}
