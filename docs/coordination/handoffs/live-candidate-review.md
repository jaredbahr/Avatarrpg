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

Final WebGL Kaya moving recapture passed on clean ce853fc (runtime ad13e4e).
Art inspected twelve consecutive 25 fps frames spanning actual Confirm: the map
remains present through preview collapse; the earlier blank-map frame is absent.
The staged legal approach and actual UI cast naturally dealt 7 damage, with no
browser errors and no service worker controller. Primary independently inspected
`confirm-every-frame.png`. Evidence: art worktree
`gallery/scene-audit/fire-attachments-ce853fc/README.md` and
`webgl-kaya/staged-cast.webm`. Art released the freeze. This bounded recording
cannot exclude sub-frame events and adds no audio or physical-device signoff;
the separate production pre-paint regressions cover both resize paths.

Separate courtyard PR #62 gallery run 35363386023 completed with only two
ambiguous Travel journal selector failures (199 passed, 139 skipped). Scoped the
selector to the exploration header, preserving both controls and gallery cases.
Both affected cases pass locally; full verify passes 689 tests/72 files. Pushed
correction eec68bd to PR #62; all checks must pass on that revision. Reconcile
this local combined candidate with merged current main after the source lands;
do not publish duplicate source changes in a competing integration PR.
All work remains local and unpushed; PR #62 is still the separate courtyard head.

## Common actions and camera framing — runtime b471939

Baseline ebcaa8e actual casts confirmed Water Whip leaving Nilak's feet and Air
Blast gathering/landing at ground level. Extend explicit attachments to Water
Whip and Air Blast using separate measured cast palms for Nilak/Sura/Nima/Jinu;
retain ground semantics for earth, melee, areas and surfaces. The first attached
water capture exposed a returning tether after the actor dropped to idle; hold
release until the whip returns, preserving impact timing. Source5782f29 and
ADR0026 record decisions, fallback rigs and immutable endpoints.

Camera source634abc reproduced a288px horizontal snap (1084→796) on selecting
Fire Jab after an ordinary default-zoom drag. Manual pan now retains framing
through aim, preview, Cancel and window resize, while Recentre and Focus work.
Five focused browser checks and14camera/renderer tests passed. Baseline failure
trace/screenshots: `gallery/scene-audit/manual-pan-regression`.

Integrated audio source4513a6 as b471939: Fire Jab ignition/body and Rock Throw
weight/grit, unchanged release/hit scheduling. ADR0027 and material-audio handoff
retain source metrics and pending listening acceptance. No listening claim.

Combined verify passes730tests/79files, typecheck/lint/format. Production build,
294.8KiB/300KiB JS and15.89MiB/25MiB precache budgets pass. Twenty production
browser cases pass:12real-Confirm staged actions,2manual-pan regressions and
6normal/reduced/missing-sheet resize cases. A separate final12cast recording
pass uses blocked service workers; all have null controllers and zero errors.
Natural damage on both renderers: Nilak6, Sura8, Bo8, Nima4, Jinu5, Riko9.
Evidence: `gallery/scene-audit/common-actions-b471939-network/README.md`, each
case's original video, metadata, preview and frame/contact samples. These are
staged presentation fixtures, not a continuous normal campaign. Primary viewed
bounded air/water contacts and water-return correction; independent art review
pending. Runtime freeze released for work after recordings finished.

Open visible issues from the baseline audit: Rock Throw still reads as a low
projectile with foot-level debris/contact; Riko's Strike gives ground dust rather
than a clear weapon/body contact. Water lacks its upstream pouch/source action.
These need distinct material decisions, not lifting every ground effect. Walking
source retains projected headings through stops and hysteresis through turns;
new continuous turn/stop qualitative evidence still needs capture. No all-action,
audio, physical-device or overall reference-quality acceptance.

Astra owns the next gate ground/wall/cart asset pass with exact map masks,
32anchors and unchanged collision. Cart scale/contact and legacy guard remain
visible review points; cutting/floor waits for gate qualitative review. Release
path is unchanged: PR62 eec68bd latest-head CI, then one reconciled combined
landing. No duplicate source PR or combined push; live remains148843f.

## Separate material/contact checkpoint ae8ba56

Rock Throw now lifts its existing boulder from ground to measured Bo/Lin Mei
release palms before the unchanged flight, ending at torso. Shards attach to the
body; ground eruption, dust and cracks stay grounded. Strike moves contact
sparks/ring to the recipient body and keeps dust on the ground. Sura alone has a
visible waterskin: a small cue draws from its cast-frame upper attachment to her
palm. Primary finds that cue too subtle for source-quality acceptance; Nilak has
no visible waterskin and gets no invented gear. Water's rigid crescent material
remains an explicit gap.

Air Blast's resolved named recipe has30ms hit-stop, correcting the first audit's
20ms family assumption. At4tiles launch306.8ms/contact506.8ms; original push
908.8–1128.8 followed caster recovery. New actual-push slide536.8–756.8 begins
after contact hold, retaining220ms forced duration/reducer destination. Suppress
ordinary recoil only on actually pushed victims to prevent recoil-back overriding
the slide. Blocked/no-push hits retain recoil; cursor still covers caster recovery.

Full verify passed737tests/79files; build and295.3KiB/300KiB JS budget pass.
Twelve staged production real-Confirm captures passed for Sura/Bo/Lin Mei/Nima/
Riko/Wen on both renderers, blockedSW/no page errors. Evidence is under
`gallery/scene-audit/material-contact-ae8ba56/README.md` with originals and sampled
frames. Primary inspected bounded contacts and shove; independent art review
pending. No continuous campaign/listening/device/performance claim. Earlier
b471939 independent Astra review passed only water/air hand contact/return,
explicitly leaving source/material quality and delayed push open.

Next structural milestone is separate: art material3f2ffc4 integrated asf9d71fb,
preserving both courtyard and forest NOTICE credits while resolving the source
conflict; plan c095bf17 integrated asea86822. SourceRect atlas implementation is
in progress for eight western cells within the existing32depth-owned slices.
No atlas art is accepted yet; no cutting/floor expansion. Source PR62 remains
eec68bd with current-head browser/gallery CI in progress; no restart or merge.

## Usage-conservation checkpoint: atlas contract9033b4e

Optional `SceneImage.sourceRect:{x,y,width,height}` is implemented in source-image
integer pixels; destination world rectangles, footprints/depth and32independent
instances remain. Whole-image compatibility retained. Loaded cropped pages must
be≤2048and regions in-bounds. Canvas uses cropped drawImage; Pixi shares page
sources across bounded rectangular views with child-before-source disposal.
Cutaway crops before downsampling and uses at most32LRU masks per image.
Thirty-nine focused tests pass, including32slices/onepage/threeframes requiring
33texture allocations, replacement/disposal and independent shared-page alpha.
Typecheck, focused lint/format pass. See ADR0028. Actual GPU seams/gutters,
western traversal and structural visual quality have NOT been verified.

Art's active western packing exposed a necessary follow-up: some rear cells
are fully hidden behind the tall9,1pier in the continuouspainting. Fading only
one visible slice leaves holes; connected-structure fadeGroup is proposed but
UNIMPLEMENTED. Do not fake missing backfaces or claim the eight-cell western
proof accepted. Art preserves guide/packing state separately; current runtime
still has the weathered repeated-wall source, not new western atlas content.

Root's latest usage instruction stops new agents/workstreams/polish passes.
Finish this local contract validation checkpoint once, retain pending gaps and
idle. No further continuous polling or captures. Final fullverify/build/budget
results to be appended by integration owner. No push or deployment claimed;
PR62 latest checked remotehead eec68bd remained draft with verifygreen and
browser/gallery in progress. Required latest-head CI/merge rules still apply.

Final combined checkpoint validation on9033b4e passes fullverify:746tests in
81files, typecheck/lint/format. Production build passes; JS295.8KiB/300KiB,
precache15.90MiB/25MiB, maps3.07MiB, props0.25MiB, portraits3.96MiB and
units3.98MiB pass existing budgets. Build output now reflects9033b4e, replacing
the earlier combat-only preview; saved ae8ba56 recordings remain authoritative
for that separate checkpoint. No further capture/test cycle or push performed.
Remaining atlasGPU/groupfade/structuralquality and perceptual audio gaps stay
open. Resume from this handoff after checking actual heads, worktree and CI.

## Autonomous integration resumed after courtyard deployment

The orchestrator superseded the idle checkpoint with plan-then-execute delivery.
PR #62 merged as44ed3f60141b97dfcc2899c854846d7f02b4930c after all three required
checks passed on eec68bd. Pages run35394389048 succeeded for that merge. This is
a courtyard progress release; reference-target acceptance remains open.

Combined branch codex/quarry-gate-integration reconciled main in ee50ab7,
retaining both handoff histories. Source art fbdb86c and19754f6 now contributes
the western atlas and exactly eight registered entries;24old wall entries,
footprints, depth, collision, credits and gallery cases remain. Shared fadeGroup
opacity is implemented on both backends with per-frame group minima. Focused
registration, schema and cutaway tests pass28cases. Production traversal and
art review are pending; the next publication is ONE draft integration PR.
No new region, combat-rule or save-format changes are included.

## PR #64 CI correction and western review

Western structural proof is accepted on runtime head 5d5952f within the limits
in quarry-west-proof.md; source documentation cf14705 is now incorporated.
The four continuous route/save checks and twelve focused production UI checks
passed on that same runtime. Overall reference quality remains open, but these
remaining aesthetic/audio gaps do not block a tested progress release.

CI run 35395176837 exposed a stale legacy painting fixture: backdrop.spec put
an orthographic probe on Forest Road after it became an oblique layered scene.
The renderer correctly ignores incompatible backdrop projection and draws the
registered scene. The probe test and gallery case 18 now explicitly remove the
layered scene and restore orthographic projection before mounting their fixture.
No product rendering change, threshold relaxation or assertion removal is needed.
Five focused production backdrop/renderer tests pass; one software-GPU-only test
skips because installed Chrome reports accelerated rendering. CI retains that
software fallback check and full Chromium/WebKit coverage.

This necessary test revision also batches the completed art handoff. Re-run full
verify before its single push. Require all three new-head CI checks; do not reuse
5d5952f checks for merging. With no outstanding regression or review, mark ready,
merge with an expected-head merge commit and confirm Pages. Keep broader gate,
water material, listening and physical-device quality work explicitly open.

## Product mandate and v0.2.0 release repair

Jared reaffirmed autonomous delivery toward the approved reference images and
DOS2-like open-map roaming, environmental and elemental combat, coherent
animation, and a distinctive engaging story. Village–quarry–return remains the
proving ground before expanding the world. Acceptance requires actual movement,
contact and audible play; readable environmental combinations; and consistent
character identity. Passing automated tests alone cannot close that goal.

Immediate milestone is a testable v0.2.0 progress release, retaining the commit
build label. Live baseline remains v0.1.0 / 44ed3f6 until deployment is confirmed.
Package and lock versions and CHANGELOG are updated in this necessary CI repair
batch. No engine migration is authorized by that change. A later architecture
recommendation must compare measured current-stack limits with a bounded Godot
scene proof; it does not imply a rewrite or an RPG Maker migration.

PR64 run35397662012 failed in two fixture families. CI traces show the pan test's
whole60s budget expires after successful layout waits and a20s ten-step drag on
software GL. It now uses the existing slow-WebGL test allowance with unchanged
assertions and layout waits. Original local SwiftShader case passed in10.1s.
All four gallery families (bandit portrait, slinger, bruiser, quarry bender)
reproduced locally: right-click targets were outside the newly pannable board.
They now focus the exact staged actor through its real turn-strip control,
assert canvas hit visibility, and retain portrait waits and all gallery cases.
The39-series filmstrips also frame their actors before playback. All14 affected
project cases are being checked together with forced software WebGL before push.

Final scope clarification: the finished product covers the opening, village,
road and quarry through the Driller encounter inclusive, its outcome and return.
No wider campaign is required. Every traversed scene, dialogue, control, battle,
animation, sound and save transition must form one coherent finished run; a
polished courtyard surrounded by placeholders does not meet acceptance. v0.2.0
is still a progress release. After shipping it, prioritize one whole-run critical
path against this scope rather than expanding into disconnected polish batches.

## PR64 replacement-head repair

Run35412143302 passed verification and gallery but stopped E2E after 75 tests
because `painted-rubble.spec.ts` timed out while taking full-page diagnostic
screenshots on software WebGL. Its registered, overlay, dynamic, high-contrast
and missing-art color probes had completed; the timeout was capture cost, not a
failed assertion. The two diagnostics now capture `.map-canvas`, the surface
under test, preserving all probes and thresholds while avoiding unrelated HUD
and curtain pixels. Local Canvas and forced software-WebGL cases pass.

The same replacement batch carries truthful elemental-tip corrections from
`f5e4b67`, cost-aware routing policy `e2864f9`, engine assessment `975170b`,
and lead-transfer handoff `434856b`. Southwest source `a39d5e4` remains held
for a separately reviewed next scene batch. Full verify, production build and
budgets must pass on the new head before merge.

## PR64 target-visibility software-WebGL repair

Run35419645940 reached 112 passing E2E cases, then stopped at the first allowed
failure in `target-visibility.spec.ts` (`Fire Jab target stays tappable with
separate decisions on webgl at desktop lower edge`). The failed operation was
the eight-step Playwright `mouse.move`, which consumed the 60-second test
budget while the page remained in the legal Fire Jab aim state; the assertion
suite itself had not failed. The trace and error context are preserved in the
`playwright-report` artifact (job `105835253927`, artifact `10577653136`).

Commit `c08ebb9` keeps the target visibility, preview-only snapshot, cancel,
reselect, Confirm and AP assertions intact. It routes the desktop drag through
three direct PointerEvents on the same canvas adapter used by gesture coverage,
avoiding eight serialized browser round trips that software WebGL could not
finish inside the test timeout. The helper uses page viewport coordinates
directly; the test asserts that camera offsets changed and that the staged
target is within 140px of the lower canvas edge before the real touchscreen
tap. Local Chrome-channel Canvas/WebGL desktop and huge-phone cases pass 4/4;
`npm run verify` passes 81 files / 748 tests and `npm run build` passes with the
0.2.0 bundle and 16,439.98 KiB precache. The repair is pushed as the sole new
commit over PR64 head `dac9982`; wait for fresh exact-head CI before merge.
