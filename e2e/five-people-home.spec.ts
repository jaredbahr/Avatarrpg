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
