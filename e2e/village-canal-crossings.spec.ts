import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';
import { paintedTileCentre } from './projection';

type Cell = { x: number; y: number };

/** Run the real explore command and observe the positions handed to the animator. */
async function walkAcross(page: Page, x: number, y: number) {
  return page.evaluate(
    async ({ x, y }) => {
      const app = window.fnt!.app;
      const start = app.state!.location.pos;
      const events = app.dispatch({ type: 'walkTo', pos: { x, y } });
      const walk = events.find((event) => event.type === 'partyWalked');
      if (!walk) throw new Error(`The party did not walk from ${start.x},${start.y} to ${x},${y}`);

      const rows = app.content.maps.get('ba_dan_village')?.rows;
      if (!rows) throw new Error('Ba Dan rows are missing');
      const leader = app.state!.party[0]?.id;
      const sampled = new Set<string>();
      const wetSamples: { id: string; x: number; y: number }[] = [];
      let bridgeFrames = 0;
      let frames = 0;
      let idleFrames = 0;
      const deadline = performance.now() + 30_000;
      while (idleFrames < 3) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const now = performance.now();
        if (now > deadline) throw new Error(`The ${x},${y} crossing did not finish in 30 seconds`);
        frames++;
        for (const member of app.state!.party) {
          const pos = app.animator.renderPos(now, member.id);
          if (!pos) continue;
          sampled.add(member.id);
          const tile = { x: Math.round(pos.x), y: Math.round(pos.y) };
          if (rows[tile.y]?.[tile.x] === '~' && wetSamples.length < 8)
            wetSamples.push({ id: member.id, ...pos });
          if (member.id === leader && tile.x === x && tile.y === 12) bridgeFrames++;
        }
        idleFrames = app.animator.busy(now) ? 0 : idleFrames + 1;
      }
      return {
        from: walk.from,
        path: walk.path,
        destination: app.state!.location.pos,
        seats: app.partyPositions(),
        leader,
        frames,
        sampled: [...sampled],
        bridgeFrames,
        wetSamples,
      };
    },
    { x, y },
  );
}

test('Ba Dan rejects canal taps and walks a party over both bridge columns in both directions', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Kaya', 'Bo', 'Nilak'], ['kaya', 'bo', 'nilak'], 'canal-crossings', {
    reduceMotion: false,
  });
  await enterNode(page, 'village_explore');
  await page.locator('.explore-scene .map-canvas').waitFor();
  await settleLayout(page);
  await waitForIdle(page);

  const rows = await page.evaluate(
    () => window.fnt!.app.content.maps.get('ba_dan_village')?.rows ?? null,
  );
  if (!rows) throw new Error('Ba Dan rows are missing');
  expect(rows[12]?.[5]).toBe('~');
  // The bridge: two columns wide, two rows long, over the canal's rows 12 and 13.
  const bridge = [13, 14];
  for (const x of bridge) for (const y of [12, 13]) expect(rows[y]?.[x]).toBe('=');
  const isCanalWater = (cell: Cell) => rows[cell.y]?.[cell.x] === '~';

  // This is a canvas tap, not a direct reducer call: a visible water tile must refuse the player.
  const before = await page.evaluate(() => window.fnt!.app.state!.location.pos);
  const water = await paintedTileCentre(page, { x: 5, y: 12 });
  if (!water) throw new Error('The canvas camera did not project the canal');
  await page.mouse.click(water.x, water.y);
  await expect(page.locator('.toast').filter({ hasText: 'You cannot walk there.' })).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.state!.location.pos)).toEqual(before);

  for (const x of bridge) {
    // Four-tile crossings make the followers travel: a shorter leg can keep
    // companions in their already-dry seats near the leader.
    await page.evaluate((bridge) => {
      const app = window.fnt!.app;
      const state = app.state!;
      app.adoptSave(
        {
          ...state,
          location: { mapId: 'ba_dan_village', pos: { x: bridge, y: 11 } },
        },
        undefined,
      );
    }, x);
    await waitForIdle(page);

    for (const y of [15, 11]) {
      const result = await walkAcross(page, x, y);
      expect(result.path, `${x},${y} did not use its crossing`).toContainEqual({
        x,
        y: 12,
      });
      expect(result.path.filter(isCanalWater), `${x},${y} entered canal water`).toEqual([]);
      expect(result.destination).toEqual({ x, y });
      expect(result.seats).toHaveLength(3);
      expect(result.seats?.filter(isCanalWater), `${x},${y} seated a follower in water`).toEqual(
        [],
      );
      expect(result.frames).toBeGreaterThan(2);
      expect(result.sampled).toContain(result.leader);
      expect(result.sampled.some((id) => id !== result.leader)).toBe(true);
      expect(
        result.bridgeFrames,
        `${x},${y} never rendered the leader on the crossing`,
      ).toBeGreaterThan(0);
      expect(result.wetSamples, `${x},${y} rendered a party member in canal water`).toEqual([]);
    }
  }

  // App.adoptSave is the live load path; it must repair a pre-change save on painted water.
  const repaired = await page.evaluate(() => {
    const app = window.fnt!.app;
    const state = app.state!;
    app.adoptSave(
      { ...state, location: { mapId: 'ba_dan_village', pos: { x: 5, y: 12 } } },
      undefined,
    );
    const after = app.state!;
    const seats = app.partyPositions();
    const events = app.dispatch({ type: 'walkTo', pos: { x: 5, y: 11 } });
    return {
      loaded: after.location.pos,
      seats,
      path: events.find((event) => event.type === 'partyWalked')?.path ?? null,
      destination: app.state!.location.pos,
    };
  });
  expect(repaired.loaded).not.toEqual({ x: 5, y: 12 });
  expect(isCanalWater(repaired.loaded)).toBe(false);
  expect(repaired.seats?.filter(isCanalWater)).toEqual([]);
  expect(repaired.path).not.toBeNull();
  expect(repaired.path?.filter(isCanalWater)).toEqual([]);
  expect(repaired.destination).toEqual({ x: 5, y: 11 });
});
