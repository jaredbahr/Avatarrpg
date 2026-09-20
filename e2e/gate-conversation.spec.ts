import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { enterNode, resetStorage, startGame } from './helpers';

for (const renderer of ['canvas', 'webgl'] as const) {
  for (const portrait of [false, true]) {
    test(`gate approach keeps the world and party restrictions on ${renderer}/${portrait ? 'portrait-huge' : 'landscape'}`, async ({
      page,
    }, testInfo) => {
      // Forced WebGL on CI is a software rasteriser. The Canvas variants
      // finish inside the normal budget; the landscape WebGL tap needs the
      // same slow-test allowance as the other forced-WebGL regressions.
      allowSoftwareWebgl(test, renderer);
      if (portrait) await page.setViewportSize({ width: 834, height: 1194 });
      await resetStorage(page, `?renderer=${renderer}`);
      await startGame(page, ['Sura', 'Riko'], ['sura', 'riko'], 'gate-world-choice');
      if (portrait)
        await page.evaluate(() => window.fnt!.app.updateSettings({ largeText: 'huge' }));
      // Isolate the choice presentation; the route suite owns arrival on foot.
      await enterNode(page, 'gate_escort_explore');
      await enterNode(page, 'gate_parley');
      await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
      await expect(page.locator('.explore-conversation .choice-panel')).toBeVisible();
      await expect(page.getByRole('button', { name: /Let the firebender/ })).toBeDisabled();
      await expect(page.getByRole('button', { name: /Let the earthbender/ })).toBeDisabled();
      const direct = page.getByRole('button', { name: /^Walk up and knock/ });
      await expect(direct).toBeEnabled();
      await direct.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`gate-choice-${renderer}.png`) });
      await direct.tap();
      await expect(page.locator('.combat-scene .map-canvas')).toBeVisible();
      expect(await page.evaluate(() => window.fnt!.app.state!.battle?.encounterId)).toBe(
        'enc_quarry_gate',
      );
    });
  }
}
