# Playable oblique Ba Dan — active integration handoff

- Owner: gameplay/integration task `01a0b300-e321-7670-aab3-f0aeaf624dc0`.
- Worktree: `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-oblique-world`; branch `codex/oblique-playable-world`.
- Delivery: [draft PR62](https://github.com/jaredbahr/Avatarrpg/pull/62). Latest pushed head remains `4ee508a`; local runtime is `1e16f38`. Check live Git before continuing.
- Current scope: make one cohesive, playable Ba Dan match the approved player-view references, then extend the accepted system through the quarry slice. No world expansion. No visual acceptance yet.
- Previous assignment is complete: #48, #55 and #52 are confirmed merged. Main base is #52 merge `c486457d60017c31eed482363b65c40b6956fead`; the old integration monitor was paused.

## Coordination and delivery

Orchestrator: `01a0b2b4-1260-7551-a818-e7a85c0645f6`; art: `01a0b2ee-8d60-7643-be9b-340997ca4ae0`; writing: `01a0b2e3-170e-7bb1-b2ab-d9e45dd780a9`.

Jared requests batching local iterations to reduce GitHub Actions cost. Preserve local commits and this handoff; do not push checkpoints. Orchestrator owns workflow changes. Before a cohesive push, run `npm run verify` and production bundle/asset checks. Required latest-head CI and actual visual review still gate readiness/merge. Keep PR62 draft.

PR62 is the single landing path, preserving source-owner commits. Art PR61 remains a draft reference and closes as incorporated only after PR62 actually merges. The named stash `Preserve copied Ba Dan prototype before authoritative art checkpoint` contains an earlier copied prototype; do not pop it over authoritative art.

## Implemented and preserved

Shared forward/inverse oblique camera, ground transforms on both backends, upright depth ordering, scene ground/scenery contract, alpha-aware roof cutaway, missing-art fallback, projected locomotion, compact exploration dock, actual local map and legal party formations. Logical rules/saves remain unchanged except six authored low boundary cells and Gao's canonical NPC placement. Only Ba Dan uses the oblique scene. See ADR0023.

Source art `f009565` is preserved as `c2196f4`. Source audio `a3d2337` is preserved as `959f8bb`, wired by `6923087`; ADR0024. Explore supplies animated foot/water proximity and clears environmental sources on hide/unmount. Nima optional rest source `a902d6f` is preserved as `ba3f025`; ADR0025. Explore selects rest poses, combat retains idle. This is one hero pilot, not full-roster approval.

Temporal movement source `08134b9` is preserved as `28d4409`, integrated by `e485e12`. Exact eased trajectories reserve spacing, including waiting/final seats; per-route delays scale once with reduced motion. Nearby legal seats avoid needless reshuffling. `e2e/party-spacing.spec.ts` samples actual rendered positions through five legs and checks minimum0.78tile, unique dry seats and leader destinations. Tight-corridor fallback remains a review limitation.

Bundle change `95ca5a8` is preserved as `0dd0ee4`: omit only unused Pixi accessibility/events/DOM registrations; native DOM accessibility/input and all used rendering systems remain. ADR0001 documents restoration requirements for future Pixi use.

Composition source `6e7b52f` is preserved as `65a35b8`: quieter ground, two planters and merchant display. `30871ae` applies shared footprints at(6,5)/(7,5), (14,9)/(15,9), and(7,4)/(8,4) as blocked but not sight-blocking. All NPCs, exit and shop approach remain reachable. Generated map layout/prompt were updated. Directory credits already cover the new assets.

`67bd20e` fixes the WebGL-only dark triangle: procedural board-edge gradients crossed the painting's bleed outside the logical diamond. Suppress those gradients only for a complete painted scene; keep fallback shading. Paired captures confirm it gone. Normal route line/arrow are smaller using shared tokens; crisp/high-contrast markers are unchanged.

## Evidence and current review

Full verification passed688tests/72files on `30871ae`. Production JavaScript is291.8KB against300KB; total precache15.11MB/25MB; maps2.43MB, units3.86MB, portraits3.96MB. Seven production renderer/ground/independent-picking tests pass; software-only automatic fallback test skips on local accelerated hardware.

Seven combined spacing/capture/picking browser tests pass. Actual five-leg spacing test takes11.2s including setup, versus50.9s before temporal reservations. Both continuous trade/escort quarry routes through save/reload and walking home, plus audio unlock/Off/cast checks, pass (4tests48.9s). These are legal automated command routes, not manual physical-device playthroughs.

Art reviewed `e485e12` recordings: Canvas10.62s, WebGL10.68s for five legs with two sampled walk stills per leg and rest stills. Earlier48.12s recording used four walk samples per leg, so the media timings are not a precise controlled benchmark. Nima rest is promising; no broad roster acceptance.

Art evidence root: `C:/Users/Jared/.codex/worktrees/71bd/Avatar RPG/gallery/scene-audit/`. Relevant folders: `e485e12-canvas`, `e485e12-webgl`, and `composition-30871ae`. The latter contains paired rest/portrait stills, with triangle absent in `webgl-rest-1.png`. Primary stills are ignored `.shots/ba-dan-{canvas,webgl}-{entry,courtyard,north}.png`.

The65s audio lifecycle harness completed a99.36s recording on frozen `30871ae` with unchanged head and no reported errors; art released the runtime. Await its grouped listening/lifecycle report. Signal peak/RMS or automated scheduling alone is not audible acceptance. Physical Surface/iPad testing is outstanding.

## Immediate next work

1. Art is lowering the oversized produce display and planter while preserving their2x1 footprints. It will reorder equal-depth props after houses so the display is not buried under the facade. Await the local source commit; preserve its authorship.
2. Whole merchant-house fading was isolated with actual per-actor renderer probes: all five party actors returned opacity1; only nearby Gao at(7,3) triggered0.28. Orchestrator approved moving Gao to visible shopfront(9,4). Local `1e16f38` does this canonically; actual party cutaway remains intact. A new save regression passes from old interior(7,3), newly blocked(7,4), and courtyard(10,7): preserve saved leader location, walk a legal route and open Gao's dialogue adjacent to the shopfront.
3. After shorter prop integration, run one paired resting/approach capture, including Gao visibility/Talk and depth ties; no repeated full recordings unless a new issue requires them. Recheck party spacing around the changed obstacles, complete verify, then update grouped evidence for the orchestrator.
4. Keep runtime4190 stable during coordinated art captures. Port4189 is ephemeral Playwright; port4198 is production preview. Temporary configs/captures are ignored. Do not change runtime during an agreed freeze.
5. No push until the local visual corrections are grouped. Latest pushed CI failures were302KB bundle and stale directional browser expectations; both have local fixes. Healthy galleries were not restarted. Require fresh CI when a final candidate is pushed.

## Latest local candidate — fcfecf4

Art height correction `70da74b` is preserved as `fcfecf4`; shorter table and one-course planter keep the same footprints, and props follow houses for equal-depth ties. Gao relocation `1e16f38` is integrated. Primary paired north captures now show an opaque merchant house, visible Gao and smaller fixtures. Actual walkTo Gao opens dialogue on both backends; five-person spacing still passes (11.2s including setup). Evidence: `.shots/ba-dan-{canvas,webgl}-north.png` and `-gao-talk.png`.

Full verify passes689tests/72files. Production JS291.8KB/300; precache15.09MB/25; maps2.41MB. Worktree is clean. Art has the runtime frozen at `fcfecf4` for the requested(10,4) frontage still and a short Talk/encounter audio follow-up. Await that report and orchestrator composition review before any batched push. No broad visual/device/audible acceptance claim.

## Reviewed local checkpoint — f142f72

Source Kaya/Sura rest batch `30111b3` is preserved as `30b8402`; approved flat fringe `e0b79ec` as `f142f72`. `4d9028b` puts ground rings below upright actors on both backends, leaving health/status overlays intact, and breaks equal legal Talk distances by Euclidean ground proximity. `shopfront.spec.ts` verifies actual dock selection and Gao dialogue plus ring occlusion pixels. The old WebGL implementation reproduced a60–140channel difference on Mira; fixed backends pass with3/255 tolerance for source alpha/raster rounding. Finite coordinates are asserted to prevent a vacuous pixel comparison.

Full verify689/72 passes; seven combined direction/rest/spacing/shopfront browser tests pass41s. JS292.1KB/300; precache15.17MB/25; units3.92MB/4. Art released and reviewed the short paired capture in `gallery/scene-audit/composition-f142f72` on its worktree. Primary also viewed WebGL rest1 and Canvas portrait. Kaya/Sura rest height/feet/identity hold, Gao is selected at(10,4), ring is occluded by Mira and fringe leaves doors clear. This is bounded acceptance, not the full reference target.

Durable technical audio evidence lives under `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-courtyard-audio/gallery/`: lifecycle folder `courtyard-audio/30871ae6-canvas-1789737769806` and targeted folder `targeted-cues/644766ef-canvas-1789738279218`. Read their README/report/summary files for exact staging. Hidden-tab lifecycle uses descriptor simulation, not real tab/device evidence. Targeted recording has actual Talk/Continue, staged encounter entry and a legal FireJab for7damage with launch/impact synchronization; initial cold UI samples were8ms late. No clipping/errors reported; listening remains unperformed.

[PR62 local checkpoint](https://github.com/jaredbahr/Avatarrpg/pull/62#issuecomment-5730860948) records the grouped milestone without triggering CI. Await only the last authorized Bo/Wen rest batch/review and PR63 cost-workflow merge, then reconcile main, verify and make one cohesive push. Latest remote is still4ee508a. No additional environment expansion. Proposed subsequent handoff: existing forest-road camera/framing and staged art contract first (never skew old backdrop), validate entry/encounter/save/return and both backend controls, then existing quarry gate/floor continuity under the same accepted system.

## Planned next contract — existing forest road only

Inspection confirms the shared forest road map is authored in `src/content/maps/combat.ts`; `src/content/maps/world.ts` adds exploration exits/triggers/NPCs. Both ExploreScene and CombatScene already pass the map's scene/projection to the shared renderers. Do not switch the map until the registered art is ready and reviewed.

Logical size20x12; oblique origin(768,0), extent2048x1024 at64worldpixels/tile. Proposed same bleed as BaDan gives2304x1280; split into two1152x1280 ground textures at(-128,-192) and(1024,-192). Preserve every existing terrain, surface, cover, elevation and blocked cell. Upright pines must occupy existingT footprints; no new collision or enemies. Exact water footprint is8cells: row5 columns5–6, row6 columns4–7, row7 columns5–6. Paint only permanent water if the scene opts into paintedWater; dynamic/fallback/high-contrast surfaces remain rule-driven.

Keep Dema(3,1), discoveries(2,9)/(16,9), west/east exits(0,4)/(19,4), crossings atx4/x8, and all authored party/enemy/reinforcement spawns clear and readable. Art owns textures/provenance/anchors; gameplay owns camera framing, tactical readability, tests and integration. Agree footprints and anchors with art before generation/integration. The continuous route also includes the existing cutting/ambush map between gate and floor; preserve that connector and flag its presentation continuity when staging later quarry work. No region is added.

Acceptance: real village departure, forest optional conversation/discovery, triggered encounter, legal move/target/impact with water/elevation, save/reload, and return. Compare Canvas/WebGL and portrait touch picking; ensure combat refit/active-unit framing preserves zoom and target readability. Keep existing map coordinates, rules and save format. This is planning, not implementation or art acceptance.

## Courtyard party checkpoint complete locally — 491c74d

Final rest source `94d5ead` is preserved as `491c74d`. All five courtyard party members now have optional relaxed exploration poses; combat frames remain unchanged. Art reviewed/released paired three-leg stop/turn/rest captures at `C:/Users/Jared/.codex/worktrees/71bd/Avatar RPG/gallery/scene-audit/composition-491c74d`; primary viewed `webgl-rest-1.png`. Bo/Wen identity, costume, gauntlet, height and foot contact hold in the sampled views. No further assets are planned for this checkpoint.

Full verify passes689/72. JavaScript292.1KB/300, precache15.23MB/25. Unit assets4,175,559bytes,18,745 below4MiB. Three latest spacing/shopfront browser tests pass26.7s. Worktree was clean before this handoff update. This is a bounded courtyard checkpoint, not final reference/world/device/listening acceptance.

Only the external PR63 cost-workflow merge blocks the scheduled batched push: its unit check passed and E2E/gallery were still running on the last inspection. Do not restart healthy jobs. After orchestrator confirms merge, fetch/reconcile main, re-run verify/build/assets, push once and inspect new-head checks. Keep PR62 draft for the approved next continuity work. Do not introduce more courtyard art while waiting.

Art agrees the planned forest projection/chunk math. Preserve walkable elevation1 cells marked^, exact cross-shaped8-cell water footprint and rubble cover(7,3)/(8,9). Before any generation, agree exact water guide/mask and scenery front/depth anchors for cover; existingT cells alone provide blocked pine footprints. No forest code or assets have changed.

Final production-route audit passes all four combinations: trade/escort on Canvas/WebGL,1.6minutes total, using the491c74d production build. The first audit correctly exposed a stale hardcoded Gao(7,3) return-test step after his approved relocation; `7b8dca0` resolves the merchant's canonical content position instead. Story assertions are unchanged. Full verify689/72 passes. Art's consolidated handoff is preserved as `ce3575d` at `docs/coordination/handoffs/courtyard-art-audio.md`. Runtime remains491c74d; only tests/docs follow it. Await PR63 merge before the one batched push.

Forest art registration is now agreed: exact12-vertex mask for the8water cells, projected boundsx576..896/y320..480; low ground rubble for walkable cover; pines144x224world with trimmed foot50%/99% at exactTcellcenter. T(0,0) stays within192topbleed; border variants may shrink but not exceed1scale. Art may prepare bounded source assets separately; gameplay does not enable the map until their registration is reviewed. Keep the4MiB map-family gate and legacy fallback, with current2.43MiB usage.

## Courtyard current-head CI correction

PR62 batched head04a3aa0 passedverify but E2E job105639450437 failed at the stale `.explore-bar .title-plate-objective` selector. CI44passed,241notrun due fail-fast; no claim about unrun suites. Failure log retrieved from completed job API while gallery ran; reportartifact10552932127 on run35356894572 retains evidence.

Corrected only the exploration regression: objective lives in `.explore-objective` and persists near the gate, with destination added beside it. Assert both objective and gate label, then still perform actual walkTo(23,7) and require map=forest_road. All4 exploration tests pass locally11.1s. Search found no remaining stale topbar objective selectors. Orchestrator authorizes cancelling the superseded failing-head run once this correction is verified, then one replacement push; this is not a healthy-job restart. Full latest-head checks remain mandatory. Forest work remains separate/local.

## PR62 software-WebGL timeout correction

Head8c301c9 failed E2E run35359990220 at shopfront Talk after the combined test exhausted60seconds, twice. Trace artifact10555401626 shows each visual capture spending about16seconds plus locator resolution overhead; Followparty took9.6seconds.88tests passed,197didnotrun. This does not establish that Talk itself is broken.

Separated real Talk interaction from the ring-occlusion pixel regression. The latter already freezes viewtime; now it presents each ring state once and waits for presentation acknowledgement, avoiding repeated identical software-WebGL draws during screenshot capture. Original15pixel RGB comparisons/tolerance3 remain; no timeout increase or forceclick. Both actual Talk tests retain dialogue visibility and Gao node assertions.

Four focused tests pass on regularChrome (29.1seconds total); final acknowledgement version also passes forcedSwiftShaderChrome (32.7seconds total), at1368x912 withtouch. Fullverify required before correctionpush. Retain existing failureartifact; obsolete failed-head gallery may be cancelled under orchestratorcostpolicy aftervalidatedfix. Newhead still requires allCI and PRstaysdraft.
