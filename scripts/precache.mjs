/**
 * What the service worker does not precache (ADR 0104 §3, 2026-11-10 note): the top-down family
 * (`art/topdown/`) is fetched at run time, and only under `?style=topdown`, until T6 switches the
 * default style; T6 revisits it. `vite.config.ts` hands these to workbox as `globIgnores`, and
 * `check-asset-budget.mjs` leaves the same files out of the precache total (the family keeps its own
 * 6 MiB budget there), so the number checked is the number precached.
 *
 * Each pattern is a path relative to `dist/`, either exact or a folder ending in `/**`.
 */
export const PRECACHE_IGNORES = ['art/topdown/**'];

/** Whether `path` (relative to `dist/`, `/`-separated) is left out of the precache. */
export function isPrecacheIgnored(path) {
  return PRECACHE_IGNORES.some((pattern) =>
    pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern,
  );
}
