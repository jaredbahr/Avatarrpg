import { expect, test, type Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { cachedGrid, tileAt } from '../src/core/rules/grid';
import type { Vec2 } from '../src/core/types';
import { generateQuarryCheckpoints } from '../scripts/e2e/quarry-checkpoints';
import { paintedTileCentre } from './projection';
import { completeAuthoredPlayback, resetStorage, settleLayout, waitForIdle } from './helpers';

/**
 * The walk home under `?style=topdown` (#452 item 7): from a save with `act1_complete` on the
 * Driller floor, west through the Cutting, the quarry gate and the Forest Road to Ba Dan. Every board
 * on the way draws its baked top-down scene, and on each one a tap where a tile is painted walks the
 * party there. The story stops on the road (Sen, Dema, the arrival) play through as they do in the
 * default style, which `quarry-return.spec.ts` covers in full.
 */
const FOLDERS: Readonly<Record<string, string>> = {
  quarry_floor: 'quarry-floor',
  ambush_road: 'cutting',
  quarry_gate: 'quarry-gate',
  forest_road: 'forest-road',
  ba_dan_village: 'ba-dan',
};

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function loadAfterDriller(page: Page): Promise<void> {
  const fixture = generateQuarryCheckpoints('trade').afterDriller;
  await resetStorage(page, '?renderer=canvas&style=topdown');
  await page.evaluate((json) => {
    const app = window.fnt?.app;
    if (!app) throw new Error('The game has not finished booting.');
    app.updateSettings({ reduceMotion: true, storyChoices: 'turns' });
    localStorage.setItem('fnt.save.slot1', json);
  }, fixture.json);
  await page.reload();
  await page.getByRole('button', { name: /load a save/i }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /^Load$/ })
    .click();
  expect(await page.evaluate(() => window.fnt!.app.state)).toEqual(fixture.state);
}

async function expectTopDown(page: Page, mapId: string): Promise<void> {
  await page.locator('.explore-scene .map-canvas').waitFor();
  await settleLayout(page);
  expect(await page.evaluate(() => window.fnt?.app.rendererCamera()?.projection)).toBe('topdown');
  const scene = await page.evaluate(() => {
    const map = window.fnt?.app.state?.location.mapId;
    const s = map ? window.fnt?.app.content.maps.get(map)?.scene : undefined;
    return { map, ground: s?.ground[0]?.url ?? '' };
  });
  expect(scene.map).toBe(mapId);
  expect(scene.ground.startsWith(`art/topdown/${FOLDERS[mapId]}/`), scene.ground).toBe(true);
}

/** An open neighbour of the party, off every exit, trigger and placed figure, on the same tier. */
function openNeighbour(mapId: string, from: Vec2): Vec2 {
  const map = CONTENT.maps.get(mapId);
  if (!map) throw new Error(`No map ${mapId}`);
  const grid = cachedGrid(map);
  const here = tileAt(grid, from);
  const marked = [
    ...map.npcs.flatMap((npc) => (npc.pos ? [npc.pos] : [])),
    ...[...(map.exits ?? []), ...(map.triggers ?? [])].flatMap((it) =>
      'pos' in it && it.pos ? [it.pos as Vec2] : [],
    ),
  ];
  for (const [dx, dy] of [
    [-1, 0],
    [0, 1],
    [0, -1],
    [-2, 0],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const to = { x: from.x + dx, y: from.y + dy };
    const tile = tileAt(grid, to);
    if (!tile || tile.blocked || tile.elevation !== here?.elevation) continue;
    if (marked.some((p) => p.x === to.x && p.y === to.y)) continue;
    return to;
  }
  throw new Error(`No open neighbour of ${from.x},${from.y} on ${mapId}`);
}

/** Taps the painted tile beside the party and waits for the party to stand on it. */
async function hop(page: Page, mapId: string): Promise<void> {
  const from = await page.evaluate(() => window.fnt?.app.state?.location.pos);
  if (!from) throw new Error('The party has no position.');
  const to = openNeighbour(mapId, from);
  const point = await paintedTileCentre(page, to);
  expect(point, `no camera to map ${to.x},${to.y} through`).not.toBeNull();
  if (!point) return;
  await page.mouse.click(point.x, point.y);
  await waitForIdle(page);
  await expect.poll(() => page.evaluate(() => window.fnt?.app.state?.location.pos)).toEqual(to);
}

async function continueStory(page: Page): Promise<void> {
  for (let step = 0; step < 60; step++) {
    const snapshot = await page.evaluate(() => ({
      screen: window.fnt?.app.state?.screen,
      choices: document.querySelectorAll('.choice-option:not(.is-locked)').length,
      interlude: document.querySelectorAll('.interlude-stage').length,
    }));
    if (snapshot.screen !== 'dialogue') return;
    if (snapshot.interlude) await page.getByRole('button', { name: 'Skip scene' }).click();
    else if (snapshot.choices) await page.locator('.choice-option:not(.is-locked)').first().click();
    else await page.locator('.dialogue-panel button.btn-primary').click();
  }
  throw new Error('Story did not return to exploration');
}

async function walkTo(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate((pos) => window.fnt!.app.dispatch({ type: 'walkTo', pos }), { x, y });
  await completeAuthoredPlayback(page);
}

async function takeRoute(page: Page, label: string, mapId: string): Promise<void> {
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId)).toBe(mapId);
  await completeAuthoredPlayback(page);
}

test('the walk home crosses every top-down board back to Ba Dan', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  await loadAfterDriller(page);
  expect(await page.evaluate(() => window.fnt?.app.state?.flags.act1_complete)).toBe(true);
  await expectTopDown(page, 'quarry_floor');
  await hop(page, 'quarry_floor');

  await takeRoute(page, 'West → The Cutting', 'ambush_road');
  await expectTopDown(page, 'ambush_road');
  await hop(page, 'ambush_road');
  await walkTo(page, 5, 9);
  expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('sen_home');
  await continueStory(page);

  await takeRoute(page, 'West → Quarry Gate', 'quarry_gate');
  await expectTopDown(page, 'quarry_gate');
  await hop(page, 'quarry_gate');

  await takeRoute(page, 'West → Forest Road', 'forest_road');
  await expectTopDown(page, 'forest_road');
  await hop(page, 'forest_road');
  await walkTo(page, 3, 1);
  expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('dema_home');
  await continueStory(page);

  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'West → Ba Dan Village', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
    .toBe('forest_return_arrival');
  await continueStory(page);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId))
    .toBe('ba_dan_village');
  await completeAuthoredPlayback(page);
  await expectTopDown(page, 'ba_dan_village');
  expect(await page.evaluate(() => window.fnt?.app.state?.world.cleared)).toContain('enc_grumbler');
  expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
});
