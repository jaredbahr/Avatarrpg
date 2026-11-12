import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import { enterNode, resetStorage, setLargeText, startGame } from './helpers';
import type { LargeText } from './helpers';

// The owner reproduced #664 on an iPad landscape viewport. Chromium supplies
// coding coverage here; physical iPad/Safari acceptance remains separate.
test.use({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });

/** Measure before any option click can scroll its clipped answer into view. */
async function expectVoteFits(page: Page, phase: string): Promise<void> {
  const panel = page.locator('.choice-panel');
  const layout = await panel.evaluate((element) => {
    const rect = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const controls = [
      ...element.querySelectorAll(
        '.vote-banner, .vote-banner > *, .choice-option, .choice-option > *',
      ),
    ].map((node) => {
      const clips = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) {
          const r = rect(parent);
          const left = r.left + parent.clientLeft;
          const top = r.top + parent.clientTop;
          clips.push({
            name: parent.className,
            left,
            top,
            right: left + parent.clientWidth,
            bottom: top + parent.clientHeight,
          });
        }
      }
      return { text: node.textContent, ...rect(node), clips };
    });
    const style = getComputedStyle(element);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      answers: [...element.querySelectorAll('.choice-option')].map(rect),
      banner: rect(element.querySelector('.vote-banner')!),
      fontSize: getComputedStyle(document.documentElement).fontSize,
      tap:
        parseFloat(style.getPropertyValue('--tap')) *
        parseFloat(getComputedStyle(document.documentElement).fontSize),
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      controls,
    };
  });
  await test.info().attach(`${phase}-layout`, {
    body: JSON.stringify(layout, null, 2),
    contentType: 'application/json',
  });
  if (phase === 'pick-1' || phase === 'result' || phase === 'tie')
    await test.info().attach(`${phase}-screen`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  expect.soft(layout.scrollTop, phase + ': no prior vertical scroll').toBe(0);
  expect
    .soft(layout.documentWidth, phase + ': no document overflow')
    .toBeLessThanOrEqual(layout.viewport.width + 1);
  expect.soft(layout.scrollLeft, phase + ': no prior horizontal scroll').toBe(0);
  expect
    .soft(layout.scrollHeight, phase + ': answers need no panel scroll')
    .toBeLessThanOrEqual(layout.clientHeight + 1);
  expect
    .soft(layout.scrollWidth, phase + ': no horizontal panel scroll')
    .toBeLessThanOrEqual(layout.clientWidth + 1);
  for (const control of layout.controls) {
    const label = phase + ': ' + control.text;
    expect.soft(control.right - control.left, label + ': visible width').toBeGreaterThan(0);
    expect.soft(control.bottom - control.top, label + ': visible height').toBeGreaterThan(0);
    expect.soft(control.left, label).toBeGreaterThanOrEqual(-1);
    expect.soft(control.top, label).toBeGreaterThanOrEqual(-1);
    expect.soft(control.right, label).toBeLessThanOrEqual(layout.viewport.width + 1);
    expect.soft(control.bottom, label).toBeLessThanOrEqual(layout.viewport.height + 1);
    for (const clip of control.clips) {
      const message = label + ' inside ' + clip.name;
      expect.soft(control.left, message).toBeGreaterThanOrEqual(clip.left - 1);
      expect.soft(control.top, message).toBeGreaterThanOrEqual(clip.top - 1);
      expect.soft(control.right, message).toBeLessThanOrEqual(clip.right + 1);
      expect.soft(control.bottom, message).toBeLessThanOrEqual(clip.bottom + 1);
    }
  }
  let previousBottom = layout.banner.bottom;
  for (const answer of layout.answers) {
    expect
      .soft(answer.top, phase + ': answers do not overlap')
      .toBeGreaterThanOrEqual(previousBottom - 1);
    previousBottom = answer.bottom;
  }
  for (const control of await panel.locator('button').all()) {
    const box = await control.boundingBox();
    expect.soft(box?.width, phase + ': tap width').toBeGreaterThanOrEqual(layout.tap - 1);
    expect.soft(box?.height, phase + ': tap height').toBeGreaterThanOrEqual(layout.tap - 1);
  }
}

for (const size of ['off', 'on', 'huge'] as const satisfies readonly LargeText[]) {
  for (const kind of ['gate', 'chair', 'custody'] as const) {
    test(`${kind} table vote fits every step at ${size} text`, async ({ page }) => {
      await resetStorage(page, '?renderer=canvas');
      const names = kind === 'custody' ? ['Ava', 'Ben'] : ['Ava', 'Ben', 'Cleo'];
      await startGame(page, names, ['kaya', 'nilak', 'riko'], 'vote-layout', {
        storyChoices: 'vote',
      });
      await setLargeText(page, size);
      expect(await page.evaluate(() => window.fnt!.app.settings.largeText)).toBe(size);
      await enterNode(page, kind === 'chair' ? 'village_explore' : 'gate_escort_explore');
      const node =
        kind === 'gate' ? 'gate_parley' : kind === 'chair' ? 'plant_chair_talk' : 'ruon_choice';
      await enterNode(page, node);
      const panel = page.locator('.choice-panel');
      await expect(panel).toHaveClass(
        kind === 'custody'
          ? /choice-panel(?!.*conversation-panel-compact)/
          : /conversation-panel-compact/,
      );
      await expect(page.locator('.stage[data-kind="choice"]')).toHaveCount(
        kind === 'custody' ? 1 : 0,
      );
      const before = await page.evaluate(() => window.fnt!.app.state!);
      const sessionBefore = await page.evaluate(() => window.fnt!.app.session.toMeta());
      const picks = kind === 'gate' ? [0, 1, 0] : kind === 'chair' ? [0, 1, 2] : [0, 1];
      for (let voter = 0; voter < names.length; voter++) {
        await expect(panel).toHaveAttribute('data-vote', 'pick');
        await expect(panel.locator('.choice-option')).toHaveCount(kind === 'custody' ? 2 : 3);
        await expect(panel.locator('.vote-names')).toHaveCount(0);
        await expect(panel.locator('.vote-banner strong')).toHaveText(names[voter] + ', your pick');
        if (kind === 'gate') await expect(panel.locator('.choice-option').nth(2)).toBeDisabled();
        await expectVoteFits(page, 'pick-' + (voter + 1));
        await panel.locator('.choice-option').nth(picks[voter]!).tap();
        if (voter < names.length - 1) {
          await expect(panel).toHaveAttribute('data-vote', 'pass');
          await expect(panel.locator('.choice-option')).toHaveCount(0);
          const ready = panel.getByRole('button', { name: "I'm ready", exact: true });
          await expect(ready).toBeFocused();
          await expectVoteFits(page, 'pass-' + (voter + 1));
          await ready.tap();
        }
      }
      // Casting votes is presentation-only until the table confirms its answer.
      expect(await page.evaluate(() => window.fnt!.app.state!)).toEqual(before);
      expect(await page.evaluate(() => window.fnt!.app.session.toMeta())).toEqual(sessionBefore);
      const result = kind === 'gate' ? 'result' : 'tie';
      await expect(panel).toHaveAttribute('data-vote', result);
      await expectVoteFits(page, result);
      if (kind === 'gate') {
        await expect(panel.locator('.choice-option.is-winner')).toHaveCount(1);
        await expect(panel.locator('.choice-option.is-winner')).toContainText('Ava, Cleo');
        const go = panel.getByRole('button', { name: 'Continue', exact: true });
        await expect(go).toBeFocused();
        await go.tap();
      } else {
        await expect(panel.locator('.choice-option.is-tied')).toHaveCount(names.length);
        await panel.locator('.choice-option').first().tap();
      }
      expect(await page.evaluate(() => window.fnt!.app.state!.story)).toEqual(
        apply(CONTENT, before, { type: 'chooseOption', optionIndex: 0 }).state.story,
      );
    });
  }
}
