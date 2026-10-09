# ADR 0074: Raise the JavaScript budget to 360 KB

**Status:** accepted, 2026-10-08

Amends ADR 0066. ADR 0057 and ADR 0060 stay in force: the Pixi stubs and the runtime validator are
requirements, not savings to spend.

## Context

ADR 0066 raised the gate in `scripts/check-bundle-size.mjs` from 320 KB to 350 KB gzipped, for the
demo work then pending. The measurement is unchanged: the gzip size of every shipped `.js` file under
`dist/`, all chunks included.

The dressed Ba Dan village (its set dressing, boundary wall, tree clumps and the placement tables
that draw them, `src/content/scenes/baDan.ts`) measures **350.1 KB**: 0.1 KB over the gate it was
written under. A table-compaction attempt (the scene's coordinate tables packed tighter, derived
fields moved out of the literals) saved nothing once gzipped: the repeated structure it removed was
already what gzip removes, and the bytes that remain are the placements themselves.

The owner delegated the limit to the supervisor on 2026-10-08, with the instruction that the goal is
Ba Dan: polish it, to prove it can be done.

## Decision

Raise the gate from 350 KB to **360 KB gzipped**. The measurement, the PWA-output check, the ADR 0057
stubs and the ADR 0060 `ZodError` check do not change. Update the roadmap's governance line.

## Alternatives considered

- **Compact the tables further.** Tried; no gain after gzip, and the literals are what the packers'
  tests assert against, so a more clever encoding costs readability for nothing.
- **Move the scene's tables out of the bundle** (fetch them as data). A second request and a new
  loading state for 0.1 KB over a gate; the scene is content and belongs where the other scenes are.

## Consequences

- The gate is still a guard rail with one explicit number. 10 KB is room for what the village needs
  to finish, not a standing permission: every later addition still has to be justified against it.
- The artwork's placement data stays in `src/content/scenes/baDan.ts`; the heavy part of the village
  (the packing, the clump composition, the trees' rule) lives in `scripts/art/` and costs the bundle
  nothing.
