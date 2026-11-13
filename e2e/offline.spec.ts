import { expect, test } from '@playwright/test';
import { precachePaths } from '../scripts/e2e/precache-manifest';
import { resetStorage } from './helpers';
import {
  installQuarryRouteDiagnostics,
  playQuarryDriller,
  playQuarryGate,
  playQuarryHome,
  playQuarryOpening,
} from './quarry-route';

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

test.describe('quarry campaign precache coverage', () => {
  installQuarryRouteDiagnostics();

  for (const style of ['default', 'explicit top-down'] as const) {
    test(`precaches assets through the Driller and home in ${style} style`, async ({
      page,
      context,
    }, testInfo) => {
      test.setTimeout(600_000);
      const requests = new Set<string>();
      page.on('request', (request) => requests.add(request.url()));

      const query = style === 'default' ? '?renderer=canvas' : '?renderer=canvas&style=topdown';
      await page.clock.install();
      await resetStorage(page, query);
      await page.waitForFunction(() => navigator.serviceWorker?.controller?.state === 'activated');
      const worker = await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL);
      const workerUrl = new URL(worker);
      const response = await page.request.get(worker);
      expect(response.ok()).toBe(true);
      const precached = precachePaths(await response.text(), workerUrl);

      // Enter setup with a trusted gesture so the online request audit includes
      // music, even though the deterministic party fixture handles the picks.
      await page.getByRole('button', { name: /new game/i }).click();
      try {
        await playQuarryOpening(page, 'escort');
        await playQuarryGate(page, 'escort');
        await playQuarryDriller(page, 'escort', true);
        await playQuarryHome(page, 'escort');

        const online = [...requests];
        const root = new URL('./', workerUrl).pathname;
        const entry = new URL('index.html', workerUrl).pathname;
        const observed = [
          ...new Set(
            online
              .map((value) => new URL(value))
              .filter((url) => url.origin === workerUrl.origin)
              .map((url) => (url.pathname === root ? entry : url.pathname)),
          ),
        ].sort();
        const missing = observed.filter((path) => !precached.has(path));
        await testInfo.attach('quarry-precache-requests', {
          body: JSON.stringify({ style, worker, observed, missing, requests: online }, null, 2),
          contentType: 'application/json',
        });
        expect(observed.some((path) => path.startsWith(root + 'art/topdown/ba-dan/'))).toBe(true);
        expect(observed.some((path) => path.startsWith(root + 'art/topdown/quarry-floor/'))).toBe(
          true,
        );

        await context.setOffline(true);
        try {
          await page.reload();
          await expect(page.getByRole('heading', { name: /four nations tactics/i })).toBeVisible();
          await page.getByRole('button', { name: /new game/i }).click();
          const ground = page.waitForResponse((res) => {
            const url = new URL(res.url());
            return (
              url.origin === workerUrl.origin &&
              url.pathname.startsWith(root + 'art/topdown/ba-dan/') &&
              url.pathname.endsWith('/ground.webp')
            );
          });
          await playQuarryOpening(page, 'escort');
          const painted = await ground;
          expect(painted.ok()).toBe(true);
          expect(painted.fromServiceWorker()).toBe(true);
          await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
          await expect
            .poll(() => page.evaluate(() => window.fnt?.app.rendererCamera()?.projection))
            .toBe('topdown');
        } finally {
          await context.setOffline(false);
        }

        expect(missing, 'same-origin campaign requests absent from the emitted precache').toEqual(
          [],
        );
      } finally {
        await testInfo.attach('quarry-all-requests', {
          body: JSON.stringify([...requests].sort()),
          contentType: 'application/json',
        });
      }
    });
  }
});
