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
