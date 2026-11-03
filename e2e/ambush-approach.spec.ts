import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

for (const scenario of [
  { name: 'Cutting', exploreNode: 'cutting_explore', mapId: 'ambush_road' },
  { name: 'Forest Road', exploreNode: 'forest_explore', mapId: 'forest_road' },
] as const) {
  test(`${scenario.name} crossing walks each drawn follower into unchanged combat spawns`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await resetStorage(page, '?renderer=canvas');
    await startGame(
      page,
      ['Kaya', 'Sura', 'Bo'],
      ['kaya', 'sura', 'bo'],
      `${scenario.mapId}-approach`,
      {
        reduceMotion: false,
      },
    );
    await page.evaluate(() => {
      const app = window.fnt!.app;
      app.state = { ...app.state!, flags: { ...app.state!.flags, ruon_spared: true } };
    });
    await enterNode(page, scenario.exploreNode);
    if (scenario.mapId === 'forest_road') {
      await page.evaluate(() => {
        const app = window.fnt!.app;
        app.state = {
          ...app.state!,
          location: { mapId: 'forest_road', pos: { x: 6, y: 4 } },
          story: {
            ...app.state!.story,
            visited: [...app.state!.story.visited, 'road_depart'],
          },
        };
        app.resync();
      });
    }
    await expect(page.locator('.explore-scene')).toBeVisible();
    await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 7, y: 4 } }));
    await waitForIdle(page);

    const observed = await page.evaluate(async (mapId) => {
      const app = window.fnt!.app;
      const before = app.partyPositions();
      const originalConsume = app.consumeCombatApproach.bind(app);
      let consumed: readonly { x: number; y: number }[] | null = null;
      const originalPush = app.animator.push.bind(app.animator);
      const approachPaths: {
        unitId: string;
        from: { x: number; y: number };
        path: readonly { x: number; y: number }[];
      }[] = [];
      app.animator.push = (now, events, unitsBefore, options) => {
        if (
          consumed &&
          app.state?.screen === 'combat' &&
          options?.alongside &&
          options.silentSteps
        ) {
          for (const event of events) {
            if (event.type === 'partyWalked')
              approachPaths.push({ unitId: event.unitId, from: event.from, path: event.path });
          }
        }
        return originalPush(now, events, unitsBefore, options);
      };
      app.consumeCombatApproach = (mapId) => {
        const positions = originalConsume(mapId);
        if (positions) consumed = positions;
        return positions;
      };
      app.dispatch({ type: 'walkTo', pos: { x: 8, y: 4 } });
      const from = app.partyPositions();
      let lastExplore: { x: number; y: number }[] | null = null;
      const frames: { x: number; y: number }[][] = [];
      const fadeFrames: { x: number; y: number }[][] = [];
      let sawWalk = false;
      const deadline = performance.now() + 15_000;
      while (performance.now() < deadline) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const now = performance.now();
        if (document.querySelector('.explore-scene')) {
          const seats = app.partyPositions();
          if (seats)
            lastExplore = app.state!.party.map(
              (member, index) =>
                app.animator.renderPos(now, member.id) ?? seats[index] ?? app.state!.location.pos,
            );
        }
        const battle = app.state?.battle;
        if (!battle || !document.querySelector('.combat-scene')) continue;
        const curtain = document.querySelector<HTMLElement>('.curtain');
        if (curtain && Number(getComputedStyle(curtain).opacity) >= 1) continue;
        const party = battle.units.filter((unit) => unit.faction === 'party');
        const moving = party.map((unit) => app.animator.renderPos(now, unit.id));
        const drawn = app.partyPositions();
        if (!drawn) continue;
        frames.push([...drawn]);
        if (app.curtainBusy) fadeFrames.push([...drawn]);
        if (moving.some((pos) => pos !== undefined)) sawWalk = true;
        if (sawWalk && !app.curtainBusy && moving.every((pos) => pos === undefined)) break;
      }
      return {
        before,
        from,
        lastExplore,
        consumed,
        consumedAgain: app.consumeCombatApproach(mapId),
        frames,
        fadeFrames,
        approachPaths,
        sawWalk,
        grid: app.state?.battle?.grid,
        to: app.state?.battle?.units
          .filter((unit) => unit.faction === 'party')
          .map((unit) => unit.pos),
      };
    }, scenario.mapId);

    const {
      before,
      from,
      lastExplore,
      consumed,
      consumedAgain,
      frames,
      fadeFrames,
      approachPaths,
      sawWalk,
      grid,
      to,
    } = observed;
    expect(before).toHaveLength(3);
    expect(from).toHaveLength(3);
    expect(lastExplore).toHaveLength(3);
    expect(consumed).toEqual(from);
    expect(consumedAgain).toBeNull();
    expect(fadeFrames.length).toBeGreaterThan(0);
    expect(sawWalk).toBe(true);
    expect(to).toEqual([
      { x: 1, y: 3 },
      { x: 3, y: 4 },
      { x: 1, y: 5 },
    ]);
    expect(frames.length).toBeGreaterThan(3);
    expect(approachPaths).toHaveLength(3);
    expect(new Set(approachPaths.map(({ unitId }) => unitId)).size).toBe(3);
    expect(grid).toBeDefined();
    if (!grid) throw new Error('Missing approach grid');
    for (const [index, { from: start, path }] of approachPaths.entries()) {
      expect(path.length).toBeGreaterThan(1);
      expect(path.at(-1)).toEqual(to?.[index]);
      let previous = start;
      for (const step of path) {
        expect(Math.max(Math.abs(step.x - previous.x), Math.abs(step.y - previous.y))).toBe(1);
        expect(grid.tiles[step.y * grid.width + step.x]?.blocked).toBe(false);
        previous = step;
      }
    }
    const first = frames[0];
    const last = frames.at(-1);
    if (!before || !from || !lastExplore || !first || !last || !to)
      throw new Error('Missing approach samples');
    const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    for (let index = 0; index < to.length; index++) {
      const origin = from[index];
      const oldSeat = before[index];
      const exploreSeat = lastExplore[index];
      const destination = to[index];
      const initial = first[index];
      const final = last[index];
      if (!origin || !oldSeat || !exploreSeat || !destination || !initial || !final)
        throw new Error('Incomplete party samples');
      expect(apart(origin, oldSeat)).toBeLessThanOrEqual(2);
      expect(apart(exploreSeat, origin)).toBeLessThan(0.35);
      expect(apart(initial, origin)).toBeLessThan(0.35);
      for (const fade of fadeFrames) {
        const fadingPos = fade[index];
        if (!fadingPos) throw new Error('Incomplete fade sample');
        expect(apart(fadingPos, origin)).toBeLessThan(0.35);
      }
      for (let frameIndex = 1; frameIndex < frames.length; frameIndex++) {
        const previous = frames[frameIndex - 1]?.[index];
        const current = frames[frameIndex]?.[index];
        if (!previous || !current) throw new Error('Incomplete frame sample');
        expect(apart(previous, current)).toBeLessThan(1.5);
      }
      expect(apart(final, destination)).toBeLessThan(0.05);
      expect(
        frames.some((frame) => {
          const pos = frame[index];
          return pos && apart(pos, origin) > 0.3 && apart(pos, destination) > 0.3;
        }),
      ).toBe(true);
    }
  });
}

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
