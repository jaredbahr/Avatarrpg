# Route quality review: integrated 0.2.1

Lead review, 19 September 2026. Normal UI on the local production server at
4210, forced WebGL, browser viewport 1280×720. Title visibly identified
`v0.2.1 · build 798bee8` after the existing service worker updated on reload.
PR64 head `82bcc78` differs only by documentation. This is not physical-device
or audible-listening evidence.

## Observed route

Continue loaded the completed homecoming save: solo Sura, level 4, 23/38 HP,
near Pella. Opened Map and chose River path; the party walked there normally.
At Riverside, chose Visit the shrine, walked there and read all three lines.
The conversation retained the painted world and reported 1/3 discoveries on
return. Walk to Ba Dan returned to the village with Sura's level and HP intact,
and the workers-home objective still present. Manual save slots were untouched.

## Findings and next ownership

- Village objective still asks for Mira, Pella and Gao after the recorded
  homecomings. Audit completion flags and make the cue reflect actual state.
- After shrine dialogue, Riverside's campaign return cue changes to the generic
  sandbox exploration objective. Return still works; determine the cause before
  treating this as state loss. `world_conversations` owns the read-only audit.
- At the village river exit, the dock says “Speak with Riverside path” and
  offers Talk. Route actions should describe walking/travel, not a person.
- Ba Dan's broad empty paving/lawn remains much less inhabited than the approved
  reference. The two courtyard props are a bounded improvement, not acceptance.
  `quarry_composition` is evaluating one coherent use of existing living-world
  behavior and art, with actual collision and occlusion constraints.
- Riverside has attractive continuous scenery, but its procedural residents
  visibly differ from the illustrated party. Its large two-row action panel
  also uses more screen space than the approved compact dock.
- Root reviewed source `dbd0808` adult Cutting captures: Ruon and the authored
  blade/sergeant figures now match party height better. Other variant figures
  remain smaller. The staged sword-release capture proves visible poses, not
  legal attack contact or a full animation-quality pass.
- `combat_preview` is auditing the prior Riko side-punch contact gap against
  the actual projection/choreography before proposing a correction.

These follow-ups are isolated from the active PR64 CI run `35430915536`; do not
restart its checks for an unverified experiment. The complete original quality
goal, deployment verification, listening and physical-device gaps remain open.

## Fresh opening review

On the same production build, opened `localhost:4210` as a separate storage
origin from the completed-route review at `127.0.0.1:4210`. Created a two-player
Sura/Riko party through normal setup, read all three opening panels, walked into
the market, read Gao's four lines and then used Look around to visit Mira.
No campaign state was injected; the generated seed was not recorded here.

The opening identifies the missing crew and interrupted quarry deliveries.
Gao's water-skin story gives Dorin a personal connection and then warns about
flooded ground. Mira's request is concise and specific. Party portraits, world
figures and dialogue portraits agree in this view. The scene remains visible
through dialogue. This is a visual/text review, not an audible reading review.

After Mira's first four lines, the objective says “Thank Elder Mira, then take
the east road”, while the nearest-person dock selects Gao. The nearby-person
tie is a further guidance inconsistency to review; it does not prove a blocked
route. Current fresh-play checkpoint is beside Mira/Gao, level 1, Sura 26/26,
Riko 28/28. The prior manual save slots remain on the separate origin.

Revisiting Mira repeats her introduction. Source inspection confirms this is
the authored graph (`mira_intro.next = village_explore`), with no separate
thank-you action or acceptance choice. Correct the objective's nonexistent
instruction; do not invent a lost story transition. The fresh review is now
at the first line of the repeated Mira conversation.

The read-only audits confirmed the riverside objective override and identified
the village exit's sign NPC taking priority over its travel action. Guidance
implementation is assigned to `world_conversations` in a separate worktree.
Two matched tree canopies are being prototyped by `quarry_composition`, with
real blocked trunks and before/after visibility checks. Riko contact work must
bring the visible hand to the target through physical movement; a distant
particle bridge is not an acceptable substitute for the missing contact.

## Forest arrival and first combat

The fresh two-person party walked through the east exit, spoke with Dema and
triggered both road crossings normally. Dema's lines connect the displaced
ducklings and dirty washing to quarry runoff. The first road narration displayed
the village illustration despite already describing pines and wheel ruts;
`4820ad6` switches that frame to the existing matching road image. All nine
interlude checks passed.

The forest entrance shows an oversized procedural turtle-duck beside illustrated
adults, plus a procedural green guard for the first road trigger. Source audit
identified adult NPC scaling applied to the animal; a bounded marker correction
is assigned to the art agent. This does not resolve all forest material/art gaps.

First encounter: Ambush on the Forest Road, round 1, Riko first, two Slingers
at 19/19 HP. The handoff and unit-focus buttons work. Initial framing shows both
heroes but neither enemy; focusing a Slinger pans to both opponents. Their
visible bodies remain smaller than the heroes. Review the broader humanoid
scale contract after the current bounded fixes, without changing the Driller's
logical footprint or generalizing a hero multiplier to nonhumanoid creatures.

Follow-up integration `619f493` includes reviewed tree framing, corrected route
guidance and the road illustration. Verify passes 815 tests /91 files; production
build totals 298.4 KiB of the unchanged 300 KiB JavaScript budget. All five
existing connected-world browser checks passed on strict port 4251, which ended
normally. Targeted new guidance interaction coverage is assigned separately on
port 4253.

## PR64 CI repair

At exact head `82bcc78`, run `35430915536` passed verification but failed the
surface-touch gesture test after 66 passes; the gallery was still running.
The failure repeated on retry: the test expected a fixed offset of 276 but
dragging produced 356. It assumed `battle_ambush` was a fitted orthographic map;
the Cutting is now oblique and correctly starts with readable, pannable tiles.

`8f4f085` explicitly pinches the real map down to fit, asserts `fitted === true`,
then preserves the original no-pan and zoomed-pan assertions. No camera behavior
or test tolerance changes. All eight gesture tests passed locally on installed
Chrome at 1368×912. The full 143-test local Chromium suite is running on strict
port 4257 before any new push. Its runtime is the `619f493` production build;
later changes so far are tests and documentation only. CI logs are retained at
`.shots/release-check/ci-35430915536-e2e.log`. No remote retry was dispatched.

The Riko contact solver was rejected after direct capture review: her body
overlaps the victim and the original-tile marker is visibly detached. Source
prototype was reverted by its owner. Evidence and minimum directional pose
requirements are in source handoff `532fc15`; no runtime fix is accepted.

## Follow-up integration checkpoint

The failed-head gallery was cancelled in run `35430915536` to conserve CI
minutes; cancellation is confirmed terminal. No checks are waived for the next
revision. The full installed-Chrome suite on runtime `619f493` finished with
141 passes, one accelerated-GPU premise skip, and one outdated case-sensitive
objective assertion. `7672248` updates that assertion to the clarified route
sentence. All eight local-map and world tests then passed, including the new
rescued Riverside shrine/return regression. The strict 4257 server ended.

Forest marker source `91b7db9` is integrated as `314ea49`, with its portable
review runner and handoff through `c1d4f0d`. Root reviewed the actual 64-pixel
entry and 96-pixel nest captures and accepted the bounded scale correction.
The pond's hard border and the discovery's simpler art remain visible gaps.

During normal two-person Sura/Riko opening play on `798bee8`, manually focusing
the forest combat and previewing a four-move destination expanded the footer
over the destination/path end. Confirm remained functional. The selected tile
should remain visible while manual zoom is preserved; a read-only camera audit
is assigned before implementation. This is not covered by a claim that existing
attack-target visibility tests prove movement-preview visibility.

Final combined verification passes 817 tests in 92 files, typecheck, lint and
formatting. Production build and art validation pass; total JavaScript is
298.5 KiB /300 and precache 17.20 MiB /25. Four integrated forest captures
passed on clean source `40f59ef` (Canvas/WebGL, illustrated/missing sheet, both
64/96 scales and real nest taps). An initial capture attempt stopped at its
provenance assertion because uncommitted documentation marked the build modified;
no gameplay assertion failed. Its retry used the committed source. Port 4259
ended normally. Tree review now also defaults to bundled Chromium and accepts
`FNT_REVIEW_BROWSER_CHANNEL` for the installed local browser.
