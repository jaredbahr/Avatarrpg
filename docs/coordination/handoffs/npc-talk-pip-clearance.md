# NPC talk indicator clearance

Tracked scope and remaining visual work: [issue #277](https://github.com/jaredbahr/Avatarrpg/issues/277).

## Bounded outcome

Place NPC talk indicators above the visible figure in Canvas and WebGL, with
space for the indicator's full radius. The old tile-relative offset could put
the dot on a tall resident's head. Keep existing foot anchors, picking,
presentation scale, motion and art unchanged.

Both backends use cached alpha bounds and the same transformed marker geometry,
including facing, pose scale, lift and lean. Each source/page has its own bounds
cache. If pixels cannot be read, placement conservatively uses the full frame.
The marker stays centred as lean crosses zero.

This is one correction within a Ba Dan interaction corner, not acceptance of
the whole scene. Preserve the accepted PixelLab party sheets and October
playback and scene-grounding work.

## Remaining visual work

- Identify the exact placeholder NPC before proposing an art replacement.
- Correlate reported dark ground rectangles with actual runtime layers before
  changing terrain, shadows or rule surfaces.
- Review Riverside's painting resolution, separate life-layer lighting and
  scale against its resident assets; do not apply a global art filter.
- Review the marker and scene at normal TV play scale and in motion. A passing
  geometry test does not establish aesthetic or gameplay acceptance.

## Validation and delivery constraints

This task is low priority. Targeted regression tests, type checking and checks
on changed files are appropriate; the full `ci:local` build/budget/balance gate,
browser suites and gallery remain deferred under the current resource limit.
Keep the PR draft and list exact executed checks in its description. No merge
or auto-merge is authorized by partial checks. The requested no-Actions delivery
uses a CI-skip commit directive without changing workflows or branch rules.

Focused validation passed: 31 tests across `talkPip.test.ts`,
`spriteCache.test.ts` and `actorSilhouette.test.ts`, using one worker with no
file parallelism. Type checking, lint on the six changed TypeScript files,
format checks and `git diff --check` passed. No browser, gallery or gameplay
acceptance is claimed.

NPC replacement art, broad scene changes and the separate comparison checkpoint
are outside this patch. No new dependency or public deployment is needed.
