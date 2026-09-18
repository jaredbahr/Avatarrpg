# Current delivery: village to quarry and back

Scope approved by Jared on 17 September 2026: a polished, continuous playable
trip from Ba Dan through the road and quarry, resolving its events and returning
to the village. No new regions are needed to prove this experience.

**Delivery checkpoint: 18 September 2026, 10:55 UTC. Implemented, checked and
game-content deployed; ready for Jared's playtest, with the device and listening
limits below.** This is a completed source record, not a live task queue. Verify
current GitHub state before starting follow-up work.

Jared delegates game direction, priorities, new sessions and routine checked
pushes/merges to the orchestrator. Quality includes coherent writing, consistent
art and animation, and meaningful narrative and tactical identities for all ten
playable characters across suitable parties. Broader world expansion remains a
separate decision after this slice's playtest.

## Completed source delivery

All slice source PRs through #58 and the final combined route-test PR #52 are
merged. The former active assignments are complete; do not restart them from
older handoff snapshots. Preserved worktrees and PR histories retain their work.

| Track                             | Completed sources                                                                                                                 | Delivery owner                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Camera, controls and presentation | #39 camera/movement, #43 portraits, #47 title version, #53 inspector focus, #54 exploration sheet markers                         | Orchestrator `01a0b2b4-1260-7551-a818-e7a85c0645f6` and source owners |
| Writing and homecoming            | #40 writing consolidation, #45 continuation, #49 return narrative, #55 defeat wording                                             | Writing `01a0b2e3-170e-7bb1-b2ab-d9e45dd780a9` and gameplay           |
| Art and audio                     | #41/#42 bandit art/audio, #46 ten-hero walks, #50 Grumbler, #51 audio scheduling/mute, #56 NPCs, #57 crossbow, #58 quarry enemies | Art/audio `01a0b2ee-8d60-7643-be9b-340997ca4ae0`                      |
| Kits and combined route           | #48 early character kits, #52 permanent trade/escort return test                                                                  | Gameplay/integration `01a0b300-e321-7670-aab3-f0aeaf624dc0`           |
| Coordination                      | #44 coordination rules, #59 checkpoint                                                                                            | Orchestrator                                                          |

[PR #52 final handoff](https://github.com/jaredbahr/Avatarrpg/pull/52#issuecomment-5728669149)
confirms merge `c486457d60017c31eed482363b65c40b6956fead` from final head
`8e840814a6bf8af84860b2964615917ede4477d8`. Fresh local verification passed
619 tests in 66 files, typecheck, lint and formatting. All six latest-head CI
jobs passed: the push and PR runs of typecheck/lint/unit tests, Chromium touch /
WebKit iPad end-to-end tests, and screenshot gallery. No outstanding reviews
remained. See [PR CI](https://github.com/jaredbahr/Avatarrpg/actions/runs/35330845545)
and [push CI](https://github.com/jaredbahr/Avatarrpg/actions/runs/35330844216).

## Deployed game content

[Pages deployment 35330420108](https://github.com/jaredbahr/Avatarrpg/actions/runs/35330420108)
succeeded for `6420e33fb2626005c2f3a0742fc9c04614c03f3a`. The orchestrator's
[fresh-network check at 10:55 UTC](https://github.com/jaredbahr/Avatarrpg/pull/52#issuecomment-5728993778)
used installed Chrome at 390x844 on the [live game](https://jaredbahr.github.io/Avatarrpg/)
and visibly confirmed `v0.1.0 · build 6420e33`. Service workers were blocked;
this confirms served content, not that an existing cached PWA has updated.

The later #52 merge `c486457` differs from `6420e33` solely by the 322-line
`e2e/quarry-return.spec.ts`; there is no game-content or asset difference.
[Deployment 35334403673](https://github.com/jaredbahr/Avatarrpg/actions/runs/35334403673)
for that merge was still running at this checkpoint. The orchestrator owns its
final deployment confirmation. Game-content delivery does not depend on treating
that pending deployment as successful.

## Acceptance evidence

- [Eight complete route checks](https://github.com/jaredbahr/Avatarrpg/pull/52#issuecomment-5726921940)
  passed on `f34e2c9`: trade and escort, Canvas and WebGL, desktop 1368x912 and
  portrait 834x1194 touch Chrome. Both quarry and Ba Dan save/reload, custody
  responses after loading, walking home and revisiting the quarry without
  repeated boss encounters or XP passed. Trade uses Kaya/Nilak/Bo with seed
  `quarry-return-campaign`; escort uses Kaya/Nilak/Bo/Tenzo/Lin Mei/Nima with seed
  `quarry-return-escort`. The [route handoff](https://github.com/jaredbahr/Avatarrpg/pull/52#issuecomment-5726898274)
  records the earlier real defeats and the test-driver correction to use legal
  actions after movement. Campaign setup uses `app.newGame`, normal reachable
  routes and legal planner combat commands, without forced outcomes, teleportation
  or campaign-state mutation. These are automated runs, not manual touch playthroughs.
- [Final reconciliation](https://github.com/jaredbahr/Avatarrpg/pull/52#issuecomment-5728198703)
  verified product, asset and route-test identity against `f34e2c9`, preserving
  the eight-route evidence on final head `8e84081`. The permanent test is merged.
- [Narrative acceptance](https://github.com/jaredbahr/Avatarrpg/pull/49#issuecomment-5725659955)
  reached all ten character contributions and all five same-element pairs through
  ordinary routes on `634a642`; an actual boss defeat reached the terminal ending.
  Branch conditions cover absent or incapacitated speakers and optional visits.
  Return writing merged in [#49](https://github.com/jaredbahr/Avatarrpg/pull/49)
  as `a5c74a0`; later combined route checks cover both custody outcomes.
- [Kit acceptance](https://github.com/jaredbahr/Avatarrpg/pull/48#issuecomment-5725817132)
  records `41f4a2d` passing 615 tests and the complete variant balance sweep,
  80 trials per encounter at 1/3/6 players plus discipline coverage. Matching
  controls isolated the pre-existing six-player boss win-rate increase from the
  kit changes; no difficulty retuning was required. All-ten usefulness rests on
  actual narrative-route evidence plus content/simulator checks and selected-party
  browser runs, not ten manually played combat campaigns.
- [Combined visual acceptance](https://github.com/jaredbahr/Avatarrpg/pull/52#issuecomment-5726183792)
  on `2ab7e50` verified accepted enemy/NPC PNG identity, merged sheet/fallback
  routing and audio source identity. Art inspected actual Canvas/WebGL village
  departure and cutting NPC scenes, reusing reviewed source motion and portrait
  captures alongside the gameplay owner's 20 combined route/UI checks. Fresh
  build, art validation and budgets passed: portraits 3.96 MB, units 3.84 MB,
  precache 13.98 MB. Subsequent gallery allowance propagation changed no product
  or assertions; final reconciliation preserved the accepted content.
- [Combined gameplay checks](https://github.com/jaredbahr/Avatarrpg/pull/52#issuecomment-5726126727)
  include combat save/reload, inspector focus and target previews on desktop and
  portrait. Existing save serialization/migration and local-save coverage passed
  in final verification. Browser/device-size coverage and visual evidence support
  this delivery without substituting for physical-device review.

Jared's editorial correction remains in [the writing guide](../writing-guide.md):
remove canned personification and metaphorical punchlines such as carts "taking
it personally". Humor comes from character and situation; a sincere line needs no
joke. The public post-Korra interval remains unspecified. Keep the existing game
name until Jared revisits naming.

## Remaining limitations and playtest scope

- Physical Surface and iPad testing has not been performed. Browser emulation,
  CI WebKit and the live Chrome viewport check do not establish actual touch,
  pinch, rotation, performance or Home Screen/PWA behavior on those devices.
- Actual audible listening review has not been performed. Audio scheduling/mute
  tests and source review do not establish listening quality, balance or timing
  as heard on hardware. Reduced-motion/fallback coverage is not a listening test.
- Some NPCs intentionally share archetypes: Dema/Mira and Sen/Gao; road guards
  remain generic. Optional deserter/blade/sergeant variants and living-riverside
  figures retain painter fallbacks. See [NPC art scope](../art/npc-idles.md).
  Universal asset replacement is not claimed.
- Automated route success does not guarantee that every party or strategy wins.
  All-ten character evidence has the scope described above. Jared's subjective
  playtest, physical-device checks and listening review remain open.

Use [the connected-world playtest](../connected-world-playtest.md) for route steps,
[the device matrix](../device-matrix.md) for hardware checks and
[the player-view target](../player-view-target.md) for visual direction. Record
new findings with the displayed build, party/seed/route, browser/device/renderer,
save checkpoint and observed result. Preserve this accepted slice and its bounded
limitations when deciding follow-up work; do not silently expand the world.
