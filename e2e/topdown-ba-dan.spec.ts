import { expect, test } from '@playwright/test';
import { paintedTileCentre } from './projection';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

/**
 * Ba Dan under `?style=topdown` (ADR 0104, T3) on Canvas 2D: the baked top-down scene loads, a tap
 * where a tile is painted walks the party to that tile (the camera's pick and its paint agree), and
 * the walk east along the road leaves by the east exit for the Forest Road.
 */
test('the top-down village walks from the spawn out of the east exit', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await resetStorage(page, '?renderer=canvas&style=topdown');
  await startGame(page, ['Elias'], ['kaya'], 'topdown-ba-dan', { reduceMotion: false });
  await enterNode(page, 'village_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await settleLayout(page);

  // The top-down board: 40 px tiles, nothing raised.
  const camera = await page.evaluate(() => window.fnt?.app.rendererCamera());
  expect(camera?.projection).toBe('topdown');
  expect(camera?.tile).toBe(40);
  const spawn = await page.evaluate(() => window.fnt?.app.state?.location.pos ?? null);
  expect(spawn).not.toBeNull();

  // East along the road in short hops, each tapped where its tile is painted: the pick of that
  // point is the tile, so the rules stand the party on it.
  // At the top-down zoom about ten tiles fit across, so each hop stays on screen; the camera
  // follows the walk (with full motion: a reduced-motion walk lands at once and does not pan).
  for (const to of [
    { x: 5, y: 7 },
    { x: 8, y: 8 },
    { x: 11, y: 7 },
    { x: 14, y: 8 },
    { x: 17, y: 7 },
    { x: 20, y: 8 },
    { x: 22, y: 7 },
  ]) {
    const point = await paintedTileCentre(page, to);
    expect(point, 'no camera to map the tile through').not.toBeNull();
    if (!point) return;
    await page.mouse.click(point.x, point.y);
    await waitForIdle(page);
    await expect
      .poll(async () => page.evaluate(() => window.fnt?.app.state?.location.pos))
      .toEqual(to);
  }

  // The east exit's mouth, one more tile on, leads to the Forest Road.
  const gate = await paintedTileCentre(page, { x: 23, y: 7 });
  expect(gate).not.toBeNull();
  if (!gate) return;
  await page.mouse.click(gate.x, gate.y);
  await expect
    .poll(async () => page.evaluate(() => window.fnt?.app.state?.location.mapId))
    .toBe('forest_road');
  expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
});

/**
 * Bending practice on the canal bank (issue #284), on the top-down village. Walking onto the
 * practice ground offers Practice as soon as the walk has played out (no art left to wait for since
 * the G1 bends retired), and pressing it plays one cast each for Kaya, Sura and Bo, in party order,
 * thrown at the mark through the combat choreography, without touching the game state.
 */
test('the Ba Dan practice ground is ready on arrival and all three benders cast', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'topdown-practice', {
    reduceMotion: false,
  });
  await enterNode(page, 'village_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await settleLayout(page);
  expect(await page.evaluate(() => window.fnt?.app.rendererCamera()?.projection)).toBe('topdown');

  const practice = page.getByRole('button', { name: /^Practice/ });
  // The practice ground's anchor (`BA_DAN_PRACTICE`): the canal bank south-east of the bridge.
  const anchor = { x: 10, y: 8 };
  // The mark every bend is thrown at, on the canal's near edge.
  const mark = { x: 6, y: 7 };
  for (const to of [{ x: 5, y: 7 }, { x: 8, y: 8 }, anchor]) {
    // Not offered on the way there.
    await expect(practice).toHaveCount(0);
    const point = await paintedTileCentre(page, to);
    expect(point, 'no camera to map the tile through').not.toBeNull();
    if (!point) return;
    await page.mouse.click(point.x, point.y);
    await expect
      .poll(async () => page.evaluate(() => window.fnt?.app.state?.location.pos))
      .toEqual(to);
    await waitForIdle(page);
  }

  // Ready the moment the walk has played out: offered and enabled without a further wait.
  await expect(practice).toBeEnabled({ timeout: 1_000 });

  const before = await page.evaluate(() => JSON.stringify(window.fnt?.app.state));
  const party = await page.evaluate(
    () => window.fnt?.app.state?.party.map((m) => ({ id: m.id, who: m.characterId })) ?? [],
  );
  expect(party.map((m) => m.who)).toEqual(['kaya', 'sura', 'bo']);

  // Watch what the scene draws from, every frame: who is in a cast pose, in what order.
  await page.evaluate(
    (ids) => {
      const app = window.fnt?.app;
      if (!app) throw new Error('No app.');
      const seen: string[] = [];
      (window as unknown as { __practiceCasts: string[] }).__practiceCasts = seen;
      let started = false;
      const sample = () => {
        const now = performance.now();
        for (const id of ids) {
          const clip = app.animator.unitPose(now, id)?.clip ?? '';
          if (clip.startsWith('cast') && seen.at(-1) !== id) seen.push(id);
        }
        const busy = app.animator.busy(now);
        started ||= busy;
        if (busy || !started) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    party.map((m) => m.id),
  );

  await practice.click();
  // While the party bends, the action stays put and disabled.
  await expect(page.getByText('Bending practice')).toBeVisible();
  await expect(practice).toBeDisabled();

  // One cast each, and every bend is thrown at the mark.
  const plan = await page.evaluate((mark) => {
    const tracks = (
      window.fnt?.app.animator as unknown as {
        timeline: {
          tracks: { kind: string; unitId?: string; clip?: string; to?: { x: number; y: number } }[];
        };
      }
    ).timeline.tracks;
    return {
      casters: [
        ...new Set(
          tracks
            .filter((t) => t.kind === 'pose' && t.clip?.startsWith('cast'))
            .map((t) => t.unitId),
        ),
      ],
      atMark: tracks.filter(
        (t) =>
          (t.kind === 'emitter' || t.kind === 'shot') &&
          t.to?.x === mark.x + 0.5 &&
          t.to?.y === mark.y + 0.5,
      ).length,
    };
  }, mark);
  expect(plan.casters).toEqual(party.map((m) => m.id));
  expect(plan.atMark).toBeGreaterThanOrEqual(3);

  await waitForIdle(page, 30_000);
  // All three were drawn casting, one after another in party order.
  expect(
    await page.evaluate(() => (window as unknown as { __practiceCasts: string[] }).__practiceCasts),
  ).toEqual(party.map((m) => m.id));
  // Presentation only: nothing in the game changed, and the ground is offered again.
  expect(await page.evaluate(() => JSON.stringify(window.fnt?.app.state))).toBe(before);
  await expect(practice).toBeEnabled();
  await expect(page.getByText('Bending practice')).toHaveCount(0);
  expect(errors).toEqual([]);
});
