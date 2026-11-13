import { expect, test, type Page } from '@playwright/test';
import { generateQuarryCheckpoints } from '../scripts/e2e/quarry-checkpoints';
import { paintedTileCentre } from './projection';
import { completeAuthoredPlayback, resetStorage, settleLayout, waitForIdle } from './helpers';

/**
 * The demo's ending (owner, 2026-11-11), on an iPad-landscape viewport in the top-down style: the
 * walk home from the Driller floor, the first step into Ba Dan, the welcome home from Mira, Gao and
 * Dorin that pays off this route's choices (the earthbender talked the gate open, Ruon escorted),
 * the demo-complete card, and "Play again with a different party" reaching party setup.
 */
test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

async function takeRoute(page: Page, label: string, mapId: string): Promise<void> {
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId)).toBe(mapId);
  await completeAuthoredPlayback(page);
}

async function nextLine(page: Page): Promise<void> {
  await page.locator('.dialogue-panel button.btn-primary').click();
}

test('the walk home ends in a welcome home and a demo-complete card', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const fixture = generateQuarryCheckpoints('escort').afterDriller;
  await resetStorage(page, '?renderer=canvas&style=topdown');
  await page.evaluate((json) => {
    window.fnt?.app.updateSettings({ reduceMotion: true });
    localStorage.setItem('fnt.save.slot1', json);
  }, fixture.json);
  await page.reload();
  await page.getByRole('button', { name: /load a save/i }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /^Load$/ })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId))
    .toBe('quarry_floor');

  await takeRoute(page, 'West → The Cutting', 'ambush_road');
  await takeRoute(page, 'West → Quarry Gate', 'quarry_gate');
  await takeRoute(page, 'West → Forest Road', 'forest_road');
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'West → Ba Dan Village', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
    .toBe('forest_return_arrival');
  await nextLine(page);
  await nextLine(page);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId))
    .toBe('ba_dan_village');
  await completeAuthoredPlayback(page);
  expect(await page.evaluate(() => window.fnt?.app.state?.screen)).toBe('explore');

  // The first step in from the east road: a tap where the street is painted.
  await settleLayout(page);
  const from = await page.evaluate(() => window.fnt!.app.state!.location.pos);
  const point = await paintedTileCentre(page, { x: Math.min(from.x - 2, 19), y: 7 });
  if (!point) throw new Error('No camera to tap through');
  await page.mouse.click(point.x, point.y);
  await waitForIdle(page);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
    .toBe('welcome_home_mira');

  const line = page.locator('.dialogue-line');
  await expect(line).toContainText('Dorin rang the gate bell');
  await nextLine(page);
  await nextLine(page);
  await nextLine(page);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
    .toBe('welcome_home_gao');
  await nextLine(page);
  // Ruon was escorted: Gao says the families can question him here.
  await expect(line).toContainText('Ruon walked down the hill beside you');
  await nextLine(page);
  await nextLine(page);
  await expect
    .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
    .toBe('welcome_home_dorin');
  // The earthbender talked the gate open on this route.
  await expect(line).toContainText('talked the quarry gate open');
  await nextLine(page);
  await nextLine(page);

  const card = page.locator('.end-panel');
  await expect(card).toContainText('Demo complete');
  await expect(card.getByRole('heading', { name: 'Home to Ba Dan' })).toBeVisible();
  await expect(card).toContainText('What lies ahead');
  await expect(card).toContainText('Across the bay');
  await expect(card.locator('.end-recap li')).toContainText([
    'Kaya, level 4',
    'Nima, level 4',
    'At the quarry gate, your earthbender talked Captain Ruon into opening it.',
    'You brought Captain Ruon home to answer to the families.',
  ]);
  await expect(card).not.toContainText('You traded Captain Ruon');
  for (const action of await card.getByRole('button').all()) {
    const box = await action.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }

  await card.getByRole('button', { name: 'Credits', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Credits');
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

  // The same table plays again: setup starts from the number of people who just finished.
  const people = await page.evaluate(() => window.fnt?.app.session.count ?? 0);
  expect(people).toBeGreaterThan(1);
  await card.getByRole('button', { name: 'Play again with a different party' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your party' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: `${people} players`, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
