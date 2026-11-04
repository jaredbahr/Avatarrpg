import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame, waitForIdle } from './helpers';

test.use({ serviceWorkers: 'block' });

for (const layout of [
  { name: 'iPad portrait', width: 834, height: 1194, huge: false, wholeWord: true },
  { name: 'iPad portrait Huge', width: 834, height: 1194, huge: true, wholeWord: true },
  { name: 'phone Huge', width: 390, height: 844, huge: true, wholeWord: false },
]) {
  test(`${layout.name}: Gao's world-conversation speaker and Continue remain usable`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Sura'], ['sura'], 'world-speaker-wrap');
    if (layout.huge) await setLargeText(page, 'huge');
    await enterNode(page, 'village_explore');
    await waitForIdle(page);
    // Use the live world Talk flow: enterNode('gao_home') would open the
    // separate full-stage DialogueScene and miss the compact speaker layout.
    await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 10, y: 4 } }));
    await waitForIdle(page);
    const talk = page.getByRole('button', { name: /^Talk/ });
    await expect(talk).toContainText('Gao');
    await talk.tap();

    const conversation = page.locator('.explore-conversation .conversation-panel-compact');
    await expect(conversation).toBeVisible();
    const name = conversation.locator('.conversation-compact-speaker strong');
    await expect(name).toHaveText('Gao the Shopkeeper');
    await expect(conversation.locator('.conversation-compact-portrait canvas')).toHaveAttribute(
      'data-asset',
      'portrait.gao',
    );

    const geometry = await conversation.evaluate((panel) => {
      const name = panel.querySelector<HTMLElement>('.conversation-compact-speaker strong');
      const portrait = panel.querySelector<HTMLElement>('.conversation-compact-portrait');
      const line = panel.querySelector<HTMLElement>('.dialogue-line');
      const next = panel.querySelector<HTMLElement>('[data-conversation-control="next"]');
      if (!name || !portrait || !line || !next) throw new Error('Incomplete Gao conversation');
      const text = name.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error('Missing speaker text');
      const start = text.textContent?.indexOf('Shopkeeper') ?? -1;
      if (start < 0) throw new Error('Missing Shopkeeper');
      const word = document.createRange();
      word.setStart(text, start);
      word.setEnd(text, start + 'Shopkeeper'.length);
      const box = (element: Element) => {
        const r = element.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      return {
        panel: box(panel),
        name: box(name),
        portrait: box(portrait),
        line: box(line),
        next: box(next),
        word: [...word.getClientRects()].map((r) => ({ x: r.x, right: r.right })),
        phoneEllipsis: getComputedStyle(name).textOverflow === 'ellipsis',
        panelScrollWidth: panel.scrollWidth,
        panelClientWidth: panel.clientWidth,
      };
    });
    expect(geometry.panel.x).toBeGreaterThanOrEqual(0);
    expect(geometry.panel.right).toBeLessThanOrEqual(layout.width);
    expect(geometry.panel.bottom).toBeLessThanOrEqual(layout.height);
    expect(geometry.panelScrollWidth).toBeLessThanOrEqual(geometry.panelClientWidth);
    expect(geometry.portrait.width).toBeGreaterThanOrEqual(80);
    expect(geometry.next.width).toBeGreaterThanOrEqual(48);
    expect(geometry.next.height).toBeGreaterThanOrEqual(48);
    expect(geometry.line.width).toBeGreaterThan(0);
    if (layout.wholeWord) {
      expect(geometry.word).toHaveLength(1);
      expect(geometry.word[0]!.x).toBeGreaterThanOrEqual(geometry.name.x);
      expect(geometry.word[0]!.right).toBeLessThanOrEqual(geometry.name.right);
      expect(geometry.name.x).toBeGreaterThanOrEqual(geometry.panel.x);
      expect(geometry.name.right).toBeLessThanOrEqual(geometry.panel.right);
    } else {
      expect(geometry.phoneEllipsis).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(`${layout.name.replaceAll(' ', '-')}.png`) });
    await conversation.locator('[data-conversation-control="next"]').tap();
    await expect(conversation.locator('.line-count')).toHaveText(/^2 of /);
    expect(await page.evaluate(() => window.fnt!.app.state!.story.lineIndex)).toBe(1);
  });
}
