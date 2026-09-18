# Live and local quarry review — 18 September 2026

## Builds and limits

LIVE title independently displayed148843f at https://jaredbahr.github.io/Avatarrpg/.
PR62 courtyard-only headce3b425 is draft; replacementCI35363386023 pending.
Local integration52f60f5 contains forest/gate and portrait corrections; gate art
remains rejected. These changes are not claimed deployed. Primary browser audit
used1280x720, normal UI, soloKaya, default renderer (backend not independently
identified). No physical-device or audio-listening acceptance.

## Bounded defect matrix

| Concern             | LIVE observation                                                                                                                                                                                                                         | Local candidate evidence                                                                                                                                                                               | Required next evidence                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Apparent obstacles  | Actual village west shop wall tap rejects with 'You cannot walk there'; interior accessible; reachable feet overlap painted south wall. Shallow pond accepts walking. These samples do not prove broad collision correctness or failure. | Courtyard uses registered oblique geometry; gate4e7788b has independently confirmed widespread cover/elevation/road art drift despite working controls.                                                | Exact gate mask repair and paired actual traversal; keep visual overlap separate from rule blockage. |
| Combat readability  | Natural forest entry reduces Kaya from approximately45px to30px in the same viewport. Actual Move/tap/Confirm spends4movement successfully.                                                                                              | Forest96px framing and party scale already validated in bounded local evidence; no live deployment claim.                                                                                              | Same-route final moving review.                                                                      |
| Gait and stopping   | User reports rough motion; this primary live sample is not a timing recording.                                                                                                                                                           | Paired4e7788b telemetry: two-cell combat move220ms; WebGL travels0.902tile in40ms near midpoint with unchanged camera, then immediately selects ready stance. Primary inspected webgl/walk-frames.png. | Compare approved distance-based timing on same2cell and longer turning move before adding frames.    |
| Speaker portraits   | Narrow/short CSS hides portraits (writer source audit).                                                                                                                                                                                  | Sources7e0784/9d743bf preserved82a5204/52f60f5: visible compact canonical portraits and resolvedspeaker title; combinedverify694/75 and11browserchecks pass.                                           | Actual route dialogue review after integration; staged tests remain labelled.                        |
| Attack/impact/audio | Not accepted.                                                                                                                                                                                                                            | Continuous recordings reach movement/AI turns, but later cast selection failed. Harness targeting/camera settling is uncertain, not established cause. Separate audio exists without listening review. | Verify actual target availability/camera and capture cast/impact/recovery uninterrupted.             |

## Immutable continuous evidence

Art evidence root:
`C:/Users/Jared/.codex/worktrees/71bd/Avatar RPG/gallery/scene-audit/moving-4e7788b/`.
Paired `canvas/` and `webgl/`: `normal-route.webm`, `audio.webm`, `route-log.json`,
`mira-dialogue.png`. Actual Newgame/Kaya/MiraTalk/villageexit/forest crossings/
combat two Move-click-Confirm actions/Endturn/AI turn. No enterNode or gameplay
state staging; normal motion, sampled serviceworker controller null. Audio and
video are separate tracks; timestamps do not establish precise synchronization.
Recordings and logs stay unchanged after source repairs.

Primary independently reached forest combat from a fresh LIVE campaign through
normal controls and completed a legal move. Browser tab retained. Local normal
campaign at52f60f5 reached village; source HMR interrupted further review and
normal autosave survived. Resume through Continue on a stable production build;
do not call that interrupted session uninterrupted evidence.

## CI correction and ownership

PR62 E2E8c301c9 exhausted60seconds after expensive frozen-scene screenshots,
with88passed/197notrun. Artifact10555401626 retained. ce3b425 separates actual
Talk from occlusion comparisons and renders each frozen ring state once, with
explicit presentation acknowledgement. Same15pixel/tolerance3 assertions,
no timeout increase. Four softwareChrome tests pass32.7seconds, verify689/72.
Oldrun35359990220 confirmed cancelled under orchestrator policy; newhead needs
allchecks. Do not push local forest/gate over courtyard branch while thisruns.

Art owns deterministic gate masks and clipped cover. Gameplay owns combined
integration and movement timing. Writer owns canonical portrait/title sources;
Dema/Sen distinct portraits remain open. No expansion beyond quarry slice.

## Approved pacing candidate

Ordinary combat walking now uses the existing distance-based stroll timing at
280 ms per tile, including120 ms bounded acceleration/braking: two cells take
680 ms instead of220 ms. Footstep cues use inverse travelled distance. Sprite
phase continues across cells; combat ready stance at rest is retained. Forced
slides/pushes and the reduced-motion action-lock duration remain unchanged.
Focused64tests plus typecheck/lint pass; actual moving comparison and cast
capture still pending. No new artwork or global step-duration change.

Combined pacing/portrait candidate passes `npm run verify` (697 tests/75 files)
and production build. Primary resumed the normally created soloKaya autosave,
used Lookaround/VisitGao, reached the dialogue by walking, directly viewed the
canonical portrait/title at1280x720 and390x844, and clickedNext once to advance
1of4 to2of4. Phone portrait andNext remained visible. This session includes an
HMR reload/Continue and is not the uninterrupted recording. Viewport reset.

## Motion capture178bbc5 and current integration

Freeze released. Immutable `moving-178bbc5/{canvas,webgl}/` under the same art
evidence root includes normal-route video, separate audio, event logs and cast
frames. Both normal UI routes reached Fire Jab; Canvas hit8damage, WebGL missed.
Do not call both a hit. Four two-cell moves include a turn, not a longer4+cell
walk. The final postcast Endturn only opened the unused-AP warning; a prior
actual Endturn/AI turn is present. Art's final capture label is misleading and
must not substitute for event evidence.

The target13,5 at1124,718 was inside the canvas but under `.confirm-bar.aim-hint`.
Actual user pan exposed it at844,498 and allowed selection. This is a real HUD
obstruction plus a harness failure to account for it, not a game-rule failure.
Approved remedy moves hint and pending-confirm panels into allocated actiondock
space outside the map; keeps real Cancel/Moveinstead/Confirm controls and bounded
scrolling. Camera ResizeObserver measures the remaining canvas. Focused target,
zoom and huge-text regressions are required before acceptance.

Gate source de623a7 is preserved as7a29093. Credit conflicts were resolved by
retaining courtyard/forest credits and updating gate provenance, then regenerating
NOTICE. All32 wall registrations and rule rows remain. Exactmask/control/visual
review is pending on the combined candidate.

Art reports directed Fire Jab originates at feet and ends at enemyfeet; healthbars
cross the upper silhouette. These are explicit subsequent presentation defects:
audit hand/torso attachment and actual scaled silhouette, preserving ground-area
effects/rules. No newframes and no concurrent edits during the next frozen review.

## Dock and mask validation

Combined runtime passes698unit tests/75files and productionbuild; maps3.08MiB,
precache15.88MiB, budgets pass. Bounded browser suite covers18cases across both
renderers: target13,5 hit-test/preview/Cancel/Confirm/AP, customzoom retained through
HUD reflow,390x844hugetext reachable44pxcontrols/positivecanvas, initiativefocus,
gestures, independentpaintedpicking and gate32walls/12oil/5props registration.

An initial parallel browser run collided in its temporary output/server and was
discarded; serial rerun isolated those infrastructure errors. One independent
viewport check then caught default300px backingstore before asynchronous automatic
WebGL startup. The test now waits for a real camera before layoutsettling; unchanged
independent geometry assertions pass. No runtime delay or loosened tolerance.

Primary viewed updated staged gateCanvas entry: misplaced embedded timber is gone,
but sharp material masks, clean modularwalls, tinycart and healthbar overlap remain
visible limitations. Registration/control tests do not grant final visualacceptance.
Freeze the combined committed runtime for art's exactmask/highcontrast/control and
realcast review; no newtarget/FX edits until that review releases it.
