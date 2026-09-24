# ADR 0048: Raise the JavaScript bundle gate to 320 KB

**Status:** accepted, 2026-09-24

Supersedes the 300 KB JavaScript ceiling in ADR 0001 and ADR 0003. Their
renderer, asset-contract and fallback decisions are unchanged.

## Context

The production bundle gate totals the gzip size of every JavaScript file under
`dist/`, including the application chunks, `sw.js`, Workbox and
`registerSW.js`. It remains a whole-download guard rail for the tablet PWA,
not only a limit on Vite's largest chunk.

The old 300 KB limit no longer accommodates the accepted living-world Slice A
(ADR 0047, W0-W9). Before rebasing Slice A, its production build measured
310.3 KB gzipped against the 300 KB gate. After rebasing it onto
`origin/main` at `a9d7b5f`, preserving the later DL-2 renderer work, the
same measurement was 310.6 KB:

| Production JavaScript       | Gzipped size |
| --------------------------- | -----------: |
| Application bundle          |     295.7 KB |
| Service worker              |       5.9 KB |
| Workbox runtime             |       5.1 KB |
| Browser helper chunk        |       3.8 KB |
| Service-worker registration |       0.1 KB |
| **Total**                   | **310.6 KB** |

The increase is functional product code: Slice A adds the deterministic world
clock, resident identity and scheduling, conversation holds, waiting and
settling, living-world UI, resident motion, renderer parity and the Ba Dan day
acceptance matrix. Further living-world slices will add more world behavior.
Holding the old ceiling would require removing accepted behavior or trading
away maintainability for a gate already exceeded by this slice.

## Decision

Raise the JavaScript gate in `scripts/check-bundle-size.mjs` from 300 KB to
**320 KB gzipped**. Keep the existing measurement: sum the gzip size of every
shipped `.js` file in `dist/`, and continue requiring the PWA output.

Update the CI label, build commentary and roadmap's current governance value to
320 KB. Historical measurements in earlier ADRs, art reports and handoffs stay
historical; this ADR is the current authority.

The 9.4 KB of headroom after Slice A is capacity for deliberate later slices,
not a standing permission for incidental growth. Contributors must continue to
measure the production bundle and avoid dependencies or registrations that do
not earn their download cost.

Any proposal that would take the measured total past 320 KB must be approved by
another ADR before changing, bypassing or redefining this gate. That ADR must
record the measured total, the source of growth, alternatives considered and
the new ceiling. CI must not gain exclusions or a silent tolerance band.

## Consequences

- ADR 0047 W0-W9 can ship with the later DL-2 work while retaining one explicit
  production-size gate.
- ADR 0001's engine choice and optional Pixi registration restrictions remain
  in force, but its 300 KB clause is superseded.
- ADR 0003's asset limits remain unchanged; only its JavaScript ceiling is
  superseded.
- Growth above 320 KB is blocked until another reviewed budget decision is
  recorded.
