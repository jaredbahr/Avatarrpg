# World conversations handoff

- **Updated:** 2026-09-19 UTC; `/root/world_conversations`; incoming integration owner `/root`.
- **Outcome:** Bounded ordinary NPC and discovery dialogue can stay over the live exploration map, with explicit content ownership and the existing staged dialogue fallback. Scope excludes CombatScene guidance/camera, lower confirmation, new narrative text, art generation, PR publication, push, and CI dispatch.
- **Acceptance:** Exact-map world nodes retain the renderer, camera, trail, and ambience through line advances and return to exploration; world input and controls are disabled while the compact panel is active; choices keep locks and hot-seat decider labels; saved line cursors use the existing location/story fields; staged interludes remain in `DialogueScene`.
- **Location:** `C:\Users\Jared\.codex\worktrees\world-conversations`, branch `codex/world-conversations`, based on frozen PR64/source commit `dac99826d02fb770bb53213168a9c4d9c5161854`; no PR or remote push.
- **Worktree state:** Follow-up source, test, and documentation edits are committed locally at this handoff head. The temporary installed-Chrome Playwright config and evidence spec were removed before handoff. `node_modules` is ignored. No running process is required.
- **Completed:**
  - Added `src/content/story/presentations.ts` with explicit authored NPC metadata, generated discovery metadata, exact-map eligibility, and cross-reference validation.
  - Wired validation through `src/content/schemas.ts` and exports through `src/content/index.ts`.
  - Added `src/app/ui/ConversationPanel.ts`; `DialogueScene` delegates ordinary dialogue and choices to it, while staged interludes retain their existing playback.
  - Routed eligible dialogue through the existing `ExploreScene`, adding compact lower-map presentation, focus retention, inert controls, and handler guards.
  - Kept ordinary queued walks intact during non-conversation syncs; entering conversation clears intent once, and entering/exiting the panel moves focus to a usable control.
  - Removed the unreachable duplicate ordinary dialogue/choice panel implementation from `DialogueScene`; malformed states retain a bounded loading fallback while staged interlude playback stays unchanged.
  - Added conversation presentation tokens/styles and focused registry/routing tests in `src/content/story/presentations.test.ts`.
  - Recorded the contract in `docs/adr/0030-world-conversation-routing.md`.
- **Decisions:** Explicit `{ kind: 'world', mapId }` metadata is required; location is never inferred from speaker, portrait, or graph position. The current content reuses combat-tagged `forest_road` and `ambush_road` records for exploration, so validation treats a map as exploration-capable when the story has an `explore` node for that map.
- **Verification:** Final local `npm run verify` passed typecheck, lint, format check, 82 test files, and 752 tests. The follow-up installed-Chrome run passed the retained-world lifecycle probe (same ExploreScene/canvas/renderer/camera, focus entry/exit, and disposal on staged transition) plus the focused dialogue, portrait/reload, discovery, and exploration specs: 18 tests passed after correcting the mismatched-map fallback expectation, with the huge-text focus case included. A retained-world screenshot is at `C:\Users\Jared\.codex\visualizations\2026\09\19\01a0b79f-a1e6-7fd0-a4d5-76e7944406f6\world-conversation-retained.png`. Gallery and physical-device checks remain for integration review.
- **Coordination:** Parent owns integration and overlapping CombatScene guidance/camera. Preserve PR64 pending changes and reconcile `App.ts`, `ExploreScene.ts`, and styles when integrating. Parent should review a normal NPC walk, a discovery, a choice with a locked option, a mid-line save/reload, and a staged interlude.
- **Next actions:**
  1. Integrate this commit with the parent’s current branch and run combined browser/gallery checks there.
  2. Preserve the ADR number `0030` when reconciling the documentation branch.
- **Completion/transfer:** Local implementation is complete and ready for integration review; ownership transfers to `/root` after this commit. No remote merge has occurred.

## Accepted exploration dock follow-up

- **Source:** `b39d8def8a411a86f105217cb916c81bc823d808` on branch `codex/world-overflow`, worktree `C:\Users\Jared\.codex\worktrees\world-overflow`, based on combined source `baa87cb`.
- **Evidence:** Installed Chrome at 1280x720 shows the exploration dock without false horizontal/vertical overflow. The six-member, portrait, Huge-text, follow-party, and resize exploration dock checks passed 6/6. Contextual Mira dialogue retained the ExploreScene/canvas, focused the conversation panel on entry, and restored focus to the first enabled HUD action on return.
- **Verification:** `npm run verify` passed 87 test files and 793 tests. Screenshot: `C:\Users\Jared\.codex\visualizations\2026\09\19\01a0b79f-a1e6-7fd0-a4d5-76e7944406f6\explore-overflow-1280x720-after.png`.
- **Transfer:** Source is accepted for integration by `/root`; no push, PR, or CI run was performed. The worktree is clean and the owned local capture server is stopped.

## CI E2E repair audit

- **Source:** `codex/ci-e2e-repair` in `C:\Users\Jared\.codex\worktrees\ci-e2e-repair`, based on combined `92b0c8a`; no push, PR, rerun, or gallery change.
- **CI evidence:** Job `105848850505` from PR64 run `35424656782` failed at `playthrough.spec.ts:275`: the `.confirm-bar` containing `Confirm` never became visible after the target click. The same log marked `world.spec.ts:30` flaky because `Leave preview` detached on 111 click retries.
- **iPad reproduction:** Installed Chrome mobile emulation at 1194x834 CSS px, DPR 2, own preview port 4267. The target was `e1` at `(5,4)`; projection returned `(885,625.72)`, while `.map-canvas` was `y=154.11..617.22`. `elementFromPoint` was the action bar and no canvas pointer events arrived. After compact framing, tile size was 64px and the same target projected to `(789,474.18)` inside the canvas; pointer down/up/click arrived and the preview Confirm control enabled.
- **Source fixes:** `ExploreScene` records `hudMoving` before the Riverside controls early return, preventing per-frame HUD replacement while the animator is busy. `CombatScene` performs one post-HUD measurement in `sync`, reserves the full compact decision dock, and permits the first settled short idle layout to select 64px while preserving manual zoom/pan and stable tall 96px framing.
- **Focused checks:** Installed-Chrome production checks passed the new Riverside close-during-walk regression, the original Riverside round trip, iPad-landscape playthrough target preview, and all six `combat-pan-reflow` framing/zoom/resize checks. WebKit was unavailable locally; the Chrome mobile run isolates the geometry and input cause. Full local verify remains for the final tracked revision.
