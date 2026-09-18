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
