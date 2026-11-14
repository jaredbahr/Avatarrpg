import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import { enterNode, resetStorage, startGame } from './helpers';

test.describe.configure({ retries: 0, timeout: 60_000 });

/** Supported choice setup, not an earned campaign checkpoint. */
async function prepare(page: Page, voters: number) {
  await resetStorage(page, '?renderer=canvas');
  await startGame(
    page,
    ['Ava', 'Ben', 'Cleo'].slice(0, voters),
    ['kaya', 'nilak', 'riko'].slice(0, voters),
    'vote-load-discovery',
    { storyChoices: 'vote' },
  );
  await enterNode(page, 'gate_escort_explore');
  await enterNode(page, 'gate_parley');
  await expectFreshVote(page, voters);
  return snapshot(page);
}

async function snapshot(page: Page) {
  return page.evaluate(() => ({
    state: structuredClone(window.fnt!.app.state!),
    session: window.fnt!.app.session.toMeta(),
  }));
}

async function expectFreshVote(page: Page, voters: number): Promise<void> {
  const panel = page.locator('.choice-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-vote', 'pick');
  await expect(panel.locator('.vote-banner')).toContainText(`Table vote · 1 of ${voters}`);
  await expect(panel.locator('.vote-banner strong')).toHaveText('Ava, your pick');
  await expect(panel.locator('.vote-banner')).toContainText('A tie goes to Ava.');
  await expect(panel.locator('.vote-names, .is-winner, .is-tied')).toHaveCount(0);
  await expect(panel.locator('[data-vote-control]')).toHaveCount(0);
  await expect(panel.locator('.choice-option:not([disabled])')).toHaveCount(2);
  await expect(panel.locator('.choice-option.is-locked')).toHaveCount(1);
  await expect(panel.locator('.choice-option.is-locked')).toBeDisabled();
}

async function saveSlot(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  await page
    .getByRole('dialog', { name: 'Paused', exact: true })
    .getByRole('button', { name: 'Save game', exact: true })
    .tap();
  const save = page.getByRole('dialog', { name: 'Save game', exact: true });
  await save
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: 'Save here', exact: true })
    .tap();
  await save.getByRole('button', { name: 'Close', exact: true }).tap();
  await page
    .getByRole('dialog', { name: 'Paused', exact: true })
    .getByRole('button', { name: 'Resume', exact: true })
    .tap();
}

async function loadSlot(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  await page
    .getByRole('dialog', { name: 'Paused', exact: true })
    .getByRole('button', { name: 'Load game', exact: true })
    .tap();
  const load = page.getByRole('dialog', { name: 'Load game', exact: true });
  await load
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: 'Load', exact: true })
    .tap();
  await expect(load).toHaveCount(0);
  await expect(page.locator('.choice-panel')).toBeVisible();
}

async function pick(page: Page, voter: string, label: string): Promise<void> {
  const panel = page.locator('.choice-panel');
  await expect(panel).toHaveAttribute('data-vote', 'pick');
  await expect(panel.locator('.vote-banner strong')).toHaveText(`${voter}, your pick`);
  await expect(panel.locator('.vote-names')).toHaveCount(0);
  await panel.locator('.choice-option').filter({ hasText: label }).tap();
}

async function handOff(page: Page, voter: string): Promise<void> {
  const panel = page.locator('.choice-panel');
  await expect(panel).toHaveAttribute('data-vote', 'pass');
  await expect(panel.locator('.vote-banner strong')).toHaveText(voter);
  await expect(panel.locator('.choice-option')).toHaveCount(0);
  await panel.getByRole('button', { name: "I'm ready", exact: true }).tap();
}

async function finishFreshVote(page: Page, voters: number): Promise<void> {
  const before = await snapshot(page);
  await expectFreshVote(page, voters);
  for (const [index, voter] of ['Ava', 'Ben', 'Cleo'].slice(0, voters).entries()) {
    if (index > 0) await handOff(page, voter);
    await pick(page, voter, 'Let the firebender');
  }
  const panel = page.locator('.choice-panel');
  await expect(panel).toHaveAttribute('data-vote', 'result');
  await expect(panel.locator('.choice-option.is-winner')).toContainText(
    `Picked by ${['Ava', 'Ben', 'Cleo'].slice(0, voters).join(', ')}`,
  );
  expect(await snapshot(page)).toEqual(before);
  await panel.getByRole('button', { name: 'Continue', exact: true }).tap();
  const expected = apply(CONTENT, before.state, { type: 'chooseOption', optionIndex: 1 }).state;
  const after = await snapshot(page);
  expect(after.state.story).toEqual(expected.story);
  expect(after.state.story.deciderIndex).toBe(1);
  expect(after.session).toEqual(before.session);
}

test('loading the pre-vote manual slot starts a fresh ballot in the same page', async ({
  page,
}, info) => {
  const saved = await prepare(page, 3);
  const panel = page.locator('.choice-panel');
  await saveSlot(page);
  await pick(page, 'Ava', 'Let the firebender');
  await expect(panel).toHaveAttribute('data-vote', 'pass');
  await expect(panel.locator('.vote-banner strong')).toHaveText('Ben');
  await loadSlot(page);
  const afterLoad = {
    mode: await panel.getAttribute('data-vote'),
    banner: await panel.locator('.vote-banner').innerText(),
    oldNames: await panel.locator('.vote-names').count(),
    oldResults: await panel.locator('.is-winner, .is-tied').count(),
    oldControls: await panel.locator('[data-vote-control]').count(),
    openOptions: await panel.locator('.choice-option:not([disabled])').count(),
    snapshot: await snapshot(page),
  };
  const shot = info.outputPath('same-page-after-manual-load.png');
  await page.screenshot({ path: shot });
  await info.attach('same-page-after-manual-load', { path: shot, contentType: 'image/png' });
  expect(afterLoad.snapshot.state.story).toEqual(saved.state.story);
  expect(afterLoad.snapshot).toEqual(saved);

  // Preserve the original positive control before asserting the captured same-page result:
  // the saved core state is valid, and a new module lifetime starts a fresh ballot.
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).tap();
  await expect(panel).toHaveAttribute('data-vote', 'pick');
  await expect(panel.locator('.vote-banner')).toContainText('Table vote · 1 of 3');
  const afterReload = {
    mode: await panel.getAttribute('data-vote'),
    banner: await panel.locator('.vote-banner').innerText(),
    snapshot: await snapshot(page),
  };
  const fresh = info.outputPath('reload-positive-control.png');
  await page.screenshot({ path: fresh });
  await info.attach('reload-positive-control', { path: fresh, contentType: 'image/png' });
  await info.attach('before-load-reload-observations', {
    body: Buffer.from(JSON.stringify({ saved, afterLoad, afterReload })),
    contentType: 'application/json',
  });
  expect(
    afterLoad.mode,
    'Actual Load should clear unsaved local ballots as the existing module contract promises',
  ).toBe('pick');
  expect(afterLoad.banner).toContain('Table vote · 1 of 3');
  expect(afterLoad.banner).toContain('Ava, your pick');
  expect(afterLoad.oldNames).toBe(0);
  expect(afterLoad.oldResults).toBe(0);
  expect(afterLoad.oldControls).toBe(0);
  expect(afterLoad.openOptions).toBe(2);
  expect(afterReload.snapshot).toEqual(saved);
  await finishFreshVote(page, 3);
});

for (const stage of ['result', 'tie'] as const) {
  test(`loading the pre-vote manual slot clears a ${stage} in the same page`, async ({
    page,
  }, info) => {
    const voters = stage === 'tie' ? 2 : 3;
    const saved = await prepare(page, voters);
    await saveSlot(page);
    await pick(page, 'Ava', 'Let the firebender');
    await handOff(page, 'Ben');
    await pick(page, 'Ben', 'Walk up and knock');
    if (stage === 'result') {
      await handOff(page, 'Cleo');
      await pick(page, 'Cleo', 'Let the firebender');
    }
    const panel = page.locator('.choice-panel');
    await expect(panel).toHaveAttribute('data-vote', stage);
    await expect(panel.locator('.vote-names')).toHaveCount(2);
    await expect(panel.locator(stage === 'tie' ? '.is-tied' : '.is-winner')).toHaveCount(
      stage === 'tie' ? 2 : 1,
    );
    expect(await snapshot(page)).toEqual(saved);

    // No reload, import, module reset or state rewriting between the stale vote and Load.
    await loadSlot(page);
    expect(await snapshot(page)).toEqual(saved);
    await expectFreshVote(page, voters);
    const shot = info.outputPath(`${stage}-after-manual-load.png`);
    await page.screenshot({ path: shot });
    await info.attach(`${stage}-after-manual-load`, { path: shot, contentType: 'image/png' });
    await finishFreshVote(page, voters);
  });
}
