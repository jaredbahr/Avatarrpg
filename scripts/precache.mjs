import { REGIONS, START_REGION_ID } from '../src/content/regions';
import { laterRegionIgnores } from './region-cache.mjs';

/**
 * What the service worker does not precache, beyond the streamed music below. Since ADR 0111 §3
 * that is every region but the start region (its chunk and art, cached on a first visit;
 * `region-cache.mjs`), and nothing else since T7
 * (ADR 0104): the oblique map art that T6 left for run time is deleted, so every image the game
 * draws is precached and it plays offline after a first visit. `vite.config.ts` hands these to
 * workbox as `globIgnores`, and `check-asset-budget.mjs` leaves the same files out of the precache
 * total, so the number checked is the number precached.
 *
 * Each pattern is a path relative to `dist/`: exact, or with `*` (within a name) and `**` (across folders).
 */
export const PRECACHE_IGNORES = laterRegionIgnores(REGIONS, START_REGION_ID);

/**
 * Area music streams from the network as it plays (ADR 0108): a few MB of loops that one area at a
 * time needs, and none of them before the first tap. `globPatterns` in `vite.config.ts` has no
 * `m4a`, so workbox never lists them; the asset budget leaves them out of the precache total too
 * (the audio family still counts them).
 */
export const STREAMED = ['audio/music/**'];

/** Whether `path` matches `pattern`: `*` stays inside a name, `**` crosses folders. */
export function globMatches(pattern, path) {
  if (!pattern.includes('*')) return path === pattern;
  const source = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0')
    .replace(/\*/g, '[^/]*')
    .replace(/\0/g, '.*');
  return new RegExp(`^${source}$`).test(path);
}

/** Whether `path` (relative to `dist/`, `/`-separated) is left out of the precache. */
export function isPrecacheIgnored(path) {
  return [...PRECACHE_IGNORES, ...STREAMED].some((pattern) => globMatches(pattern, path));
}
