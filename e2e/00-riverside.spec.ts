import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { allowSoftwareWebgl } from './budget';
import {
  enterNode,
  resetStorage,
  setLargeText,
  settleLayout,
  startGame,
  waitForIdle,
} from './helpers';

async function openActivities(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Activities', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

test('riverside dock stays compact until secondary activities are opened', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
  await settleLayout(page);

  const closed = await page.evaluate(() => {
    const dock = document.querySelector('.explore-dock')?.getBoundingClientRect();
    const canvas = document.querySelector('.map-canvas')?.getBoundingClientRect();
    const panel = document.querySelector<HTMLElement>('.village-controls');
    return {
      dockHeight: dock?.height ?? 0,
      canvasHeight: canvas?.height ?? 0,
      horizontalOverflow: panel ? panel.scrollWidth - panel.clientWidth : 0,
      journalInDock: [...(panel?.querySelectorAll('button') ?? [])].some(
        (button) => button.textContent === 'Travel journal',
      ),
      settingsInDock: [...(panel?.querySelectorAll('button') ?? [])].some(
        (button) => button.textContent === 'Settings',
      ),
      pauseInDock: [...(panel?.querySelectorAll('button') ?? [])].some(
        (button) => button.textContent === 'Pause',
      ),
    };
  });
  expect(closed.dockHeight).toBeLessThan(180);
  expect(closed.canvasHeight).toBeGreaterThan(480);
  // The dock reserves a few device pixels for its vertical scrollbar; the
  // Riverside HUD itself is visible without a horizontal scroller.
  expect(closed.horizontalOverflow).toBeLessThanOrEqual(8);
  expect(closed.journalInDock).toBe(false);
  expect(closed.settingsInDock).toBe(false);
  expect(closed.pauseInDock).toBe(false);

  await expect(page.getByRole('button', { name: 'Activities', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await openActivities(page);
  await expect(page.getByRole('button', { name: 'Under the banyan', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Visit the shrine', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wait until…', exact: true })).toBeVisible();
  // The preview enters in the afternoon, when Dorin is on the gate post (M7).
  await expect(page.getByRole('button', { name: "Dorin's drill", exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activities', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('riverside activities remain reachable at largest text in portrait', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
  await setLargeText(page, 'huge');
  await settleLayout(page);
  await openActivities(page);

  const geometry = await page.evaluate(() => {
    const scene = document.querySelector('.explore-scene')?.getBoundingClientRect();
    const canvas = document.querySelector('.map-canvas')?.getBoundingClientRect();
    const dock = document.querySelector('.explore-dock')?.getBoundingClientRect();
    return {
      sceneWidth: scene?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      dockHeight: dock?.height ?? 0,
      pageWidth: document.documentElement.scrollWidth,
    };
  });
  expect(geometry.sceneWidth).toBe(390);
  expect(geometry.pageWidth).toBeLessThanOrEqual(390);
  expect(geometry.canvasHeight).toBeGreaterThan(300);
  expect(geometry.dockHeight).toBeLessThanOrEqual(geometry.sceneWidth * 2);

  const menu = page.locator('#riverside-activities');
  await expect(menu).toBeVisible();
  // The last activity in the afternoon, when the drill is not on offer.
  const wait = page.getByRole('button', { name: 'Wait until…', exact: true });
  await wait.scrollIntoViewIfNeeded();
  await expect(wait).toBeVisible();
  expect((await wait.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
});

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
  await expect(page.locator('.explore-conversation, .dialogue-scene').first()).toBeVisible();
});

for (const renderer of ['canvas', 'webgl']) {
  test(`riverside discovery, forms and campaign preservation (${renderer})`, async ({ page }) => {
    // The WebGL CI runner rasterises in software; the same gallery form
    // takes two minutes there and five seconds on Canvas.
    test.setTimeout(90_000);
    allowSoftwareWebgl(test, renderer);
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
    await openActivities(page);
    await page.getByRole('button', { name: 'Under the banyan', exact: true }).click();
    await expect(page.locator('.village-note')).toContainText('The banyan shades the path.', {
      timeout,
    });
    await expect(page.locator('.village-life-canvas')).toHaveAttribute(
      'data-occluded-actors',
      /^[1-9]/,
    );
    await expect
      .poll(() => page.evaluate(() => window.fnt!.app.state?.location.pos))
      .toEqual({ x: 13, y: 9 });
    await openActivities(page);
    await page.getByRole('button', { name: 'Meet Pebble', exact: true }).click();
    await expect(page.locator('.village-note')).toContainText('Pebble leans', { timeout });
    await openActivities(page);
    await page.getByRole('button', { name: 'Tea break', exact: true }).click();
    await expect(page.locator('.village-note')).toContainText('jasmine tea', { timeout });
    // Dorin's drill is his midday relief (D3); the preview's afternoon has
    // him on the gate post, so wait for it here at the porch (D8).
    await expect(page.getByRole('button', { name: "Dorin's drill", exact: true })).toHaveCount(0);
    await openActivities(page);
    await page.getByRole('button', { name: 'Wait until…', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Midday/ })
      .click();
    await expect(page.locator('.explore-phase')).toHaveText('Midday');
    await openActivities(page);
    await page.getByRole('button', { name: 'Visit the shrine', exact: true }).click();
    await expect(page.locator('.explore-conversation, .dialogue-scene').first()).toBeVisible({
      timeout,
    });
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('.line-count')).toHaveText(`${i + 1} of 3`);
      await page
        .locator('button')
        .filter({ hasText: /^(Next|Continue)$/ })
        .click();
    }
    await expect(page.locator('.village-caption')).toContainText('3/3');
    await openActivities(page);
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
  await openActivities(page);
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
