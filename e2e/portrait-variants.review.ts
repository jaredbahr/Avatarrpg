/**
 * Review captures for the portrait variant sample (art/source/portraits-variants). Each shot is a real dialogue
 * scene with the speaker's shipped portrait file swapped on the network for a sample, so no game code changes:
 * route A (an expression) and route C (the 128 px pixel reduction, enlarged 4x nearest so the game's own
 * resample decides how it lands, as it would without integer-snap wiring). Route B has no sample.
 *
 * Writes art/source/portraits-variants/review/dialogue-<label>.png at 1368x912, 2 device px per CSS px; the
 * committed copies are those PNGs re-encoded as WebP (quality 90).
 * Local review fixture only: not a CI check.
 *
 *   npx playwright test -c playwright.portrait-variants.config.ts
 */
import { readFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { enterNode, resetStorage, settleLayout, startGame } from './helpers';

const DIR = 'art/source/portraits-variants';
const shots = [
  { label: 'kaya-neutral', node: 'after_forest', file: 'kaya.png', with: null },
  { label: 'kaya-a-angry', node: 'after_forest', file: 'kaya.png', with: 'out/kaya.angry.png' },
  { label: 'kaya-a-worried', node: 'after_forest', file: 'kaya.png', with: 'out/kaya.worried.png' },
  { label: 'kaya-c-pixel', node: 'after_forest', file: 'kaya.png', with: 'out/kaya.c128x4.png' },
  { label: 'mira-neutral', node: 'mira_intro', file: 'mira.png', with: null },
  { label: 'mira-a-warm', node: 'mira_intro', file: 'mira.png', with: 'out/mira.warm.png' },
] as const;

for (const shot of shots) {
  test(shot.label, async ({ page }) => {
    if (shot.with) {
      const body = readFileSync(`${DIR}/${shot.with}`);
      await page.route(`**/art/portraits/${shot.file}`, (route) =>
        route.fulfill({ body, contentType: 'image/png' }),
      );
    }
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Elias'], ['kaya']);
    await enterNode(page, shot.node);
    await page.locator('.stage-portrait canvas').first().waitFor();
    await settleLayout(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${DIR}/review/dialogue-${shot.label}.png` });
  });
}
