import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame } from './helpers';

test.use({ viewport: { width: 844, height: 390 } });

async function fonts(page: Page, tag: string) {
  const d = await page.evaluate(() => {
    const fs = (sel: string) => {
      const e = document.querySelector(sel);
      return e ? getComputedStyle(e).fontSize + '/' + getComputedStyle(e).paddingLeft : null;
    };
    const span = document.querySelectorAll('.choice-option > span.muted')[1];
    return {
      html: fs('html'),
      body: fs('body'),
      app: fs('#app'),
      scene: fs('.scene'),
      topStrong: fs('.top-bar strong, header strong, strong'),
      pause: fs('button'),
      panel: fs('.conversation-panel'),
      span: span ? getComputedStyle(span).fontSize : null,
      fontsStatus: document.fonts.status,
      loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + f.weight),
    };
  });
  console.log('DIAG', tag, JSON.stringify(d));
}

const raf = (page: Page) =>
  page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

const W1 = "html[data-large-text='on'] *, html[data-large-text='huge'] * { --large-text-restyle: 1 }";
const W2 = "html[data-large-text='on'] *, html[data-large-text='huge'] *, html[data-large-text='off'] * { --large-text-restyle: 1 }";
for (const variant of ['w1', 'w2', 'w1on'] as const)
  test(`diag ${variant}`, async ({ page }) => {
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Tala', 'Mina'], ['sura', 'riko'], 'long-conversation-layout');
    await page.addStyleTag({ content: variant === 'w2' ? W2 : W1 });
    await fonts(page, variant + ' before');
    await setLargeText(page, variant === 'w1on' ? 'on' : 'huge');
    await fonts(page, variant + ' afterHuge');
    await enterNode(page, 'gate_escort_explore');
    await enterNode(page, 'gate_parley');
    await page.locator('.conversation-panel .choice-option').nth(2).waitFor();
    await fonts(page, variant + ' panel');
    await setLargeText(page, 'off');
    await fonts(page, variant + ' off');
    await setLargeText(page, 'huge');
    await fonts(page, variant + ' huge2');
    await setLargeText(page, 'on');
    await fonts(page, variant + ' on');
    await page.waitForTimeout(1500);
    await fonts(page, variant + ' on+1.5s');
  });
