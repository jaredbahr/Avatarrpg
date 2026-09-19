import { expect, test } from '@playwright/test';
import { groundPoint } from './projection';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

for (const backend of ['canvas', 'webgl']) {
  test(`tea holds on the porch and yields to walking and forms (${backend})`, async ({ page }) => {
    // Install before navigation so setup runs on the real clock; pause only
    // once the normal-motion tea pose is ready for the deterministic cel check.
    await page.clock.install();
    await page.setViewportSize({ width: 1280, height: 720 });
    await resetStorage(page, `?renderer=${backend}`);
    await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
    await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true }));
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    const tea = page.getByRole('button', { name: 'Tea break', exact: true });
    const stage = page.locator('.village-life-canvas');
    await tea.click();
    await expect(stage).toHaveAttribute('data-tea-actors', '2');
    expect(await page.evaluate(() => window.fnt!.app.partyPositions())).toEqual([
      { x: 8, y: 18 },
      { x: 8, y: 19 },
    ]);
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await test.info().attach(`tea-${backend}-reduced`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await expect(stage).toHaveAttribute('data-illustrated-actors', '2');
    await settleLayout(page);
    const cam = await page.evaluate(() => window.fnt!.app.rendererCamera()!);
    const box = await stage.boundingBox();
    if (!box) throw new Error('missing village canvas');
    const foot = groundPoint(cam, { x: 8.5, y: 18.85 });
    const teaPortrait = () =>
      page.screenshot({
        clip: { x: box.x + foot.x - 30, y: box.y + foot.y - 55, width: 60, height: 110 },
      });
    const still = await teaPortrait();
    // Reduced motion holds the seated cup pose, rather than reverting to idle.
    await page.waitForTimeout(300);
    expect((await teaPortrait()).equals(still)).toBe(true);
    await page.getByRole('button', { name: 'Water form', exact: true }).click();
    await expect(stage).toHaveAttribute('data-tea-actors', '0');
    await expect(page.getByRole('button', { name: 'Activities', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await expect(tea).toBeEnabled();
    await tea.click();
    await expect(stage).toHaveAttribute('data-tea-actors', '2');
    // A rules-driven walk also clears the hold when no pointer action runs.
    await page.evaluate(() => window.fnt!.app.dispatch({ type: 'walkTo', pos: { x: 10, y: 19 } }));
    await expect(stage).toHaveAttribute('data-tea-actors', '0');
    await waitForIdle(page);
    await tea.click();
    await expect(stage).toHaveAttribute('data-tea-actors', '2');
    await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: false }));
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await test
      .info()
      .attach(`tea-${backend}-hold`, { body: await page.screenshot(), contentType: 'image/png' });
    const now = await page.evaluate(() => Date.now());
    // Leave room for the browser round trip before freezing the clock.
    await page.clock.pauseAt(now + 30_000);
    const hold = await teaPortrait();
    // The authored tea clip has two cels at 0.25 fps: exactly four seconds
    // reaches the opposite cel without depending on wall-clock scheduling.
    await page.clock.fastForward(4000);
    expect((await teaPortrait()).equals(hold)).toBe(false);
    await expect(stage).toHaveAttribute('data-tea-actors', '2');
    await test
      .info()
      .attach(`tea-${backend}-sip`, { body: await page.screenshot(), contentType: 'image/png' });
  });
}

test('tea only seats present supported characters on the porch', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Host'], ['bo', 'sura']);
  await enterNode(page, 'riverside_explore');
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await page.getByRole('button', { name: 'Tea break', exact: true }).click();
  await expect(page.locator('.village-life-canvas')).toHaveAttribute('data-tea-actors', '1');
  await expect(page.locator('.village-note')).toHaveText(
    'A quiet break on the veranda with jasmine tea. The river runs below the steps.',
  );
  expect(await page.evaluate(() => window.fnt!.app.state!.flags.riverside_tea)).toBe(true);
});
