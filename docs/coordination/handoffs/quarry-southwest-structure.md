# Southwest gate source checkpoint

18 September 2026. Local branch `codex/quarry-southwest-structure`, based on
western handoff `cf14705`. One new cluster implemented; eastern clusters remain
unchanged. PR #64 and its frozen release head were not modified. Hold integration
until the v0.2.0 release checkpoint; gameplay remains sole integration owner.

## Source and budget

The [remaining-cluster plan](../../art/quarry-remaining-clusters.md) records all
24 cells and budget before generation. Implemented cells are (4..9,11), (4,10),
(9,10), exactly eight existing blocked cells. Scene wiring retains all 32 wall
footprints, other 16 old-module entries, both ground chunks and four cover decals.
No gameplay, live-prop, renderer, schema or cache changes.

`public/art/maps/quarry-gate-scene/southwest-structure.webp`: 1024x1495,
201,644 bytes; SHA-256
`1abee2a0a7b47faf5b49338ce424aba96ea0609689e47cadf436d0401cddd40a`.
Eight depth-owned source rectangles have transparent gutters and their own
`quarry-southwest-structure` fadeGroup. The western page remains byte-identical.
Total gate artifacts: 621,316 bytes of 665,600; 44,284 bytes remain. Maps 3.45 MiB
of 4 MiB. Later eastern reuse is translation, preserving light and depth ordering;
no mirroring and no extra image bytes. That future wiring is not implemented here.

Built-in ImageGen generated one source:
`C:/Users/Jared/.codex/generated_images/01a0b2ee-8d60-7643-be9b-340997ca4ae0/exec-c850046e-4e3b-48d7-b418-c6f0c2d5f541.png`.
Prompt: paint the exact southwest technical guide, uninterrupted long front face
and rear-pointing end returns; accepted western limestone, timber/iron and
upper-left lighting as material reference only; preserve geometry and open
interior; transparent outside; no floor, ground shadow, props or added obstacles.
Inputs: generated `quarry-southwest/structure-guide.png` and accepted registered
western painting. This is a new southern orientation, not a mirrored northern U.

Reproduce with `scripts/art/quarry-southwest-guide.ts`, then
`scripts/art/quarry-southwest-pack.ts <source PNG>`. Packing uses world x256/y288,
512x416 bounds, two source pixels per world pixel. Source 1374x1145; alpha bounds
x38/y50,1301x1067. Removed 2,902 saturated fringe pixels; clipped 6,059 of 472,997
opaque normalized pixels. 20,468 guide-interior pixels have alpha below 64:
silhouette inset differences remain disclosed, not described as exact painted
coverage. Registered painting and atlas intermediates are ignored under
`art/raw/quarry-southwest/`. Production asset and metadata are tracked.

## Local review and validation

Source `npm run verify` passes: 627 tests in 70 files, typecheck/lint/format.
Art validation and family budgets pass. Runtime review used an isolated detached
preview of `5d5952fed1ded5f3eb485c68fee6b4994c98787a` with only quarryGate.ts,
quarrySouthwestFrames.ts and the new WebP overlaid. Its production build and asset
checks pass; precache 16.28 MiB. This is a preview composition, not a released SHA.

Two final desktop Chromium cases pass in 30.8 seconds, Canvas and WebGL, 1672x941,
96px camera, normal motion, service workers blocked/null. Served atlas hash
matches disk; page error arrays empty. Staged solo Kaya node entry, seed
`gate-registration`; legal routes from (1,3) through (3,5), (3,9), then
(4,9)/(5,9)/(5,10). No unit teleport, HP change or enemy disable. Actual enemy
turns reduce Kaya to 4 HP. An earlier long-route attempt ended in defeat before
the interior view; its original recordings are retained as failed evidence.
An initial harness attempt assumed the wrong spawn; a separate environment
attempt lacked the configured bundled ffmpeg path. Neither is a product failure.

Evidence root:
`C:/Users/Jared/.codex/worktrees/71bd/Avatar RPG/gallery/scene-audit/quarry-southwest-proof/`.
Final evidence: each backend's entry and route-0/1/2 PNGs, route WebM and metadata
JSON; WebGL 2fps contact sheet reviewed for group transition. Failed-long-route
WebMs are separate. Executed harness is
`gallery/scene-audit/scripts/quarry-southwest-proof.executed.ts.txt`.

Local structural result: continuous front face, matching western material/light,
no obvious separated cube gaps, gutter lines or colored halos in inspected views.
The group fades together and Kaya remains readable behind the foreground wall;
the open interior was reached legally. No opaque pier hides the actor in those
views. Final visual acceptance remains with orchestration: while faded, Kaya and
the nearby cover decal can appear to sit on the coping in a still. This spatial
ambiguity warrants inclusion in the combined scene review; no renderer expansion
or art regeneration was attempted to disguise it.

## Smallest depth remedy proposal

The ambiguity is caused by the existing layer contract: `cover-timber.webp` at
cover cell (5,8) is baked into `QUARRY_GATE_SCENE.ground`, while the southwest
wall fades as one `quarry-southwest-structure` scenery group. When the wall is
transparent, that opaque ground decal reads through the coping. The central
passage is not involved: rows x10..11 contain no `#` in all 12 rows (only open
ground, oil and the road stripe), and the scene still has exactly 32 walls.

Smallest reversible fix for review: keep cover cell (5,8), its rules/cover state
and exact projected rectangle unchanged, but draw only that existing
`cover-timber.webp` rectangle as a `SceneScenery` item with depth `{x:5.5,y:8.5}`
and `fadeGroup: 'quarry-southwest-structure'`; remove it from the six-item ground
list. This reuses `sceneryOpacities` in both Canvas and WebGL, adds no art bytes,
does not alter collision or picking, and lets the timber cue fade with the wall
when Kaya is behind it. Update the cover-count assertion in
`src/content/scenes/quarryGate.test.ts` and compare route-2 again. If the cue
becomes too weak, revert this content-only move; do not tune renderer probes or
generate another painting before orchestration reviews it.

The controlled preview comparison is now complete. Four cases (Canvas/WebGL at
fade `0.28` and `0.10`) passed in 44.7 seconds with the same legal route and
empty page-error arrays. Evidence is
`canvas-route-2-fade-028.png`, `canvas-route-2-fade-010.png`,
`webgl-route-2-fade-028.png` and `webgl-route-2-fade-010.png`, with matching
`depth-fade-*.json` metadata. The timber cue fades with the wall as intended,
but Kaya still reads high against the coping at `0.28`; at `0.10` the complete
wall becomes too faint and the spatial read is worse. Keep `0.28` as the
baseline. This experiment does not justify a global fade change or accept the
cluster visually. The remaining smallest fix is a reviewed geometry/depth cue
adjustment around the foreground wall, not a second opacity value guessed into
production.

## Next bounded visual boundary

The approved quarry reference is an active industrial workspace, while the
current cutting and Driller floor remain sparse orthographic arenas. After this
depth decision, the next bounded slice converts those two existing maps using
the established oblique scene contract: art owns one continuous Cutting
composition and one Driller-floor composition with exact ground/obstacle guides;
gameplay owns only scene registration and the existing backdrop/scene fallback.
Registered full-scene ground pages are now present but unreferenced; the source,
measurements and 12-slice-per-map upright-cliff guides are in
`docs/art/cutting-driller-ground-registration.md`. The map family is 3,846,608
bytes, leaving 347,696 bytes under the 4 MiB cap; 219,666 bytes remain inside the
original two-map reserve for the needed transparent cliffs and packing variance.
Keep map masks, encounter props, actors, oil/cover rules and paths unchanged.
No scene registration or production visual acceptance has started.

The cliff guides are now individually extractable transparent technical PNGs:
each has an exact source crop, ground anchor, footprint, sort depth and exposed
face geometry in `cliff-slices.json`; the full-map image is an assembly overview
only. Their height follows the active oblique renderer's 3.84 world-pixel lift
per elevation tier, rounded to four guide pixels. The 1683×935 ground sources
scale exactly to the 2304×1280 guide because both source-to-guide ratios reduce
to 187/256. Visual review found that tall internal slabs would conflict with
walkable `A`/`^` cells under that shallow lift, so these internal files remain an
elevation trace, not a tall-cliff source request. The active next target is the
three-piece Cutting and four-piece Driller exterior-rim plan in
`docs/art/exterior-quarry-rim-design.md`: it places weathered quarry mass
strictly outside the playable diamond, preserves the Cutting side approach and
Driller rear gap, and gives every piece depth `{-1,-1}` (sum -2), ahead of all
actor foot depths (minimum sum 1). No scene registration or final art generation
has started.

The first transparent exterior-rim candidates are now measured and assembled as
ignored review artifacts. `scripts/art/exterior-rim-pack.ts` records each
component's source baseline, affine scale, runtime crop and explicit cleanup;
the full previews use the registered packed ground pages rather than raw
generation sources and extend to world `y=-320` so no rear cliff top is cropped.
The corrected guide attaches exterior footprints to the map-facing `x=0`/`y=0`
boundary; its previous far-edge anchor created a one-tile black moat. The exact
diamond mask removes 4,171 Cutting and 2,632 Driller candidate feather pixels,
all recorded in the ignored registration JSON. Review those full assemblies and
the candidate-registration document before accepting a WebP or scene wiring.

The final source atlases are now present but unreferenced:
`cutting-scene/exterior-rim.webp` (122,288 bytes) and
`driller-floor-scene/exterior-rim.webp` (80,736 bytes). Their exact scene
metadata is isolated in `src/content/scenes/quarryExteriorRims.ts`; gameplay
must opt it into the two scenes and capture combined Canvas/WebGL views with
live props and actors before visual acceptance. The Driller rear gap remains
intentional. No southwest preview server was started or changed.

No missing-atlas, high contrast, portrait, WebKit, physical-device, full-route,
audio or gate-wide acceptance is claimed for this new cluster. The remaining
opening-through-Driller-and-return work needs one comprehensive scene/encounter/
NPC/motion/audio gap plan after release, not isolated hero-shot signoffs.
No new agents were used. Implementation was already active when the new model
routing policy arrived; future bounded implementation should use the assigned
Luna routing, with Astra reserved for orchestration/final visual review.

## Faded-scenery footprint prototype (local preview only)

The isolated preview also tested a renderer-only footprint cue for the foreground
southwest wall. Canvas and WebGL both passed the route-2 case at the baseline
0.28 opacity in 23.2 seconds. The original opacity-comparison paths
`canvas-route-2-fade-028.png` and `webgl-route-2-fade-028.png` were overwritten
by this later footprint run and cannot be restored from the workspace; they must
not be cited as immutable opacity evidence. Copies under the new, specific names
`canvas-footprint-route-2-fade-028.png` and
`webgl-footprint-route-2-fade-028.png` preserve the current footprint result.
The cue makes the ground/wall boundary legible, but its dark tile outline
currently reads too gridlike for shipping and is not an acceptance of the
cluster. No production renderer, scene source, collision, picking or art asset
was changed. The temporary preview used port 4203 from the detached `5d5952f`
worktree; the prototype should be discarded or redesigned after the cross-system
visual review.
