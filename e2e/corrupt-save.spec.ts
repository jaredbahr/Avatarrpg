import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';

async function game(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app?.state) throw new Error('The game is missing');
    return { state: app.state, session: app.session.toMeta() };
  });
}

async function press(control: Locator, touch: boolean) {
  if (touch) await control.tap();
  else await control.click();
}

async function importFile(page: Page, json: string, touch: boolean) {
  const chooser = page.waitForEvent('filechooser');
  await press(page.getByRole('button', { name: 'Import from file', exact: true }), touch);
  await (
    await chooser
  ).setFiles({
    name: 'combat-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
}

test('a corrupt combat cursor cannot replace a playable game; a valid import still takes turns', async ({
  page,
}, testInfo) => {
  const backend = testInfo.project.name.includes('webgl') ? 'webgl' : 'canvas';
  const touch = Boolean(testInfo.project.use.hasTouch);
  await resetStorage(page, `?renderer=${backend}`);
  await startGame(page, ['Older', 'Partner'], ['kaya', 'bo'], 'cursor-save-older', {
    reduceMotion: false,
  });
  await enterNode(page, 'battle_forest_road');
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(backend);
  const saved = await page.evaluate(() => {
    const app = window.fnt?.app;
    if (!app?.saveTo('slot1')) throw new Error('Could not save the real combat fixture');
    const json = localStorage.getItem('fnt.save.slot1');
    if (!json) throw new Error('The combat save is missing');
    const blob = JSON.parse(json);
    const corrupt = JSON.parse(json);
    corrupt.state.battle.turnIndex = 0.5;
    return { json, corrupt: JSON.stringify(corrupt), seed: blob.state.seed };
  });

  await startGame(page, ['Current'], ['nilak'], 'cursor-save-current', { reduceMotion: false });
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  const before = await game(page);
  expect(before.state.seed).not.toBe(saved.seed);
  await press(page.getByRole('button', { name: 'Pause', exact: true }), touch);
  await press(
    page
      .getByRole('dialog', { name: 'Paused', exact: true })
      .getByRole('button', { name: 'Load game', exact: true }),
    touch,
  );
  const menu = page.getByRole('dialog', { name: 'Load game', exact: true });
  await importFile(page, saved.corrupt, touch);
  await expect(page.locator('.toast').last()).toHaveText(/This save looks damaged|Game loaded\./);
  const observed = await page.evaluate(() => {
    const app = window.fnt?.app;
    const battle = app?.state?.battle;
    return {
      seed: app?.state?.seed,
      phase: battle?.phase,
      turnIndex: battle?.turnIndex,
      activeId:
        battle?.units.find((unit) => unit.id === battle.order[battle.turnIndex])?.id ?? null,
      toasts: [...document.querySelectorAll('.toast')].map((node) => node.textContent),
    };
  });
  await testInfo.attach('corrupt-import-observation', {
    body: Buffer.from(JSON.stringify(observed, null, 2)),
    contentType: 'application/json',
  });
  await expect(page.locator('.toast').last()).toContainText(
    'This save looks damaged (state.battle.turnIndex).',
  );
  await expect(menu).toBeVisible();
  expect(await game(page)).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath('corrupt-import.png') });

  // The same FileReader/import/adoption path must still accept the untouched save.
  await importFile(page, saved.json, touch);
  await expect(menu).toHaveCount(0);
  await expect(page.locator('.toast').last()).toHaveText('Game loaded.');
  expect(await page.evaluate(() => window.fnt?.app.state?.seed)).toBe(saved.seed);
  expect(await takeTurn(page)).toBe(true);
  await waitForIdle(page);
  const turn = await page.evaluate(() => {
    const battle = window.fnt?.app.state?.battle;
    if (!battle) throw new Error('The imported battle is missing');
    const active = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
    if (active?.faction !== 'party') throw new Error('The imported turn has no player actor');
    return { round: battle.round, index: battle.turnIndex, activeId: active.id };
  });
  const end = page.getByRole('button', { name: /^End turn(?: \d+ AP left)?$/ });
  await expect(end).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('valid-import.png') });
  await press(end, touch);
  await expect(page.locator('.toast').last()).toContainText('Tap End turn again');
  await press(end, touch);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const battle = window.fnt?.app.state?.battle;
        return battle ? { round: battle.round, index: battle.turnIndex } : null;
      }),
    )
    .not.toEqual({ round: turn.round, index: turn.index });
});
