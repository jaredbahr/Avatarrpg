# ADR 0066: Raise the JavaScript budget to 350 KB

**Status:** accepted, 2026-09-29

Numbered 0066 because 0065 is taken by a pending branch. Amends ADR 0048.
ADR 0057 and ADR 0060 recovered headroom under the 320 KB gate and stay in
force: their Pixi stubs and the runtime validator remain requirements, not
temporary savings to spend.

## Context

ADR 0048 set the production JavaScript gate at 320 KB gzipped, summing the
gzip size of every shipped `.js` file under `dist/`: the application chunk,
Pixi's lazy `browserAll` chunk, `sw.js`, the Workbox runtime and
`registerSW.js`. The measurement is unchanged here.

ADR 0057 recovered headroom by dropping Pixi registrations the game never
creates and the `safari10` workaround, and ADR 0060 replaced runtime zod with
`src/core/schema.ts` for about 11.5 KB. Later passes found smaller savings.
That work left main measuring **318.7 KB** against the 320 KB gate, which
`CHANGELOG.md` records for the 0.2.11 candidate.

That headroom is already committed. Elevation presentation, the AI fixes and
the AI weight work are pending together, and the village-to-quarry demo still
owes the preview UI, the cloud visuals and the bends. Each further trim now
costs a worker-day for about 1 KB, so paying for the remaining demo work by
deleting reachable behavior trades the delivery for a number no player sees.

## Decision

Raise the JavaScript gate in `scripts/check-bundle-size.mjs` from 320 KB to
**350 KB gzipped**. Keep the existing measurement: sum the gzip size of every
shipped `.js` file under `dist/`, all chunks included, and continue requiring
the PWA output, the ADR 0057 stubs and the ADR 0060 `ZodError` check.

Update the build commentary, `src/core/schema.ts`'s budget note and the
roadmap's current governance value to 350 KB. Historical measurements in
earlier ADRs, the changelog, art reports and handoffs stay historical; this
ADR, and ADR 0048 as amended, are the current authority.

## Alternatives considered

- **Trim to fit 320 KB.** The next 2 KB of dedicated search costs roughly two
  worker-days and buys no player-visible behavior, which is more than the
  pending demo work needs.
- **Split the budget per chunk.** The gate is a whole-download guard rail for a
  tablet PWA; a per-chunk limit would police a number no player downloads on its
  own.
- **Cut planned demo work.** The preview UI, cloud visuals and bends are
  accepted scope for the current finish line, not optional polish.

## Consequences

- The gate stays a guard rail: it still fails the build on a regression and
  still carries one explicit, reviewable number.
- New render code should still pay for itself where it can. The larger ceiling
  is room for the committed demo work, not a standing permission for incidental
  growth.
- Revisit the number before release, against the shipped total and the demo's
  remaining scope.
