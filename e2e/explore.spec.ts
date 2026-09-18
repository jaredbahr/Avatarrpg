import { paintedTileCentre as tileCentre } from './projection';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

/**
 * The village, on both backends.
 *
 * The rules keep one position for the party; the scene draws all of them.
 * These check that what is drawn agrees with the rules after a walk (the
 * leader on the rules' tile, each follower a tile further back along the
 * route), that the roster tells the truth about the party, and that Talk
 * and the gate both go where the story says.
 */
const PARTY = ['kaya', 'bo', 'nilak'];
const PLAYERS = ['Elias', 'Lorelai', 'Frehley'];

/** Stands the party on `pos` without walking, as a loaded save would. */
async function standAt(page: Page, pos: { x: number; y: number }) {
  await page.evaluate((pos) => {
    const app = window.fnt?.app;
    const state = app?.state;
    if (!app || !state) return;
    app.state = { ...state, location: { ...state.location, pos } };
    app.resync();
  }, pos);
}

test.describe('the village', () => {
  for (const renderer of ['canvas', 'webgl'] as const) {
    test(`the party walks together on ${renderer}`, async ({ page, browserName }) => {
      test.setTimeout(120_000);
      if (renderer === 'webgl' && browserName === 'webkit') test.slow();

      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));

      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, PLAYERS, PARTY, 'explore-spec', { reduceMotion: false });
      await enterNode(page, 'village_explore');
      await page.locator('.explore-scene .map-canvas').waitFor();
      await settleLayout(page);

      // The roster lists everyone with their health; the leader's row is plated.
      const rows = page.locator('.roster .roster-row');
      await expect(rows).toHaveCount(PARTY.length);
      await expect(rows.first()).toHaveClass(/active/);
      await expect(rows.first().locator('.bar-label')).toHaveText(/^\d+ \/ \d+$/);

      // Before anyone moves, the followers stand in a line behind the leader.
      const start = await page.evaluate(() => {
        const app = window.fnt?.app;
        return { pos: app?.state?.location.pos ?? null, drawn: app?.partyPositions() ?? null };
      });
      expect(start.pos).not.toBeNull();
      expect(start.drawn?.[0]).toEqual(start.pos);
      expect(new Set((start.drawn ?? []).map((p) => `${p.x},${p.y}`)).size).toBe(PARTY.length);
      if (!start.pos) return;

      // Four tiles east along the road, tapped where the tile is painted.
      const to = { x: start.pos.x + 4, y: start.pos.y };
      const point = await tileCentre(page, to);
      expect(point, 'no camera to map the tile through').not.toBeNull();
      if (!point) return;
      await page.mouse.click(point.x, point.y);
      // Whether the walk *plays* is the animation spec's to prove, inside one
      // evaluate with the dispatch: on CI's software WebGL a frame can take
      // over a second, so a read after the click may find the walk finished.
      await waitForIdle(page);

      // The rules moved the party; the drawing agrees, a tile apart along the route.
      const after = await page.evaluate(() => {
        const app = window.fnt?.app;
        return { pos: app?.state?.location.pos ?? null, drawn: app?.partyPositions() ?? null };
      });
      expect(after.pos).toEqual(to);
      expect(after.drawn).toEqual(PARTY.map((_, i) => ({ x: to.x - i, y: to.y })));
      expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
    });
  }

  test('Talk walks up to the nearest villager and opens their conversation', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'explore-talk');
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();

    // Nobody is within reach of the spawn, and the button says so.
    const talk = page.getByRole('button', { name: /^Talk/ });
    await expect(talk).toBeDisabled();

    // On the road two tiles below the elder, and further from everyone else,
    // Talk lights up with her name; tapping it walks the party to her side
    // and starts her node.
    await standAt(page, { x: 11, y: 7 });
    await expect(talk).toBeEnabled();
    await expect(talk).toContainText('Elder Mira');
    await talk.click();
    await expect
      .poll(async () => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
      .toBe('mira_intro');
    await expect
      .poll(async () => page.evaluate(() => window.fnt?.app.state?.location.pos.y))
      .toBe(6);
  });

  test('the gate names the road and leads to it', async ({ page }) => {
    await resetStorage(page);
    await startGame(page, ['Elias'], ['kaya'], 'explore-gate');
    await enterNode(page, 'village_explore');
    await page.locator('.explore-scene .map-canvas').waitFor();

    const objective = page.locator('.explore-bar .title-plate-objective');
    await expect(objective).toContainText('Talk to Elder Mira');

    // Beside the gate the banner reads its label instead of the objective.
    await standAt(page, { x: 22, y: 7 });
    await expect(objective).toHaveText('East road → Forest Road');

    await page.evaluate(() => {
      window.fnt?.app.dispatch({ type: 'walkTo', pos: { x: 23, y: 7 } });
    });
    await expect
      .poll(async () => page.evaluate(() => window.fnt?.app.state?.location.mapId))
      .toBe('forest_road');
  });
});
