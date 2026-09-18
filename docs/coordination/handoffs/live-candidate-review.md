# Live and local quarry review — 18 September 2026

## Builds and limits

LIVE title independently displayed 148843f at https://jaredbahr.github.io/Avatarrpg/.
PR #62 courtyard-only head ce3b425 remains draft. CI 35363386023 now passes
typecheck/lint/unit and Chromium touch/WebKit E2E; gallery remains running.
The local integration includes forest/gate, portraits, movement pacing and dock
corrections. Gate registration has bounded acceptance below; overall art and
experience remain unfinished. These changes are not claimed deployed. Primary
live browser audit used 1280x720, normal UI, solo Kaya, default renderer (backend
not independently identified). No physical-device or audio-listening acceptance.

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

## Bounded acceptance at38815cf

Art released the freeze and accepted gate registration on both renderers: all six
served asset hashes match disk, service worker controller null,96px,6groundpieces,
32walls,12liveoilcells,5props. Actual UI Move reaches3,2; staged legal routes3,1
through5,1 show sampled fade/depth; highcontrast matches timber/road/stone/oil.
Evidence: `gallery/scene-audit/quarry-gate-mask-integrated/` in art worktree.
Style remains unfinished: sharp fields, pristine repeated walls, tiny cart and
legacy guard. No chain reaction, destruction, physical device or full gate route
acceptance.

Normal `moving-38815cf/webgl/` reaches target13,5 at1124,718 on exposedcanvas,
FireJab hits9damage, then confirmed Endturn and AI turn; no old pan workaround.
Canvas has a different random roster: Bruiser14,5 is projected1220,766 below the
724px canvas edge. That capture stops before casting; this is an offviewport
framing case, not recurrence of the in-canvas overlay obstruction. Bounded next
check uses the actual initiative focus button and preserves ability selection.
Do not claim paired fullcast success from this normal-route set. The separate
staged target regression covers13,5 on both backends. Both runs have zero page
errors. Runtime unchanged pending that bounded focus continuation.

## Focus continuation and attachment candidate

The Canvas Bruiser continuation passed on runtime 0112e9a (docs head 75bd738).
This is explicitly staged seed `focus-bruiser-5` plus legal move/turn replay,
because the prior normal-route browser context had closed without an exported
save. Actual UI Fire Jab → Focus Bruiser retained the ability, moved target 14,5
from off-canvas 1220,766 to exposed canvas 836,439, and allowed preview/Confirm.
The hit dealt 7 damage (HP 29→22), AP 5→4, with no forced outcome or page error.
The service worker controller was null. Evidence: art worktree
`gallery/scene-audit/focus-bruiser-38815cf/`, including metadata, screenshots and
`staged-focus-cast.webm`. This closes that bounded focus check, not a normal-route
Canvas cast claim. Centering the enemy can leave the caster outside the view.

Art released the runtime freeze. The approved next correction is Fire Jab's
hand/torso attachments and silhouette health bars. Healthbar source 7ef316a is
local; [ADR 0026](../../adr/0026-actor-effect-attachments.md) records the shared
presentation contract. Ground-area effects, rules and flight timing are retained.
No new art frames. Combined validation and a new frozen paired moving review are
required before acceptance or any combined landing decision.

## Fire Jab placement and resize correction

Art accepted the bounded hand gather/launch, Bruiser torso contact, stable
recovery and healthbar clearance on c6b46f2. Four staged legal approaches with
actual aim/Focus/pan/target/Confirm produced natural first-cast hits: Kaya 7 and
Tenzo 6 on Canvas and WebGL. No browser errors, service worker null. Evidence:
art worktree `gallery/scene-audit/fire-attachments-c6b46f2/README.md`, original
`staged-cast.webm` and metadata in each case. Primary independently inspected
Canvas Kaya and WebGL Tenzo contact sheets. This is neither overall visual
acceptance nor audio/device/mirrored/boss visual signoff.

Primary also resumed the normal solo Kaya campaign through Continue on c6b46f2,
completed Gao/Mira dialogue, walked village→forest, triggered the pine interlude
and roadblock, made two 4-point moves with a confirmed End turn/AI turn between,
then used Fire Jab→Focus Bruiser→target→Confirm. The natural hit reduced Bruiser
HP 29→22 and Kaya AP 5→4. This was actual UI with no state staging; renderer was
not independently identified. It is a continuation after loading, not an
uninterrupted recording. Bar clearance at rest was directly visible. Later HMR
returned the tab to the title with the combat autosave intact.

Art's WebGL Kaya recording showed one blank-map frame as Confirm collapsed the
preview. Production c6b46f2 reproduced the defect: canvas height 499→619, no draw
after resize, zero opaque pixels in a pre-paint microtask. Baseline failure is
preserved locally under `test-results/resize-baseline/`. Observer-only correction
b33dd62 fixed Confirm, but a real window resize still reproduced 619→699 with
the same empty-buffer evidence (`test-results/resize-window-baseline/`). Final
runtime ad13e4e applies synchronous resize→scene refit→cached view redraw to both
observer and explicit combat/exploration resize paths. No new animation loop.

Combined `npm run verify` passes 719 tests in 79 files plus typecheck/lint/format.
Production build passes; total compressed JavaScript is 294.4 KiB of 300 KiB,
precache 15.89 MiB of 25 MiB. Ten production browser checks pass in 21.2 seconds:
Canvas/WebGL × normal/reduced/missing character sheets actual Confirm, real
window resize on normal cases, and four viewport/painted-picking regressions.
The permanent regression checks a redraw and nonempty canvas before presentation,
not just a settled screenshot; AP spending also remains correct. Missing-sheet
tests intercept the Kaya atlas request and exercise the painter fallback.

Final WebGL moving recapture of the original Confirm flash remains pending.
All work remains local and unpushed; PR #62 is still the separate courtyard head.
