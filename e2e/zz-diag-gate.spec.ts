import { test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame } from './helpers';

test.use({ viewport: { width: 844, height: 390 } });

async function dump(panel: Locator, tag: string) {
  const d = await panel.evaluate((element) => {
    const texts = [
      ...element.querySelectorAll<HTMLElement>(
        '.dialogue-line, .choice-option strong, .choice-option > span, :scope > p.tiny',
      ),
    ];
    const r4 = (r: DOMRect) => [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100);
    const out = texts.map((text, index) => {
      const range = document.createRange();
      range.selectNodeContents(text);
      const cs = getComputedStyle(text);
      return {
        index,
        rr: [...range.getClientRects()].map(r4),
        er: [...text.getClientRects()].map(r4),
        h: text.offsetHeight,
        w: text.offsetWidth,
        fs: cs.fontSize,
        ff: cs.fontFamily.slice(0, 30),
        tsa: (cs as unknown as Record<string, string>)['webkitTextSizeAdjust'],
        opt: text.closest('.choice-option')?.getBoundingClientRect().height,
      };
    });
    const hov = [...document.querySelectorAll(':hover')].map((e) => e.className || e.tagName).slice(-3);
    return {
      st: element.scrollTop,
      sh: element.scrollHeight,
      cw: element.clientWidth,
      ow: element.offsetWidth,
      hov,
      active: document.activeElement?.className,
      out: out.filter((o) => o.index >= 5),
    };
  });
  console.log('DIAG', tag, JSON.stringify(d));
}

async function setup(page: Page) {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Tala', 'Mina'], ['sura', 'riko'], 'long-conversation-layout');
  await setLargeText(page, 'huge');
  await enterNode(page, 'gate_escort_explore');
  await enterNode(page, 'gate_parley');
  await page.evaluate(() => document.fonts.ready);
  const panel = page.locator('.conversation-panel');
  await panel.locator('.choice-option').nth(2).waitFor();
  return panel;
}

for (const variant of ['mouse', 'nomouse', 'still', 'tsa'] as const)
  test(`diag ${variant}`, async ({ page }) => {
    const panel = await setup(page);
    if (variant === 'tsa')
      await page.addStyleTag({ content: 'html{-webkit-text-size-adjust:100%;text-size-adjust:100%}' });
    await dump(panel, variant + ' start');
    const box = (await panel.boundingBox())!;
    if (variant === 'still') {
      await page.waitForTimeout(1000);
      await dump(panel, 'still +1s');
      await panel.evaluate((el) => {
        el.querySelectorAll('.choice-option').forEach((o) => o.classList.add('zz'));
        void (el as HTMLElement).offsetHeight;
      });
      await dump(panel, 'still restyled');
      await panel.evaluate((el) => {
        (el as HTMLElement).style.width = 'calc(100% - 1px)';
        void (el as HTMLElement).offsetHeight;
        (el as HTMLElement).style.width = '';
        void (el as HTMLElement).offsetHeight;
      });
      await dump(panel, 'still relayout');
      return;
    }
    if (variant !== 'nomouse') await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await dump(panel, variant + ' moved');
    for (let i = 1; i <= 5; i++) {
      await panel.evaluate((el) => el.scrollBy(0, 62));
      await page.waitForTimeout(150);
      await dump(panel, variant + ' step' + i);
    }
    await panel.evaluate((el) => el.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await dump(panel, variant + ' back0');
  });
