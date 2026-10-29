import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame } from './helpers';

const layouts = [
  { name: 'desktop', width: 1280, height: 800, largeText: 'off' as const },
  { name: 'portrait tablet', width: 820, height: 1180, largeText: 'off' as const },
  { name: 'phone with huge text', width: 390, height: 844, largeText: 'huge' as const },
];

test('speakerless ending summary uses a readable column and keeps its actions reachable', async ({
  page,
}) => {
  for (const layout of layouts) {
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

    const bounds = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.stage[data-kind="end"]');
      const panel = stage?.querySelector<HTMLElement>('.end-panel');
      if (!stage || !panel) throw new Error('Ending summary did not render');
      const stageBox = stage.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      return {
        stageWidth: stageBox.width,
        panelWidth: panelBox.width,
        stageLeft: stageBox.left,
        stageRight: stageBox.right,
        panelLeft: panelBox.left,
        panelRight: panelBox.right,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(bounds.panelWidth, layout.name).toBeGreaterThanOrEqual(bounds.stageWidth * 0.7);
    expect(bounds.panelLeft, layout.name).toBeGreaterThanOrEqual(bounds.stageLeft);
    expect(bounds.panelRight, layout.name).toBeLessThanOrEqual(bounds.stageRight);
    expect(bounds.documentWidth, layout.name).toBeLessThanOrEqual(bounds.viewportWidth);

    const actions = await panel.getByRole('button').all();
    expect(actions.length, layout.name).toBeGreaterThan(0);
    for (const action of actions) {
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
      const tapTargetHeight = await action.evaluate(
        (button) => button.getBoundingClientRect().height,
      );
      expect(tapTargetHeight, layout.name).toBeGreaterThanOrEqual(48);
    }

    await panel.getByRole('button', { name: 'Continue exploring' }).click();
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.state?.story.nodeId))
      .toBe('quarry_after_explore');
  }
});
