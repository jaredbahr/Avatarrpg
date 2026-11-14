import { expect, test, type Page } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame, waitForIdle } from './helpers';

test.use({ serviceWorkers: 'block' });

/**
 * The retained-world conversation's portrait canvas must stay inside its responsive frame
 * and clear of the speaker's name and line (#651). The frame used to be measured instead of
 * the canvas, so an inline canvas size that overflowed the 5rem/6rem frames went unseen.
 * Reach the conversation through the live Talk flow: enterNode('gao_home') opens the
 * full-stage DialogueScene and misses the compact layout.
 */
async function openGao(page: Page): Promise<void> {
  await enterNode(page, 'village_explore');
  await waitForIdle(page);
  await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 10, y: 4 } }));
  await waitForIdle(page);
  const talk = page.getByRole('button', { name: /^Talk/ });
  await expect(talk).toContainText('Gao');
  await talk.tap();
}

async function portraitGeometry(page: Page) {
  const conversation = page.locator('.explore-conversation .conversation-panel-compact');
  await expect(conversation).toBeVisible();
  const canvas = conversation.locator('.conversation-compact-portrait canvas');
  await expect(canvas).toHaveAttribute('data-asset', 'portrait.gao');
  // The backing store follows the box on the next resize-observer pass.
  await expect
    .poll(() =>
      canvas.evaluate((c: HTMLCanvasElement) => {
        const css = c.getBoundingClientRect().width;
        return Math.abs(c.width - Math.round(css * devicePixelRatio));
      }),
    )
    .toBe(0);
  return conversation.evaluate((panel) => {
    const box = (selector: string) => {
      const node = panel.querySelector(selector);
      if (!node) throw new Error('Missing ' + selector);
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width };
    };
    return {
      frame: box('.conversation-compact-portrait'),
      canvas: box('.conversation-compact-portrait canvas'),
      name: box('.conversation-compact-speaker strong'),
      line: box('.dialogue-line'),
    };
  });
}

type Box = { x: number; y: number; right: number; bottom: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.right - 0.5 && b.x < a.right - 0.5 && a.y < b.bottom - 0.5 && b.y < a.bottom - 0.5;

for (const layout of [
  { name: 'phone', width: 390, height: 844, dpr: 3, huge: false, frameRem: 5 },
  { name: 'phone Largest text', width: 390, height: 844, dpr: 3, huge: true, frameRem: 5 },
  { name: 'iPad portrait', width: 834, height: 1194, dpr: 2, huge: false, frameRem: 6 },
  { name: 'iPad landscape', width: 1180, height: 820, dpr: 2, huge: false, frameRem: 15 },
]) {
  test.describe(layout.name, () => {
    test.use({
      viewport: { width: layout.width, height: layout.height },
      deviceScaleFactor: layout.dpr,
    });

    test(`the world-conversation portrait stays inside its frame, clear of the text`, async ({
      page,
    }) => {
      await resetStorage(page, '?renderer=canvas');
      await startGame(page, ['Sura'], ['sura'], 'world-portrait-frame');
      if (layout.huge) await setLargeText(page, 'huge');
      await openGao(page);

      const g = await portraitGeometry(page);
      const rootPx = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).fontSize),
      );
      expect(g.canvas.width).toBeCloseTo(layout.frameRem * rootPx, 0);
      expect(g.canvas.x).toBeGreaterThanOrEqual(g.frame.x - 0.5);
      expect(g.canvas.y).toBeGreaterThanOrEqual(g.frame.y - 0.5);
      expect(g.canvas.right).toBeLessThanOrEqual(g.frame.right + 0.5);
      expect(g.canvas.bottom).toBeLessThanOrEqual(g.frame.bottom + 0.5);
      expect(overlaps(g.canvas, g.name)).toBe(false);
      expect(overlaps(g.canvas, g.line)).toBe(false);
    });
  });
}

test.describe('phone reload', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

  test('the portrait stays framed after next and a reload into Continue', async ({ page }) => {
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Sura'], ['sura'], 'world-portrait-reload');
    await openGao(page);
    await page.locator('[data-conversation-control="next"]').tap();
    const conversation = page.locator('.explore-conversation .conversation-panel-compact');
    const lineCount = conversation.locator('.line-count');
    const line = (await lineCount.textContent())?.trim();
    expect(line).toMatch(/^2 of \d+$/);
    let g = await portraitGeometry(page);
    expect(overlaps(g.canvas, g.name)).toBe(false);
    const saved = await page.evaluate(() => {
      const app = window.fnt!.app;
      if (!app.saveTo('auto')) throw new Error('Save failed');
      return app.state;
    });
    await page.reload();
    await page.getByRole('button', { name: /^Continue$/ }).click();
    await waitForIdle(page);
    // Continue must restore the open conversation itself; never reopen it here.
    expect(await page.evaluate(() => window.fnt?.app.state)).toEqual(saved);
    await expect(conversation).toBeVisible();
    await expect(conversation.locator('.conversation-compact-speaker strong')).toHaveText(
      'Gao the Shopkeeper',
    );
    await expect(lineCount).toHaveText(line ?? '');
    g = await portraitGeometry(page);
    expect(g.canvas.right).toBeLessThanOrEqual(g.frame.right + 0.5);
    expect(overlaps(g.canvas, g.name)).toBe(false);
    expect(overlaps(g.canvas, g.line)).toBe(false);
  });
});
