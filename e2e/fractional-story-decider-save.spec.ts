/** #683: reject a malformed saved story cursor before replacing a playable campaign. */
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import type { SaveBlob } from '../src/core/save/serialize';
import { resetStorage, settleLayout, waitForIdle } from './helpers';

test.describe.configure({ retries: 0, timeout: 60_000 });

async function snapshot(page: Page) {
  return page.evaluate(() => ({
    state: structuredClone(window.fnt!.app.state!),
    session: window.fnt!.app.session.toMeta(),
    slots: Object.fromEntries(
      ['slot1', 'slot2', 'slot3', 'auto'].map((slot) => [
        slot,
        localStorage.getItem(`fnt.save.${slot}`),
      ]),
    ),
  }));
}

async function walk(page: Page, pos: { x: number; y: number }): Promise<void> {
  const before = await snapshot(page);
  const expected = apply(CONTENT, before.state, { type: 'walkTo', pos });
  expect(expected.state.screen).toBe('explore');
  expect(expected.state.location.pos).toEqual(pos);
  await page.evaluate((target) => window.fnt!.app.dispatch({ type: 'walkTo', pos: target }), pos);
  const after = await snapshot(page);
  expect(after.state).toEqual(expected.state);
  expect(after.session).toEqual(before.session);
  await waitForIdle(page);
  await settleLayout(page);
}

/** Actual suggested setup, opening, legal walks, Wait and canonical Gao Talk. */
async function firstChoice(page: Page): Promise<void> {
  await resetStorage(page, '?style=topdown&renderer=canvas');
  await page.evaluate(() =>
    window.fnt!.app.updateSettings({ reduceMotion: true, storyChoices: 'vote', volume: 0 }),
  );
  await page.getByRole('button', { name: 'New game', exact: true }).tap();
  await page.getByRole('button', { name: '2 players', exact: true }).tap();
  await page.getByRole('button', { name: 'Start with the suggested party', exact: true }).tap();
  const advance = page.getByRole('button', { name: /^(Next|Continue)$/ });
  await expect(advance).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('act1_open');
  for (let index = 0; index < 3; index++) await advance.tap();
  await page.waitForFunction(() => window.fnt!.app.state?.screen === 'explore');
  await waitForIdle(page);
  const seat = await page.evaluate(() => {
    const app = window.fnt!.app;
    const rest = app.content.maps.get(app.state!.location.mapId)?.restSpots?.[0];
    if (!rest) throw new Error('No village rest spot');
    return rest.pos;
  });
  await walk(page, seat);
  await page.getByRole('button', { name: /^Wait/ }).tap();
  await page
    .getByRole('dialog', { name: 'Wait until…', exact: true })
    .getByRole('button', { name: /Afternoon/ })
    .tap();
  expect(await page.evaluate(() => window.fnt!.app.state!.world.clock.phase)).toBe('afternoon');
  await page.waitForFunction(
    () => {
      const gao = window
        .fnt!.app.residents.figures()
        .find((figure) => figure.npcId === 'shopkeeper_gao');
      return (
        gao?.pos &&
        !gao.walking &&
        gao.alpha === 1 &&
        gao.drawPos.x === gao.pos.x &&
        gao.drawPos.y === gao.pos.y
      );
    },
    undefined,
    { timeout: 10_000 },
  );
  const beside = await page.evaluate(() => {
    const app = window.fnt!.app;
    const map = app.content.maps.get(app.state!.location.mapId);
    const figures = app.residents.figures();
    const gao = figures.find((figure) => figure.npcId === 'shopkeeper_gao');
    if (!map || !gao?.pos) throw new Error('No canonical Gao');
    const target = gao.pos;
    const pos = [
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]
      .map((offset) => ({ x: target.x + offset.x, y: target.y + offset.y }))
      .find((candidate) => {
        const symbol = map.rows[candidate.y]?.[candidate.x];
        const tile = symbol === undefined ? undefined : map.legend[symbol];
        return (
          tile !== undefined &&
          !tile.blocked &&
          !figures.some((figure) => figure.pos?.x === candidate.x && figure.pos.y === candidate.y)
        );
      });
    if (!pos) throw new Error('No legal adjacent approach to Gao');
    return pos;
  });
  await walk(page, beside);
  await page.getByRole('button', { name: 'Look around', exact: true }).tap();
  await page
    .getByRole('dialog', { name: 'Look around', exact: true })
    .getByRole('button', { name: 'Visit Gao the Shopkeeper', exact: true })
    .tap();
  const current = await snapshot(page);
  expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe('canvas');
  expect(current.state.story.nodeId).toBe('plant_chair');
  expect(current.state.story.deciderIndex).toBe(0);
  expect(current.state.world.talk?.npcId).toBe('shopkeeper_gao');
  expect(current.session.participants).toEqual([
    { id: 'player-1', name: 'Player 1' },
    { id: 'player-2', name: 'Player 2' },
  ]);
  await expectFreshVote(page);
}

async function expectFreshVote(page: Page): Promise<void> {
  const panel = page.locator('.choice-panel');
  await expect(panel).toHaveAttribute('data-vote', 'pick');
  await expect(panel.locator('.vote-banner strong')).toHaveText('Player 1, your pick');
  await expect(panel.locator('.vote-banner')).toContainText('Table vote · 1 of 2');
  await expect(panel.locator('.vote-names, .is-winner, .is-tied')).toHaveCount(0);
  await expect(panel.locator('.choice-option:not([disabled])')).toHaveCount(2);
}

async function exportCurrent(page: Page, info: TestInfo) {
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  const paused = page.getByRole('dialog', { name: 'Paused', exact: true });
  await paused.getByRole('button', { name: 'Save game', exact: true }).tap();
  const save = page.getByRole('dialog', { name: 'Save game', exact: true });
  await save
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: 'Save here', exact: true })
    .tap();
  const before = await snapshot(page);
  expect(before.slots['slot1']).not.toBeNull();
  expect(before.slots['auto']).not.toBeNull();
  const pending = page.waitForEvent('download');
  await save.getByRole('button', { name: 'Export to file', exact: true }).tap();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(
    /^four-nations-tactics-lv\d+-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const path = info.outputPath('actual-export.json');
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  const bytes = await readFile(path);
  const blob = JSON.parse(bytes.toString('utf8')) as SaveBlob;
  expect(blob.state).toEqual(before.state);
  expect(blob.session).toEqual(before.session);
  expect(await snapshot(page)).toEqual(before);
  await info.attach('actual-export', { path, contentType: 'application/json' });
  await save.getByRole('button', { name: 'Close', exact: true }).tap();
  await paused.getByRole('button', { name: 'Resume', exact: true }).tap();
  return { blob, path };
}

async function openLoad(page: Page) {
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  await page
    .getByRole('dialog', { name: 'Paused', exact: true })
    .getByRole('button', { name: 'Load game', exact: true })
    .tap();
  return page.getByRole('dialog', { name: 'Load game', exact: true });
}

async function chooseFile(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  const pending = page.waitForEvent('filechooser');
  await page
    .getByRole('dialog', { name: 'Load game', exact: true })
    .getByRole('button', { name: 'Import from file', exact: true })
    .tap();
  await (await pending).setFiles(file);
}

async function ballotView(page: Page) {
  return page.locator('.choice-panel').evaluate((panel) => ({
    phase: panel.getAttribute('data-vote'),
    banner: panel.querySelector('.vote-banner')?.textContent,
    enabledAnswers: panel.querySelectorAll('.choice-option:not([disabled])').length,
    disabledAnswers: panel.querySelectorAll('.choice-option[disabled]').length,
    names: [...panel.querySelectorAll('.vote-names')].map((node) => node.textContent),
    winners: panel.querySelectorAll('.is-winner').length,
    tiedAnswers: panel.querySelectorAll('.is-tied').length,
  }));
}

test('a fractional saved story decider cannot replace a playable campaign', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await firstChoice(page);
  const exported = await exportCurrent(page, info);
  const malformed = structuredClone(exported.blob);
  expect(malformed.state.story.deciderIndex).toBe(0);
  malformed.state.story.deciderIndex = 0.5;
  const restoredCopy = structuredClone(malformed);
  restoredCopy.state.story.deciderIndex = exported.blob.state.story.deciderIndex;
  expect(restoredCopy).toEqual(exported.blob);
  const load = await openLoad(page);
  // Freeze the full game/session/slot bytes immediately before the real chooser import.
  const before = await snapshot(page);
  const beforeBallot = await ballotView(page);
  await chooseFile(page, {
    name: 'fractional-story-decider.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(malformed)),
  });
  const warning = page.locator('.toast').filter({
    hasText: 'This save looks damaged. Try another save file.',
  });
  // Either existing behavior accepted the file or the intended rejection is on screen.
  // This wait does not choose which behavior satisfies the assertions below.
  await expect
    .poll(async () => (await load.count()) === 0 || (await warning.isVisible()))
    .toBe(true);
  const after = await snapshot(page);
  const observed = {
    before,
    after,
    beforeBallot,
    afterBallot: await ballotView(page),
    loadDialogs: await load.count(),
    warnings: await page.locator('.toast').allTextContents(),
    errors,
    mutation: { field: 'state.story.deciderIndex', from: 0, to: 0.5, otherValuesEqual: true },
  };
  await info.attach('fractional-import-observation', {
    body: Buffer.from(JSON.stringify(observed)),
    contentType: 'application/json',
  });
  await page.screenshot({ path: info.outputPath('after-fractional-import.png') });
  expect(errors).toEqual([]);
  expect(
    after,
    'A malformed story decider must not replace the playable game or stored saves',
  ).toEqual(before);
  await expect(load).toBeVisible();
  await expect(warning).toHaveText('This save looks damaged. Try another save file.');
});

test('the untouched exported story cursor imports and completes an ordinary table vote', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await firstChoice(page);
  const exported = await exportCurrent(page, info);
  const load = await openLoad(page);
  const before = await snapshot(page);
  await chooseFile(page, exported.path);
  await expect(load).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
  await expectFreshVote(page);
  const imported = await ballotView(page);
  const panel = page.locator('.choice-panel');
  await panel.locator('.choice-option').filter({ hasText: 'Sit down' }).tap();
  await expect(panel).toHaveAttribute('data-vote', 'pass');
  await expect(panel.locator('.vote-banner strong')).toHaveText('Player 2');
  expect(await snapshot(page)).toEqual(before);
  await panel.getByRole('button', { name: "I'm ready", exact: true }).tap();
  await expect(panel.locator('.vote-banner strong')).toHaveText('Player 2, your pick');
  await panel.locator('.choice-option').filter({ hasText: 'Sit down' }).tap();
  await expect(panel).toHaveAttribute('data-vote', 'result');
  await expect(panel.locator('.vote-names')).toHaveText('Picked by Player 1, Player 2');
  expect(await snapshot(page)).toEqual(before);
  const expected = apply(CONTENT, before.state, { type: 'chooseOption', optionIndex: 0 }).state;
  await panel.getByRole('button', { name: 'Continue', exact: true }).tap();
  const after = await snapshot(page);
  expect(after.state).toEqual(expected);
  expect(after.state.story.deciderIndex).toBe(1);
  expect(after.session).toEqual(before.session);
  expect(errors).toEqual([]);
  await info.attach('valid-import-continuation', {
    body: Buffer.from(JSON.stringify({ before, imported, after, errors })),
    contentType: 'application/json',
  });
  await page.screenshot({ path: info.outputPath('after-valid-import-and-choice.png') });
});
