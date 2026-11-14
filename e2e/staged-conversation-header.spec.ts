import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

// #698: a staged conversation over the retained exploration screen drew its
// speaker label on the same spot as the veiled map header. One header at a time.
for (const { explore, staged, speaker } of [
  { explore: 'village_return_explore', staged: 'welcome_home_mira', speaker: 'Elder Mira' },
  { explore: 'gate_return_explore', staged: 'ruon_surrender', speaker: 'Captain Ruon' },
]) {
  test(`${staged} owns the top bar over the veiled world`, async ({ page }, info) => {
    await resetStorage(page);
    await startGame(page, ['Jared', 'Morgan'], ['kaya', 'nilak'], 'staged-header-698');
    await enterNode(page, explore);
    await expect(page.locator('.explore-scene .explore-bar')).toBeVisible();
    await enterNode(page, staged);

    const label = page.locator('.dialogue-layer .dialogue-scene > .top-bar');
    await expect(label).toBeVisible();
    await expect(label).toContainText(speaker);
    // The world stays behind the veil, but its chrome steps aside.
    await expect(page.locator('.explore-scene')).toHaveAttribute('inert', '');
    await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
    for (const chrome of ['.explore-bar', '.explore-map-corner', '.explore-dock'])
      await expect(page.locator(`.explore-scene ${chrome}`)).toBeHidden();
    await page.screenshot({ path: info.outputPath(`${staged}.png`) });
  });
}
