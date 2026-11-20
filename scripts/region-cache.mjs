/**
 * Offline play for later regions (ADR 0111 §3, amended 2026-11-14). Pure helpers: `precache.mjs`
 * hands them the region list, `vite.config.ts` hands the result to workbox, and
 * `region-cache.test.ts` runs them against made-up regions.
 *
 * The start region and its neighbours are precached at install. Every other region's chunk
 * (`assets/region-<folder>-<hash>.js`, folder = the camelCased id) and its art folders (one per
 * top-down scene) are left out of the precache and cached by the service worker the first time
 * the page fetches them (`CacheFirst`), which is the first time the party enters that region
 * (`RegionStore` imports the chunk and reads the scenes; no extra message is needed). Music
 * stays streamed (ADR 0108): an `<audio>` element sends Range requests, which a cache cannot keep.
 */

const folderOf = (url) => url.slice(0, url.lastIndexOf('/') + 1);
const camel = (id) => id.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The regions fetched, then cached, on a first visit: every one but the start region and the
 * start region's neighbours. A region is ready only when its neighbours are loaded too
 * (`RegionStore`), so a neighbour of the start region is needed before the first command of a
 * new game runs; left to the runtime cache, the demo itself would not start offline after an
 * update cleared that cache (ADR 0111 §3, amended 2026-11-15 for RG-02).
 */
export function laterRegions(regions, startId) {
  const start = regions.find((region) => region.id === startId);
  const needed = new Set([startId, ...(start?.neighbours ?? [])]);
  return regions.filter((region) => !needed.has(region.id));
}

/** The pieces of a later region's files: its chunk folder name and its art folders. */
function pieces(region) {
  return {
    chunk: camel(region.id),
    artDirs: [...new Set(Object.values(region.scenes).map((scene) => folderOf(scene.url)))],
  };
}

/** Precache ignore patterns (`precache.mjs` format) for the later regions' chunks and art. */
export function laterRegionIgnores(regions, startId) {
  return laterRegions(regions, startId).flatMap((region) => {
    const { chunk, artDirs } = pieces(region);
    return [`assets/region-${chunk}-*.js`, ...artDirs.map((dir) => `${dir}**`)];
  });
}

/** The service worker's cache for those files; the name carries the build, so an update starts clean. */
export const regionCacheName = (build) => `fnt-regions-${build}`;

/**
 * A workbox `runtimeCaching` entry for the later regions, or none while there are none (the
 * demo's one region is the start region, so the worker is unchanged). A RegExp, not a function,
 * because workbox writes the config into `sw.js` as text.
 */
export function laterRegionRuntimeCaching(regions, startId, build) {
  const later = laterRegions(regions, startId).map(pieces);
  if (later.length === 0) return [];
  const chunks = later.map((region) => escapeRegExp(region.chunk)).join('|');
  const dirs = later.flatMap((region) => region.artDirs.map(escapeRegExp)).join('|');
  return [
    {
      urlPattern: new RegExp(`/(?:assets/region-(?:${chunks})-[^/]+\\.js|(?:${dirs}).+)$`),
      handler: 'CacheFirst',
      options: { cacheName: regionCacheName(build) },
    },
  ];
}

/**
 * The worker's `importScripts` file: on activate it deletes every region cache but this build's,
 * so a hashed chunk or an unhashed scene of an older build is never served again. (Workbox's own
 * `cleanupOutdatedCaches` only knows the precache.)
 */
export function regionCacheCleanupScript(build) {
  return `self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('fnt-regions-') && key !== ${JSON.stringify(regionCacheName(build))})
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});
`;
}
