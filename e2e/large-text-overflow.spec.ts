import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { CONTENT } from '../src/content';
import { awardXp, levelUpOutcome, xpForLevel } from '../src/core/rules/leveling';
import { apply } from '../src/core/state/reducer';
import { earnedRewardFixture } from './earnedRewardFixture';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleDialog,
  settleMapCanvas,
  startGame,
  takeTurn,
  waitForIdle,
} from './helpers';
import { paintedTileCentre } from './projection';

const layouts = [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'iPad landscape', width: 1194, height: 834 },
] as const;

const story = [...CONTENT.story.values()];
const longestLine = story
  .flatMap((node) =>
    node.kind === 'dialogue'
      ? [node.lines, ...(node.variants ?? []).map(({ lines }) => lines)].flatMap((lines) =>
          lines.map((text, index) => ({ node, text, index })),
        )
      : [],
  )
  .sort((a, b) => b.text.length - a.text.length)[0]!;
const longestOption = story
  .flatMap((node) =>
    node.kind === 'choice'
      ? node.options.map((option, index) => ({
          node,
          option,
          index,
          length: option.label.length + option.detail.length + (option.lockedHint?.length ?? 0),
        }))
      : [],
  )
  .sort((a, b) => b.length - a.length)[0]!;

function disciplineFixture() {
  const { state, session } = earnedRewardFixture();
  const earned = state.pendingChoices.reduce(
    (current, choice) =>
      apply(CONTENT, current, {
        type: 'chooseLevelUp',
        unitId: choice.unitId,
        abilityId: choice.options[0]!,
      }).state,
    state,
  );
  const unit = earned.party[0]!;
  const gain = awardXp(
    CONTENT,
    unit,
    xpForLevel(5) - unit.xp,
    CONTENT.characters.get(unit.characterId!),
  );
  const { pendingChoices } = levelUpOutcome(unit.id, gain);
  expect(pendingChoices.map(({ kind }) => kind)).toEqual(['discipline']);
  return {
    state: {
      ...earned,
      party: earned.party.map((member) => (member.id === unit.id ? gain.unit : member)),
      pendingChoices,
    },
    session,
  };
}

// The preview reserves two lines so changing the selected action cannot shift
// the target under a player's finger. The combat test reads the same copy in
// full on its inspector card.
const selectedAbilityPreview = '.ability-header .header-desc';

async function expectTextToFit(root: Locator, allowedEllipsis: readonly string[] = []) {
  await expect(root).toBeVisible();
  const result = await root.evaluate(async (scope, ellipsis) => {
    await document.fonts.ready;
    const text = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const checked = new Set<Element>();
    const overflow: string[] = [];
    for (let node = text.nextNode(); node; node = text.nextNode()) {
      const label = node.textContent?.trim();
      const element = node.parentElement;
      if (!label || !element || element.closest('.visually-hidden, [hidden]')) continue;
      range.selectNodeContents(node);
      if (![...range.getClientRects()].some((rect) => rect.width > 0 && rect.height > 0)) continue;
      const style = getComputedStyle(element);
      if (style.visibility !== 'visible') continue;
      if (style.position === 'absolute' && style.clip === 'rect(0px, 0px, 0px, 0px)') continue;

      // Inline and display:contents elements have no measurable element box.
      const box = element.clientWidth ? element : (element.closest('button') ?? element);
      if (!box.clientWidth || !box.clientHeight || checked.has(box)) continue;
      checked.add(box);
      const boxStyle = getComputedStyle(box);
      if (ellipsis.some((selector) => box.matches(selector))) continue;
      const widthOverflow = box.scrollWidth > box.clientWidth + 1;
      const heightOverflow = box.scrollHeight > box.clientHeight + 1;
      const permitsScroll = (value: string) => value === 'auto' || value === 'scroll';
      if (widthOverflow && !permitsScroll(boxStyle.overflowX)) {
        overflow.push(`${label} width ${box.scrollWidth}/${box.clientWidth}`);
      }
      // Visible font overhang can extend beyond a line box without losing ink.
      if (
        heightOverflow &&
        boxStyle.whiteSpace !== 'nowrap' &&
        boxStyle.overflowY !== 'visible' &&
        !permitsScroll(boxStyle.overflowY)
      ) {
        overflow.push(`${label} height ${box.scrollHeight}/${box.clientHeight}`);
      }
    }
    return { checked: checked.size, overflow };
  }, allowedEllipsis);
  expect(result.checked, 'visible text boxes inspected').toBeGreaterThan(0);
  expect(result.overflow).toEqual([]);
}

for (const { name, width, height } of layouts) {
  test.describe(name, () => {
    test.use({ viewport: { width, height } });

    test.beforeEach(async ({ page }) => {
      await resetStorage(page, '?renderer=canvas&titleArt=a&titleArtHold=0');
      await setLargeText(page, 'on');
      await expect(page.locator('html')).toHaveAttribute('data-large-text', 'on');
    });

    test('title and Settings text fit at Large text', async ({ page }) => {
      await expectTextToFit(page.locator('.title-card'));
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
      await expect(dialog).toBeVisible();
      await settleDialog(dialog);
      await expectTextToFit(dialog);
    });

    test('the party setup text fits at Large text', async ({ page }) => {
      await page.getByRole('button', { name: 'New game', exact: true }).click();
      await page.getByRole('button', { name: '1 player', exact: true }).click();
      await page.getByRole('button', { name: 'Choose your own', exact: true }).click();
      const name = page.getByRole('textbox', { name: 'Your name', exact: true });
      await expect(name).toBeVisible();
      await expectTextToFit(page.locator('.setup-panel'));
      await name.fill('Aster');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expectTextToFit(page.locator('.setup-panel'));
    });

    test('the ending summary text fits at Large text', async ({ page }) => {
      await startGame(page, ['Aster'], ['kaya'], 'large-text-overflow');
      await enterNode(page, 'demo_complete');
      const summary = page.locator('.stage[data-kind="end"] .end-panel');
      await expect(summary.getByRole('heading', { name: 'Home to Ba Dan' })).toBeVisible();
      await expectTextToFit(summary);
    });

    test('the longest authored dialogue line fits at Large text', async ({ page }) => {
      await startGame(page, ['Aster'], ['kaya'], 'large-text-overflow');
      await enterNode(page, 'village_explore');
      await enterNode(page, longestLine.node.id);
      const panel = page.locator('.conversation-panel');
      for (let index = 0; index < longestLine.index; index++) {
        await panel.locator('[data-conversation-control="next"]').tap();
      }
      await expect(panel.locator('.dialogue-line')).toHaveText(longestLine.text);
      await expectTextToFit(panel);
    });

    test('the longest authored choice fits at Large text', async ({ page }) => {
      await startGame(page, ['Aster'], ['kaya'], 'large-text-overflow');
      await enterNode(page, 'gate_escort_explore');
      await enterNode(page, longestOption.node.id);
      const panel = page.locator('.conversation-panel');
      const option = panel.locator('.choice-option').nth(longestOption.index);
      await expect(option.locator('strong')).toHaveText(longestOption.option.label);
      await expect(option).toContainText(longestOption.option.detail);
      if (longestOption.option.lockedHint) {
        await expect(option).toBeDisabled();
        await expect(option).toContainText(longestOption.option.lockedHint);
      }
      await expectTextToFit(panel);
    });

    test('the exploration dock and expanded objective fit at Large text', async ({ page }) => {
      await startGame(page, ['Aster'], ['kaya'], 'large-text-overflow');
      await enterNode(page, 'village_explore');
      const objective = page.locator('.explore-objective');
      await expect(objective).toHaveAttribute('aria-expanded', 'true');
      await expectTextToFit(objective);
      await expectTextToFit(page.locator('.explore-dock'));
    });

    test('the action header and combat inspector fit at Large text', async ({ page }) => {
      await startGame(page, ['Aster'], ['kaya'], 'large-text-overflow');
      await enterNode(page, 'battle_forest_road');
      expect(await takeTurn(page)).toBe(true);
      await waitForIdle(page);
      await page.getByRole('button', { name: 'Skip guidance', exact: true }).click();
      const ability = page.getByRole('button', { name: /^Fire Jab/ });
      await ability.click();
      await expect(ability).toHaveClass(/\bselected\b/);
      const description = CONTENT.abilities.get('fire_jab')!.description;
      await expect(page.locator(selectedAbilityPreview)).toHaveText(description);
      await expectTextToFit(page.locator('.combat-bar'));
      await expectTextToFit(page.locator('.action-bar'), [selectedAbilityPreview]);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();

      await settleMapCanvas(page);
      const position = await page.evaluate(
        () => window.fnt!.app.state!.battle!.units.find(({ faction }) => faction === 'party')!.pos,
      );
      const point = await paintedTileCentre(page, position);
      if (!point) throw new Error('Kaya has no painted position');
      expect(
        await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y) === document.querySelector('.map-canvas'),
          point,
        ),
        'Kaya can be inspected on the painted board',
      ).toBe(true);
      await page.touchscreen.tap(point.x, point.y);
      const inspector = page.getByRole('dialog');
      await expect(inspector.getByRole('heading', { level: 2 })).toContainText('Kaya');
      const fullCopy = inspector.getByText(description, { exact: true });
      await fullCopy.scrollIntoViewIfNeeded();
      await expect(fullCopy).toBeInViewport();
      await expectTextToFit(fullCopy);
      await expectTextToFit(inspector);
    });

    for (const kind of ['reward', 'discipline'] as const) {
      test(`the ${kind} pick fits at Large text`, async ({ page }) => {
        const { state, session } = kind === 'reward' ? earnedRewardFixture() : disciplineFixture();
        await page.evaluate(({ state, session }) => window.fnt!.app.adoptSave(state, session), {
          state,
          session,
        });
        const dialog = page.getByRole('dialog').filter({
          has: page.getByRole('button', { name: kind === 'reward' ? /^Learn / : /^Take up / }),
        });
        await expect(dialog).toBeVisible();
        await settleDialog(dialog);
        await expectTextToFit(dialog);
      });
    }
  });
}
