import { expect, test, type Page } from '@playwright/test';
import type { EncounterDef } from '../src/core/types';
import { enterNode, resetStorage, startGame } from './helpers';

/**
 * Objective fights (ADR 0116's 2026-11-15 amendment), on a test-only copy of
 * the Forest Road with a placeholder objective: a road cell two steps from
 * Kaya's spawn. The header names the goal and counts the rounds; a hero on the
 * cell when the round ends wins it; nobody there when the last round ends
 * loses it. The label is a placeholder, not story text.
 */

const GOAL = { x: 4, y: 5 };

async function stageObjectiveFight(page: Page, loseAfterRound: number): Promise<void> {
  await page.evaluate(
    ({ goal, limit }) => {
      const app = window.fnt?.app;
      const encounter = app?.content.encounters.get('enc_forest_road');
      if (!app || !encounter) throw new Error('Forest road encounter unavailable.');
      (app.content.encounters as Map<string, EncounterDef>).set(encounter.id, {
        ...encounter,
        guidance: undefined,
        variants: [],
        reinforcements: [],
        objective: { kind: 'holdAtRoundEnd', cells: [goal], label: 'Placeholder objective' },
        loseAfterRound: limit,
      });
    },
    { goal: GOAL, limit: loseAfterRound },
  );
}

/**
 * Plays forward until the fight ends: hand-off cards are acknowledged with the
 * real button, Kaya walks onto the goal on her turn when `takeGoal` is set,
 * every other hero ends their turn, and the AI plays its own.
 */
async function playOut(page: Page, takeGoal: boolean): Promise<string> {
  for (let step = 0; step < 120; step++) {
    const now = await page.evaluate(() => {
      const battle = window.fnt?.app.state?.battle;
      const id = battle?.order[battle.turnIndex];
      const unit = battle?.units.find((u) => u.id === id);
      return {
        phase: battle?.phase ?? 'none',
        id,
        faction: unit?.faction,
        characterId: unit?.characterId,
        pos: unit?.pos,
        move: unit?.move ?? 0,
        banner: Boolean(document.querySelector('.handoff-banner:not(.result-banner)')),
      };
    });
    if (now.phase !== 'active') return now.phase;
    if (now.banner) {
      await page.getByRole('button', { name: "I'm ready" }).click();
    } else if (now.faction === 'party' && now.id) {
      const onGoal = now.pos?.x === GOAL.x && now.pos?.y === GOAL.y;
      if (takeGoal && now.characterId === 'kaya' && !onGoal && now.move >= 2) {
        await page.evaluate(
          ({ unitId, goal }) =>
            window.fnt?.app.dispatch({
              type: 'move',
              unitId,
              path: [{ x: goal.x - 1, y: goal.y }, goal],
            }),
          { unitId: now.id, goal: GOAL },
        );
      } else {
        await page.evaluate(
          (unitId) => window.fnt?.app.dispatch({ type: 'endTurn', unitId }),
          now.id,
        );
      }
    }
    await page.waitForTimeout(150);
  }
  throw new Error('The objective fight never ended.');
}

test('the header names the goal, and holding it at the end of a round wins', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Ava', 'Ben'], ['kaya', 'riko'], 'objective-hold');
  await stageObjectiveFight(page, 3);
  await enterNode(page, 'battle_forest_road');

  // The goal and the rounds left, read whole to a screen reader.
  const line = page.locator('.combat-bar .combat-objective');
  await expect(line).toBeVisible();
  await expect(line.locator('.combat-objective-label')).toHaveText('Placeholder objective');
  await expect(line.locator('.combat-objective-rounds')).toHaveText('3 rounds left');
  await expect(
    page.getByRole('status', { name: 'Goal: Placeholder objective. 3 rounds left' }),
  ).toBeVisible();

  expect(await playOut(page, true)).toBe('victory');
  const outcome = await page.evaluate(() => {
    const state = window.fnt?.app.state;
    return {
      round: state?.battle?.round,
      enemiesStanding: state?.battle?.units.some((u) => u.faction === 'enemy' && u.hp > 0),
      log: state?.log.join('\n') ?? '',
    };
  });
  expect(outcome.round).toBe(1);
  expect(outcome.enemiesStanding).toBe(true);
  expect(outcome.log).toContain('holds the objective');
});

test('nobody on the goal when the last round ends loses the fight', async ({ page }) => {
  await resetStorage(page);
  await startGame(page, ['Ava', 'Ben'], ['kaya', 'riko'], 'objective-timeout');
  await stageObjectiveFight(page, 1);
  await enterNode(page, 'battle_forest_road');

  await expect(page.locator('.combat-objective.urgent .combat-objective-rounds')).toHaveText(
    'Last round!',
  );
  expect(await playOut(page, false)).toBe('defeat');
  const log = await page.evaluate(() => window.fnt?.app.state?.log.join('\n') ?? '');
  expect(log).toContain('Out of time. This fight is lost.');
});
