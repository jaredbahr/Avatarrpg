import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import {
  awardXp,
  disciplineUnlocked,
  levelUpOutcome,
  xpForLevel,
} from '../src/core/rules/leveling';
import { apply } from '../src/core/state/reducer';
import { earnedRewardFixture } from './earnedRewardFixture';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleDialog,
  startGame,
  waitForIdle,
} from './helpers';

// Phone profiles reproduce #492's shared card-grid overflow. The landscape
// and tablet controls retain the established 16rem multi-column layout.
const profiles = [
  { name: 'phone Normal', viewport: { width: 390, height: 844 }, size: 'off' },
  { name: 'phone Large', viewport: { width: 390, height: 844 }, size: 'on' },
  { name: 'phone Largest', viewport: { width: 390, height: 844 }, size: 'huge' },
  { name: 'short landscape Large', viewport: { width: 844, height: 390 }, size: 'on' },
  { name: 'tablet Large', viewport: { width: 820, height: 1180 }, size: 'on' },
] as const;

async function fitCards(dialog: Locator) {
  await settleDialog(dialog);
  const bounds = await dialog.evaluate((element) => {
    const body = element.querySelector<HTMLElement>(':scope > .stack');
    const grid = body?.querySelector<HTMLElement>('.choice-cards');
    if (!body || !grid) throw new Error('Missing card grid');
    const box = body.getBoundingClientRect();
    return {
      body: { left: box.left, right: box.right, width: body.clientWidth, scroll: body.scrollWidth },
      overflowX: getComputedStyle(body).overflowX,
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      cards: [...grid.children].map((card) => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
      text: [
        ...grid.querySelectorAll<HTMLElement>('h3, p, li, button, .chip, .stack.tight > span'),
      ].map((text) => ({
        label: text.textContent,
        width: text.clientWidth,
        scrollWidth: text.scrollWidth,
        height: text.clientHeight,
        scrollHeight: text.scrollHeight,
        ellipsis: getComputedStyle(text).textOverflow === 'ellipsis',
        lines: (() => {
          const card = text.closest('.ability-card')!.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(text);
          return [...range.getClientRects()]
            .filter((r) => r.width > 0)
            .map((r) => ({
              left: r.left,
              right: r.right,
              cardLeft: card.left,
              cardRight: card.right,
            }));
        })(),
      })),
    };
  });
  expect(bounds.body.scroll, 'no sideways scrolling to compare cards').toBeLessThanOrEqual(
    bounds.body.width + 1,
  );
  expect(bounds.overflowX, 'width is fixed by reflow, not horizontal clipping').not.toBe('hidden');
  expect(bounds.cards.length).toBeGreaterThan(0);
  for (const card of bounds.cards) {
    expect(card.left).toBeGreaterThanOrEqual(bounds.body.left - 1);
    expect(card.right).toBeLessThanOrEqual(bounds.body.right + 1);
  }
  for (const text of bounds.text) {
    expect(text.scrollWidth, `${text.label} wraps horizontally`).toBeLessThanOrEqual(
      text.width + 1,
    );
    expect(text.scrollHeight, `${text.label} has natural height`).toBeLessThanOrEqual(
      text.height + 1,
    );
    expect(text.ellipsis, `${text.label} is not abbreviated`).toBe(false);
    for (const line of text.lines) {
      expect(line.left, `${text.label} starts inside card`).toBeGreaterThanOrEqual(
        line.cardLeft - 1,
      );
      expect(line.right, `${text.label} ends inside card`).toBeLessThanOrEqual(line.cardRight + 1);
    }
  }
  return bounds;
}

async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 30; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Card control was not keyboard reachable');
}

async function reachable(page: Page, target: Locator) {
  await tabTo(page, target);
  await expect(target).toBeInViewport();
  const hit = await target.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const body = button.closest('.dialog')?.querySelector(':scope > .stack');
    if (!body) throw new Error('Missing dialog body');
    const box = body.getBoundingClientRect();
    return {
      contained:
        rect.left >= box.left &&
        rect.right <= box.right &&
        rect.top >= box.top &&
        rect.bottom <= box.bottom,
      hit: button.contains(
        document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
      ),
      height: rect.height,
      width: rect.width,
      tap:
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize) *
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap')),
    };
  });
  expect(hit.contained, 'whole focused control fits its scrolling body').toBe(true);
  expect(hit.hit, 'focused control receives a real pointer hit').toBe(true);
  expect(hit.height, 'tap floor scales with text').toBeGreaterThanOrEqual(hit.tap);
  expect(hit.width, 'tap width scales with text').toBeGreaterThanOrEqual(hit.tap);
}

function disciplineFixture() {
  // Layout boundary only: consume the fixture's earned level-3 picks through
  // the reducer, then use the real level-gain functions to offer level 5.
  // This does not claim the shipped route earns level 5 or test its balance.
  const fixture = earnedRewardFixture();
  let state = fixture.state;
  for (const choice of state.pendingChoices) {
    const abilityId = choice.options[0];
    if (!abilityId) throw new Error('Missing earned technique');
    state = apply(CONTENT, state, {
      type: 'chooseLevelUp',
      unitId: choice.unitId,
      abilityId,
    }).state;
  }
  const unit = state.party[0];
  if (!unit?.characterId) throw new Error('Missing reward character');
  const character = CONTENT.characters.get(unit.characterId);
  const gain = awardXp(CONTENT, unit, xpForLevel(5) - unit.xp, character);
  const outcome = levelUpOutcome(unit.id, gain);
  if (outcome.pendingChoices.length !== 1 || outcome.pendingChoices[0]?.kind !== 'discipline')
    throw new Error('Expected a real discipline offer');
  return {
    ...fixture,
    state: {
      ...state,
      party: state.party.map((u) => (u.id === unit.id ? gain.unit : u)),
      pendingChoices: outcome.pendingChoices,
    },
  };
}

for (const profile of profiles) {
  test.describe(profile.name, () => {
    test.use({ viewport: profile.viewport });
    for (const kind of ['reward', 'discipline'] as const) {
      test(`${kind} cards wrap and their real choice remains usable`, async ({ page }, info) => {
        const fixture = kind === 'reward' ? earnedRewardFixture() : disciplineFixture();
        await resetStorage(page, '?renderer=canvas');
        await page.evaluate(
          ({ state, session, size }) => {
            window.fnt!.app.updateSettings({ reduceMotion: true, largeText: size });
            window.fnt!.app.adoptSave(state, session);
          },
          { state: fixture.state, session: fixture.session, size: profile.size },
        );
        const dialog = page.getByRole('dialog');
        const before = await page.evaluate(() => window.fnt!.app.state!);
        const bounds = await fitCards(dialog);
        if (profile.name === 'short landscape Large') expect(bounds.columns).toBe(2);
        await info.attach('card-layout', {
          body: JSON.stringify(bounds),
          contentType: 'application/json',
        });
        await page.screenshot({ path: info.outputPath(`${kind}-top.png`) });
        const controls = dialog.getByRole('button', {
          name: kind === 'reward' ? /^Learn / : /^Take up /,
        });
        const count = await controls.count();
        const choice = before.pendingChoices[0];
        if (!choice) throw new Error('Missing real pending choice');
        expect(bounds.cards).toHaveLength(choice.options.length);
        const available = choice.options.filter((id) => {
          if (kind === 'reward') return true;
          const discipline = CONTENT.disciplines.get(id);
          if (!discipline) throw new Error('Missing discipline');
          return disciplineUnlocked(discipline, before.flags);
        });
        expect(count).toBe(available.length);
        if (kind === 'discipline') {
          await expect(dialog.getByRole('button', { name: 'Locked', exact: true })).toHaveCount(
            choice.options.length - available.length,
          );
          for (const locked of await dialog
            .getByRole('button', { name: 'Locked', exact: true })
            .all())
            await expect(locked).toBeDisabled();
        }
        for (let index = 0; index < count; index++) await reachable(page, controls.nth(index));
        const selected =
          kind === 'reward'
            ? choice.options[count - 1]
            : choice.options.find((id) => !CONTENT.disciplines.get(id)?.requiresFlag);
        if (!selected) throw new Error('Missing available choice');
        const label =
          kind === 'reward'
            ? `Learn ${CONTENT.abilities.get(selected)?.name}`
            : `Take up ${CONTENT.disciplines.get(selected)?.name}`;
        const control = dialog.getByRole('button', { name: label, exact: true });
        await reachable(page, control);
        await page.screenshot({ path: info.outputPath(`${kind}-choice.png`) });
        expect(await page.evaluate(() => window.fnt!.app.state!)).toEqual(before);
        await page.keyboard.press('Enter');
        const after = await page.evaluate(() => window.fnt!.app.state!);
        expect(after.pendingChoices).toEqual(before.pendingChoices.slice(1));
        const unit = after.party.find((u) => u.id === choice.unitId);
        if (kind === 'reward') expect(unit?.abilities).toContain(selected);
        else expect(unit?.disciplineId).toBe(selected);
        expect(after.story).toEqual(before.story);
        expect(after.flags).toEqual(before.flags);
      });
    }
    test('inspector technique cards wrap without changing the party', async ({ page }, info) => {
      await resetStorage(page, '?renderer=canvas');
      await startGame(page, ['Tala'], ['kaya'], 'card-layout-inspector');
      await enterNode(page, 'village_explore');
      await waitForIdle(page);
      await setLargeText(page, profile.size);
      const before = await page.evaluate(() => window.fnt!.app.state!);
      await page.locator('.roster-row').first().click();
      const dialog = page.getByRole('dialog');
      const bounds = await fitCards(dialog);
      await info.attach('card-layout', {
        body: JSON.stringify(bounds),
        contentType: 'application/json',
      });
      await dialog.locator('.choice-cards').hover();
      await page.mouse.wheel(0, 5000);
      await reachable(page, dialog.getByRole('button', { name: 'Close', exact: true }));
      await page.screenshot({ path: info.outputPath('inspector-controls.png') });
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      expect(await page.evaluate(() => window.fnt!.app.state!)).toEqual(before);
    });
  });
}
