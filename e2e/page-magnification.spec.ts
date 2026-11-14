import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { enterNode, resetStorage, settleDialog, startGame } from './helpers';

async function tapWithinVisualViewport(control: Locator) {
  const visible = await control.evaluate((element) => {
    const viewport = window.visualViewport;
    if (!viewport) return false;
    const { x, y, width, height } = element.getBoundingClientRect();
    const centreX = x + width / 2;
    const centreY = y + height / 2;
    return (
      centreX >= viewport.offsetLeft &&
      centreX < viewport.offsetLeft + viewport.width &&
      centreY >= viewport.offsetTop &&
      centreY < viewport.offsetTop + viewport.height
    );
  });
  expect(visible, 'control centre is inside the magnified viewport').toBe(true);
  await control.tap();
}

test('Settings and the exploration objective respond at enlarged page scale', async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== 'chromium', 'Chromium CDP sets the visual viewport scale');
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'Settings', exact: true }).tap();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(settings).toBeVisible();
  await settleDialog(settings);

  const client = await page.context().newCDPSession(page);
  const scale = () => page.evaluate(() => window.visualViewport?.scale);
  await expect.poll(scale).toBe(1);
  // Set the visual scale directly to exercise controls after magnification.
  // The axe scan separately verifies that the viewport permits user zoom.
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.5 });
  await expect.poll(scale).toBe(1.5);
  const soundOff = settings
    .getByRole('radiogroup', { name: 'Sound', exact: true })
    .getByRole('radio', { name: 'Off', exact: true });
  await expect(soundOff).toHaveAttribute('aria-checked', 'false');
  await tapWithinVisualViewport(soundOff);
  await expect(soundOff).toHaveAttribute('aria-checked', 'true');
  await expect.poll(scale).toBe(1.5);

  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  await expect.poll(scale).toBe(1);
  await settings.getByRole('button', { name: 'Done', exact: true }).tap();
  await expect(settings).toBeHidden();

  await startGame(page, ['Aster'], ['kaya'], 'page-magnification');
  await enterNode(page, 'village_explore');
  const objective = page.getByRole('button', { name: /^Current objective:/ });
  await expect(objective).toHaveAttribute('aria-expanded', 'true');
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.5 });
  await expect.poll(scale).toBe(1.5);
  await tapWithinVisualViewport(objective);
  await expect(objective).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(scale).toBe(1.5);
});
