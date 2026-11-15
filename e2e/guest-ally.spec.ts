import { expect, test, type Page } from '@playwright/test';
import type { EncounterDef } from '../src/core/types';
import { enterNode, resetStorage, startGame } from './helpers';

/**
 * Guest allies (ADR 0116), on a test-only copy of the Forest Road: one guest
 * the table plays (a placeholder built from Sura's kit) and one the AI plays.
 * The table guest passes round the table a round at a time, and every guest
 * is tagged "Guest" in the turn strip and the HUD.
 */

async function stageGuestFight(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = window.fnt?.app;
    const encounter = app?.content.encounters.get('enc_forest_road');
    if (!app || !encounter) throw new Error('Forest road encounter unavailable.');
    (app.content.encounters as Map<string, EncounterDef>).set(encounter.id, {
      ...encounter,
      guidance: undefined,
      variants: [],
      reinforcements: [],
      guests: [
        // High level so it is still standing for its second turn.
        { characterId: 'sura', pos: { x: 4, y: 5 }, control: 'table', level: 10 },
        { enemyId: 'ruon_ally', pos: { x: 5, y: 6 } },
      ],
    });
  });
}

/** The table guest's unit id, once the battle is on the field. */
async function tableGuestId(page: Page): Promise<string> {
  const handle = await page.waitForFunction(() => {
    const battle = window.fnt?.app.state?.battle;
    return battle?.units.find((u) => u.faction === 'ally' && u.ai === 'none')?.id ?? false;
  });
  return (await handle.jsonValue()) as string;
}

/**
 * Plays forward until `guestId` is the unit acting in `round`: party members
 * end their turns, hand-off cards are acknowledged with the real button.
 * Returns the hand-off card's text if one was shown for the guest itself.
 */
async function reachGuestTurn(page: Page, guestId: string, round: number): Promise<string | null> {
  for (let step = 0; step < 80; step++) {
    const now = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      const id = battle?.order[battle.turnIndex];
      const unit = battle?.units.find((u) => u.id === id);
      return {
        round: battle?.round ?? 0,
        phase: battle?.phase,
        id,
        faction: unit?.faction,
        ai: unit?.ai,
        banner: document.querySelector('.handoff-banner:not(.result-banner)')?.textContent ?? null,
      };
    });
    if (now.phase !== 'active') throw new Error('The fight ended before the guest acted.');
    if (now.id === guestId && now.round === round) {
      if (now.banner) {
        await page.getByRole('button', { name: "I'm ready" }).click();
        return now.banner;
      }
      // The HUD may still be catching up with the turn change.
      if (await page.locator('.unit-panel').count()) return null;
    } else if (now.banner) {
      await page.getByRole('button', { name: "I'm ready" }).click();
    } else if (now.faction === 'party' || (now.faction === 'ally' && now.ai === 'none')) {
      await page.evaluate((unitId) => {
        window.fnt?.app.dispatch({ type: 'endTurn', unitId: unitId ?? '' });
      }, now.id);
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`The guest's turn in round ${round} never came.`);
}

test('a table guest is tagged, passed round the table, and played by the person named', async ({
  page,
}) => {
  await resetStorage(page);
  await startGame(page, ['Ava', 'Ben'], ['kaya', 'riko'], 'guest-ally');
  await stageGuestFight(page);
  await enterNode(page, 'battle_forest_road');
  const guestId = await tableGuestId(page);

  // Both guests carry the tag in the turn strip, and say so to a screen reader.
  const strip = page.locator('.turn-strip');
  await expect(strip.locator('.turn-chip.guest')).toHaveCount(2);
  await expect(strip.locator('.turn-chip.guest .guest-tag').first()).toHaveText('Guest');
  await expect(page.getByRole('button', { name: /^Focus .+ \(guest\)$/ })).toHaveCount(2);

  // Round 1: the guest is the story decider's (Ava's) to play.
  const firstBanner = await reachGuestTurn(page, guestId, 1);
  if (firstBanner) expect(firstBanner).toContain('our guest');
  const panel = page.locator('.unit-panel');
  await expect(panel.locator('.chip-guest')).toHaveText('Guest');
  await expect(panel).toContainText('Ava');
  await expect(page.getByRole('button', { name: /^Move/ })).toBeEnabled();
  await page.evaluate((id) => window.fnt?.app.dispatch({ type: 'endTurn', unitId: id }), guestId);

  // Round 2: it has passed to the next person at the table.
  const secondBanner = await reachGuestTurn(page, guestId, 2);
  if (secondBanner) {
    expect(secondBanner).toContain('Ben');
    expect(secondBanner).toContain('our guest');
  }
  await expect(panel.locator('.chip-guest')).toHaveText('Guest');
  await expect(panel).toContainText('Ben');
});
