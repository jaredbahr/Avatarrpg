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

for (const variant of ['base', 'bodyInherit', 'toggleBack'] as const)
  test(`diag ${variant}`, async ({ page }) => {
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Tala', 'Mina'], ['sura', 'riko'], 'long-conversation-layout');
    if (variant === 'bodyInherit')
      await page.addStyleTag({ content: 'body{font-size:inherit !important}' });
    await fonts(page, variant + ' before');
    await setLargeText(page, 'huge');
    await fonts(page, variant + ' afterHuge');
    await enterNode(page, 'gate_escort_explore');
    await enterNode(page, 'gate_parley');
    await page.locator('.conversation-panel .choice-option').nth(2).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await fonts(page, variant + ' panel');
    for (let i = 1; i <= 6; i++) {
      await page.waitForTimeout(250);
      await fonts(page, variant + ' t' + i * 250);
    }
    if (variant === 'toggleBack') {
      await setLargeText(page, 'off');
      await fonts(page, variant + ' off');
      await page.waitForTimeout(1500);
      await fonts(page, variant + ' off+1.5s');
    }
  });
