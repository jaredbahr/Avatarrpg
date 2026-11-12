import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import { resetStorage, settleLayout, waitForIdle } from './helpers';

test.describe.configure({ retries: 0, timeout: 60_000 });

async function snapshot(page: Page) {
  return page.evaluate(() => ({
    state: structuredClone(window.fnt!.app.state!),
    session: window.fnt!.app.session.toMeta(),
  }));
}

async function walk(page: Page, pos: { x: number; y: number }): Promise<void> {
  const before = await snapshot(page);
  const expected = apply(CONTENT, before.state, { type: 'walkTo', pos });
  expect(expected.state.screen).toBe('explore');
  expect(expected.state.location.pos).toEqual(pos);
  await page.evaluate((target) => window.fnt!.app.dispatch({ type: 'walkTo', pos: target }), pos);
  expect(await snapshot(page)).toEqual({ state: expected.state, session: before.session });
  await waitForIdle(page);
  await settleLayout(page);
}

/** Two real suggested setups, opening dialogue, Wait and canonical Talk; only walking uses commands. */
async function newFirstChoice(page: Page) {
  await page.getByRole('button', { name: 'New game', exact: true }).tap();
  await page.getByRole('button', { name: '2 players', exact: true }).tap();
  await page.getByRole('button', { name: 'Start with the suggested party', exact: true }).tap();
  const advance = page.getByRole('button', { name: /^(Next|Continue)$/ });
  await expect(advance).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('act1_open');
  // The opening uses visual cutscene controls rather than world-conversation data attributes.
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
      const resident = window
        .fnt!.app.residents.figures()
        .find((figure) => figure.npcId === 'shopkeeper_gao');
      return (
        resident?.pos &&
        !resident.walking &&
        resident.alpha === 1 &&
        resident.drawPos.x === resident.pos.x &&
        resident.drawPos.y === resident.pos.y
      );
    },
    undefined,
    { timeout: 10_000 },
  );
  const beside = await page.evaluate(() => {
    const app = window.fnt!.app;
    const state = app.state!;
    const map = app.content.maps.get(state.location.mapId);
    const figures = app.residents.figures();
    const gao = figures.find((figure) => figure.npcId === 'shopkeeper_gao');
    if (!map || !gao?.pos) throw new Error('No canonical Gao');
    const target = gao.pos;
    const offsets = [
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    const pos = offsets
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
  await expect(page.locator('.choice-panel')).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.state!.story.nodeId)).toBe('plant_chair');
  expect(
    await page.evaluate(() => window.fnt!.app.state!.flags['guidance.firstFightEligible']),
  ).toBe(true);
  return snapshot(page);
}

async function ballotView(page: Page) {
  return page.locator('.choice-panel').evaluate((panel) => ({
    phase: panel.getAttribute('data-vote'),
    banner: panel.querySelector('.vote-banner')?.textContent,
    names: [...panel.querySelectorAll('.vote-names')].map((node) => node.textContent),
    winners: panel.querySelectorAll('.is-winner').length,
    ties: panel.querySelectorAll('.is-tied').length,
    options: [...panel.querySelectorAll<HTMLButtonElement>('.choice-option')].map((node) => ({
      text: node.querySelector('strong')?.textContent,
      disabled: node.disabled,
    })),
  }));
}

async function expectFresh(page: Page): Promise<void> {
  const panel = page.locator('.choice-panel');
  await expect(
    panel,
    'A new campaign must not retain the previous campaign hand-off',
  ).toHaveAttribute('data-vote', 'pick');
  await expect(panel.locator('.vote-banner strong')).toHaveText('Player 1, your pick');
  await expect(panel.locator('.vote-banner')).toContainText('Table vote · 1 of 2');
  await expect(panel.locator('.vote-banner')).toContainText('A tie goes to Player 1.');
  await expect(panel.locator('.vote-names, .is-winner, .is-tied')).toHaveCount(0);
  await expect(panel.locator('[data-vote-control]')).toHaveCount(0);
  await expect(panel.locator('.choice-option:not([disabled])')).toHaveCount(2);
}

async function pick(page: Page, voter: string, option: 'Sit down' | 'Another time'): Promise<void> {
  const panel = page.locator('.choice-panel');
  await expect(panel).toHaveAttribute('data-vote', 'pick');
  await expect(panel.locator('.vote-banner strong')).toHaveText(`${voter}, your pick`);
  await expect(panel.locator('.vote-names')).toHaveCount(0);
  await panel.locator('.choice-option').filter({ hasText: option }).tap();
}

async function handOff(page: Page): Promise<void> {
  const panel = page.locator('.choice-panel');
  await expect(panel).toHaveAttribute('data-vote', 'pass');
  await expect(panel.locator('.vote-banner strong')).toHaveText('Player 2');
  await expect(panel.locator('.choice-option')).toHaveCount(0);
  await panel.getByRole('button', { name: "I'm ready", exact: true }).tap();
  await expect(panel.locator('.vote-banner')).toContainText('Table vote · 2 of 2');
}

async function quit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  const paused = page.getByRole('dialog', { name: 'Paused', exact: true });
  await paused.getByRole('button', { name: 'Quit to title', exact: true }).tap();
  await paused.getByRole('button', { name: 'Quit', exact: true }).tap();
  await expect(page.locator('.title-scene')).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.state)).toBeNull();
}

for (const oldPhase of ['pass', 'result', 'tie'] as const) {
  test(`Quit then a second suggested new game clears its previous ${oldPhase} ballot`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, '?style=topdown&renderer=canvas');
    await page.evaluate(() =>
      window.fnt!.app.updateSettings({ reduceMotion: true, storyChoices: 'vote', volume: 0 }),
    );
    const first = await newFirstChoice(page);
    const panel = page.locator('.choice-panel');
    await expectFresh(page);
    await pick(page, 'Player 1', 'Sit down');
    if (oldPhase !== 'pass') {
      await handOff(page);
      await pick(page, 'Player 2', oldPhase === 'tie' ? 'Another time' : 'Sit down');
    }
    await expect(panel).toHaveAttribute('data-vote', oldPhase);
    if (oldPhase === 'result') {
      await expect(panel.locator('.is-winner')).toHaveCount(1);
      await expect(panel.locator('.vote-names')).toHaveText('Picked by Player 1, Player 2');
    } else if (oldPhase === 'tie') {
      await expect(panel.locator('.is-tied')).toHaveCount(2);
      await expect(panel.locator('.vote-banner')).toContainText("It's a tie!");
    } else {
      await expect(panel.locator('.vote-banner strong')).toHaveText('Player 2');
    }
    expect(await snapshot(page)).toEqual(first);
    const oldBallot = await ballotView(page);
    await page.screenshot({ path: info.outputPath(`old-game-${oldPhase}-vote.png`) });
    await quit(page);
    const second = await newFirstChoice(page);
    const freshBallot = await ballotView(page);
    await info.attach('newgame-ballot-observation', {
      body: Buffer.from(
        JSON.stringify({
          oldPhase,
          first,
          second,
          oldBallot,
          freshBallot,
          limits:
            'Actual suggested setup/opening/wait/Talk/Quit/New game; legal reducer-checked walk commands. No loading or forced story/cache state.',
        }),
      ),
      contentType: 'application/json',
    });
    await page.screenshot({ path: info.outputPath('new-game-first-choice.png') });
    expect(second.session).toEqual(first.session);
    expect(second.state.story.deciderIndex).toBe(0);
    expect(second.state.seed).not.toBe(first.state.seed);
    expect(second.state.rng).not.toBe(first.state.rng);
    // Only a fresh campaign's seed/RNG may differ after repeating the identical route.
    expect({
      ...second,
      state: { ...second.state, seed: first.state.seed, rng: first.state.rng },
    }).toEqual(first);
    expect(errors).toEqual([]);
    await expectFresh(page);

    await pick(page, 'Player 1', 'Sit down');
    const partial = await ballotView(page);
    expect(await snapshot(page)).toEqual(second);
    // A regular Settings sync rebuilds the scene; it must preserve this game's partial vote.
    await page.evaluate(() => {
      const app = window.fnt!.app;
      app.updateSettings({ showGrid: !app.settings.showGrid });
    });
    expect(await ballotView(page)).toEqual(partial);
    expect(await snapshot(page)).toEqual(second);
    await handOff(page);
    await pick(page, 'Player 2', 'Sit down');
    await expect(panel).toHaveAttribute('data-vote', 'result');
    await expect(panel.locator('.is-winner')).toHaveCount(1);
    await expect(panel.locator('.vote-names')).toHaveText('Picked by Player 1, Player 2');
    expect(await snapshot(page)).toEqual(second);
    const resultBallot = await ballotView(page);
    const expected = apply(CONTENT, second.state, { type: 'chooseOption', optionIndex: 0 }).state;
    await panel.getByRole('button', { name: 'Continue', exact: true }).tap();
    const after = await snapshot(page);
    expect(after).toEqual({ state: expected, session: second.session });
    expect(after.state.story.deciderIndex).toBe(1);
    await info.attach('fresh-game-voting-observation', {
      body: Buffer.from(JSON.stringify({ partial, resultBallot, after })),
      contentType: 'application/json',
    });
    expect(errors).toEqual([]);
  });
}
