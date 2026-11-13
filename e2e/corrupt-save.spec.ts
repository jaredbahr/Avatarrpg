import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, startGame, takeTurn, waitForIdle } from './helpers';

// Pinned to the oblique look until migrated or deleted at T7 (ADR 0104 T6).

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
  const warning = page.locator('.toast.toast-warn').last();
  await expect(warning).toHaveText('This save looks damaged. Try another save file.');
  await expect(warning).toBeVisible();
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
    const app = window.fnt?.app;
    const battle = app?.state?.battle;
    if (!app || !battle) throw new Error('The imported battle is missing');
    const active = battle.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
    if (active?.faction !== 'party') throw new Error('The imported turn has no player actor');
    return {
      round: battle.round,
      index: battle.turnIndex,
      activeId: active.id,
      name: active.name,
      ap: active.ap,
      backend: app.rendererBackend(),
    };
  });
  expect(turn.backend).toBe(backend);
  expect(turn.ap).toBeGreaterThan(0);
  const end = page.getByRole('button', { name: /^End turn(?: \d+ AP left)?$/ });
  await expect(end).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('valid-import.png') });
  await end.scrollIntoViewIfNeeded();
  const probe = await end.evaluateHandle((button) => {
    const rect = button.getBoundingClientRect();
    const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    if (!button.contains(document.elementFromPoint(point.x, point.y)))
      throw new Error('The rendered End turn action is covered');
    const seen = new Set(document.querySelectorAll('.toast'));
    const events: Array<{
      trusted: boolean;
      round: number | undefined;
      index: number | undefined;
      newToasts: string[];
    }> = [];
    // Observe after the button handler. This records the real first warning
    // and its unchanged turn without a browser round trip between inputs.
    const observe = (event: MouseEvent) => {
      if (!(event.target instanceof Node) || !button.contains(event.target)) return;
      const battle = window.fnt?.app.state?.battle;
      const added = [...document.querySelectorAll('.toast')].filter((node) => !seen.has(node));
      added.forEach((node) => seen.add(node));
      events.push({
        trusted: event.isTrusted,
        round: battle?.round,
        index: battle?.turnIndex,
        newToasts: added.map((node) => node.textContent ?? ''),
      });
    };
    document.addEventListener('click', observe, { passive: true });
    return { point, events, stop: () => document.removeEventListener('click', observe) };
  });
  try {
    const point = await probe.evaluate(({ point }) => point);
    // Repeating locator actionability on software GL took 7.7 seconds and
    // expired the real confirmation. Keep the game's original clocks and
    // send the two genuine inputs together after the target checks above.
    if (touch) {
      await page.touchscreen.tap(point.x, point.y);
      await page.touchscreen.tap(point.x, point.y);
    } else await page.mouse.dblclick(point.x, point.y);
    const events = await probe.evaluate(({ events }) => events);
    await testInfo.attach('native-end-turn-observations', {
      body: Buffer.from(JSON.stringify(events, null, 2)),
      contentType: 'application/json',
    });
    expect(events.map((event) => event.trusted)).toEqual([true, true]);
    expect(events[0]).toMatchObject({ round: turn.round, index: turn.index });
    expect(events[0]?.newToasts).toContain(
      `${turn.name} still has ${turn.ap} AP. Tap End turn again to finish anyway.`,
    );
  } finally {
    await probe.evaluate(({ stop }) => stop());
  }
  await expect
    .poll(() =>
      page.evaluate(() => {
        const battle = window.fnt?.app.state?.battle;
        return battle ? { round: battle.round, index: battle.turnIndex } : null;
      }),
    )
    .not.toEqual({ round: turn.round, index: turn.index });
});
