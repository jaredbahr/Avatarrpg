import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

/**
 * #628: the quarry dialogue shows what it talks about. The gate parley rises
 * to the curtain wall, Ruon stands in the Cutting while he speaks, three freed
 * workers walk into Ba Dan with the party, and Mira takes the rubbing.
 */

const RETURNEES = [
  'lw.npc.bo_shan',
  'lw.npc.leto',
  'lw.npc.amri',
  'lw.npc.hesra',
  'lw.npc.senn_messenger',
] as const;

interface Patch {
  readonly node: string;
  readonly mapId: string;
  readonly pos: { x: number; y: number };
  readonly flags?: Record<string, boolean>;
  readonly visited?: readonly string[];
  readonly profiles?: string;
  readonly villageReturn?: { x: number; y: number };
}

async function adopt(page: Page, patch: Patch): Promise<void> {
  await page.evaluate(
    ({ patch, ids }) => {
      const app = window.fnt!.app;
      const current = app.state!;
      app.adoptSave(
        {
          ...current,
          screen: 'explore',
          flags: { ...current.flags, ...patch.flags },
          location: { mapId: patch.mapId, pos: patch.pos },
          story: {
            ...current.story,
            nodeId: patch.node,
            lineIndex: 0,
            visited: [...current.story.visited, ...(patch.visited ?? [])],
          },
          world: {
            ...current.world,
            residentProfiles: patch.profiles
              ? Object.fromEntries(ids.map((id) => [id, patch.profiles!]))
              : current.world.residentProfiles,
            returnPos: patch.villageReturn
              ? { ...current.world.returnPos, ba_dan_village: patch.villageReturn }
              : current.world.returnPos,
          },
        } as typeof current,
        undefined,
      );
    },
    { patch, ids: RETURNEES },
  );
  await waitForIdle(page);
}

async function walkTo(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate((pos) => window.fnt!.app.dispatch({ type: 'walkTo', pos }), { x, y });
  await waitForIdle(page);
}

/** Screen-space rectangles, in canvas CSS pixels, of the given tiles and the panel's top. */
async function framing(page: Page, tiles: readonly { x: number; y: number }[]) {
  return page.evaluate((tiles) => {
    type Camera = {
      toScreen(pos: { x: number; y: number }): { x: number; y: number; size: number };
      viewport: { width: number; height: number };
    };
    const scene = (window.fnt!.app as unknown as { scene: { renderer: { camera: Camera } } }).scene;
    const camera = scene.renderer.camera;
    const canvas = document.querySelector('.explore-scene .map-canvas')!.getBoundingClientRect();
    const panel = document
      .querySelector('.explore-conversation .conversation-panel')!
      .getBoundingClientRect();
    return {
      width: camera.viewport.width,
      panelTop: ((panel.top - canvas.top) * camera.viewport.height) / canvas.height,
      boxes: tiles.map((tile) => camera.toScreen(tile)),
    };
  }, tiles);
}

const npcIds = (page: Page) =>
  page.evaluate(() =>
    (
      window.fnt!.app as unknown as { scene: { lastNpcs: readonly { id: string }[] } }
    ).scene.lastNpcs.map((npc) => npc.id),
  );

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Ana', 'Ben', 'Cy'], ['kaya', 'sura', 'bo'], 'story-staging');
});

test('the gate parley frames the curtain wall above the choices', async ({ page }) => {
  await adopt(page, {
    node: 'forest_after_explore',
    mapId: 'quarry_gate',
    pos: { x: 5, y: 5 },
    visited: ['road_depart', 'after_forest'],
  });
  await walkTo(page, 8, 5);
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('gate_parley');
  await expect(page.locator('.explore-conversation .choice-panel')).toBeVisible();
  // The stage's corners: the gatehouse and the wall either side of it.
  const wall = [
    { x: 6, y: 0 },
    { x: 13, y: 0 },
    { x: 6, y: 1 },
    { x: 13, y: 1 },
  ];
  await expect
    .poll(async () => {
      const { boxes, panelTop, width } = await framing(page, wall);
      return boxes.every(
        (box) =>
          box.x >= 0 &&
          box.x + box.size <= width &&
          box.y + box.size > 0 &&
          box.y + box.size <= panelTop,
      );
    })
    .toBe(true);
});

test('Ruon stands in the Cutting while he speaks after the ambush', async ({ page }) => {
  await adopt(page, {
    node: 'cutting_explore',
    mapId: 'ambush_road',
    pos: { x: 8, y: 5 },
    flags: { ruon_spared: true },
    visited: ['road_depart', 'after_forest', 'gate_parley', 'ruon_choice', 'escort_chosen'],
  });
  expect(await npcIds(page)).not.toContain('ruon_cutting');
  await enterNode(page, 'after_ambush');
  await expect(page.locator('.dialogue-line')).toContainText('We cannot stay on the road');
  await expect.poll(() => npcIds(page)).toContain('ruon_cutting');
  await expect
    .poll(async () => {
      const { boxes, panelTop, width } = await framing(page, [{ x: 10, y: 4 }]);
      const box = boxes[0]!;
      return box.x >= 0 && box.x + box.size <= width && box.y + box.size <= panelTop;
    })
    .toBe(true);
  await page.locator('[data-conversation-control="next"]').click();
  await page.locator('[data-conversation-control="next"]').click();
  await page.locator('[data-conversation-control="next"]').click();
  await expect(page.locator('.explore-conversation')).toBeHidden();
  // He waits there, and has a word of his own, until the descent.
  expect(await npcIds(page)).toContain('ruon_cutting');
  await walkTo(page, 10, 4);
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('ruon_cutting');
  await expect(page.locator('.dialogue-line')).toContainText('quarry floor');
});

test('three freed workers walk into Ba Dan for the welcome home', async ({ page }) => {
  await adopt(page, {
    node: 'forest_return_explore',
    mapId: 'forest_road',
    pos: { x: 3, y: 4 },
    flags: { act1_complete: true, ruon_spared: true },
    profiles: 'returning',
    villageReturn: { x: 22, y: 7 },
    visited: ['road_depart', 'after_forest', 'gate_parley', 'ruon_choice', 'act1_victory'],
  });
  await walkTo(page, 1, 4);
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe(
    'forest_return_arrival',
  );
  await page.locator('.dialogue-panel button.btn-primary').click();
  await page.locator('.dialogue-panel button.btn-primary').click();
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state!.location.mapId))
    .toBe('ba_dan_village');
  await waitForIdle(page);
  const walkers = ['lw.npc.amri', 'lw.npc.bo_shan', 'lw.npc.leto'];
  await expect
    .poll(async () => (await npcIds(page)).filter((id) => id.startsWith('lw.npc.')).sort())
    .toEqual(expect.arrayContaining(walkers));
  const ids = await npcIds(page);
  expect(ids).not.toContain('lw.npc.hesra');
  expect(ids).not.toContain('lw.npc.senn_messenger');
  await walkTo(page, 20, 7);
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('welcome_home_mira');
  // The welcome plays over the village as the party left it: they are still there.
  expect(
    await page.evaluate(() => window.fnt!.app.residents.figures().map((who) => who.id)),
  ).toEqual(expect.arrayContaining(walkers));
});

test('Mira takes the maker-plate rubbing once', async ({ page }) => {
  await adopt(page, {
    node: 'village_return_explore',
    mapId: 'ba_dan_village',
    pos: { x: 12, y: 7 },
    flags: { act1_complete: true, ruon_traded: true },
    profiles: 'resting',
    visited: ['act1_victory', 'forest_return_arrival', 'demo_complete'],
  });
  await walkTo(page, 11, 5);
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('mira_epilogue');
  const next = page.locator('[data-conversation-control="next"]');
  await next.click();
  await next.click();
  await expect(page.locator('.dialogue-line')).toContainText('maker-plate rubbing');
  await next.click();
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('mira_rubbing');
  await expect(page.locator('.dialogue-line')).toContainText('rubbing');
  await next.click();
  await next.click();
  await expect(page.locator('.explore-conversation')).toBeHidden();
  expect(await page.evaluate(() => window.fnt!.app.state!.flags.rubbing_given)).toBe(true);
  await walkTo(page, 11, 5);
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('mira_rubbing_kept');
});
