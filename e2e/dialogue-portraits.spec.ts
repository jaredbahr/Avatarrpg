import { expect, test } from '@playwright/test';
import { enterNode, resetStorage, setLargeText, startGame } from './helpers';

test.use({ serviceWorkers: 'block' });

for (const layout of [
  { name: 'phone', width: 390, height: 844, huge: false },
  { name: 'phone largest text', width: 390, height: 844, huge: true },
  { name: 'short landscape largest text', width: 844, height: 390, huge: true },
  { name: 'desktop', width: 1368, height: 912, huge: false },
]) {
  test(`${layout.name}: speaker art stays visible through dialogue, choice and reload`, async ({
    page,
  }) => {
    await page.setViewportSize(layout);
    await resetStorage(page, '?renderer=canvas');
    await startGame(page, ['Elias'], ['jinu']);
    if (layout.huge) await setLargeText(page, 'huge');
    for (const [node, asset] of [
      ['mira_intro', 'portrait.mira'],
      ['gao_home', 'portrait.gao'],
      ['dorin_home', 'portrait.dorin'],
      ['dorin_directions', 'portrait.jinu'],
      ['ruon_choice', 'portrait.ruon'],
    ] as const) {
      await enterNode(page, node);
      const portrait = page
        .locator('.stage-portrait canvas, .conversation-compact-portrait canvas')
        .first();
      await expect(portrait).toBeVisible();
      await expect(portrait).toHaveAttribute('data-asset', asset);
      const bounds = await portrait.boundingBox();
      if (!bounds) throw new Error('Portrait has no bounds');
      expect(bounds.width).toBeGreaterThanOrEqual(64);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(layout.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(layout.height);
      expect(
        await page
          .locator('.name-plate, .conversation-compact-speaker')
          .first()
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const panel = await page.locator('.dialogue-panel').boundingBox();
      if (!panel) throw new Error('Dialogue has no bounds');
      expect(panel.height).toBeGreaterThan(48);
      expect(panel.y + panel.height).toBeLessThanOrEqual(layout.height);
    }
    // The last choice can scroll, but each authored option remains reachable.
    for (const option of await page.locator('.choice-panel button').all()) {
      await option.scrollIntoViewIfNeeded();
      await expect(option).toBeInViewport();
    }
    await enterNode(page, 'gao_home');
    await page.locator('.dialogue-panel button').tap();
    await expect(page.locator('.line-count')).toHaveText('2 of 3');
    const saved = await page.evaluate(() => {
      const app = window.fnt!.app;
      if (!app.saveTo('auto')) throw new Error('Save failed');
      return app.state;
    });
    await page.reload();
    await page.getByRole('button', { name: /^Continue$/ }).click();
    expect(await page.evaluate(() => window.fnt?.app.state)).toEqual(saved);
    await expect(
      page.locator('.stage-portrait canvas, .conversation-compact-portrait canvas').first(),
    ).toBeVisible();
    await expect(page.locator('.line-count')).toHaveText('2 of 3');
    await page.locator('.dialogue-panel button').tap();
    await expect(page.locator('.line-count')).toHaveText('3 of 3');
  });
}

test('a failed canonical portrait image keeps a visible painted fallback', async ({
  page,
  context,
}) => {
  // Block the asset before boot; a service worker must not fulfill it from cache.
  let blocked = false;
  await context.route('**/art/portraits/mira.png', (route) => {
    blocked = true;
    return route.abort();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Elias'], ['kaya']);
  await enterNode(page, 'mira_intro');
  await expect.poll(() => blocked).toBe(true);
  const portrait = page
    .locator('.stage-portrait canvas, .conversation-compact-portrait canvas')
    .first();
  await expect(portrait).toBeVisible();
  expect(
    await portrait.evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      return data.some((value, i) => i % 4 === 3 && value > 0);
    }),
  ).toBe(true);
  await page.locator('.dialogue-panel button').tap();
  await expect(page.locator('.line-count')).toHaveText('2 of 4');
});

test('party speaker title agrees with the portrait and staged narration keeps its label', async ({
  page,
}) => {
  await resetStorage(page, '?renderer=canvas');
  await startGame(page, ['Elias'], ['jinu']);
  await expect(page.locator('.top-bar > span')).toHaveText('Ba Dan');
  await enterNode(page, 'dorin_directions');
  await expect(
    page.locator('.name-plate h2, .conversation-compact-speaker strong').first(),
  ).toHaveText('Jinu');
  await expect(page.locator('.top-bar > span')).toHaveText('Jinu');
  await expect(
    page.locator('.stage-portrait canvas, .conversation-compact-portrait canvas').first(),
  ).toHaveAttribute('data-asset', 'portrait.jinu');
  await page.locator('.dialogue-panel button').tap();
  await expect(page.locator('.top-bar > span')).toHaveText('Jinu');
  await enterNode(page, 'ruon_choice');
  await expect(page.locator('.top-bar > span')).toHaveText('Captain Ruon');
  await enterNode(page, 'act1_open');
  await expect(page.locator('.top-bar > span')).toHaveText('Ba Dan');
});
