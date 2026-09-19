# Cutting control and art follow-up

Updated 19 September 2026 by root. This is an ongoing manual review, not slice
acceptance. PR64 remains frozen at `ff243ab7c5ad2caa9a106d971d626dbc2e76a5c7`
while required run `35435673189` proceeds. Its verification job passed; browser
and gallery jobs were running at this checkpoint. No duplicate run was started.

Next integration work lives in `C:/Users/Jared/.codex/worktrees/route-art-followup`,
branch `codex/route-art-followup`, based on that frozen revision. The gate spawn
screen and deserter source checkpoint are preserved here; neither changes game
balance or the shipped deserter. The Riko elevation/provenance correction and
tea-station replacement remain with their isolated owners. The release version
remains v0.2.1 until the next playable release is prepared.

## Manual route evidence

The continuing Sura/Riko campaign uses older production runtime `798bee8` at
`http://localhost:4210/?renderer=webgl`, installed in-app Chromium, 1280×720.
It does not verify the newer compact HUD, AI or art changes. Both heroes entered
the Cutting at level 3 and full health after the gate defeat/escort branch;
Sura selected Water Pull and Riko Bolas through ordinary level-up controls.

Walking from the gate reached Sen and the optional tea station. Sen's kettle
conversation and the three discovery lines stayed over the explored world.
Six cups, the washing bowl, workers' names and the wire-mended handle provide
concrete evidence of daily life. The procedural oversized green kettle clashes
with the painted people and environment; a grounded table replacement is assigned
to `quarry_composition`. No audible listening judgment was made.

Walking to Jin's waiting mercenaries entered the Cutting fight normally. Riko
moved four points on round 1 but still had no Bolas target within six tiles;
he ended with five unused AP. Sura also spent the first turn approaching without
a Water Pull target. The crossbow hit Riko for seven, then Sura for eight in the
next round. The distant deployment still creates an approach-only opening.

On round 2 Riko used Bolas on a mercenary: the preview reported 90% hit,
approximately three damage and 85% Rooted. The log confirmed three damage and
Rooted. Riko then advanced four points toward the two melee enemies; the move
preview warned of mercenary and crossbow threats. He remained outside Strike
range and ended with four unused AP. This was an exposed manual choice.

Sura moved into range and used Water Pull on the crossbow standing on broken
stone. The preview reported damage, Wet, displacement to (10,1), and mud on
the original tile. Actual play dealt an eleven-point critical, made mud,
displaced the crossbow and applied Wet. Ice Path next forecast 40% Chilled
contact on the crossbow and ice on two tiles; the log confirmed Chilled.
Water Whip then dealt a fifteen-point critical. Ruon followed with a thirteen-
point sabre hit and finished the displaced crossbow. This is a real positional
payoff; Ice Path did not promise or produce guaranteed Frozen.

Both mercenaries then attacked Riko: eighteen critical damage, nine damage and
nine damage knocked him out. One further attack missed Sura. Thus the chosen
Bolas target and follow-up position did not prevent the melee response. This
single sequence does not establish pair balance, and should not be described
as a successful defensive combo.

At round 3 Sura has 26/34 HP, four AP and four movement; Ruon has 48/48 HP,
the mercenaries 44/44 and 41/44, and Riko and the crossbow are down. Manual
slot 3 saved this state at 04:59:28 local. Slot 1 preserves the level-2 forest
checkpoint; slot 2 preserves the level-3 gate escort checkpoint. Continue through
the normal Load menu if needed. The separate 127.0.0.1 origin retains the older
solo Driller and completed homecoming saves.

The next review should finish this encounter and the route, test the revised
art in the follow-up build, and compare presentation against the approved player
views. Physical Surface/iPad and subjective audio acceptance remain open.

## Encounter completed

The same manual campaign subsequently won on round 4. On round 3 Sura used
three Water Whips on the nearer mercenary (41 to 13 HP), shoved him one tile,
then retreated four movement points to a destination whose real preview found
no immediate direct attack. Sura took no further damage. Ruon killed that
mercenary and wounded the other. On round 4 Sura advanced two points to a
similarly unthreatened tile and used four Water Whips to finish the remaining
32-HP enemy. Ruon remained at full health.

Continue played Ruon's three-line cutting/quartermaster/driller confession and
returned to exploration with the east route open. Sura recovered to 34/34 HP;
Riko recovered to 18/36. The postfight conversation used the standalone dialogue
screen in this old runtime; retained-world presentation needs checking in the
latest source. Slot 3 still preserves the earlier round-3 state rather than the
victory. The live tab is now back in Cutting exploration.

The tea-station owner's actual Canvas 96px and WebGL 64px captures were reviewed:
the grounded worktable, vessels, footline and interaction pip read coherently
beside Sen. This accepts that bounded visual correction; source integration and
the combined release checks remain pending. No overall art signoff is implied.

## Combined follow-up validation

Root integrated Riko directional contact and its elevation/provenance correction,
the accepted tea table and semantic missing-image fallback, and the `pushes` /
`pulls` preview wording repair. Ruon's `after_ambush` now explicitly retains the
Cutting world, preserving the original lines and continuation. Both-backend
production tests pass for that transition, forest aftermath save/reload, and
gate choices at landscape and Huge portrait: eight checks total.

At `37210c6`, full verification passes 831 tests in 97 files, typecheck, lint and
formatting. The first combined run found formatting in the audit handoff and a
franchise term in the art-review heading; both were corrected without weakening
validation. Product build `8c91b74` passes art validation and asset budgets;
JavaScript is 299.2 KiB / 300 KiB and precache 17.23 MiB / 25 MiB. Later commits
only format/fix documentation. Strict production preview 4267 stopped when the
eight-check browser batch completed.

PR64's exact-head run `35435673189` is terminal cancelled: verification passed,
E2E failed after 73 passing tests at the forced-WebGL forest-aftermath 60-second
timeout, and root cancelled the still-running gallery to conserve usage. The
retry timed out on the final party-state read. That is a diagnostic observation,
not yet a proven root cause. `world_conversations` owns the isolated trace audit
and repair; no replacement CI run has started. Root's job log is retained under
`.shots/integration/ci-35435673189-e2e.log`.

Deserter runtime art is a separate isolated follow-up. Root authorized a narrow
units-family allocation from 4.5 to 4.75 MiB with an ADR; expected combined units
are 4,837,007 bytes, leaving 143,729 bytes. All other family, total precache and
JavaScript caps stay unchanged. Runtime walking/casting review remains required
before accepting that asset. This is not yet in the combined source above.

## Driller arrival

The manual `798bee8` campaign walked east using the local map route, then across
the quarry floor to the actual Driller marker. The three-panel descent and two
quarry narrative lines led normally into Grumbler round 1. Current live state:
Riko 18/36, Sura 34/34, Grumbler 64/64, Riko's ready handoff still open. The
entrance floor remains visually bare relative to the approved reference; the
surround and individual props do not close that composition gap. An isolated
read-only audit is comparing the exploration machine/adult proportions with
combat before deciding whether the landmark needs a scale correction.

The old root preview listener was found stopped, though the cached game remained
playable. Root restarted the same unchanged production dist at strict 4210
(exec session 19819, PID35916 at this checkpoint). No rebuild or save overwrite
was performed. Both manual campaign tabs are preserved for continuing review.

## Driller control review and defeat branch

The same manual WebGL runtime `798bee8` continued through a real Driller defeat.
Round 1: Riko stayed back, Sura advanced four tiles and took 11 damage from
Debris Throw. Round 2: Riko advanced, used Bolas (90% hit, about 1 damage,
85% Rooted preview), and the log confirmed 1 damage and Rooted on Grumbler.
Sura's four-tile approach then showed "No immediate direct attack found".
Five Water Whips reduced Grumbler from 63 to 42 HP (including one miss).
Nevertheless, the enemy used Churn the Ground and then Driller Slam, dealing
14 damage to Sura and pushing her back. The boss also appeared to move.
This apparent preview discrepancy is assigned to `combat_preview` for a
current-source rules audit; the earlier no-threat forecast is not accepted.

Round 3 exposed a separate reproducible interface issue: rooted Riko still
had an enabled Move button, reachable highlights, an exposure preview and a
Confirm button. Confirm correctly rejected the move with "Riko cannot move
right now", retaining four move points and six AP. `world_conversations`
owns the isolated current-source movement-availability correction.

Sura then used Water Pull: preview predicted one of three tiles before an
obstruction, landing on Mud. The actual attack dealt 2 damage and moved the
machine one tile. Ice Path applied Chilled. The subsequent enemy turn defeated
both characters, reaching the round-4 Driven back screen with Grumbler at 40 HP.
The three retreat lines and all five ending panels continued normally to
"The Quarry Keeps Running", with Save this game / Replay scene / Back to title.
No slot was overwritten; the earlier Cutting round-3 save remains available.
This is a defeated-route observation, not a successful two-person balance result.

The scale audit found matching exploration/combat proportions: Grumbler idle
165 x 102 pixels at a 96-pixel tile; party bodies about 113.4 pixels tall;
Ruon about 113.25. Nominal marker scale differences compensate source dimensions.
No exploration-only scale correction is warranted.

Root integrated the scoped software-WebGL aftermath allowance as `ac8c81d` and
its trace handoff as `dfadbd2`. Fresh `npm run verify` at `dfadbd2` passes all
831 tests in 97 files, typecheck, lint and formatting. No new GitHub run started.
The revised deserter counter-swing and matching portrait have passed root source
and actual Canvas/WebGL capture review; final owner validation and integration
remain pending. This accepts that bounded asset correction only.

## Confirmed Rooted AI defect

The independent current-source audit reproduced a Rooted Grumbler moving before
Churn and Slam. Both AI movement branches in `src/core/rules/ai.ts` omitted the
shared `canMove` rule. The direct-attack helper correctly reports no stationary
threat at the reviewed distance while Debris Throw is cooling down, and correctly
reports Slam at its actual stationary reach. The AI correction and regression
belong to `combat_preview`; do not loosen the preview to accommodate illegal AI
movement. The separate player movement-availability UI remains assigned above.

Deserter implementation `1f6fc72` is integrated as `c66f0f9`. Combined production
build, art validation and budgets pass at `c66f0f9`: JavaScript 299.3 KiB / 300,
precache 17.37 MiB / 25, units 4,835,087 bytes under the documented 4.75 MiB cap.
The source owner's full verify passed 834 tests in 98 files; the root combined
full suite will run after the pending AI and player-interface corrections.
No GitHub run or push has occurred for this local batch yet.

## Checked release and next quality ownership

Root froze `codex/route-art-followup` at `fc37c6a` and pushed that exact head to
PR64. Full verification passes 836 tests in 99 files; build, art and budgets pass
at 299.5 KiB JavaScript and 17.37 MiB precache. Twelve focused production browser
checks and both complete trade/escort quarry-return routes pass. CI run
35438371967 has passed verification, including balance, and its E2E and gallery
jobs are still running. Merge-commit auto-merge remains enabled, with no review
threads. Do not push more commits into this running revision.

The prior campaign's Cutting round-3 save was exported through the game menu
and imported successfully into a fresh production origin on build `fc37c6a`.
Root repeated the normal Cutting victory with the same command pattern, checked
corrected "pushes" wording and the retained-world three-line Ruon aftermath,
then walked through the east exit and across the quarry floor to the Driller.
The intervening two-line quarry narration still uses a standalone screen; this
is a presentation observation for the next pass, not accepted continuity.

Current manual browser: in-app tab 5, `http://127.0.0.1:4267/?renderer=webgl`,
1280 x 720. Party Sura34/34 and Riko18/36, level3. Slot1 is the healed Cutting
checkpoint at05:57; slot2 is Grumbler round1 at06:03. The save menu is open over
Pause before Riko's ready handoff. No battle action has occurred yet. Production
preview4267 is root-owned session98332, serving frozen `fc37c6a`. Earlier tabs3/4
and the unchanged4210 preview preserve the earlier victory and original saves.
The old run's defeat is not a balance result for the corrected AI.

The separate `codex/deserter-material-fx` candidate contains `df5432f` plus
`b0e1d60`, based on the frozen release. Root accepted its bounded source-launch,
small-flask and grounded-impact captures. The source owner reports841 tests in
101 files and all build/art/budget checks passing, with389 bytes of JavaScript
headroom. Root has verified its clean branch and now owns this next-quality
candidate; its source owner released editing and stopped4265. Do not copy its
changes into PR64 while CI runs. Versioning and the next landing revision follow
the actual release state, not an unshipped checkpoint.

## Corrected Driller replay on fc37c6a

Manual WebGL replay used the imported normal level-3 Sura/Riko campaign and
matched the old round-2 command sequence: Bolas, approach and five Water Whips.
The boss reached42/64 HP. Rooted now prevents its movement: it used Churn and
Oil Spray in place, with no Slam. Sura retained23/34 HP instead of the old9/34.
Riko's Move button was disabled with the authored Rooted explanation. Slot3
preserves round3 before player actions (19 September,06:14:38 local).

Continuing legally, rooted Sura used four Water Whips (boss42 to28). Once Rooted
expired, Debris Throw critically hit Sura for17 and splashed Riko for8; Slam
then downed Sura. Riko moved4 through the mud to melee range and used six
Strikes, one missing, leaving the boss2/64. Its reply defeated the party.
The three retreat lines and all five ending panels continued successfully to
The Quarry Keeps Running. This confirms the scoped AI/UI repair and defeated
route on the release build; it is not an all-party balance or quality signoff.

Tab5 remains at the terminal ending. Slots1/2 retain Cutting and Driller round1;
slot3 retains the corrected round3 checkpoint. CI35438371967 still has passed
verification with E2E and gallery running at this observation. No duplicate run
or new release revision was pushed.

Next-quality ownership: quarry_composition works in the isolated
codex/route-enemy-scale tree on consistent adult proportions for five route enemy
sheets, using existing presentation scaling without a schema change. Preview4265
is reserved to that task. combat_preview is auditing a bounded quarry interior
with navigable cover and useful props against the approved reference; it has no
map-edit authorization until scope review. Root owns this FX integration tree.

The superseded root-owned4210 preview (session19819) was stopped after save
transfer and corrected-build review; its old browser origins and saves remain
preserved. Current release4267 remains available. Adult-scale source review
accepted loaded Canvas96 bruiser/Forest marker and WebGL96 quarry worker plus
WebGL64 crossbow. Missing-image fallback remains functional but its primitive
bruiser is taller than the loaded sheet; no visual-parity acceptance is implied.
world_conversations now owns an isolated next-quality investigation of the two
standalone quarry narration lines before battle, reusing existing world-backed
conversation routing and preserving the illustrated interlude.

## Next-quality integration and quarry interior assignment

Root integrated the reviewed scale source as3fe44ff and its handoff asc8f8b06,
without modifying frozen PR64. Source verification843/102 and its visual matrix
apply unchanged; root-only differences from that base are documentation. The
next combined verification waits for the coherent quality batch.

combat_preview completed the read-only interior audit: current Driller arena has
no permanent interior blockers and its scene scenery list is empty. Root approved
an isolated implementation based onc8f8b06: permanent stone stacks at(8,4) and
(11,7) with reused masonry; live rubble at(6,7)/(13,4), water barrel(12,6), brazier
(10,3), preserving the conditional cart. The owner must establish engine path,
LOS, size-two footprint, save and balance behavior; its simple connected-cell
audit alone is not acceptance. It owns maps/combat.ts and quarryProjected.ts.

quarry_composition owns a separate art-only rear loading/rail strip assignment,
also isolated fromc8f8b06, coordinating its key and anchor with gameplay. Target
80–100KiB within remaining map budget175,940B; reuse art where suitable. No fake
interactive props, duplicate Driller, renderer changes or budget increase.
The current combined JavaScript has about315B headroom; measured authoring
compression may be necessary. Root remains the sole integration owner, with
PR64 frozen and no duplicate pushes or CI. Both assignments must provide exact
source and runtime evidence before integration. Narration continuity remains
with world_conversations in its separate scope review.

## Successful campaign import and optional river loop

On frozen releasefc37c6a, root imported the earlier normal solo Sura victory and
completed-homecoming export into a separate fresh origin, localhost4267, tab6.
The title visibly identifies v0.2.1/buildfc37c6a. Export is
four-nations-tactics-lv4-2026-09-19 (1).json in Downloads (06:29 local); original
tab3 and its saves remain unchanged. Sura is level4,23/38HP. This is compatibility
and post-victory review, not a replay of that whole winning fight on fc37c6a.

The completed-homecoming objective now correctly says the party has caught up
with the village. Root walked to Riverside, used Tea break and Meet Pebble,
observed discoveries1/3 to2/3 to3/3, and walked back to Ba Dan. Pella's three-line
post-quarry conversation retained the world and returned to exploration. Slot1
in tab6 saves the return beside Pella at06:35:18. Full page reload and loading
that slot restored Sura's health, Pella proximity and completed-homecoming
objective. The journal visibly preserves all three river discoveries and prior
village/road/quarry visits. Tab6 currently has the journal open; tab5 retains the
separate two-character defeat and three combat checkpoints.

Presentation findings remain open: Riverside's dock uses about231px of a720px
viewport, repeats header utilities and horizontally scrolls many activities.
world_conversations now owns a new isolated compact-dock pass based on9a54d23,
limited to VillageLife.ts, Riverside CSS and focused interaction coverage. All
activities, preview exit/settings, touch/Large-text access and return behavior
must remain available. Tea text describes sitting with a cup, but visible Sura
stands beside the porch; this is a recorded animation mismatch, not accepted
sitting animation. Village buildings and retained conversations read coherently,
but broad grass/paving and sparse daily-life detail still fall short of the
approved dense neighborhood reference. Do not mark the full target accepted.

The quarry assessment metadata source is integrated asf0894bc with handoff
9a54d23. Root reviewed the exact-map registration and marker/save/reload test.
Source verification842/101 and all9 interlude browser tests passed; current
combined checks await the coherent quality batch. PR64 remains frozen with its
single required CI run. Its existing job caps are60min E2E and75min gallery;
source comments record prior successful durations41–48 and up to62min, so the
currently live long-running jobs are not treated as stalled without evidence.

## Release CI failure and local engine coverage

CI35438371967 is terminal: verification passed; E2E failed after240passes on the
iPad-landscape pinch test's starting-scale assertion (96expected,64received),
including its retry; root cancelled the remaining gallery. Log and playwright
report are retained under frozen route-art-followup/.shots/integration with the
run id. PR64 still targetsfc37c6a, remains open with merge-commit auto-merge
enabled, and has not merged. Its body now records the actual failure.

New isolated gesture_ci_repair owner is fixing the test contract fromfc37c6a,
without touching root's ExploreScene. Local Chrome1194x834 reproduced the exact
failure. Current compact framing intentionally chooses64, while wider/taller
Surface uses96. Exact responsive sizes, usable canvas/actor visibility and all
pinch/anchor/pan/Recentre/reflow assertions remain required.

To reduce repeated CI-only discoveries, root installed the matching official
Playwright WebKit2359 runtime on this Windows host (standardms-playwright cache).
The repository's no-install instruction is for dev containers; this is Windows,
not that environment. No package/lockfile changed. The repair owner now runs the
actual local WebKit iPad profiles as well as27 passing Chrome gesture cases.
This engine coverage does not replace a physical iPad or audible review.

Root committed conversation-entry framing as1f82c1c after fullverify844/102,
production build/budget and four Chrome browser cases. Four local WebKit framing
cases also passed (27.6s); strict4266 stopped. See conversation-framing.md.
Art source505941c supplies the accepted40,086B rail ledge. Gameplay source
d266abb supplies the new quarry cover/props and has fullverify849/103 plus
build/art/budget/balance passing. Gameplay is still integrating the rail asset
and owes actual scene/route/variant evidence before root accepts the combined
interior. Neither source alone establishes completed interior presentation.

## Combined dock and gesture checkpoint — 19 September

Root integrated the released Riverside dock commits as `a9699a9`/`702d9a6` and
responsive gesture coverage as `710128d`. The combined candidate passes
`npm run verify` (844 tests / 102 files), production build, and the 300 KiB
JavaScript budget (299.8 KiB). Version remains the unshipped v0.2.1.
The gesture owner separately passed 27 Chrome and 18 actual Windows WebKit cases.
Root's combined 20-case Riverside/conversation-framing Chrome and WebKit run is
active on strict port 4266; results are not yet final. Its reusable ignored config
is `.shots/integration/full-local.config.ts`, preserving the production project's
coverage and using installed Chrome plus opt-in WebKit. Full combined E2E awaits
quarry integration. No push or new GitHub run occurred.

Quarry interior registration and runtime review remain with combat_preview.
The Riverside owner released editing ownership and is now performing a read-only
Ba Dan composition audit against the approved neighborhood reference. No visual
acceptance or deployment is claimed from the passing source checks.

The combined Riverside/conversation-framing browser run completed: **20/20 pass**
in 3.3 minutes, Chrome Surface and actual Windows WebKit iPad, both renderers and
portrait Largest text. Root also reviewed actual WebGL preview v0.2.1/710128d at
1280×720: the closed dock leaves approximately486px of map, Activities opens all
visits and preview battle, and Tea break completes its discovery. The remaining
standing-at-tea mismatch is confirmed visually; a separate tea art/pose task now
owns its correction. No deployment or aesthetic completion is claimed.

A local three-pass Terser experiment saved only about20 compressed bytes and was
reverted; source still uses two passes and remains clean. The transient dist from
that experiment is not an acceptance build and must be rebuilt from source before
the next full run. Root stopped its temporary4268 manual preview. Frozen release
4267 remains separate. Browser evidence for710128d was copied to the ignored
`.shots/integration/dock-framing-710128d` directory before any later test run.

## Legacy Driller save review — 19 September

Root found an unresolved visual/rules compatibility risk before quarry integration:
CombatScene supplies current `content.maps[mapId].scene`, while a loaded battle
retains its serialized grid. The proposed new static walls can therefore be drawn
on old saves whose8,4/11,7 cells remain walkable. The quarry owner is investigating
a small authoritative-grid-dependent scene visibility correction; old battle
positions, props and terrain must remain intact. New-grid save roundtrips alone
do not establish legacy compatibility. Quarry integration awaits this correction.

The Ba Dan read-only audit is complete. The owner now has a separate bounded
neighborhood task: reuse market/planter art for the lower court and propose a
coherent short canal/bank/bridge geometry before generating matching art. NPC,
exit and save reachability remain mandatory; no new destination is authorized.

## Combined quarry and download checkpoint

Integrated quarry geometry, source art and registration as95598af/ce175de/e7ac483.
Combined verification passes850 tests in103 files, production build and all art/
asset checks. The initial JS total was307,232B,32B above the existing300KiB cap.
Root's omission of unused Pixi video-texture registration (ADR0038) restores the
budget to297.7KiB, with850 tests/build passing; renderer acceptance remains pending.
No budget cap changed and no game content was removed.

The first local full418-case Chrome/WebKit run stopped after97 passes at
interludes.spec.ts: the new stone cover makes the actual quarry crossing(9,5)
instead of(9,4). Root repaired the brittle coordinate expectation to capture the
actual marker location and require the assessment to preserve it; exact saved
state/reload assertions remain. Evidence is preserved under
`.shots/integration/full-e7ac483-first-failure`. A new combined run follows.
Legacy-save wall visibility, tea motion and Ba Dan neighborhood remain active
isolated assignments. No new GitHub push/run or deployment occurred.

## Legacy campaign fixture and running combined checks

Root exported the actual fc37 manual Driller round3 checkpoint through the game's
UI without overwriting slots. File:
`C:/Users/Jared/Downloads/four-nations-tactics-lv3-2026-09-19 (2).json`
(65,917 bytes, 19 September 07:33 local). It contains Sura23/34, Riko18/36 with
Rooted, and Grumbler42/64. Quarry ownership now includes a focused Canvas/WebGL
load of this older save, preserving its baked grid, unit state and RNG while
omitting new wall artwork absent from its terrain.

Root's combined 418-case run on the video-source-excluded build stopped after
178 passes, one skip and 238 not run. All 168 Chromium cases completed, including
repaired quarry assessment/save-load, renderer and motion checks. Windows WebKit
failed audio unlock: an independent button-gesture probe confirmed that this
engine exposes neither AudioContext nor webkitAudioContext; Chrome exposes a
running context. Linux CI audio checks remain mandatory and unchanged. Evidence
is retained in `.shots/integration/full-473165b-audio-failure`.
The tested build precedes tea and legacy-wall guard integration.
Tea's transient agent capacity failure was resumed in the same preserved worktree
with its live probes retained; no duplicate jobs or GitHub runs were started.

Tea visual review found a separate real presentation issue: opening Activities
can blank WebKit's forced-WebGL base painting while overlay actors remain. The
tea owner is comparing the pre-tea compact dock on root's temporary port 4268
with the frozen release on 4267. No renderer parity or platform-wide limitation
is claimed. Root must preserve the 4268 dist while that comparison is active.

## Ownership transfer: legacy walls and Riverside resize

Integrated legacy-wall guard as `b69fa4e` after source review and the actual R3
save import checks on Canvas/WebGL. The shared helper preserves old battle terrain
and omits wall slices unless their footprint is blocked wall terrain. The quarry
owner released the original assignment and now owns a new isolated WebKit resize
fix from this integrated head. Tea owner proved the blank Riverside base painting
on pre-tea production4268: Activities toggle alone causes it; tea art is not causal.

Root's Windows-only WebKit diagnostic continuation is live on4266 with248 cases;
its ignored config excludes audio because both Web Audio constructors are absent
in this Windows engine. It retains all other iPad coverage. Required Linux CI and
repository test configuration remain unchanged. Root dist/4268 stay frozen while
this run and the independent resize comparison use them. No deployment is claimed.

Village visual review rejected the first regenerated full ground pages: both Q11
and Q82 crops change the existing soft painted grass/stone into darker, noisy
texture. This is a source/material difference, not a justification to lower
quality. The neighborhood owner must preserve the shipped ground outside the
new canal envelope, preferably with an appropriately registered canal/bank slice.
The approved direction remains the seven-cell water/bridge neighborhood feature,
not merely a bridge over the former small pond. No rejected ground is integrated.

## Combined tea and legacy-save build

Tea source integrated as `50b0ee0`; cleanup handoff as `a8d557d`. Its dedicated
4275 dev server is stopped. Combined `npm run verify` passes 855 tests in 103
files plus typecheck, lint and formatting. Separate production output
`.shots/integration/combined-tea-dist` builds successfully and passes art validation.
Its exact JavaScript gzip total is 305,219 bytes (298.065 KiB), leaving 1,981 bytes
under the unchanged 300 KiB limit; PWA files are present. The displayed build is
50b0ee0. Root's older dist remains unchanged for the live Windows WebKit diagnostic
and resize reproduction on 4266/4268. Final integrated browser acceptance awaits
the independent WebKit Activities painting fix and village canal work.

## Windows diagnostic completion and canal review

Windows WebKit continuation session3760 completed successfully: 178 passed,
70 skipped in 21.3 minutes. Both full trade/escort campaigns, reload and walk-home
checks passed. This tested the frozen pre-tea/pre-legacy-guard root dist, not the
latest source. Audio/offline exclusions remain local; required Linux CI checks
are unchanged. Report: `.shots/integration/windows-webkit-report`; preserved
results: `.shots/integration/windows-webkit-473165b-results`.

Root reviewed the canal owner's actual Canvas/WebGL crossing captures. The
corrected bridge orientation is coherent, but a detached turquoise rectangle
still overlays the dry court southeast of the bridge. The owner is correcting
its source and checking an actual bridge approach before integration. No full
ground replacement or visual acceptance is authorized by this partial review.

Combined manual campaign resumes on production4269, build50b0ee0, using the
exported healed Cutting checkpoint `(3).json`: Sura34/34 and Riko18/36, level3.
The saved campaign loaded successfully and walked through the ordinary east
route into the quarry. Further encounter play remains in progress. PR64 remains
open/blocked on fc37c6a with merge-commit auto-merge enabled; remote main remains
44ed3f6. No new CI run, merge or deployment occurred at this checkpoint.

The manual campaign subsequently entered Grumbler round1. Riko used four legal
movement points around the northern cover; previews reported movement cost and
Grumbler's potential reach. Sura remains34/34, Riko18/36, boss64/64; no attack
or outcome is claimed. Slot1 on4269 holds this state, exported through the UI as
`C:/Users/Jared/Downloads/four-nations-tactics-lv3-2026-09-19 (4).json`
(64,697 bytes). Active browser tab9 is marked for continuation, with Save open.

## Manual prop setup on combined50b0ee0

Continued that actual two-player campaign to round3, without state mutation.
Riko moved beside the new brazier, shoved it onto oil, followed and used Strike
to break it. The preview explicitly announced four fire tiles and friendly
damage; the executed break reduced Riko11 to7 HP. Shoving alone correctly did
not ignite the oil. Bolas then damaged Grumbler64 to63 and applied Rooted.

Sura's Water Pull initially forecast zero displacement because the water barrel
blocked the two-cell boss. Two Water Whips broke the barrel, removed its cover
and applied Wet. The next pull forecast changed to three tiles, landing at
displayed(11,5), and execution moved the boss and reduced it to61 HP. This is
verified setup/displacement behavior, not a claim that the boss was pulled
through fire or that the strategy won. Round3: Sura23/34, Riko7/36 Rooted,
Grumbler61/64. Riko's Move correctly disables and melee correctly reports no
target within one tile. The low-health imported party and this costly setup
have not established encounter balance or tactical payoff.

Slot2 on4269 preserves round3; slot1 preserves round1. The UI export is
`C:/Users/Jared/Downloads/four-nations-tactics-lv3-2026-09-19 (5).json`.
Tab9 remains marked for continuation with Save open. Canal owner is fixing the
old baked pond mask with the original atlas; renderer owner has isolated the
blank painting to Pixi base rendering after resize, independent of VillageLayer.
Neither unfinished change has been integrated or pushed.
