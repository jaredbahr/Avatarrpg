import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn } from './helpers';

const fights = [
  ['battle_forest_road', 'after_forest'],
  ['battle_quarry_gate', 'ruon_surrender'],
  ['battle_ambush', 'after_ambush'],
  ['battle_grumbler', 'act1_epilogue'],
] as const;

test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

async function winCurrentFight(page: Page): Promise<void> {
  expect(await takeTurn(page)).toBe(true);
  const phase = await page.evaluate(() => {
    const app = window.fnt!.app;
    const state = app.state!;
    const battle = state.battle!;
    const activeId = battle.order[battle.turnIndex];
    if (!activeId) throw new Error('No active unit for the result transition');
    // End a real active turn through the App after staging a won board. The
    // reducer, result card and Continue button still own the transition.
    app.state = {
      ...state,
      battle: {
        ...battle,
        units: battle.units.map((unit) => (unit.faction === 'enemy' ? { ...unit, hp: 0 } : unit)),
      },
    };
    app.resync();
    app.dispatch({ type: 'endTurn', unitId: activeId });
    return app.state?.battle?.phase;
  });
  expect(phase).toBe('victory');
  await expect(page.locator('.result-panel')).toBeVisible();
  await expect(page.locator('.result-banner')).toHaveCSS('background-color', /^rgb\(/);
}

async function reachResult(page: Page, nodeId: string): Promise<void> {
  await resetStorage(page, '?style=topdown&renderer=canvas');
  await startGame(page, ['Kaya', 'Nilak', 'Bo'], ['kaya', 'nilak', 'bo'], `post-fight-${nodeId}`, {
    reduceMotion: true,
  });
  if (nodeId === 'battle_quarry_gate') {
    // The gate's actual XP follows a forest win, as on the authored route.
    await enterNode(page, 'battle_forest_road');
    await winCurrentFight(page);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await enterNode(page, nodeId);
  await winCurrentFight(page);
}

for (const [battleNode, nextNode] of fights) {
  test(`${battleNode} Continue leaves combat behind before the next story beat`, async ({
    page,
  }, info) => {
    await reachResult(page, battleNode);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state?.story.nodeId))
      .toBe(nextNode);
    await expect(page.locator('.combat-scene')).toHaveCount(0);
    await expect(page.locator('.combat-bar, .combat-overlays')).toHaveCount(0);
    await expect(page.locator('.result-panel')).toHaveCount(0);
    const story = page.locator('.dialogue-scene, .explore-conversation:not([hidden])');
    await expect(story).toHaveCount(1);
    await expect(page.locator('.scene-host > .combat-scene')).toHaveCount(0);
    if (battleNode === 'battle_quarry_gate') {
      expect(
        await page.evaluate(() => window.fnt!.app.state?.pendingChoices.length),
      ).toBeGreaterThan(0);
    }

    for (let pick = 0; pick < 12 && (await page.getByRole('dialog').count()) > 0; pick++) {
      await expect(story).toBeHidden();
      await expect(page.locator('.scene-host.reward-first')).toHaveCount(1);
      const dialogueOwner = (await page.locator('.dialogue-layer').count())
        ? page.locator('.dialogue-layer')
        : story;
      await expect(dialogueOwner).toHaveAttribute('aria-hidden', 'true');
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /^(Learn|Take up) / })
        .first()
        .click();
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.scene-host.reward-first')).toHaveCount(0);
    await expect(story).toBeVisible();

    if (battleNode === 'battle_quarry_gate') {
      // This is the first visible post-gate dialogue, after every earned pick.
      await expect(page.locator('.result-panel')).toHaveCount(0);
      const image = info.outputPath('first-post-gate-dialogue.png');
      await page.screenshot({ path: image });
      await info.attach('first-post-gate-dialogue', { path: image, contentType: 'image/png' });
    }
  });
}

test('the demo-complete stage has a solid full-frame backdrop', async ({ page }) => {
  await resetStorage(page, '?style=topdown&renderer=canvas');
  await startGame(page, ['Kaya'], ['kaya'], 'post-fight-end', { reduceMotion: true });
  await enterNode(page, 'demo_complete');
  await expect(page.locator('.dialogue-scene.end-scene')).toBeVisible();
  await expect(page.locator('.dialogue-scene.end-scene')).toHaveCSS('background-color', /^rgb\(/);
  await expect(page.locator('.stage[data-kind="end"] .end-panel')).toBeVisible();
});
