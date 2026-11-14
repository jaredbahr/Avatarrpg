/**
 * What the service worker does not precache, beyond the streamed music below. Nothing since T7
 * (ADR 0104): the oblique map art that T6 left for run time is deleted, so every image the game
 * draws is precached and it plays offline after a first visit. `vite.config.ts` hands these to
 * workbox as `globIgnores`, and `check-asset-budget.mjs` leaves the same files out of the precache
 * total, so the number checked is the number precached.
 *
 * Each pattern is a path relative to `dist/`, either exact or a folder ending in `/**`.
 */
export const PRECACHE_IGNORES = [];

/**
 * Area music streams from the network as it plays (ADR 0108): a few MB of loops that one area at a
 * time needs, and none of them before the first tap. `globPatterns` in `vite.config.ts` has no
 * `m4a`, so workbox never lists them; the asset budget leaves them out of the precache total too
 * (the audio family still counts them).
 */
export const STREAMED = ['audio/music/**'];

/** Whether `path` (relative to `dist/`, `/`-separated) is left out of the precache. */
export function isPrecacheIgnored(path) {
  return [...PRECACHE_IGNORES, ...STREAMED].some((pattern) =>
    pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern,
  );
}
