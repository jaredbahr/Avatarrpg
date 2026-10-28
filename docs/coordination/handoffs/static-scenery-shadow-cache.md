# Static scenery shadow cache

## Scope and ownership

This change caches only the Canvas static scenery shadow union. Structure, prop
and live actor shadows retain their per-frame paths and exact maximum-overlap
composition. No reveal rendering, unit capture, shared draw ordering, public
interface, gameplay rule, art or test timeout changes are included.

The parent approved this boundary alongside Claude's PR #304. Its inspected diff
adds reveal rendering and unit capture outside these shadow methods. Keep that
work intact when integrating either branch; do not replace the shared draw pass.

## Cache validity

One mask is retained per backend. Its stamp includes the full scene data, camera
projection/grid/viewport/DPR, scale and offsets, mask geometry, image dimensions
and URLs. Actual image identities are compared separately. Camera movement,
resize, changed scenery or grounding, grid-filtered casters, late loads, eviction
and source replacement invalidate it. The scratch-context fallback invalidates
and bypasses the cache so a coloured fallback mask cannot survive recovery.
Destroy releases the retained canvas.

## Review and verification

Independent source review found a scratch-context recovery fault in the first
version; it was corrected and a regression added. Re-review found no remaining
source correctness findings and confirmed the PR #304 boundary remains disjoint.

Focused tests exercise maximum-overlap pixel equivalence with structure/live
shadows, actor movement without static invalidation, camera/mask geometry,
viewport/DPR, in-place scene changes, image arrival/eviction/replacement and
context failure/recovery. Their identity-only canvas model supplements rather
than replaces the native browser comparison.

Final exact-head validation, native before/after pixels and measured performance
are recorded in the pull request description. Preserve any failed attempts and
state environment differences; do not infer Linux CI root cause from a local
Windows WebKit pass. The original run 40625030055 failed at
8567471282553160d86f988aae15b8cf1af689cc. Its evidence was preserved before expiry.
No timeout increase, assertion removal, paid service, deployment or merge is part
of this task.
