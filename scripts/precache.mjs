/**
 * What the service worker does not precache (ADR 0104 T6). Top-down is the default style, so its
 * family (`art/topdown/`) is precached and the game plays offline after a first visit. What is
 * left for run time is the oblique art of the five maps that now draw a top-down scene: only
 * `?style=oblique` (kept until T7) or a failed top-down scene load ever requests it. Leaving it
 * out keeps the precache inside its 25 MB without raising a budget. `vite.config.ts` hands these
 * to workbox as `globIgnores`, and `check-asset-budget.mjs` leaves the same files out of the
 * precache total (the maps family still holds its own budget), so the number checked is the
 * number precached.
 *
 * Each pattern is a path relative to `dist/`, either exact or a folder ending in `/**`.
 */
export const PRECACHE_IGNORES = [
  // Ba Dan's continuous painting and the Forest Road and quarry pages (the oblique scenes).
  'art/maps/ba-dan-scene/**',
  'art/maps/forest-g1/**',
  'art/maps/forest-scene/**',
  'art/maps/quarry-gate-scene/**',
  'art/maps/cutting-scene/**',
  'art/maps/driller-floor-scene/**',
  'art/maps/quarry-surround/**',
  // Their oblique backdrops; the riverside's stays, since it has no top-down scene yet.
  'art/maps/ba_dan_village.webp',
  'art/maps/forest_road.webp',
  'art/maps/quarry_gate.webp',
  'art/maps/ambush_road.webp',
  'art/maps/quarry_floor.webp',
];

/** Whether `path` (relative to `dist/`, `/`-separated) is left out of the precache. */
export function isPrecacheIgnored(path) {
  return PRECACHE_IGNORES.some((pattern) =>
    pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern,
  );
}
