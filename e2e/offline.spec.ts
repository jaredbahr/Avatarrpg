import { expect, test } from '@playwright/test';

/**
 * The PWA promise: install it once on the Surface, then it works in the car,
 * at the cabin, and anywhere else the wifi does not reach.
 *
 * Tests the real service worker against the production build, then pulls the
 * network out from under it.
 */
test.describe('offline', () => {
  test('registers a service worker and serves the app with no network', async ({
    page,
    context,
  }) => {
    await page.goto('/');

    // Wait for the worker to take control, not merely to be registered.
    await page.waitForFunction(
      () => {
        if (!('serviceWorker' in navigator)) return false;
        return navigator.serviceWorker.controller?.state === 'activated';
      },
      undefined,
      { timeout: 30_000 },
    );
    // An active registration can precede clients.claim(). Cut the network only
    // once this document is controlled and the navigation fallback is cached.
    await expect
      .poll(() =>
        page.evaluate(async () =>
          Boolean(
            await caches.match(new URL('index.html', location.href).href, { ignoreSearch: true }),
          ),
        ),
      )
      .toBe(true);

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: /four nations tactics/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /new game/i })).toBeVisible();

    // Top-down is the default (ADR 0104 T6) and precached: its boards draw with no network.
    await page.evaluate(() => {
      window.fnt?.app.newGame([{ name: 'Sam', unitId: '' }], [{ characterId: 'kaya' }], 'offline');
      window.fnt?.app.dispatch({ type: 'enterNode', nodeId: 'village_explore' });
    });
    await page.locator('.explore-scene .map-canvas').waitFor();
    await expect
      .poll(() => page.evaluate(() => window.fnt?.app.rendererCamera()?.projection))
      .toBe('topdown');
    expect(
      await page.evaluate(
        () => window.fnt?.app.content.maps.get('ba_dan_village')?.scene?.ground[0]?.url,
      ),
    ).toMatch(/^art\/topdown\/ba-dan\//);
    // Every image the board asked for came from the cache.
    const missing = await page.evaluate(async () => {
      const urls = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => url.includes('/art/topdown/'));
      const absent: string[] = [];
      for (const url of urls)
        if (!(await caches.match(url, { ignoreSearch: true }))) absent.push(url);
      return { checked: urls.length, absent };
    });
    expect(missing.checked).toBeGreaterThan(0);
    expect(missing.absent).toEqual([]);

    await context.setOffline(false);
  });

  test('ships a manifest that installs as a landscape app', async ({ page }) => {
    await page.goto('/');
    const href = await page.getAttribute('link[rel=manifest]', 'href');
    expect(href).toBeTruthy();

    const response = await page.request.get(href ?? '');
    expect(response.ok()).toBe(true);

    const manifest = (await response.json()) as {
      name: string;
      display: string;
      orientation: string;
      icons: { sizes: string; purpose?: string }[];
    };

    expect(manifest.name).toMatch(/four nations tactics/i);
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.icons.map((i) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});
