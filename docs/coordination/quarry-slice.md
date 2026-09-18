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

Initial assignment snapshot: 18 September 2026 UTC. Verify live state before work.
Session IDs locate conversations; PRs and Git remain the source for code status.

| Track                 | Session                                | Owned outcome / next milestone                                                 |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| Orchestration         | `01a0b2b4-1260-7551-a818-e7a85c0645f6` | Scope, coordination docs, integration order and final acceptance               |
| Art and audio (Astra) | `01a0b291-2f6f-75a2-a93c-312f80543200` | Consistent party art, directional walks and sound; reconcile asset PRs #41–43  |
| Writing               | `01a0b294-82fd-7f02-9b91-303660f2ca1a` | Integrate overlapping #38/#40; coherent departure, quarry and return responses |
| Gameplay/integration  | `01a0b293-318a-7603-bd56-5b87e944054e` | Finish #39; playable return, objectives and distinct early character kits      |

No PR in this table is claimed merged. Live PR list:
[jaredbahr/Avatarrpg](https://github.com/jaredbahr/Avatarrpg/pulls).

## Known gaps at the initial audit

- Gameplay reports the quarry ending currently reaches a terminal end node with
  Save/Replay/Title only, blocking a playable return despite reciprocal map exits.
  Gameplay owns generic continuation and navigation; writing owns the epilogue
  link, return objective and NPC responses. Reuse existing story flags where valid.
- Gameplay reports same-element pairs share their early abilities, leaving some
  signature roles unavailable during this slice. Audit and differentiate early
  kits with progression/balance evidence; do not change biographies concurrently.
- Writing is consolidating two overlapping prose PRs, preserving functional
  speaker-availability tests and useful continuity changes from both.
- Art is developing side-walk frames and checking anatomy/identity against the
  portrait corrections. A successful asset import alone is not visual acceptance.

These are reported findings, not a complete audit or claims of implemented fixes.
Task owners provide tested evidence; the orchestrator updates this record at
milestones and removes resolved gaps with links to the resolving PRs.

## Acceptance checklist

Every item starts unverified. Record evidence before checking it off; green PRs
alone do not complete the slice.

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

Not yet performed. The orchestrator records the tested commit, build/PR links,
party/seed/route, save checkpoints, device/browser/renderer settings, screenshots
or recording links, observed results and unresolved limitations. Each character's
story contribution and tactical role must be supported by concrete in-game evidence.
Complete this review before assigning broader world expansion.
