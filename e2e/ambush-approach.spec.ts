import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

test('the Cutting ambush walks each drawn follower into unchanged combat spawns', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'cutting-approach', {
    reduceMotion: false,
  });
  await page.evaluate(() => {
    const app = window.fnt!.app;
    app.state = { ...app.state!, flags: { ...app.state!.flags, ruon_spared: true } };
  });
  await enterNode(page, 'cutting_explore');
  await expect(page.locator('.explore-scene')).toBeVisible();
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 7, y: 4 } }));
  await waitForIdle(page);

  const observed = await page.evaluate(async () => {
    const app = window.fnt!.app;
    app.dispatch({ type: 'walkTo', pos: { x: 8, y: 4 } });
    const from = app.partyPositions();
    const frames: { x: number; y: number }[][] = [];
    const deadline = performance.now() + 15_000;
    while (performance.now() < deadline) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const battle = app.state?.battle;
      if (!battle || !document.querySelector('.combat-scene') || app.curtainBusy) continue;
      const now = performance.now();
      const party = battle.units.filter((unit) => unit.faction === 'party');
      const moving = party.map((unit) => app.animator.renderPos(now, unit.id));
      if (frames.length === 0 && moving.every((pos) => pos === undefined)) continue;
      frames.push(party.map((unit, index) => moving[index] ?? unit.pos));
      if (frames.length > 2 && moving.every((pos) => pos === undefined)) break;
    }
    return {
      from,
      frames,
      to: app.state?.battle?.units
        .filter((unit) => unit.faction === 'party')
        .map((unit) => unit.pos),
    };
  });

  const { from, frames, to } = observed;
  expect(from).toHaveLength(3);
  expect(to).toEqual([
    { x: 1, y: 3 },
    { x: 3, y: 4 },
    { x: 1, y: 5 },
  ]);
  expect(frames.length).toBeGreaterThan(3);
  const first = frames[0];
  const last = frames.at(-1);
  if (!from || !first || !last || !to) throw new Error('Missing approach samples');
  const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  for (let index = 0; index < to.length; index++) {
    const origin = from[index];
    const destination = to[index];
    const initial = first[index];
    const final = last[index];
    if (!origin || !destination || !initial || !final) throw new Error('Incomplete party samples');
    expect(apart(initial, origin)).toBeLessThan(0.35);
    expect(apart(final, destination)).toBeLessThan(0.05);
    expect(
      frames.some((frame) => {
        const pos = frame[index];
        return pos && apart(pos, origin) > 0.3 && apart(pos, destination) > 0.3;
      }),
    ).toBe(true);
  }
});

test('reduced motion places the Cutting party at its combat spawns immediately', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya', 'Sura', 'Bo'], ['kaya', 'sura', 'bo'], 'cutting-still', {
    reduceMotion: true,
  });
  await page.evaluate(() => {
    const app = window.fnt!.app;
    app.state = { ...app.state!, flags: { ...app.state!.flags, ruon_spared: true } };
  });
  await enterNode(page, 'cutting_explore');
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 8, y: 4 } }));
  await expect(page.locator('.combat-scene')).toBeVisible();
  expect(
    await page.evaluate(() => {
      const app = window.fnt!.app;
      const party = app.state!.battle!.units.filter((unit) => unit.faction === 'party');
      return {
        positions: party.map((unit) => unit.pos),
        moving: party.some(
          (unit) => app.animator.renderPos(performance.now(), unit.id) !== undefined,
        ),
      };
    }),
  ).toEqual({
    positions: [
      { x: 1, y: 3 },
      { x: 3, y: 4 },
      { x: 1, y: 5 },
    ],
    moving: false,
  });
});
