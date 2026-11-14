import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { CONTENT } from '../src/content';
import { enterNode, resetStorage, setLargeText, settleDialog, startGame } from './helpers';

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

async function expectTextToFit(root: Locator) {
  await expect(root).toBeVisible();
  const result = await root.evaluate(async (scope) => {
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

      // Inline and display:contents elements have no measurable element box.
      const box = element.closest<HTMLElement>('button, input, select, textarea') ?? element;
      if (!box.clientWidth || !box.clientHeight || checked.has(box)) continue;
      checked.add(box);
      const boxStyle = getComputedStyle(box);
      const widthOverflow = box.scrollWidth > box.clientWidth + 1;
      const heightOverflow = box.scrollHeight > box.clientHeight + 1;
      const permitsScroll = (value: string) => value === 'auto' || value === 'scroll';
      if (widthOverflow && !permitsScroll(boxStyle.overflowX)) {
        overflow.push(`${label} width ${box.scrollWidth}/${box.clientWidth}`);
      }
      // Visible font overhang can extend beyond a line box without losing ink.
      if (
        heightOverflow &&
        boxStyle.overflowY !== 'visible' &&
        !permitsScroll(boxStyle.overflowY)
      ) {
        overflow.push(`${label} height ${box.scrollHeight}/${box.clientHeight}`);
      }
    }
    return { checked: checked.size, overflow };
  });
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
  });
}
