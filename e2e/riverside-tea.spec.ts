import { expect, test } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import { groundPoint } from './projection';
import { enterNode, resetStorage, settleLayout, startGame, waitForIdle } from './helpers';

for (const backend of ['canvas', 'webgl']) {
  test(`tea holds on the porch and yields to walking and forms (${backend})`, async ({ page }) => {
    // Four seconds of stepped RAF frames are costly on software WebGL.
    allowSoftwareWebgl(test, backend);
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
    const foot = groundPoint(cam, { x: 8.5, y: 18.85 });
    /*
     * The seated figure is drawn by the shared 2D life layer, above a board
     * that differs by backend. Comparing two composited page captures instead
     * made the cel assertion depend on how long a software rasteriser took to
     * hand frames back: on CI the two clipped reads landed more than one
     * authored four-second cel apart and came back byte-identical, while the
     * app's own clock had advanced by exactly the mocked interval. Reading
     * this layer's own pixels compares the cel the app drew, on both
     * backends, without waiting on the compositor.
     */
    const teaCel = () =>
      page.evaluate(
        (crop) => {
          const canvas = document.querySelector<HTMLCanvasElement>('.village-life-canvas');
          const ctx = canvas?.getContext('2d');
          if (!canvas || !ctx) throw new Error('missing village life layer');
          const sx = canvas.width / canvas.clientWidth;
          const sy = canvas.height / canvas.clientHeight;
          const scratch = document.createElement('canvas');
          scratch.width = Math.max(1, Math.round(crop.width * sx));
          scratch.height = Math.max(1, Math.round(crop.height * sy));
          const out = scratch.getContext('2d');
          if (!out) throw new Error('missing life layer probe');
          out.drawImage(
            canvas,
            Math.round(crop.x * sx),
            Math.round(crop.y * sy),
            scratch.width,
            scratch.height,
            0,
            0,
            scratch.width,
            scratch.height,
          );
          return scratch.toDataURL('image/png');
        },
        { x: foot.x - 30, y: foot.y - 55, width: 60, height: 110 },
      );
    const still = await teaCel();
    // Reduced motion holds the seated cup pose, rather than reverting to idle.
    await page.waitForTimeout(300);
    expect(await teaCel()).toBe(still);
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
    // Publish the held frame before measuring the four-second cel interval.
    await page.clock.runFor(17);
    const hold = await teaCel();
    // The authored tea clip has two cels at 0.25 fps: exactly four seconds
    // reaches the opposite cel without depending on wall-clock scheduling.
    // Jump the frozen clock rather than stepping 240 software-WebGL frames:
    // the clip is read from the app's own clock for this pose, so one drawn
    // frame after the jump is the same drawing the stepped run produced.
    const appClock = () => page.evaluate(() => performance.now());
    const before = await appClock();
    await page.clock.fastForward(4000);
    await page.clock.runFor(17);
    const after = await appClock();
    // Evidence either way: if the app's clock did not reach the interval, no
    // waiting for a frame would show the other cel.
    await test.info().attach(`tea-${backend}-advance`, {
      body: JSON.stringify({
        before,
        after,
        advanced: before !== null && after !== null ? after - before : null,
      }),
      contentType: 'application/json',
    });
    const sip = await teaCel();
    expect(sip).not.toBe(hold);
    // Two cels at 0.25 fps: one more interval returns the held cup drawing.
    await page.clock.fastForward(4000);
    await page.clock.runFor(17);
    expect(await teaCel()).toBe(hold);
    await expect(stage).toHaveAttribute('data-tea-actors', '2');
    await test.info().attach(`tea-${backend}-sip`, {
      body: Buffer.from(sip.slice(sip.indexOf(',') + 1), 'base64'),
      contentType: 'image/png',
    });
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
