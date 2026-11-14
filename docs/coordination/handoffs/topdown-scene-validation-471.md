# Top-down scene validation and reduced-motion coverage (#471)

Owner: continuous gameplay quality, `root/scene-validation471-20261110`.
Branch: `codex/scene-validation-471`, based on canonical main `c5f4ff2b`.
[Verified pre-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/471#issuecomment-6774129677).

## Problem and change

The fetched-scene guard accepted any object with ground and scenery arrays.
A missing scenery crop, the wrong atlas URL or a negative size therefore
reached the renderer instead of the existing logged, playable oblique fallback.
The shipped Ba Dan and Forest Road scenes already follow the packed contract.

Validate at the loader boundary with `src/core/schema.ts`, as ADR 0060 requires.
The schema preserves every supported `MapScene` field and both shipped payloads.
Ground crops are optional; atlas scenery crops are required. Display sizes must
be finite and positive, crop origins nonnegative integers, and image URLs the
source scene's sibling ground/atlas files. Legitimate negative world positions,
depth keys, exterior footprints and chimney positions remain valid. Custom
source directories retain their sibling URL contract. Validation establishes
neither image existence nor crop bounds in decoded images.

Failures retain the existing `is not a map scene` prefix and include the source
URL and exact nested issue paths. `main.ts` already logs a rejected load and
boots original `CONTENT`; it needs no change. No map geometry, rules, art,
character identity, default style, renderer, FX, packer format, dependencies or
budgets change. The seven claimed files contain the loader/schema, new unit and
native tests, and this handoff. The schema author owned only the three content
files; root owns the other four and integration.

## Preserved evidence

Evidence: `/workspace/avatarrpg-env/scene-validation471/`.

- The public main snapshot's complete Git tree and all 28,084 file modes/blobs
  match `ade784e3e91fc2bfd2f8d663e03e1ca8e8a7cda0`; the canonical signed commit
  bytes match main's SHA. This is merged main, not another worker's candidate.
  Existing dependency files match the previously tested lock; no installation
  or credential/access change occurred.
- Before final freeze, main merged #592's soak-load repair and #589's Earth Wall
  work. Root adopted canonical `c5f4ff2b` after verifying its fourteen changed
  blobs, complete tree and signed commit, with all seven candidate hashes
  unchanged. None of those merged paths overlaps this claim; no renderer or
  soak edit belongs to this PR. The clean `a6e6f99f` counterfactual and its
  original failures remain preserved below.
- `schema-red.*`: unchanged loader accepts twelve malformed cases; 12 failed,
  four shipped/custom/optional-field controls passed, stable 1.499 s. The test
  uses the real loader and copies of both shipped JSON files, not a second
  validator or a missing-import failure.
- `schema-related-green.*`: all 25 cases across the schema, existing
  presentation and new ambience files pass, plus typecheck/lint, stable 32.698 s.
  The original sixteen schema assertions remain; formatting is the only change
  to that red regression file.
- `baseline-build.*`: clean canonical main production build passes, 31.961 s.
- `native-baseline-schema.*`: both actual Canvas and WebGL valid-scene walking
  controls pass. All six malformed-scene cases fail on the precise defect:
  expected oblique fallback, actual top-down presentation. No skips/retries or
  flaky results; clean, stable producer, 88.932 s. Original probe bytes, errors,
  screenshots, videos and traces are retained. Final tests additionally check
  fallback console/page errors after walking, not only before it. Their request
  fixtures block service-worker caching so injected JSON reaches the loader
  across reload; this is not PWA acceptance or a production PWA change.
- `native-baseline-motion.*`: two actual rendered cases pass on the same clean
  production build, 34.888 s. Both backends freeze decoded chimney-region RGBA
  and complete smoke emitter descriptors across real draws over a second apart.
  With motion on, populated sampled smoke x/y positions and rendered region
  pixels change. Full game state/RNG, camera and source coordinates remain fixed.

## Motion boundary

No production motion defect was found. Existing `ambientEmitters` freezes smoke
at its fixed elapsed time and omits moving motes, canopy leaves and ripples.
The new coverage protects this behavior on the actual shipped top-down scene,
which has five chimneys and twenty-one canopies. The old merged #380/#368
oblique three-mouth evidence is useful setup history, not current acceptance.

The unit tests require ten real chimney loops, nonempty particle geometry for
each of the five sources, exact reduced descriptors/geometry a second apart,
and actual x/y motion when enabled. Native tests forward real draw calls without
alteration, await Explore's existing image readiness and settled camera, and use
a legal painted-tile walk to frame the nearby chimney at (8.025,8.075).
No position/camera mutation, fabricated draw view, virtual clock, animation
slowdown or favorable-frame-rate wait arranges the observation.

The native crop covers one visible chimney region and some surrounding board;
it does not establish that all five mouths are visibly framed or attribute every
live changed pixel exclusively to smoke. Actual smoke geometry supplies the
separate nonempty motion control. All five sources are checked in delivered
emitter data. OS reduced-motion coverage and whole-app idle-image identity
remain #524's distinct assignment; existing renderer, ambience, review and
`reduce-motion.spec.ts` files are untouched. No new browser coordinator or
protected #423/#443/#479 route ownership is created.

## Final delivery gates

Independent source/evidence review is required. Before publishing, run exact
clean final-head `npm run ci:local`, then all ten relevant native cases against
that CI production build: eight valid/fallback scene cases and two ambience
cases. Bind their results, source/producer identities and remaining gates in the
draft PR and publication receipts. Preserve all earlier failures and do not
weaken assertions, budgets, timeouts or expected behavior for green.

Keep the PR **draft**. Local production Chromium does not establish WebKit,
physical input, device FPS, PWA or final aesthetic acceptance. Report actual
hosted jobs and skips separately from aggregate checks. No Ready/formal
approval, merge, deployment, dispatch/rerun, installation, paid request,
generated/replacement art or security/access change is authorized here.
Unshipped source candidates do not claim a new deployed release version.
