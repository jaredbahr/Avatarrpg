# Finish the complete run through the Driller

Jared's latest scope is the opening through the Driller encounter, its outcome,
and the return to Ba Dan. Every part must feel finished. He authorizes planning,
implementation, technical decisions and releases without routine approval.
Conserve usage by working in bounded batches with existing owners. This plan
supersedes any interpretation that one polished scene completes the assignment.

The three images in `assets/reference/player-view-2026-09-17/` and
[player-view-target](../player-view-target.md) govern presentation. Causeway is
a visual reference, not another destination to build. DOS2 is inspiration for
roaming, tactical choices and environmental interactions, not a commitment to
copy its campaign, assets or every mechanic.

## Delivery sequence

1. **Make v0.2.0 available for play.** Gameplay owns PR #64. Reproduce and repair
   the failing browser/gallery families together, retain their meaningful
   assertions, validate once, and push one batch. Require all checks on that
   exact head, merge with a merge commit, and confirm the version actually
   served by Pages. Keep the build hash beside the release number. v0.2.0 is
   an interim release, not reference-quality completion.
2. **Close the technology decision before further renderer expansion.** Review
   what the shipped candidate still cannot deliver reliably. Prefer the current
   stack when the remaining work is art, choreography or content. An engine
   experiment is justified only by a specific demonstrated limitation. If
   justified, reuse one existing scene, character and action in a bounded Godot
   proof; compare actual mobile loading, picking, collision, animation, audio,
   authoring effort and reuse cost. Do not build a second campaign or migrate
   on an attractive screenshot alone. Record a stay/migrate decision and its
   evidence. No engine experiment is required merely because an engine exists.
3. **Complete the route's environments as one visual system.** Art owns source
   material; gameplay owns registration, depth and interaction. Finish the gate's
   connected structures and terrain transitions, then the existing cutting and
   floor. Retain the reviewed village/forest improvements and fix remaining
   scale, repeated texture and icon/guard/prop mismatches. Judge each at actual
   play zoom before extending its technique. Preserve honest traversable paths,
   cover, water, oil and live props. No new regions.
4. **Finish material combat and movement across the playable roster.** Use the
   existing recorded actions to identify remaining defects before adding frames.
   Resolve water sourcing/flexible motion, grounded earth lift and body contact,
   melee contact, knockback timing, turn/stop transitions and the Driller's
   footprint/telegraphs/reactions. Keep actions readable with multiple characters,
   normal/reduced motion and both renderer backends. Preserve distinct kits and
   the rules behind previews.
5. **Finish sound and character presentation.** Review an actual recorded mix
   covering roaming, conversation, a normal encounter and the Driller. Assess
   ambience, footsteps, material identity, impact weight and transitions through
   actual listening; signal levels and cue timestamps alone cannot pass this
   requirement. Keep listening unavailable if it has not occurred. Complete
   speaker identity/portrait gaps, including shared NPC art where misleading,
   and preserve the accepted writing and branch facts.
6. **Run final release acceptance, repair findings, then ship.** Use a normal
   new game and a continued save through the entire route and return. Test the
   actual deployed version after CI and merge. Keep outstanding quality gaps
   explicit until resolved; do not turn them into exclusions to declare success.

## Evidence required for completion

| Requirement | Evidence that can close it |
| --- | --- |
| Whole-route visual coherence | Build-identified gameplay from village, road, gate, cutting, floor, Driller and return, compared with the approved references; no unfinished area hidden by selective framing. |
| Open roaming and truthful terrain | Actual input walks at apparent entrances, walls, water, cover, elevations and exits, with map-state agreement and reachable conversations. Include both renderers and portrait controls. |
| Fun environmental tactics | Actual legal play demonstrates useful elemental/environmental interactions and their costs/consequences, including live props and the Driller fight. Record opportunities that are unclear or tactically pointless and improve them. Passing a damage calculation is insufficient. |
| Character importance | Each playable character has a coherent story contribution and a distinct useful tactical role across this run; preserve existing branch/kit evidence and review it against the final build. |
| Motion and contact | Walk/turn/stop and cast/travel/impact/reaction/recovery sequences, including forced movement, multi-cell boss and reduced motion; no foot sliding, unexplained snap, blank frame or misleading attachment. |
| Sound quality | Actual listening notes tied to a build and recorded scene, plus timing/mute/lifecycle checks. No fabricated listening signoff. |
| Story and portraits | Normal mobile/landscape dialogue, resolved speaker identity, readable choices, consequence/return scenes and consistent portraits without rewriting accepted story arbitrarily. |
| Touch and accessibility | Real target selection, focus, pan, zoom, cancel and confirm; large-text narrow screens retain reachable controls and a usable map. Automated browser emulation and physical-device evidence are labeled separately. |
| Save and continuity | Fresh/continued routes, quarry and home reload, both custody outcomes, no duplicate rewards/fights and coherent Driller win/loss aftermath. |
| Release integrity | Exact-head required CI, preserved source/credits, merge commit, successful Pages deployment and observed title version; changelog distinguishes shipped features from known gaps. |

## Ownership and usage discipline

Gameplay/integration: `01a0b300-e321-7670-aab3-f0aeaf624dc0`.
Art/animation/audio: `01a0b2ee-8d60-7643-be9b-340997ca4ae0`.
The orchestrator owns this plan, priorities and cross-track acceptance. Writing
is recalled only for a concrete uncovered narrative/presentation defect.

Before a batch, name its result and evidence. After it, preserve source commits,
the exact tested head, remaining gaps and the next action. Do not repeatedly run
full suites or galleries for unchanged content. Do not trigger CI for a handoff
alone when it can accompany the next necessary revision. Failed required checks
are diagnosed rather than bypassed; obsolete runs can be canceled after a
necessary replacement has been established. No new agent or wider workstream
without a specific need that existing owners cannot efficiently handle.

Current authoritative implementation evidence is the PR and
[live candidate review](handoffs/live-candidate-review.md), including its linked
source reviews. Their bounded passes do not close the completion table above.
