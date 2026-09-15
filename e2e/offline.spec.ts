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
    const controlled = await page.waitForFunction(
      async () => {
        if (!('serviceWorker' in navigator)) return false;
        const registration = await navigator.serviceWorker.getRegistration();
        return Boolean(registration?.active);
      },
      undefined,
      { timeout: 30_000 },
    );
    expect(controlled).toBeTruthy();

    // Give the precache a moment to finish before cutting the cord.
    await page.waitForTimeout(1500);

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: /four nations tactics/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /new game/i })).toBeVisible();

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
