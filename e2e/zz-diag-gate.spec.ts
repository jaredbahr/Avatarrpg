import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame } from './helpers';

test.use({ viewport: { width: 844, height: 390 } });

export async function fonts(page: Page, tag: string) {
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

async function chain(page: Page, tag: string) {
  const d = await page.evaluate(() => {
    let e: Element | null = document.querySelectorAll('.choice-option > span.muted')[1] ?? document.querySelector('.scene');
    const out: string[] = [];
    while (e) {
      const cs = getComputedStyle(e);
      out.push(
        (e.id ? '#' + e.id : '') + e.tagName.toLowerCase() + '.' + String(e.className).split(' ').slice(0, 2).join('.') +
          ' fs=' + cs.fontSize + ' t=' + cs.transitionProperty.slice(0, 20) + '/' + cs.transitionDuration.slice(0, 12) +
          ' a=' + e.getAnimations().map((a) => (a as CSSTransition).transitionProperty ?? (a as CSSAnimation).animationName).join(','),
      );
      e = e.parentElement;
    }
    return out;
  });
  console.log('DIAG', tag, '\n  ' + d.join('\n  '));
}
test('diag chain', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Tala', 'Mina'], ['sura', 'riko'], 'long-conversation-layout');
  await chain(page, 'before');
  await setLargeText(page, 'huge');
  await chain(page, 'afterHuge');
  await enterNode(page, 'gate_escort_explore');
  await enterNode(page, 'gate_parley');
  await page.locator('.conversation-panel .choice-option').nth(2).waitFor();
  await chain(page, 'panel');
  await page.waitForTimeout(400);
  await chain(page, '+400');
});
