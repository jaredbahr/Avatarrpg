import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, startGame, waitForIdle } from './helpers';

test('riverside painted paths and sprite picking', async ({ page }) => {
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
  await page.evaluate(() => window.fnt!.app.updateSettings({ reduceMotion: true }));
  const canvas = page.locator('.map-canvas');
  // Use the same two-pointer gesture as a tablet. Native mouse.wheel is
  // unsupported by mobile WebKit; the actual picking assertions run on both.
  await canvas.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const fire = (type: string, id: number, dx: number) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: 'touch',
          isPrimary: id === 1,
          clientX: box.left + box.width / 2 + dx,
          clientY: box.top + box.height / 2,
          button: 0,
          buttons: 1,
          bubbles: true,
          cancelable: true,
        }),
      );
    fire('pointerdown', 1, -150);
    fire('pointerdown', 2, 150);
    for (let d = 140; d >= 20; d -= 10) {
      fire('pointermove', 1, -d);
      fire('pointermove', 2, d);
    }
    fire('pointerup', 1, -20);
    fire('pointerup', 2, 20);
  });
  const tapWorld = async (x: number, y: number) => {
    const camera = await page.evaluate(() => window.fnt!.app.rendererCamera());
    if (!camera) throw new Error('Missing explore camera');
    await canvas.tap({
      position: {
        x: x * camera.tilePx - camera.offsetX,
        y: y * camera.tilePx - camera.offsetY,
      },
    });
    await waitForIdle(page);
  };
  for (const [x, y] of [
    [6, 12],
    [6, 10],
    [6, 8],
    [14, 8],
    [14, 12],
  ] as const) {
    await tapWorld(x + 0.5, y + 0.5);
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state?.location.pos))
      .toEqual({ x, y });
  }
  // The torso is visually above the NPC's navigation tile.
  await tapWorld(15.5, 8.8);
  await expect(page.locator('.dialogue-scene')).toBeVisible();
});

for (const renderer of ['canvas', 'webgl']) {
  test(`riverside discovery, forms and campaign preservation (${renderer})`, async ({ page }) => {
    // The WebGL CI runner rasterises in software; the same gallery form
    // takes two minutes there and five seconds on Canvas.
    test.setTimeout(renderer === 'webgl' ? 180_000 : 90_000);
    // Scenic routes now take 280 ms per tile; crossing the whole area can
    // exceed the default assertion timeout even at a smooth frame rate.
    const timeout = renderer === 'webgl' ? 30_000 : 20_000;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await resetStorage(page, `?renderer=${renderer}`);
    await startGame(page, ['Jared'], ['bo'], 'campaign-to-preserve', { reduceMotion: false });
    const before = await page.evaluate(() => {
      const app = window.fnt!.app;
      app.saveTo('slot1');
      app.saveTo('auto');
      return {
        state: JSON.stringify(app.state),
        session: JSON.stringify(app.session.toMeta()),
        storage: JSON.stringify(localStorage),
      };
    });
    await page.evaluate(() => window.fnt!.app.startVillagePreview());
    await expect(page.getByRole('button', { name: 'Water form', exact: true })).toBeVisible();
    await expect(page.locator('.village-life-canvas')).toHaveCount(1);
    await expect(page.locator('.village-life-canvas')).toHaveAttribute(
      'data-illustrated-actors',
      '2',
    );
    await page.getByRole('button', { name: 'Under the banyan', exact: true }).click();
    await expect(page.locator('.village-note')).toContainText('branches pass overhead', {
      timeout,
    });
    await expect(page.locator('.village-life-canvas')).toHaveAttribute(
      'data-occluded-actors',
      /^[1-9]/,
    );
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state?.location.pos))
      .toEqual({ x: 13, y: 9 });
    await page.getByRole('button', { name: 'Meet Pebble', exact: true }).click();
    await expect(page.locator('.village-note')).toContainText('Pebble leans', { timeout });
    await page.getByRole('button', { name: 'Tea break', exact: true }).click();
    await expect(page.locator('.village-note')).toContainText('jasmine tea', { timeout });
    await page.getByRole('button', { name: 'Visit the shrine', exact: true }).click();
    await expect(page.locator('.dialogue-scene')).toBeVisible({ timeout });
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('.line-count')).toHaveText(`${i + 1} of 3`);
      await page
        .locator('button')
        .filter({ hasText: /^(Next|Continue)$/ })
        .click();
    }
    await expect(page.locator('.village-caption')).toContainText('3/3');
    await page.getByRole('button', { name: "Dorin's drill", exact: true }).click();
    await expect(page.locator('.village-note')).toContainText('sets a rhythm', { timeout });
    for (const name of ['Water form', 'Fire form', 'Water form']) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.getByRole('button', { name: 'Wave', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Wave', exact: true })).toBeEnabled();
    }
    await expect(page.locator('.village-note')).toContainText('Nicely done');
    expect(await page.evaluate(() => window.fnt!.app.saveTo('slot1'))).toBe(false);
    await page.getByRole('button', { name: 'Leave preview', exact: true }).click();
    const after = await page.evaluate(() => {
      const app = window.fnt!.app;
      return {
        state: JSON.stringify(app.state),
        session: JSON.stringify(app.session.toMeta()),
        storage: JSON.stringify(localStorage),
      };
    });
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
    await expect(
      page.getByRole('button', { name: 'Explore the riverside', exact: true }),
    ).toBeVisible();
  });
}

test('preview can be left through Pause after returning to the main village', async ({ page }) => {
  await resetStorage(page);
  await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
  await page.getByRole('button', { name: 'Try a battle', exact: true }).click();
  await expect(page.locator('.combat-scene')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Return to the riverside', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Water form', exact: true })).toBeVisible();
  await enterNode(page, 'village_explore');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save game', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Leave preview', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Explore the riverside', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.fnt!.app.previewActive)).toBe(false);
});
