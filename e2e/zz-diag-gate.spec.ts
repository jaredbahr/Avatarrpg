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

for (const variant of ['base', 'datasetOnly', 'rootFontDirect', 'epoch', 'displayToggle', 'noComputedRead'] as const)
  test(`diag ${variant}`, async ({ page }) => {
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Tala', 'Mina'], ['sura', 'riko'], 'long-conversation-layout');
    if (variant === 'rootFontDirect')
      await page.addStyleTag({ content: "html[data-large-text='huge']{font-size:24px}" });
    await fonts(page, variant + ' before');
    if (variant === 'datasetOnly') {
      await page.evaluate(() => (document.documentElement.dataset.largeText = 'huge'));
      await raf(page);
    } else if (variant === 'noComputedRead') {
      await page.evaluate(() => {
        const app = window.fnt!.app as unknown as { settings: Record<string, unknown> };
        app.settings = { ...app.settings, largeText: 'huge' };
        document.documentElement.dataset.largeText = 'huge';
      });
      await raf(page);
    } else {
      await setLargeText(page, 'huge');
    }
    if (variant === 'epoch')
      await page.evaluate(() => document.documentElement.style.setProperty('--text-epoch', '1'));
    if (variant === 'displayToggle')
      await page.evaluate(() => {
        const a = document.getElementById('app')!;
        a.style.display = 'none';
        void a.offsetHeight;
        a.style.display = '';
        void a.offsetHeight;
      });
    await fonts(page, variant + ' afterHuge');
    await enterNode(page, 'gate_escort_explore');
    await enterNode(page, 'gate_parley');
    await page.locator('.conversation-panel .choice-option').nth(2).waitFor();
    await fonts(page, variant + ' panel');
    await page.waitForTimeout(1500);
    await fonts(page, variant + ' +1.5s');
  });
