import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

// Read the positions actually handed to the renderer throughout a real walk,
// including scheduled waits and gathering, rather than only checking final seats.
test('five people keep their spacing through courtyard turns and arrive on dry ground', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    ['Nima', 'Kaya', 'Sura', 'Bo', 'Wen'],
    ['nima', 'kaya', 'sura', 'bo', 'wen'],
    'courtyard-spacing',
    { reduceMotion: false },
  );
  await enterNode(page, 'village_explore');
  await page.waitForTimeout(100);
  await waitForIdle(page);
  const report = [];
  for (const destination of [
    { x: 16, y: 10 },
    { x: 17, y: 8 },
    { x: 15, y: 8 },
    { x: 12, y: 11 },
    { x: 16, y: 10 },
  ]) {
    const leg = await page.evaluate(async (pos) => {
      const app = window.fnt!.app;
      const start = performance.now();
      const events = app.dispatch({ type: 'walkTo', pos });
      if (!events.some((event) => event.type === 'partyWalked'))
        throw new Error('Route did not walk');
      let minimum = Infinity;
      let samples = 0;
      let idleFrames = 0;
      while (idleFrames < 3) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const now = performance.now();
        const seats = app.partyPositions() ?? [];
        const drawn = app.state!.party.map(
          (member, index) => app.animator.renderPos(now, member.id) ?? seats[index],
        );
        for (let i = 0; i < drawn.length; i++)
          for (let j = i + 1; j < drawn.length; j++) {
            const a = drawn[i],
              b = drawn[j];
            if (a && b) minimum = Math.min(minimum, Math.hypot(a.x - b.x, a.y - b.y));
          }
        samples++;
        idleFrames = app.animator.busy(now) ? 0 : idleFrames + 1;
        if (now - start > 30_000) throw new Error('A courtyard leg exceeded thirty seconds');
      }
      return {
        destination: app.state!.location.pos,
        elapsed: performance.now() - start,
        minimum,
        samples,
        seats: app.partyPositions(),
      };
    }, destination);
    report.push(leg);
    expect(leg.destination).toEqual(destination);
    expect(leg.samples).toBeGreaterThan(1);
    expect(leg.minimum, JSON.stringify(leg)).toBeGreaterThanOrEqual(0.78);
    expect(new Set(leg.seats?.map((seat) => `${seat.x},${seat.y}`)).size).toBe(5);
    for (const seat of leg.seats?.slice(1) ?? [])
      // The canal beside the bridge's foot: row 12 (and 13) at x 10-12 and 15.
      expect(
        (seat.y === 12 || seat.y === 13) && ((seat.x >= 10 && seat.x <= 12) || seat.x === 15),
      ).toBe(false);
  }
  await testInfo.attach('actual-walk-cadence-and-spacing', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
});
