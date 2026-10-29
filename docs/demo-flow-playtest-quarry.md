# Quarry flow review, 2026-10-29

This extends [the forest review](demo-flow-playtest.md) through the quarry gate,
cutting, floor, Driller, ending and return to Ba Dan. It is an automated browser
review against [the approved player views](player-view-target.md), not a claim
that the slice has reached that target. No art was generated or replaced.

## Recorded source and method

The desktop Canvas trade route passed at clean fixture commit
`4304e988eebd8d99fdd7b3b6c1bb5880ca75d2d8`: 86 beats, no page errors, title
`v0.2.12 · build 4304e98`, 1280×800 at DPR 1, in 7.2 minutes. The portrait Canvas escort route passed at clean fixture commit
`3c4138c2893643ea179b24be889de96876f6c6d3`: 89 beats, no page errors, title
`v0.2.12 · build 3c4138c`, 820×1180 at DPR 2, in 10.7 minutes.

Both routes use three players: Kaya, Nilak and Bo. The default seeds are
`quarry-return-trade-route` and `quarry-return-escort`. Setup, practice,
conversations, choices, map routes and target/confirm controls use browser input.
Combat also uses legal planner commands. The driver records every staged shortcut:
living enemies are set to 1 HP after three party activations, then defeated with
legal actions. These recordings establish progression and presentation, not
unstaged balance or a manual tactical playthrough. Bo's kinship option resolves
the gate without a fight; trade takes the peaceful cutting passage.

The input trace identifies mouse clicks, touch taps and board navigation.
The portrait run uses touch taps for controls and five logged real mouse-wheel
zoom gestures for board targets. Portrait is a Chromium viewport/touch profile,
not Safari or a physical iPad.
Playwright video has no audio track; no listening acceptance is claimed.

The captured product tree is `5b45759e05d7a17a4c6c88da268f9a7bcffb8d45`.
The later portrait driver fixes change test input handling only. Each recording
retains its own full fixture SHA and actual visible build label; neither is
presented as a recording of the final integration commit. The separate ending
summary fix below changes the reviewed product afterward and has its own
focused evidence.

## Beats and retained evidence

Times are seconds from the fixture's start and approximately the corresponding
video position. Untrimmed scaled videos retain the original duration. Original
beat manifests include UTC machine timestamps, input traces, shortcut reasons and
source identity. Human-facing review date: 2026-10-29, America/Chicago.

| Beat                                 |     Desktop trade (s) |   Portrait escort (s) |
| ------------------------------------ | --------------------: | --------------------: |
| Title / party ready                  |             5.7 / 9.2 |            3.6 / 11.0 |
| Practice / Mira                      |           29.9 / 42.8 |           37.9 / 53.4 |
| Forest opening / flask aim / burning |    86.6 / 92.2 / 96.9 | 112.4 / 119.8 / 124.9 |
| Forest victory                       |                 173.4 |                 224.0 |
| Quarry gate / custody choice         |         191.3 / 215.8 |         247.4 / 287.2 |
| Cutting                              |                 234.0 |                 307.5 |
| Quarry floor / descent               |         250.3 / 262.3 |         409.6 / 429.4 |
| Driller / Show enemies               |         272.2 / 275.5 |         446.1 / 451.2 |
| Driller victory / outcome / summary  | 315.5 / 318.7 / 326.6 | 491.5 / 494.9 / 507.8 |
| Ba Dan return                        |                 386.7 |                 576.9 |
| Dorin / Mira / Gao                   | 396.4 / 412.4 / 425.3 | 591.0 / 612.9 / 628.4 |
| Completed custody response           |                 430.6 |                 637.1 |

[Desktop recording](../art/source/demo-flow/review/quarry-trade-desktop-canvas.mp4),
[original beat manifest](../art/source/demo-flow/review/quarry-trade-desktop-canvas.beats.json)
and [selected-still index](../art/source/demo-flow/review/quarry-trade-desktop-canvas.stills.json).
Contact sheets cover every desktop recorded beat:
[1](../art/source/demo-flow/review/quarry-trade-desktop-canvas-beats-1.webp),
[2](../art/source/demo-flow/review/quarry-trade-desktop-canvas-beats-2.webp),
[3](../art/source/demo-flow/review/quarry-trade-desktop-canvas-beats-3.webp),
[4](../art/source/demo-flow/review/quarry-trade-desktop-canvas-beats-4.webp).

[Portrait recording](../art/source/demo-flow/review/quarry-escort-ipad-canvas.mp4),
[original beat manifest](../art/source/demo-flow/review/quarry-escort-ipad-canvas.beats.json)
and [selected-still index](../art/source/demo-flow/review/quarry-escort-ipad-canvas.stills.json).
All portrait beats are on contact sheets
[1](../art/source/demo-flow/review/quarry-escort-ipad-canvas-beats-1.webp),
[2](../art/source/demo-flow/review/quarry-escort-ipad-canvas-beats-2.webp),
[3](../art/source/demo-flow/review/quarry-escort-ipad-canvas-beats-3.webp) and
[4](../art/source/demo-flow/review/quarry-escort-ipad-canvas-beats-4.webp).
The escort route also fights through the cutting; its third HP shortcut is
separately logged. Both manifests end with the custody-specific homecoming and
assert the cleared Driller encounter and the appropriate route flag.

Some raw arrival stills caught a transition curtain despite the driver's idle
check. They are retained in the contact sheets. The complete video shows those
spaces; clear derived frames are labeled with video time:
[cutting at 237.0 s](../art/source/demo-flow/review/quarry-trade-desktop-canvas-video-237-cutting.webp)
and [forest return at 371.5 s](../art/source/demo-flow/review/quarry-trade-desktop-canvas-video-3715-forest-return.webp).
These are frame extractions, not regenerated or repainted game images.

## Audit

Severity follows the first review: **blocker**, **ugly**, **nit**. Status is
**fixed**, **deferred**, **art** or **ok**. Estimates are bounded follow-up effort,
not commitments from other owners. `QR-01` is a local finding identifier, not a
GitHub issue number; API access is still blocked.

1. **QR-01 — ugly, fixed, code (separate commit `d540deff`).** The ending summary has no speaker,
   but its panel occupies the 16rem portrait column of a two-column stage. At
   desktop 326.6 s, almost the whole screen is empty while the ending and its
   continuation controls require scrolling in a narrow sidebar.
   [Before](../art/source/demo-flow/review/quarry-trade-desktop-canvas-69-driller-ending-summary.webp).
   The headless stage now uses a single column and a centered readable panel;
   story and actions are unchanged. Focused checks passed desktop, portrait and
   Huge-text phone, including reachable 48px actions and Continue exploring.
   Clean-source after captures at `d540deff` show panel widths of 928px, 756px
   and 354px respectively:
   [desktop](../art/source/demo-flow/review/ending-summary-after-desktop.webp),
   [portrait](../art/source/demo-flow/review/ending-summary-after-portrait.webp),
   [Huge phone actions](../art/source/demo-flow/review/ending-summary-after-phone-huge-actions.webp).
   The direct-ending-node capture method and geometry are retained in
   [the receipt](../art/source/demo-flow/review/ending-summary-after.receipt.json).
   Implementation and evidence belong to
   [the separate fix](coordination/handoffs/ending-summary-layout.md).

2. **Ugly, art — quarry terrain coherence remains open (#345).** Gate at
   191.3 s, cutting video 237.0 s, floor 250.3 s and Driller view 275.5 s expose
   repeated wall runs, heavy rectangular slab edges and visible joins between
   ground and structures. These spaces do not yet match the reference's composed
   quarry. [Floor](../art/source/demo-flow/review/quarry-trade-desktop-canvas-52-quarry-floor-arrival.webp)
   and [Driller](../art/source/demo-flow/review/quarry-trade-desktop-canvas-61-driller-enemy-view.webp).
   Route A paintings and integration remain gated on M1. Estimate: 1–2 art
   sessions per approved area plus registration/depth review; preserve collision
   and real traversal rather than covering them with scenery.

3. **Ugly, art — figure families remain inconsistent (#346/#347/#339).** Kaya
   and Bo's G1 figures, Nilak's legacy figure and the quarry cast differ in detail
   and proportions. Purple returnee placeholders are visible beside Dorin at
   396.4 s. [Practice](../art/source/demo-flow/review/quarry-trade-desktop-canvas-13-practice-bending.webp)
   and [homecoming](../art/source/demo-flow/review/quarry-trade-desktop-canvas-77-dorin-homecoming.webp).
   The approved recipe, figure rollout and quarry art gates still apply; #347 is
   deferred until after M3. Estimate: approved art batches, then half a day of
   import/contact checks per family. Do not silently replace these during a
   code-only review.

4. **Ugly, deferred, code — objective obscures the world (#329).** The broad
   upper-left card remains visible at village, gate and floor arrival, occupying
   space needed to read the scene. [Gate](../art/source/demo-flow/review/quarry-trade-desktop-canvas-34-quarry-gate-arrival.webp).
   In portrait custody choice at 287.2s it also covers the speaker identity and
   competes with the conversation header:
   [choice](../art/source/demo-flow/review/quarry-escort-ipad-canvas-44-ruon-custody-choice.webp).
   Its existing owner/PR #354 retains the fix; validate world conversations too.
   Estimate: 2–4 hours with text-size checks. Toast overlap is not independently
   retested by these selected stills.

5. **Ugly, deferred, code — portrait combat spends too much space on chrome
   (#330).** The header wraps and the actor card stretches beside a tall preview
   dock, shrinking the battlefield. Preserve the existing PR #355 ownership and
   validate the combined Show enemies control. At portrait 119.8s the actor card
   stretches next to the flask preview; at 451.2s the header still wraps above
   the complete boss view.
   [Preview](../art/source/demo-flow/review/quarry-escort-ipad-canvas-26-flask-aim.webp)
   and [boss](../art/source/demo-flow/review/quarry-escort-ipad-canvas-64-driller-enemy-view.webp).
   Estimate: half a day including WebKit.

6. **Ugly, deferred, code — enemy dock still presents disabled player-style
   actions (#326).** At video 125.0 s it says “Bandit: choose an action” above
   greyed Move/Club Swing/Rush while “Enemies are moving” is also shown.
   [Frame](../art/source/demo-flow/review/quarry-trade-desktop-canvas-video-125-enemy-turn.webp).
   PR #352 owns this. Estimate: 1–2 hours. The separate stale-AP-warning case is
   not reproduced by a planner-driven end turn. Camera-glide work remains with
   #327/PR #353; its pacing is not closed by this review.

7. **Ugly, art — burning oil remains a flat patch (#342).** At desktop 96.9 s,
   fire is a small orange diamond in a larger oil area; it does not read as active
   flame at normal play scale.
   [Burning flask](../art/source/demo-flow/review/quarry-trade-desktop-canvas-28-flask-burning.webp).
   Estimate: one bounded effects/art pass plus both-backend timing and normal-zoom
   review, after the relevant art direction is approved.

8. **Nit, deferred, fixture — some arrival stills precede the visible scene.**
   See the explicitly derived cutting/forest-return frames above. This is a
   capture synchronization gap, not evidence of a game loading failure. Keep the
   continuous video, correct the driver's observable route-arrival wait, and
   avoid changing gameplay or adding arbitrary sleep. Estimate: a focused driver
   adjustment and a targeted transition check.

9. **Nit, deferred, code — long speaker names split mid-word in portrait.** At
   escort 628.4s Gao's “Shopkeeper” label breaks before its final “er”. It remains
   readable but looks unfinished.
   [Gao](../art/source/demo-flow/review/quarry-escort-ipad-canvas-86-gao-homecoming.webp).
   Estimate: one hour to review speaker-column sizing and word wrapping at normal
   and Huge text without restoring truncation. Keep the existing portrait/identity
   owner involved; no fix is claimed in this batch.

10. **Ok — progression, framing and branch consequences.** Both trade and escort reach
    the Driller, all five outcome frames, the summary, westward objective and
    Dorin/Mira/Gao homecoming. Show enemies displays the complete live boss and
    health bar through normal controls before any Driller HP shortcut; Recentre
    restores the acting unit. The prop preview names the flask and its oil/fire
    consequences without coordinates. This does not close the art items above.

The failed early portrait capture made a hay bale prominent inside the flask's
broad target area. Source review found correct, distinct flask/hay assets and
positions and no proven mapping/picking error; do not file a product identity
bug from that still alone. Recheck target legibility with the portrait-layout
owner rather than claiming a speculative fix.

## Scope still open

This pass does not exercise defeat, all parties/strategies, physical devices,
Home Screen/PWA behavior or audible quality. The earlier bounded quarry route
checks cover save/reload and a cleared-boss revisit; these recordings do not add
new coverage for those checks. Required exact-head remote CI, merge and deployment
remain separate from local review. The final nine-stage local gate and integration SHA will be recorded in
`/workspace/avatarrpg-env/quarry-review-verification.md` after the fixture,
artifacts, separate CSS fix and audit are committed. This review does not replace
that gate or the required remote checks.
