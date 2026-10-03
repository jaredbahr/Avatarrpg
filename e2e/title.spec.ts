import { expect, test, type Page } from '@playwright/test';
import { resetStorage } from './helpers';

test.describe('title screen', () => {
  test('shows the key art behind a readable plate with the title as live text', async ({
    page,
  }) => {
    await resetStorage(page);
    const art = page.locator('.title-art-layer[data-active="true"] img');
    await expect(art).toBeAttached();
    await expect
      .poll(() => art.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(page.locator('.title-card h1')).toHaveText('Four Nations Tactics');
    await expect(page.locator('.title-card .legal')).toContainText('A non-commercial fan project.');
    await expect(page.locator('.title-card .tagline')).toBeVisible();
  });

  test('keeps the title above the tagline and every button on screen', async ({ page }) => {
    await resetStorage(page);
    const h1 = await page.locator('.title-card h1').boundingBox();
    const tagline = await page.locator('.title-card .tagline').boundingBox();
    expect(h1 && tagline && tagline.y >= h1.y + h1.height).toBe(true);
    const buttons = page.locator('.title-card button');
    for (let i = 0; i < (await buttons.count()); i++) {
      await buttons.nth(i).scrollIntoViewIfNeeded();
      await expect(buttons.nth(i)).toBeInViewport();
    }
  });

  test('draws a visible focus ring on a button', async ({ page }) => {
    await resetStorage(page);
    await page.keyboard.press('Tab');
    const ring = await page
      .locator('.title-card button:focus-visible')
      .evaluate((node) => getComputedStyle(node).outlineWidth);
    expect(parseFloat(ring)).toBeGreaterThanOrEqual(3);
  });

  /** The painting on show, as the scene reports it. */
  const shown = (page: Page) => page.locator('.title-art').getAttribute('data-current');

  /** Page time stops at 1 s and moves only when a test runs it, so no 12 s wait is ever real. */
  async function frozenClock(page: Page) {
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
  }

  async function boot(page: Page, query: string, storage: Record<string, string> = {}) {
    // A static file on the same origin: storage can be set without loading the app first.
    await page.goto('/robots.txt');
    await page.evaluate((entries) => {
      localStorage.clear();
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, storage);
    await page.goto(`/${query}`);
    await expect.poll(() => page.evaluate(() => Boolean(window.fnt?.app))).toBe(true);
  }

  test('a forced painting puts the plate on the side that painting leaves quiet', async ({
    page,
  }) => {
    for (const [id, side] of [
      ['a', 'left'],
      ['b', 'right'],
      ['c', 'left'],
    ] as const) {
      await boot(page, `?titleArt=${id}&titleArtHold=0`);
      await expect(page.locator('.title-art')).toHaveAttribute('data-current', id);
      await expect(page.locator('.title-scene')).toHaveAttribute('data-side', side);
      const viewport = page.viewportSize();
      const card = await page.locator('.title-card').boundingBox();
      if (!viewport || !card) throw new Error('no layout');
      const centre = card.x + card.width / 2;
      if (viewport.width / viewport.height > 0.9) {
        if (side === 'left') expect(centre).toBeLessThan(viewport.width / 2);
        else expect(centre).toBeGreaterThan(viewport.width / 2);
      }
    }
  });

  test('each visit picks a painting other than the one remembered for the device', async ({
    page,
  }) => {
    for (const previous of ['a', 'b', 'c']) {
      await boot(page, '?titleArtHold=0', { 'fnt.titleArt': previous });
      const now = await shown(page);
      expect(['a', 'b', 'c']).toContain(now);
      expect(now).not.toBe(previous);
      expect(await page.evaluate(() => localStorage.getItem('fnt.titleArt'))).toBe(now);
    }
  });

  test('still shows a painting when storage throws', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    await page.goto('/?titleArtHold=0');
    await expect(page.locator('.title-card h1')).toHaveText('Four Nations Tactics');
    expect(['a', 'b', 'c']).toContain(await shown(page));
  });

  test('cross-fades to a different painting after the idle time, preloading only the next', async ({
    page,
  }) => {
    const wide = new Set<string>();
    page.on('request', (request) => {
      const match = /title-([abc])-wide\.webp/.exec(request.url());
      if (match?.[1]) wide.add(match[1]);
    });
    await frozenClock(page);
    await boot(page, '?titleArt=a');
    await expect(page.locator('.title-art')).toHaveAttribute('data-current', 'a');
    // First paint has one painting; only the next one is fetched behind it.
    await expect.poll(() => page.locator('.title-art img').count()).toBe(2);
    await expect.poll(() => wide.size).toBe(2);
    expect(wide.has('a')).toBe(true);

    const fade = await page
      .locator('.title-art-layer')
      .first()
      .evaluate((node) => getComputedStyle(node).transitionDuration);
    expect(fade).toBe('1.5s');

    await page.clock.runFor(11000);
    expect(await shown(page)).toBe('a');
    await page.clock.runFor(1500);
    const next = await shown(page);
    expect(next).not.toBe('a');
    await expect(page.locator(`.title-art-layer[data-art="${next}"]`)).toHaveAttribute(
      'data-active',
      'true',
    );
    await expect(page.locator('.title-art-layer[data-active="true"]')).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('fnt.titleArt'))).toBe(next);
    // The plate has followed the painting to its side by the end of the fade.
    await page.clock.runFor(1600);
    await expect(page.locator('.title-scene')).toHaveAttribute(
      'data-side',
      next === 'b' ? 'right' : 'left',
    );
    await expect(page.locator('.title-scene')).not.toHaveAttribute('data-swap', 'out');
    // It keeps going, and never to the painting already on show.
    await page.clock.runFor(12000);
    expect(await shown(page)).not.toBe(next);
  });

  test('Reduce motion keeps the per-visit pick but never cross-fades', async ({ page }) => {
    const settings = JSON.stringify({ reduceMotion: true });
    await frozenClock(page);
    await boot(page, '', { 'fnt.settings': settings, 'fnt.titleArt': 'a' });
    const first = await shown(page);
    expect(first).not.toBe('a');
    await page.clock.runFor(60000);
    expect(await shown(page)).toBe(first);
    // Nothing was loaded behind it, and nothing is mid-fade.
    await expect(page.locator('.title-art img')).toHaveCount(1);
    await expect(page.locator('.title-art-layer[data-active="true"]')).toHaveCount(1);
  });
});
