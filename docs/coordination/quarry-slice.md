# Current delivery: village to quarry and back

Scope approved by Jared on 17 September 2026. This is the current release target,
ahead of the broader roadmap: a polished, continuous playable trip from Ba Dan
through the road and quarry, resolving its events and returning to the village.
No new regions are needed to prove this experience.

Jared delegates game direction, priorities, new sessions and routine checked
pushes/merges to the orchestrator. Quality includes coherent polished writing,
consistent art and animation, and a meaningful narrative and tactical identity
for every playable character. This does not require all characters in one party.

## Active ownership

Checkpoint: 18 September 2026, 07:31 UTC. Verify live state before work.
Session IDs locate conversations; PRs and Git remain the source for code status.
The original three sessions reached task usage limits and transferred ownership
with committed work preserved. Do not restart their assignments.

| Track                | Current session                        | Owned outcome / next milestone                                                   |
| -------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| Orchestration        | `01a0b2b4-1260-7551-a818-e7a85c0645f6` | Scope, integration order, version label #47 and final acceptance                 |
| Art/audio (Astra)    | `01a0b2ee-8d60-7643-be9b-340997ca4ae0` | Finish #50/#57/#58 checked integration; accepted visual evidence on #52          |
| Writing              | `01a0b2e3-170e-7bb1-b2ab-d9e45dd780a9` | Finish #49 required CI and confirm merge; narrative route evidence recorded      |
| Gameplay/integration | `01a0b300-e321-7670-aab3-f0aeaf624dc0` | Integrate sources, ready #48 kits and #52 route test, verify final combined head |

Live PR list: [jaredbahr/Avatarrpg](https://github.com/jaredbahr/Avatarrpg/pulls).
Do not infer deployment or current CI from this checkpoint.

## Delivery and remaining gates

Confirmed merged by this checkpoint: camera/movement #39, writing consolidation
#40 (including #45 continuation), bandit art/audio #41/#42, portrait corrections
#43, coordination #44, ten-hero walks #46, audio scheduling/mute fix #51,
inspector focus #53, exploration sheet markers #54, defeat wording #55 and NPC
illustrations #56. See the respective PR for exact merge/check records.

Ready source PRs still require live checks and merge confirmation: return writing
#49, Grumbler #50, crossbow #57, slinger/bruiser/quarry earthbender #58. #50/#57/#58 need
reconciliation with newly merged main. Character kits #48 have passed all six
required checks on `41f4a2d`, but remain draft pending narrative integration.
Combined route-test PR #52 remains draft until source changes are reconciled and
its final head passes required checks. The title-screen version label #47 is
not yet merged; a motion-transitions test clock race needs repair.

Use existing tested implementations; do not regenerate accepted art or create
competing implementations. Preserve optimized portraits, source credits and both
renderer/gallery registrations during merges. The six-player boss win-rate rise
was isolated to pre-kit movement behavior; no difficulty retuning is planned.
Evidence and rationale are recorded on #48.

Jared's editorial correction is in the writing guide: remove canned personification
and metaphorical punchlines such as carts "taking it personally". Humor must earn
its place through character and situation. A sincere line needs no joke. Naming is
undecided: keep the existing name until Jared revisits it.

## Evidence available before final acceptance

These are tested branch results, not a claim that every change is deployed.

- [#49 narrative acceptance](https://github.com/jaredbahr/Avatarrpg/pull/49#issuecomment-5725659955):
  all ten character contributions and all five same-element pairs reached through
  ordinary routes; actual terminal boss defeat checked. Source `634a642`; later
  main reconciliation `af45425` passed 612 local tests.
- [#48 kit handoff](https://github.com/jaredbahr/Avatarrpg/pull/48#issuecomment-5725817132):
  `41f4a2d` passed 615 tests and the complete variant balance sweep, 80 trials per
  encounter at 1/3/6 players plus discipline coverage. Matching controls show kits
  do not cause the pre-existing six-player boss win-rate increase.
- [#52 combined integration](https://github.com/jaredbahr/Avatarrpg/pull/52):
  `2ab7e50` passed 619 tests and 20 focused browser checks, including full quarry
  return on Canvas/WebGL at 1368x912 and 834x1194, combat save/reload, inspector
  focus and previews. Setup uses `app.newGame`; combat uses legal planner commands,
  without forced outcomes, teleportation or campaign-state mutation. It is not
  proof of an entirely manual touchscreen playthrough.
- Art reviewed the combined `2ab7e50` build, including additional Canvas/WebGL NPC
  map captures, accepted-source PNG identity, correct fallbacks and asset budgets
  (portraits 3.96 MB, units 3.84 MB, precache 13.98 MB). Later `9892581` changed six
  gallery helper timeout arguments only; `bb66559` reconciled main without a tree
  change. Recheck live heads before deciding whether evidence remains applicable.

## Explicit remaining limitations

Final integrated required CI, source merges, deployment confirmation and the
orchestrator's final review are still outstanding. Physical Surface/iPad testing
and actual audible listening review have not been performed; automated audio
scheduling/mute coverage and browser emulation must not be described as those.
Some NPCs intentionally still share archetypes (Dema/Mira and Sen/Gao). Optional
mercenary variants and living-riverside figures retain painter fallbacks; do not
claim universal asset replacement. Assess these against the chosen release route
without silently expanding the world or concealing visible limitations.

## Acceptance checklist

The evidence above supports provisional branch acceptance. Leave final release
checkboxes open until the integrated revision is accepted; green PRs alone do not
complete the slice.

- [ ] A normal new campaign supports departure, road events, quarry resolution
      and walking back to Ba Dan without debug tools or restarting the campaign.
- [ ] Motivation, dialogue, objectives and return acknowledgment agree with the
      chosen route and outcome. Serious scenes and humor fit each speaker.
- [ ] Optional conversations and repeated visits preserve continuity; absent or
      incapacitated characters do not speak as if present and able to participate.
- [ ] Each playable character has a documented narrative contribution and a
      useful distinctive tactical role available during this slice. Cover all ten
      across suitable parties, including same-element comparisons and small parties.
- [ ] Victory, defeat and supported alternate resolutions remain coherent; return
      visits do not replay cleared fights, duplicate rewards or strand progression.
- [ ] Save/reload during exploration, combat and the return preserves party,
      objectives, discoveries and resolved events; existing saves remain supported.
- [ ] Character identities, proportions, orientation, foot contact and walk/idle/
      attack transitions are consistent across portraits and actual route scenes.
- [ ] Elemental effects and sound have readable direction and timing. Verify mute,
      reduced motion and fallback behavior without making gameplay depend on audio.
- [ ] Real controls, movement, target previews and objectives are readable on
      Surface/iPad sizes, portrait, landscape and Large text; check both renderers.
- [ ] Required checks pass on the final integrated revision; the continuous run
      is played and visually reviewed. Any physical-device checks not performed
      are explicitly listed rather than claimed from browser emulation.

Use [the connected-world playtest](../connected-world-playtest.md) for existing
route steps and [the player-view target](../player-view-target.md) for visual
direction. Expand the existing playtest as mechanics change instead of maintaining
another competing set of navigation instructions here.

## Final acceptance evidence

Final release sign-off is not yet performed. The orchestrator records the tested commit, build/PR links,
party/seed/route, save checkpoints, device/browser/renderer settings, screenshots
or recording links, observed results and unresolved limitations. Each character's
story contribution and tactical role must be supported by concrete in-game evidence.
Complete this review before assigning broader world expansion.
