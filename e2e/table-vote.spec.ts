import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { apply } from '../src/core/state/reducer';
import { CONTENT } from '../src/content';
import { enterNode, resetStorage, startGame } from './helpers';

/*
 * The table vote on story choices (#621), through the real panel: each player
 * picks in secret with a hand-off between them, the majority wins, a tie goes
 * to the rotating decider, and the winner is sent as the ordinary
 * `chooseOption`, so the rotation and the rules are exactly as before.
 */

async function story(page: Page) {
  return page.evaluate(() => window.fnt!.app.state!.story);
}

async function vote(page: Page, voter: string, label: string, last = false): Promise<void> {
  const panel = page.locator('.choice-panel');
  await expect(panel).toHaveAttribute('data-vote', 'pick');
  await expect(panel.locator('.vote-banner strong')).toHaveText(`${voter}, your pick`);
  // Nobody's pick shows while the vote is open.
  await expect(panel.locator('.vote-names')).toHaveCount(0);
  await panel.locator('.choice-option').filter({ hasText: label }).click();
  if (last) return;
  await expect(panel).toHaveAttribute('data-vote', 'pass');
  // The hand-off hides the answers, so the next player cannot see the pick.
  await expect(panel.locator('.choice-option')).toHaveCount(0);
  const ready = panel.getByRole('button', { name: "I'm ready", exact: true });
  await expect(ready).toBeFocused();
}

async function handOff(page: Page, next: string): Promise<void> {
  const panel = page.locator('.choice-panel');
  await expect(panel.locator('.vote-banner strong')).toHaveText(next);
  await panel.getByRole('button', { name: "I'm ready", exact: true }).click();
}

test('three players vote 2-1, then a 1-1-1 tie goes to the decider', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  // A firebender but no earthbender: two roads open at the gate, one locked.
  await startGame(page, ['Ava', 'Ben', 'Cleo'], ['kaya', 'nilak', 'riko'], 'table-vote', {
    storyChoices: 'vote',
  });
  await enterNode(page, 'gate_escort_explore');
  await enterNode(page, 'gate_parley');
  const panel = page.locator('.choice-panel');
  await expect(panel.locator('.vote-banner')).toContainText('Table vote · 1 of 3');
  await expect(panel.locator('.vote-banner')).toContainText('A tie goes to Ava.');

  // The road this party cannot take stays on screen, says why, and takes no vote.
  const locked = panel.locator('.choice-option.is-locked');
  await expect(locked).toHaveCount(1);
  await expect(locked).toBeDisabled();
  await expect(locked.locator('.locked-hint')).toContainText(/earthbender/i);

  const before = await page.evaluate(() => window.fnt!.app.state!);
  await vote(page, 'Ava', 'Let the firebender');
  await handOff(page, 'Ben');
  await expect(panel.locator('.vote-banner')).toContainText('Table vote · 2 of 3');
  await expect(panel.locator('.choice-option.is-locked')).toBeDisabled();
  await vote(page, 'Ben', 'Walk up and knock');
  await handOff(page, 'Cleo');
  await vote(page, 'Cleo', 'Let the firebender', true);

  // The result: who picked what, and nothing chosen until the table moves on.
  await expect(panel).toHaveAttribute('data-vote', 'result');
  await expect(panel.locator('.vote-banner strong')).toHaveText(
    'Let the firebender do the talking wins!',
  );
  const winner = panel.locator('.choice-option.is-winner');
  await expect(winner).toContainText('Picked by Ava, Cleo');
  await expect(panel.locator('.choice-option').first()).toContainText('Picked by Ben');
  expect(await page.evaluate(() => window.fnt!.app.state!)).toEqual(before);
  const go = panel.getByRole('button', { name: 'Continue', exact: true });
  await expect(go).toBeFocused();
  await go.click();
  const expected = apply(CONTENT, before, { type: 'chooseOption', optionIndex: 1 }).state;
  expect(await story(page)).toEqual(expected.story);
  expect((await story(page)).deciderIndex).toBe(1);

  // Ben decides now, so Ben votes first and breaks the tie.
  await enterNode(page, 'plant_chair_talk');
  await expect(panel.locator('.vote-banner')).toContainText('A tie goes to Ben.');
  await vote(page, 'Ben', 'Admire the plant');
  await handOff(page, 'Cleo');
  await vote(page, 'Cleo', 'Ask about the puzzle box');
  await handOff(page, 'Ava');
  await vote(page, 'Ava', 'Just sit', true);
  await expect(panel).toHaveAttribute('data-vote', 'tie');
  await expect(panel.locator('.vote-banner')).toContainText("It's a tie!");
  await expect(panel.locator('.vote-banner')).toContainText('Ben picks between the tied answers.');
  await expect(panel.locator('.choice-option.is-tied')).toHaveCount(3);
  const tieBefore = await page.evaluate(() => window.fnt!.app.state!);
  await panel.locator('.choice-option').filter({ hasText: 'Ask about the puzzle box' }).click();
  const tieExpected = apply(CONTENT, tieBefore, { type: 'chooseOption', optionIndex: 1 }).state;
  expect(await story(page)).toEqual(tieExpected.story);
  expect((await story(page)).deciderIndex).toBe(2);
});

test('a single player skips the vote and chooses at once', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Ava'], ['kaya', 'nilak', 'riko'], 'table-vote-solo', {
    storyChoices: 'vote',
  });
  await enterNode(page, 'plant_chair_talk');
  const panel = page.locator('.choice-panel');
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveAttribute('data-vote');
  await expect(page.locator('.decider-banner')).toHaveCount(0);
  const before = await page.evaluate(() => window.fnt!.app.state!);
  await panel.locator('.choice-option').filter({ hasText: 'Just sit' }).click();
  const expected = apply(CONTENT, before, { type: 'chooseOption', optionIndex: 2 }).state;
  expect(await story(page)).toEqual(expected.story);
});
