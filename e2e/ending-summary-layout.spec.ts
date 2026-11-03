import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame } from './helpers';

const layouts = [
  ...[
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'iPad landscape', width: 1194, height: 834 },
    { name: 'iPad portrait', width: 834, height: 1194 },
  ].flatMap((viewport) =>
    (['off', 'huge'] as const).map((largeText) => ({
      ...viewport,
      name: `${viewport.name} with ${largeText === 'off' ? 'Normal' : 'Huge'} text`,
      largeText,
    })),
  ),
  { name: 'portrait tablet', width: 820, height: 1180, largeText: 'off' as const },
  { name: 'phone with huge text', width: 390, height: 844, largeText: 'huge' as const },
];

for (const layout of layouts) {
  test(`speakerless ending summary stays readable and scrolls on its stage: ${layout.name}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Jared'], ['kaya'], `ending-layout-${layout.name}`);
    if (layout.largeText !== 'off') await setLargeText(page, layout.largeText);

    // Jump directly to the real ending node; this spec is about its rendered
    // summary, not the route or the interlude's playback.
    await enterNode(page, 'act1_epilogue');
    await page.getByRole('button', { name: 'Read summary' }).click();

    const stage = page.locator('.stage[data-kind="end"]');
    const panel = stage.locator('.end-panel');
    await expect(panel.getByRole('heading', { name: 'The Quarry of Ba Dan' })).toBeVisible();
    await expect(panel).toContainText('It is time to take the news home to Ba Dan.');
    await page.evaluate(() => document.fonts.ready);

    const bounds = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.stage[data-kind="end"]');
      const panel = stage?.querySelector<HTMLElement>('.end-panel');
      if (!stage || !panel) throw new Error('Ending summary did not render');
      const stageBox = stage.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      const textRects = [...panel.querySelectorAll('p, li, h1')].flatMap((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return [...range.getClientRects()].map((rect) => ({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        }));
      });
      return {
        stageWidth: stageBox.width,
        panelWidth: panelBox.width,
        stageLeft: stageBox.left,
        stageRight: stageBox.right,
        panelLeft: panelBox.left,
        panelRight: panelBox.right,
        panelTop: panelBox.top,
        panelBottom: panelBox.bottom,
        panelScrollHeight: panel.scrollHeight,
        panelClientHeight: panel.clientHeight,
        panelOverflow: getComputedStyle(panel).overflowY,
        stageScrollHeight: stage.scrollHeight,
        stageClientHeight: stage.clientHeight,
        stageOverflow: getComputedStyle(stage).overflowY,
        textRects,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(bounds.panelWidth, layout.name).toBeGreaterThanOrEqual(bounds.stageWidth * 0.7);
    expect(bounds.panelLeft, layout.name).toBeGreaterThanOrEqual(bounds.stageLeft);
    expect(bounds.panelRight, layout.name).toBeLessThanOrEqual(bounds.stageRight);
    expect(
      Math.abs(
        (bounds.panelLeft + bounds.panelRight) / 2 - (bounds.stageLeft + bounds.stageRight) / 2,
      ),
      'ending summary is centered',
    ).toBeLessThanOrEqual(1);
    expect(bounds.documentWidth, layout.name).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.panelOverflow, 'summary has no inner scroll container').toBe('visible');
    expect(bounds.panelScrollHeight, 'summary has natural content height').toBeLessThanOrEqual(
      bounds.panelClientHeight + 1,
    );
    expect(bounds.stageOverflow, 'ending stage owns vertical scrolling').toBe('auto');
    for (const rect of bounds.textRects) {
      expect(rect.left, 'text starts inside summary').toBeGreaterThanOrEqual(bounds.panelLeft - 1);
      expect(rect.right, 'text ends inside summary').toBeLessThanOrEqual(bounds.panelRight + 1);
      expect(rect.top, 'text starts below summary top').toBeGreaterThanOrEqual(bounds.panelTop - 1);
      expect(rect.bottom, 'text ends above summary bottom').toBeLessThanOrEqual(
        bounds.panelBottom + 1,
      );
    }

    const actions = await panel.getByRole('button').all();
    expect(actions.length, layout.name).toBeGreaterThan(0);
    for (const action of actions) {
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
      const fullyReachable = await action.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const stage = button.closest('.stage');
        if (!stage) throw new Error('Ending action has no stage');
        const stageBox = stage.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.top >= stageBox.top &&
          rect.bottom <= Math.min(stageBox.bottom, innerHeight)
        );
      });
      expect(fullyReachable, 'whole ending action is reachable').toBe(true);
      const tapTargetHeight = await action.evaluate(
        (button) => button.getBoundingClientRect().height,
      );
      expect(tapTargetHeight, layout.name).toBeGreaterThanOrEqual(48);
    }
    expect(await panel.evaluate((element) => element.scrollTop), 'summary never scrolls').toBe(0);
    if (bounds.stageScrollHeight > bounds.stageClientHeight + 1) {
      expect(
        await stage.evaluate((element) => element.scrollTop),
        'stage reveals ending actions',
      ).toBeGreaterThan(0);
    }

    await panel.getByRole('button', { name: 'Continue exploring' }).click();
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
      .toBe('quarry_after_explore');
    expect(errors).toEqual([]);
  });
}
