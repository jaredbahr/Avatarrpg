import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

/**
 * #696: the people the quarry gate talks about are on the map. Two of the crew
 * watch from the wall while the parley is read; Ruon stands with the party as
 * he surrenders and while the table votes; on the escort route he follows the
 * party through the gate, the Cutting and the walk home into Ba Dan, and on the
 * trade route he does not.
 */

interface Patch {
  readonly node: string;
  readonly mapId: string;
  readonly pos: { x: number; y: number };
  readonly flags?: Record<string, boolean>;
  readonly visited?: readonly string[];
  readonly profiles?: string;
  readonly villageReturn?: { x: number; y: number };
}

const RETURNEES = [
  'lw.npc.bo_shan',
  'lw.npc.leto',
  'lw.npc.amri',
  'lw.npc.hesra',
  'lw.npc.senn_messenger',
] as const;

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

const nodeId = (page: Page) => page.evaluate(() => window.fnt!.app.state!.story.nodeId);

/** Advance the open dialogue until the story leaves `node`. */
async function finishDialogue(page: Page, node: string): Promise<void> {
  for (let line = 0; line < 8 && (await nodeId(page)) === node; line++)
    await page.evaluate(() => window.fnt!.app.dispatch({ type: 'advanceDialogue' }));
  expect(await nodeId(page)).not.toBe(node);
}

const followers = (page: Page) =>
  page.evaluate(() => window.fnt!.app.followerPositions()?.map((who) => who.id) ?? null);

/** Ruon's tile, the leader's, and the party's drawn tiles (in the explore scene). */
const line = (page: Page) =>
  page.evaluate(() => {
    const app = window.fnt!.app;
    return {
      ruon: app.followerPositions()?.find((who) => who.id === 'follower.ruon')?.pos ?? null,
      leader: app.state!.location.pos,
      party: app.partyPositions() ?? [],
    };
  });

const npcIds = (page: Page) =>
  page.evaluate(() =>
    (
      window.fnt!.app as unknown as { scene: { lastNpcs: readonly { id: string }[] } }
    ).scene.lastNpcs.map((npc) => npc.id),
  );

/** The clip each named NPC marker is drawn with, in the order asked. */
const npcClips = (page: Page, ids: readonly string[]) =>
  page.evaluate((ids) => {
    const npcs = (
      window.fnt!.app as unknown as {
        scene: { lastNpcs: readonly { id: string; clip?: string }[] };
      }
    ).scene.lastNpcs;
    return ids.map((id) => npcs.find((npc) => npc.id === id)?.clip ?? null);
  }, ids);

/** From the gate, after the fight, to the vote on Ruon. */
async function surrender(page: Page): Promise<void> {
  await adopt(page, {
    node: 'forest_after_explore',
    mapId: 'quarry_gate',
    pos: { x: 8, y: 5 },
    visited: ['road_depart', 'after_forest', 'gate_parley', 'battle_quarry_gate'],
  });
  await enterNode(page, 'ruon_surrender');
  await expect(page.locator('.dialogue-line')).toContainText('My sabre stays on the ground');
  // He stands with the party while he speaks: drawn in the world behind the panel.
  await expect.poll(() => followers(page)).toEqual(['follower.ruon']);
  await finishDialogue(page, 'ruon_surrender');
  expect(await nodeId(page)).toBe('ruon_choice');
  expect(await followers(page)).toEqual(['follower.ruon']);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Ana', 'Ben', 'Cy'], ['kaya', 'sura', 'bo'], 'ruon-escort');
});

test('two of the crew watch from the wall while the parley is read', async ({ page }) => {
  await adopt(page, {
    node: 'forest_after_explore',
    mapId: 'quarry_gate',
    pos: { x: 5, y: 5 },
    visited: ['road_depart', 'after_forest'],
  });
  expect(await npcIds(page)).not.toContain('gate_watch_worker');
  await walkTo(page, 8, 5);
  expect(await nodeId(page)).toBe('gate_parley');
  await expect(page.locator('.explore-conversation .choice-panel')).toBeVisible();
  await expect
    .poll(() => npcIds(page))
    .toEqual(expect.arrayContaining(['gate_watch_worker', 'gate_watch_hauler']));
  // They face the party below the wall, on their south-facing idle, not side-on.
  expect(await npcClips(page, ['gate_watch_worker', 'gate_watch_hauler'])).toEqual([
    'idleSouth',
    'idleSouth',
  ]);
  // They are the crew the party fights: they come down off the wall for it.
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'chooseOption', optionIndex: 0 }));
  await expect.poll(() => page.evaluate(() => window.fnt!.app.state!.screen)).toBe('combat');
});

test('an earthbender talks the gate open and Ruon steps up to surrender', async ({ page }) => {
  await adopt(page, {
    node: 'forest_after_explore',
    mapId: 'quarry_gate',
    pos: { x: 5, y: 5 },
    visited: ['road_depart', 'after_forest'],
  });
  await walkTo(page, 8, 5);
  expect(await nodeId(page)).toBe('gate_parley');
  // Bo speaks about the stonework; the crew watch until the gate is opened.
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'chooseOption', optionIndex: 2 }));
  expect(await nodeId(page)).toBe('gate_kinship');
  expect(await followers(page)).toEqual([]);
  await finishDialogue(page, 'gate_kinship');
  expect(await nodeId(page)).toBe('ruon_surrender');
  // The world kept behind the conversation repaints with him in it.
  await expect.poll(() => followers(page)).toEqual(['follower.ruon']);
});

test('Ruon surrenders beside the party and follows it on the escort route', async ({ page }) => {
  await surrender(page);
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'chooseOption', optionIndex: 0 }));
  expect(await nodeId(page)).toBe('escort_chosen');
  expect(await followers(page)).toEqual(['follower.ruon']);
  await finishDialogue(page, 'escort_chosen');
  expect(await nodeId(page)).toBe('gate_escort_explore');
  await waitForIdle(page);
  expect(await followers(page)).toEqual(['follower.ruon']);

  // Across the gate: he trails the party, never on a member's tile, never far behind.
  await walkTo(page, 15, 5);
  const { ruon, party, leader } = await line(page);
  expect(ruon).not.toBeNull();
  expect(Math.max(Math.abs(ruon!.x - leader.x), Math.abs(ruon!.y - leader.y))).toBeLessThanOrEqual(
    3,
  );
  expect(party.some((seat) => seat.x === ruon!.x && seat.y === ruon!.y)).toBe(false);
  // He never blocks a step: the leader can walk onto the tile he stands on.
  await walkTo(page, ruon!.x, ruon!.y);
  expect(await page.evaluate(() => window.fnt!.app.state!.location.pos)).toEqual(ruon);

  // East into the Cutting, still with him.
  await walkTo(page, 19, 5);
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state!.location.mapId))
    .toBe('ambush_road');
  await waitForIdle(page);
  expect(await followers(page)).toEqual(['follower.ruon']);
  expect(await npcIds(page)).not.toContain('ruon_cutting');
});

test('Jin takes Ruon on the trade route, and he does not follow', async ({ page }) => {
  await surrender(page);
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'chooseOption', optionIndex: 1 }));
  expect(await nodeId(page)).toBe('trade_chosen');
  // He is still there while Jin says "Captain. Hands where I can see them."
  await expect.poll(() => followers(page)).toEqual(['follower.ruon']);
  await finishDialogue(page, 'trade_chosen');
  expect(await nodeId(page)).toBe('gate_trade_explore');
  await waitForIdle(page);
  expect(await followers(page)).toEqual([]);
  await walkTo(page, 15, 5);
  expect(await followers(page)).toEqual([]);
});

test('Ruon walks home with the party and joins the welcome home', async ({ page }) => {
  await adopt(page, {
    node: 'forest_return_explore',
    mapId: 'forest_road',
    pos: { x: 3, y: 4 },
    flags: { act1_complete: true, ruon_spared: true },
    profiles: 'returning',
    villageReturn: { x: 22, y: 7 },
    visited: ['road_depart', 'after_forest', 'gate_parley', 'ruon_choice', 'act1_victory'],
  });
  expect(await followers(page)).toEqual(['follower.ruon']);
  await walkTo(page, 1, 4);
  expect(await nodeId(page)).toBe('forest_return_arrival');
  await finishDialogue(page, 'forest_return_arrival');
  await expect
    .poll(() => page.evaluate(() => window.fnt!.app.state!.location.mapId))
    .toBe('ba_dan_village');
  await waitForIdle(page);
  expect(await followers(page)).toEqual(['follower.ruon']);
  // Waiting for the party to come up the street, he steps aside from no one.
  const { ruon, party } = await line(page);
  expect(party.some((seat) => seat.x === ruon!.x && seat.y === ruon!.y)).toBe(false);
  await walkTo(page, 20, 7);
  expect(await nodeId(page)).toBe('welcome_home_mira');
  // The welcome plays over the village as the party walked in, Ruon among the crowd:
  // he waits with Bo-shan at the east-road mouth.
  expect(await page.evaluate(() => window.fnt!.app.followerPositions())).toEqual([
    { id: 'follower.ruon', pos: { x: 22, y: 6 } },
  ]);
});

test('a party that traded Ruon walks home without him', async ({ page }) => {
  await adopt(page, {
    node: 'forest_return_explore',
    mapId: 'forest_road',
    pos: { x: 3, y: 4 },
    flags: { act1_complete: true, ruon_traded: true },
    profiles: 'returning',
    visited: ['road_depart', 'after_forest', 'gate_parley', 'ruon_choice', 'act1_victory'],
  });
  expect(await followers(page)).toEqual([]);
});
