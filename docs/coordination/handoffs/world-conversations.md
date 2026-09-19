# World conversations handoff

- **Updated:** 2026-09-19 UTC; `/root/world_conversations`; incoming integration owner `/root`.
- **Outcome:** Bounded ordinary NPC and discovery dialogue can stay over the live exploration map, with explicit content ownership and the existing staged dialogue fallback. Scope excludes CombatScene guidance/camera, lower confirmation, new narrative text, art generation, PR publication, push, and CI dispatch.
- **Acceptance:** Exact-map world nodes retain the renderer, camera, trail, and ambience through line advances and return to exploration; world input and controls are disabled while the compact panel is active; choices keep locks and hot-seat decider labels; saved line cursors use the existing location/story fields; staged interludes remain in `DialogueScene`.
- **Location:** `C:\Users\Jared\.codex\worktrees\world-conversations`, branch `codex/world-conversations`, based on frozen PR64/source commit `dac99826d02fb770bb53213168a9c4d9c5161854`; no PR or remote push.
- **Worktree state:** Source and docs are committed locally at handoff. `node_modules` is ignored. No running process is required.
- **Completed:**
  - Added `src/content/story/presentations.ts` with explicit authored NPC metadata, generated discovery metadata, exact-map eligibility, and cross-reference validation.
  - Wired validation through `src/content/schemas.ts` and exports through `src/content/index.ts`.
  - Added `src/app/ui/ConversationPanel.ts`; `DialogueScene` delegates ordinary dialogue and choices to it, while staged interludes retain their existing playback.
  - Routed eligible dialogue through the existing `ExploreScene`, adding compact lower-map presentation, focus retention, inert controls, and handler guards.
  - Added conversation presentation tokens/styles and focused registry/routing tests in `src/content/story/presentations.test.ts`.
  - Recorded the contract in `docs/adr/0029-world-conversation-routing.md`.
- **Decisions:** Explicit `{ kind: 'world', mapId }` metadata is required; location is never inferred from speaker, portrait, or graph position. The current content reuses combat-tagged `forest_road` and `ambush_road` records for exploration, so validation treats a map as exploration-capable when the story has an `explore` node for that map.
- **Verification:** Final `npm run verify` passed at the handoff head: typecheck, lint, format check, 82 test files, and 752 tests. Focused presentation/content/discovery/return tests also passed (4 files, 42 tests). Targeted Playwright specs were attempted, but this workstation lacks the configured Chromium executable (`C:\Users\Jared\AppData\Local\ms-playwright\chromium_headless_shell-1243\chrome-headless-shell-win64\chrome-headless-shell.exe`); browser, gallery, and physical-device checks remain for integration CI/review.
- **Coordination:** Parent owns integration and overlapping CombatScene guidance/camera. Preserve PR64 pending changes and reconcile `App.ts`, `ExploreScene.ts`, and styles when integrating. Parent should review a normal NPC walk, a discovery, a choice with a locked option, a mid-line save/reload, and a staged interlude.
- **Next actions:**
  1. Review the compact panel in portrait and landscape, including focus on Next and exit/pause controls.
  2. Integrate this commit with the parent’s current branch and run combined browser/gallery checks there.
- **Completion/transfer:** Local implementation is complete and ready for integration review; ownership transfers to `/root` after this commit. No remote merge has occurred.
