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
