import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { NpcMarker } from '../src/render/view';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

const RETURNEES = [
  'lw.npc.bo_shan',
  'lw.npc.leto',
  'lw.npc.amri',
  'lw.npc.hesra',
  'lw.npc.senn_messenger',
] as const;

async function settleResidents(page: Page): Promise<void> {
  await waitForIdle(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const step = (): void => {
          frames++;
          if (frames >= 3 && !window.fnt!.app.residents.moving()) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
  );
}

const drawnReturnees = (page: Page) =>
  page.evaluate((ids) => {
    const app = window.fnt!.app;
    const scene = (app as unknown as { scene: { lastNpcs: readonly NpcMarker[] } }).scene;
    return scene.lastNpcs
      .filter((marker) => ids.includes(marker.id as (typeof ids)[number]))
      .map((marker) => marker.id);
  }, RETURNEES);

async function walkTo(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate((pos) => window.fnt!.app.dispatch({ type: 'walkTo', pos }), { x, y });
  await waitForIdle(page);
}

async function takeRoute(page: Page, label: string, mapId: string): Promise<void> {
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.fnt?.app.state?.location.mapId)).toBe(mapId);
  await waitForIdle(page);
}

async function saveAndReload(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /save here/i })
    .click();
  const saved = await page.evaluate(() => {
    const state = window.fnt!.app.state!;
    return {
      flags: state.flags,
      world: state.world,
      story: state.story,
      location: state.location,
    };
  });
  await page.reload();
  await page.getByRole('button', { name: /load a save/i }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /^Load$/ })
    .click();
  expect(
    await page.evaluate(() => {
      const state = window.fnt!.app.state!;
      return {
        flags: state.flags,
        world: state.world,
        story: state.story,
        location: state.location,
      };
    }),
  ).toEqual(saved);
}

test('seeded return profiles own five forest markers and missing owns none under Canvas', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Jared'], ['kaya'], 'five-people-home');
  await enterNode(page, 'forest_explore');

  await page.evaluate((ids) => {
    const app = window.fnt!.app;
    const current = app.state!;
    app.adoptSave(
      {
        ...current,
        screen: 'explore',
        flags: { ...current.flags, act1_complete: true },
        story: {
          ...current.story,
          nodeId: 'forest_explore',
          visited: [...current.story.visited, 'road_depart', 'after_forest'],
        },
        location: { mapId: 'forest_road', pos: { x: 1, y: 4 } },
        world: {
          ...current.world,
          residentProfiles: Object.fromEntries(ids.map((id) => [id, 'returning'])),
        },
      },
      undefined,
    );
  }, RETURNEES);
  await settleResidents(page);

  const returning = await drawnReturnees(page);
  expect([...returning].sort()).toEqual([...RETURNEES].sort());
  expect(new Set(returning).size).toBe(5);

  await page.evaluate((ids) => {
    const app = window.fnt!.app;
    const current = app.state!;
    app.adoptSave(
      {
        ...current,
        world: {
          ...current.world,
          residentProfiles: Object.fromEntries(ids.map((id) => [id, 'missing'])),
        },
      },
      undefined,
    );
  }, RETURNEES);
  await settleResidents(page);

  expect(await drawnReturnees(page)).toEqual([]);
});

for (const custody of ['escort', 'trade'] as const) {
  test(`${custody} victory keeps five returning until the real west-exit arrival completes`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Jared'], ['kaya'], `five-home-${custody}`);
    await page.evaluate((route) => {
      const app = window.fnt!.app;
      const current = app.state!;
      const flag = route === 'escort' ? 'ruon_spared' : 'ruon_traded';
      app.adoptSave(
        {
          ...current,
          flags: { ...current.flags, [flag]: true },
          story: {
            ...current.story,
            visited: [
              ...current.story.visited,
              'road_depart',
              'after_forest',
              'gate_parley',
              'ruon_choice',
              ...(route === 'escort' ? ['escort_chosen', 'after_ambush'] : ['trade_chosen']),
            ],
          },
        },
        undefined,
      );
    }, custody);
    await enterNode(page, 'act1_victory');

    expect(await page.evaluate(() => window.fnt!.app.state?.world.residentProfiles)).toEqual(
      Object.fromEntries(RETURNEES.map((id) => [id, 'returning'])),
    );
    await page.getByRole('button', { name: 'Read summary' }).click();
    await page.getByRole('button', { name: 'Continue exploring' }).click();

    await takeRoute(page, 'West → The Cutting', 'ambush_road');
    await takeRoute(page, 'West → Quarry Gate', 'quarry_gate');
    await takeRoute(page, 'West → Forest Road', 'forest_road');
    await settleResidents(page);
    expect(await drawnReturnees(page)).toHaveLength(5);
    await expect(page.locator('.title-plate-objective')).toContainText('returning');

    await saveAndReload(page);
    await settleResidents(page);
    expect(await drawnReturnees(page)).toHaveLength(5);
    expect(await page.evaluate(() => window.fnt!.app.state?.world.residentProfiles)).toEqual(
      Object.fromEntries(RETURNEES.map((id) => [id, 'returning'])),
    );

    await walkTo(page, 0, 4);
    expect(await page.evaluate(() => window.fnt!.app.state?.story.nodeId)).toBe(
      'forest_return_arrival',
    );
    expect(await page.evaluate(() => window.fnt!.app.state?.location.mapId)).toBe('forest_road');
    expect(await page.evaluate(() => window.fnt!.app.state?.world.residentProfiles)).toEqual(
      Object.fromEntries(RETURNEES.map((id) => [id, 'returning'])),
    );

    await page.locator('.dialogue-panel button.btn-primary').click();
    expect(await page.evaluate(() => window.fnt!.app.state?.world.residentProfiles)).toEqual(
      Object.fromEntries(RETURNEES.map((id) => [id, 'returning'])),
    );
    await page.locator('.dialogue-panel button.btn-primary').click();
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state?.location.mapId))
      .toBe('ba_dan_village');
    expect(await page.evaluate(() => window.fnt!.app.state?.world.residentProfiles)).toEqual(
      Object.fromEntries(RETURNEES.map((id) => [id, 'resting'])),
    );
    await settleResidents(page);
    expect(await drawnReturnees(page)).toEqual([]);
    await expect(page.locator('.title-plate-objective')).toContainText('home');
    expect(
      await page.evaluate(
        (flag) => window.fnt!.app.state?.flags[flag],
        custody === 'escort' ? 'ruon_spared' : 'ruon_traded',
      ),
    ).toBe(true);
  });
}
