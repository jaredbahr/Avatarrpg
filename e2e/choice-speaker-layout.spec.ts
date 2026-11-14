import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame } from './helpers';
import type { LargeText } from './helpers';

// #627: a story choice keeps its speaker in view and is sized to its text. On
// an iPad either way up the speaker, the decider banner and every answer fit
// without scrolling; a phone may scroll, but a long name wraps whole rather
// than losing its end to an ellipsis. The table vote has its own spec.
test.use({ deviceScaleFactor: 2 });

const SIZES = ['off', 'on', 'huge'] as const satisfies readonly LargeText[];
const CHOICES = [
  { node: 'gate_parley', from: 'gate_escort_explore', speaker: 'The Quarry Gate', world: true },
  { node: 'plant_chair_talk', from: 'village_explore', speaker: 'Gao the Shopkeeper', world: true },
  { node: 'ruon_choice', from: 'gate_escort_explore', speaker: 'Captain Ruon', world: false },
] as const;

type Box = { left: number; top: number; right: number; bottom: number };

async function measure(page: Page) {
  return page.locator('.choice-panel').evaluate((panel) => {
    const edges = (r: DOMRect): Box => ({
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
    });
    const rect = (node: Element): Box => edges(node.getBoundingClientRect());
    /** The visible part of a node: the viewport cut by every clipping ancestor. */
    const clip = (node: Element): Box => {
      const box = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (!/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) continue;
        const r = parent.getBoundingClientRect();
        box.left = Math.max(box.left, r.left + parent.clientLeft);
        box.top = Math.max(box.top, r.top + parent.clientTop);
        box.right = Math.min(box.right, r.left + parent.clientLeft + parent.clientWidth);
        box.bottom = Math.min(box.bottom, r.top + parent.clientTop + parent.clientHeight);
      }
      return box;
    };
    const name = panel.querySelector<HTMLElement>(
      '.conversation-compact-speaker strong, .stage-head .name-plate h2',
    );
    const head = panel.closest('.stage')?.querySelector('.stage-head') ?? null;
    const speaker = name ?? head?.querySelector<HTMLElement>('.name-plate h2') ?? null;
    const range = document.createRange();
    if (speaker) range.selectNodeContents(speaker);
    return {
      tap:
        parseFloat(getComputedStyle(panel).getPropertyValue('--tap')) *
        parseFloat(getComputedStyle(document.documentElement).fontSize),
      scrollHeight: panel.scrollHeight,
      clientHeight: panel.clientHeight,
      speaker: speaker
        ? {
            text: speaker.textContent,
            box: rect(speaker),
            clip: clip(speaker),
            scrollWidth: speaker.scrollWidth,
            clientWidth: speaker.clientWidth,
            textOverflow: getComputedStyle(speaker).textOverflow,
            lines: [...range.getClientRects()].filter((r) => r.width > 0).map(edges),
          }
        : null,
      controls: [...panel.querySelectorAll('.decider-banner, .choice-option')].map((node) => ({
        text: node.textContent,
        box: rect(node),
        clip: clip(node),
      })),
    };
  });
}

function inside(box: Box, bounds: Box, label: string): void {
  expect.soft(box.left, label + ' left').toBeGreaterThanOrEqual(bounds.left - 1);
  expect.soft(box.top, label + ' top').toBeGreaterThanOrEqual(bounds.top - 1);
  expect.soft(box.right, label + ' right').toBeLessThanOrEqual(bounds.right + 1);
  expect.soft(box.bottom, label + ' bottom').toBeLessThanOrEqual(bounds.bottom + 1);
}

async function openChoice(page: Page, choice: (typeof CHOICES)[number], size: LargeText) {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Ava', 'Ben', 'Cleo'], ['kaya', 'sura', 'bo'], 'choice-speaker-627');
  await setLargeText(page, size);
  await enterNode(page, choice.from);
  await enterNode(page, choice.node);
  const panel = page.locator('.choice-panel');
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveAttribute('data-vote');
  await expect(page.locator('.explore-conversation .choice-panel')).toHaveCount(
    choice.world ? 1 : 0,
  );
  await expect(panel.locator('.decider-banner strong')).toHaveText('Ava');
  return panel;
}

for (const view of [
  { name: 'landscape', size: { width: 1180, height: 820 } },
  { name: 'upright', size: { width: 820, height: 1180 } },
] as const) {
  test.describe(`iPad ${view.name}`, () => {
    test.use({ viewport: view.size });
    for (const choice of CHOICES) {
      test(`${choice.node} keeps its speaker and every answer in view`, async ({ page }) => {
        for (const size of SIZES) {
          const panel = await openChoice(page, choice, size);
          const layout = await measure(page);
          const label = `${choice.node} at ${size}`;
          if (size === 'huge')
            await test.info().attach(label, {
              body: await page.screenshot(),
              contentType: 'image/png',
            });
          expect(layout.speaker?.text, label + ': speaker').toBe(choice.speaker);
          inside(layout.speaker!.box, layout.speaker!.clip, label + ': speaker name');
          for (const line of layout.speaker!.lines) inside(line, layout.speaker!.clip, label);
          expect
            .soft(layout.scrollHeight, label + ': no panel scroll')
            .toBeLessThanOrEqual(layout.clientHeight + 1);
          for (const control of layout.controls)
            inside(control.box, control.clip, `${label}: ${control.text}`);
          for (const option of await panel.locator('.choice-option').all()) {
            const box = await option.boundingBox();
            expect.soft(box?.height, label + ': tap height').toBeGreaterThanOrEqual(layout.tap - 1);
            expect.soft(box?.width, label + ': tap width').toBeGreaterThanOrEqual(layout.tap - 1);
          }
        }
        // The last answer is a real tap, and it takes the story on.
        const panel = page.locator('.choice-panel');
        const before = await page.evaluate(() => window.fnt!.app.state!.story.nodeId);
        await panel.locator('.choice-option:not([disabled])').last().tap();
        await expect
          .poll(() => page.evaluate(() => window.fnt!.app.state!.story.nodeId))
          .not.toBe(before);
      });
    }
  });
}

test.describe('phone upright', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('a long speaker name wraps whole instead of being cut off', async ({ page }) => {
    for (const choice of CHOICES.filter((c) => c.world)) {
      for (const size of SIZES) {
        await openChoice(page, choice, size);
        const name = page.locator('.conversation-compact-speaker strong');
        await name.scrollIntoViewIfNeeded();
        const layout = await measure(page);
        const label = `${choice.node} at ${size}`;
        expect(layout.speaker?.text, label).toBe(choice.speaker);
        expect.soft(layout.speaker!.textOverflow, label + ': no ellipsis').not.toBe('ellipsis');
        expect
          .soft(layout.speaker!.scrollWidth, label + ': name fits its plate')
          .toBeLessThanOrEqual(layout.speaker!.clientWidth + 1);
        for (const line of layout.speaker!.lines) inside(line, layout.speaker!.clip, label);
      }
    }
  });
});
