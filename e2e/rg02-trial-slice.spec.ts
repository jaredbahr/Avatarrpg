import { expect, test, type Page } from '@playwright/test';
import { enterNode, finishConversation, resetStorage, startGame } from './helpers';

/**
 * The RG-02 pipeline-trial slice (Saltstep and Emberwatch, `docs/pipeline-trial-log.md`): its
 * chunk loads as Ba Dan's neighbour, the coast-road sign opens only once Act I is over, the cart
 * takes the party to Saltstep, the found conversations lead into the winch fight with Veyra as a
 * guest, and the optional side fight starts in Emberwatch's power yard.
 */

/** Taps an NpcDef on the current map the way a player does: walking to it. */
async function tapNpc(page: Page, npcId: string): Promise<void> {
  await page.waitForFunction(() => window.fnt?.app.state?.screen === 'explore');
  await page.evaluate((id) => {
    const app = window.fnt?.app;
    const state = app?.state;
    const npc = state && app.content.maps.get(state.location.mapId)?.npcs.find((n) => n.id === id);
    if (!app || !npc?.pos) throw new Error(`${id} is not on this map.`);
    app.dispatch({ type: 'walkTo', pos: npc.pos });
  }, npcId);
  await page.waitForFunction(() => window.fnt?.app.state?.screen === 'dialogue');
}

async function where(page: Page) {
  return page.evaluate(() => {
    const state = window.fnt?.app.state;
    return { mapId: state?.location.mapId, screen: state?.screen, node: state?.story.nodeId };
  });
}

test('the coast road opens after Act I and leads into the winch fight beside Veyra', async ({
  page,
}) => {
  const regionChunks: string[] = [];
  page.on('request', (request) => {
    if (/region-saltstepEmberwatch-.*\.js/.test(request.url())) regionChunks.push(request.url());
  });
  await resetStorage(page);
  await startGame(page, ['Ava', 'Ben'], ['kaya', 'riko'], 'rg02-trial');

  // Before the end of Act I the sign is not there: the region's gate.
  await page.waitForFunction(() => window.fnt?.app.content.maps.has('saltstep_market'));
  const signBefore = await page.evaluate(() => {
    const app = window.fnt?.app;
    return app?.content.maps.get('ba_dan_village')?.npcs.find((n) => n.id === 'coast_road_sign');
  });
  expect(signBefore?.when).toBeDefined();
  expect(regionChunks.length, 'the region loads as a chunk of its own').toBeGreaterThan(0);

  // After a Driller loss the occupied village shows the sign; Dorin drives.
  await page.evaluate(() => {
    const app = window.fnt?.app;
    app?.dispatch({ type: 'setFlags', flags: { act1_lost: true } });
    app?.dispatch({ type: 'enterNode', nodeId: 'village_explore' });
  });
  await tapNpc(page, 'coast_road_sign');
  expect((await where(page)).node).toBe('mq02_coast_road');
  await finishConversation(page);
  expect(await where(page)).toMatchObject({ mapId: 'saltstep_market', screen: 'explore' });

  // The first step in plays the market's arrival; then the bowl-seller sends the party on.
  await page.evaluate(() => window.fnt?.app.dispatch({ type: 'walkTo', pos: { x: 6, y: 5 } }));
  await page.waitForFunction(() => window.fnt?.app.state?.screen === 'dialogue');
  expect((await where(page)).node).toBe('mq02_saltstep_arrival');
  await finishConversation(page);
  await tapNpc(page, 'mq02_bowl_seller');
  await finishConversation(page);

  // Customs (Scene 2.3) runs straight through the pump woman (2.4) into the sling (2.5).
  await tapNpc(page, 'mq02_customs_clerk');
  await finishConversation(page);
  await page.waitForFunction(() => window.fnt?.app.state?.screen === 'combat');
  const battle = await page.evaluate(() => {
    const state = window.fnt?.app.state;
    return {
      mapId: state?.battle?.mapId,
      guests: state?.battle?.units.filter((u) => u.faction === 'ally').map((u) => u.name),
      enemies: state?.battle?.units.filter((u) => u.faction === 'enemy').length,
    };
  });
  expect(battle.mapId).toBe('saltstep_pontoon');
  expect(battle.guests).toEqual(['Veyra']);
  expect(battle.enemies).toBeGreaterThan(0);
  await expect(page.locator('.turn-strip .turn-chip.guest')).toHaveCount(1);
});

test('the optional side fight starts in the Emberwatch power yard', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Ava'], ['kaya', 'riko', 'bo'], 'rg02-side');
  await page.waitForFunction(() => window.fnt?.app.content.maps.has('emberwatch_power_yard'));
  await enterNode(page, 'mq03_power_yard_explore');
  await tapNpc(page, 'sf21_sabi');
  await finishConversation(page);
  await page.waitForFunction(() => window.fnt?.app.state?.screen === 'combat');
  const battle = await page.evaluate(() => ({
    mapId: window.fnt?.app.state?.battle?.mapId,
    riggers: window.fnt?.app.state?.battle?.units.filter((u) => u.faction === 'enemy').length,
  }));
  expect(battle.mapId).toBe('emberwatch_power_yard');
  expect(battle.riggers).toBeGreaterThanOrEqual(4);
});
