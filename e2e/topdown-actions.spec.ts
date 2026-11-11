import { expect, test, type Page } from '@playwright/test';
import { paintedTileCentre } from './projection';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';

/**
 * Top-down action clips in combat (ADR 0104, #587), on the Canvas 2D backend CI runs: a party unit that
 * attacks north plays its north action, drawn, and the Driller's idle is its rumble, whose drawn cel changes.
 */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

type Clips = Record<string, { frames: string[] } | undefined>;

/** The clips a sprite's loaded sheet draws, as the animator reads them. */
function sheetClips(page: Page, sprite: string): Promise<Clips | undefined> {
  return page.evaluate((key) => {
    // A top-down fight plays on the combat scene's own animator (#500); anything else on the app's.
    const app = window.fnt?.app as unknown as {
      scene?: { sceneAnimator?: unknown };
      animator: unknown;
    };
    const animator = (app?.scene?.sceneAnimator ?? app?.animator) as {
      options: { sheetClips?: (sprite: string) => Clips | undefined };
    };
    return animator.options.sheetClips?.(key);
  }, sprite);
}

test('a party unit attacking north plays its north action', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await resetStorage(page, '?renderer=canvas&style=topdown');
  await startGame(page, ['Elias'], ['kaya'], 'topdown-actions-north', { reduceMotion: false });
  await enterNode(page, 'battle_forest_road');
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  await expect
    .poll(async () => (await sheetClips(page, 'unit.fire.kaya'))?.['cast@north']?.frames[0])
    .toMatch(/jabNorth/);

  // Every action pose the animator hands the scene, by unit.
  await page.evaluate(() => {
    const app = window.fnt?.app as unknown as {
      scene?: { sceneAnimator?: unknown };
    };
    const animator = (app?.scene?.sceneAnimator ?? window.fnt?.app.animator) as
      NonNullable<typeof window.fnt>['app']['animator'] | undefined;
    if (!animator) return;
    const seen: string[] = [];
    (window as unknown as { seenClips: string[] }).seenClips = seen;
    const own = animator.unitPose.bind(animator);
    animator.unitPose = (now, unitId, sprite) => {
      const pose = own(now, unitId, sprite);
      if (pose?.clip.includes('@')) seen.push(`${unitId} ${pose.clip}`);
      return pose;
    };
  });

  // Kaya and a bandit three cells north of her, on open level ground with nothing between them; she jabs it.
  const plan = await page.evaluate(() => {
    const app = window.fnt?.app;
    const battle = app?.state?.battle;
    if (!app?.state || !battle) return null;
    const kaya = battle.units.find((u) => u.id === battle.order[battle.turnIndex]);
    const bandit = battle.units.find((u) => u.faction === 'enemy' && u.hp > 0 && u.size === 1);
    if (!kaya || !bandit) return null;
    const { width, height, tiles } = battle.grid;
    const open = (x: number, y: number, elevation: number) => {
      const tile = tiles[y * width + x];
      return (
        tile !== undefined &&
        !tile.blocked &&
        !tile.blocksSight &&
        !tile.cover &&
        tile.elevation === elevation &&
        !battle.units.some(
          (u) =>
            u.hp > 0 && u.id !== kaya.id && u.id !== bandit.id && u.pos.x === x && u.pos.y === y,
        )
      );
    };
    for (let y = height - 1; y >= 3; y -= 1)
      for (let x = 0; x < width; x += 1) {
        const elevation = tiles[y * width + x]?.elevation ?? -1;
        if (![0, 1, 2, 3].every((dy) => open(x, y - dy, elevation))) continue;
        const target = { x, y: y - 3 };
        app.state = {
          ...app.state,
          battle: {
            ...battle,
            units: battle.units.map((u) =>
              u.id === bandit.id
                ? { ...u, pos: target }
                : u.id === kaya.id
                  ? { ...u, pos: { x, y } }
                  : u,
            ),
          },
        };
        return { kaya: kaya.id, target };
      }
    return null;
  });
  expect(plan, 'no open column for the jab').not.toBeNull();
  if (!plan) return;
  await page.evaluate(({ kaya, target }) => {
    window.fnt?.app.dispatch({ type: 'useAbility', unitId: kaya, abilityId: 'fire_jab', target });
  }, plan);
  await waitForIdle(page);
  const seen = await page.evaluate(
    () => (window as unknown as { seenClips?: string[] }).seenClips ?? [],
  );
  expect(seen).toContain(`${plan.kaya} cast@north`);
  expect(
    seen.filter((entry) => entry.startsWith(plan.kaya)).every((e) => e.endsWith('@north')),
  ).toBe(true);
  expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
});

test("the Driller's idle is its rumble, and its drawn cel changes", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await resetStorage(page, '?renderer=canvas&style=topdown');
  await startGame(page, ['Elias'], ['kaya'], 'topdown-actions-driller', { reduceMotion: false });
  await enterNode(page, 'battle_grumbler');
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  await expect
    .poll(async () => (await sheetClips(page, 'unit.enemy.driller'))?.idleSouthWest?.frames[0])
    .toMatch(/rumbleSouthWest/);

  const pos = await page.evaluate(
    () => window.fnt?.app.state?.battle?.units.find((u) => u.sprite === 'unit.enemy.driller')?.pos,
  );
  expect(pos).toBeDefined();
  if (!pos) return;
  // The middle of its 2x2 body.
  const a = await paintedTileCentre(page, pos);
  const b = await paintedTileCentre(page, { x: pos.x + 1, y: pos.y + 1 });
  expect(a && b).toBeTruthy();
  if (!a || !b) return;
  const span = Math.abs(b.x - a.x) * 2;
  const clip = {
    x: Math.max(0, (a.x + b.x) / 2 - span),
    y: Math.max(0, (a.y + b.y) / 2 - span * 1.5),
    width: span * 2,
    height: span * 2,
  };
  const shots: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    shots.push((await page.screenshot({ clip })).toString('base64'));
    await page.waitForTimeout(130);
  }
  expect(new Set(shots).size, 'the rumble never changed cel').toBeGreaterThan(1);
  expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([]);
});
