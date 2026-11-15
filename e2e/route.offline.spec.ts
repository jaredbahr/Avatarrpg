/**
 * Offline, the whole way (#498): everything a session fetches from the title to the Driller and
 * home again is in the service worker's precache, and the same session plays with the network
 * gone.
 *
 * The game is installed to the iPad's Home Screen. `offline.spec.ts` proves the shell and the
 * first board; this plays the route (`e2e/soak/route.ts`: a new game, every map and fight, a loss
 * and a retry, the ending, the riverside preview, a save loaded and quit) and holds two things:
 *
 * 1. online, every same-origin request the session makes is either in the precache list built
 *    into `sw.js` or one of the declared exceptions (`STREAMED` in `scripts/precache.mjs`: the
 *    area music, which streams by decision, ADR 0108);
 * 2. offline, after a reload, the same session runs to the end and the only requests that fail
 *    are those same exceptions.
 *
 * So an asset added later and fetched lazily (a portrait, a sheet, a scene file) that the precache
 * globs miss fails here, naming the file, instead of on a tablet in the car.
 */
import { expect, test, type Page } from '@playwright/test';
import { STREAMED, globMatches } from '../scripts/precache.mjs';
import { newGameFromTitle, playRoute, titleLoadAndQuit, type RouteOptions } from './soak/route';

const OPTIONS: RouteOptions = { reduceMotion: true, turnsPerFight: 1 };

/** A request's path relative to the site root, without its query. */
function sitePath(url: string, origin: string): string | null {
  const parsed = new URL(url);
  if (parsed.origin !== origin) return null;
  return decodeURIComponent(parsed.pathname).replace(/^\//, '');
}

const streamed = (path: string): boolean => STREAMED.some((pattern) => globMatches(pattern, path));

async function playSession(page: Page): Promise<void> {
  await newGameFromTitle(page, OPTIONS);
  await playRoute(page, OPTIONS);
  await titleLoadAndQuit(page, OPTIONS);
}

test('a whole session fetches only what is precached, and plays with no network', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(600_000);
  const origin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const requested = new Set<string>();
  const failed = new Set<string>();
  page.on('request', (request) => {
    const path = sitePath(request.url(), origin);
    if (path !== null) requested.add(path);
  });
  page.on('requestfailed', (request) => {
    // A scene change drops the track it was streaming; that abort is the player's own doing.
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    const path = sitePath(request.url(), origin);
    if (path !== null) failed.add(path);
  });

  await page.goto('/?renderer=canvas');
  await page.waitForFunction(() => navigator.serviceWorker?.controller?.state === 'activated', {
    timeout: 60_000,
  });
  await page.waitForFunction(() => Boolean(window.fnt?.app));

  // What the worker precached, read from the worker that shipped.
  const worker = await (await page.request.get('/sw.js')).text();
  const precached = new Set(
    [...worker.matchAll(/url:"([^"]+)"/g)].map((match) => match[1] ?? '').filter(Boolean),
  );
  expect(precached.size, 'precache entries in sw.js').toBeGreaterThan(100);
  // The navigation itself is served from `index.html`; the worker and its registration are the
  // browser's own fetches.
  const shell = (path: string): boolean =>
    path === '' || path === 'sw.js' || /^workbox-[\w-]+\.js$/.test(path);

  /* 1. Online: nothing asked for is outside the precache, bar the declared exceptions. */
  await playSession(page);
  const unprecached = [...requested]
    .filter((path) => !precached.has(path) && !shell(path) && !streamed(path))
    .sort();
  const music = [...requested].filter(streamed).sort();
  console.log(
    `online: ${requested.size} paths requested, ${precached.size} precached, ` +
      `${music.length} streamed by decision (${music.join(', ') || 'none'})`,
  );
  expect(unprecached, 'requested online but not precached').toEqual([]);
  expect([...failed], 'requests that failed online').toEqual([]);
  expect(errors, 'page errors online').toEqual([]);

  /* 2. Offline: the same session, from a reload, to the end. */
  await context.setOffline(true);
  requested.clear();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.fnt?.app));
  await playSession(page);
  const brokeOffline = [...failed].filter((path) => !streamed(path)).sort();
  console.log(
    `offline: ${requested.size} paths requested, ${failed.size} failed ` +
      `(${[...failed].sort().join(', ') || 'none'})`,
  );
  expect(brokeOffline, 'requests that failed offline and are not streamed music').toEqual([]);
  expect(errors, 'page errors offline').toEqual([]);
  await context.setOffline(false);
});
