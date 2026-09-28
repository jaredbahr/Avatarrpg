/**
 * Local review of Kaya and Sura walking the riverside, on both backends:
 * crops around the pair mid-stride in each screen direction, standing, at tea
 * and waving, for a before/after comparison of the sheets the riverside draws.
 *
 * Run: FNT_REVIEW_OUT=<dir> npx playwright test -c playwright.riverside-g.config.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { pauseClock, resetStorage, settleLayout } from './helpers';

const OUT = process.env.FNT_REVIEW_OUT ?? 'test-results/riverside-g';

/** The leader's drawn feet on the page, in CSS pixels. */
async function leaderPoint(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const app = window.fnt!.app as unknown as {
      state: { party: { id: string }[]; location: { pos: { x: number; y: number } } };
      animator: { renderPos(now: number, id: string): { x: number; y: number } | undefined };
      rendererCamera(): {
        groundTransform: { a: number; b: number; c: number; d: number; tx: number; ty: number };
      } | null;
    };
    const id = app.state.party[0]?.id ?? '';
    const at = app.animator.renderPos(performance.now(), id) ?? app.state.location.pos;
    const m = app.rendererCamera()!.groundTransform;
    const x = (at.x + 0.5) * 64;
    const y = (at.y + 0.5) * 64;
    const rect = document.querySelector('.map-canvas')!.getBoundingClientRect();
    return {
      x: rect.left + m.a * x + m.c * y + m.tx,
      y: rect.top + m.b * x + m.d * y + m.ty,
    };
  });
}

async function crop(page: Page, name: string): Promise<void> {
  const at = await leaderPoint(page);
  const size = page.viewportSize()!;
  const w = 280;
  const h = 200;
  const x = Math.max(0, Math.min(size.width - w, at.x - w / 2));
  const y = Math.max(0, Math.min(size.height - h, at.y - h * 0.6));
  writeFileSync(
    join(OUT, `${name}.png`),
    await page.screenshot({ clip: { x, y, width: w, height: h } }),
  );
}

for (const backend of ['canvas', 'webgl']) {
  test(`riverside party review (${backend})`, async ({ page }) => {
    // Software WebGL reads back slowly at DPR 2.
    test.setTimeout(900_000);
    mkdirSync(OUT, { recursive: true });
    await resetStorage(page, `?renderer=${backend}`);
    await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
    await settleLayout(page);
    await pauseClock(page);
    await page.clock.runFor(1500);
    const party = await page.evaluate(() => window.fnt!.app.state!.party.map((p) => p.characterId));
    expect(party).toEqual(expect.arrayContaining(['kaya', 'sura']));
    writeFileSync(join(OUT, `${backend}-00-full.png`), await page.screenshot());
    await crop(page, `${backend}-01-standing`);

    const start = await page.evaluate(() => window.fnt!.app.state!.location.pos);
    const legs: [string, { x: number; y: number }][] = [
      ['east', { x: start.x + 4, y: start.y }],
      ['north', { x: start.x + 4, y: start.y - 3 }],
      ['west', { x: start.x, y: start.y - 3 }],
      ['south', { x: start.x, y: start.y }],
      ['southeast', { x: start.x + 3, y: start.y + 3 }],
    ];
    let index = 2;
    for (const [label, pos] of legs) {
      await page.evaluate((to) => window.fnt!.app.dispatch({ type: 'walkTo', pos: to }), pos);
      for (let frame = 0; frame < 4; frame++) {
        await page.clock.runFor(160);
        await crop(page, `${backend}-${String(index).padStart(2, '0')}-${label}-${frame}`);
      }
      await page.clock.runFor(4000);
      await crop(page, `${backend}-${String(index).padStart(2, '0')}-${label}-stop`);
      index++;
    }

    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await page.getByRole('button', { name: 'Tea break', exact: true }).click();
    // The break walks the party to the veranda first.
    const stage = page.locator('.village-life-canvas');
    for (let step = 0; step < 60 && (await stage.getAttribute('data-tea-actors')) !== '2'; step++)
      await page.clock.runFor(500);
    await expect(stage).toHaveAttribute('data-tea-actors', '2');
    await crop(page, `${backend}-${index}-tea-hold`);
    await page.clock.runFor(4000);
    await crop(page, `${backend}-${index}-tea-sip`);
    index++;
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await page.getByRole('button', { name: 'Wave', exact: true }).click();
    await page.clock.runFor(700);
    await crop(page, `${backend}-${index}-wave`);
  });
}
