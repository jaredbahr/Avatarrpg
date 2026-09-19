# Forest discovery and crossing marker coherence

- **Updated:** 2026-09-19. Art owner transfers to root integration owner.
- **Location:** `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-forest-marker-coherence`,
  branch `codex/forest-marker-coherence`, base `82bcc78`, runtime `91b7db9`.
  The following handoff commit changes documentation only. No push, PR, CI,
  release-version bump, generation or asset budget change.
- **Outcome:** The turtle-duck discovery renders at scale 0.6 instead of the
  adult NPC multiplier 1.5. At tile zoom 96 its approximately 0.57-tile painted
  body is 33 pixels high instead of 82 (before stroke), beside a roughly
  113-pixel party adult. This specific animal key is the only NPC override;
  other discoveries and people keep their previous scale.
- **Crossing identity:** `road_depart` at `(4,4)` now uses the existing illustrated
  `unit.enemy.thug`, also used by the forest encounter marker at `(8,4)`. Both
  forest crossing markers use scale 1.25, matching the party's 121-pixel source
  body at 128 pixels per tile. `road_depart` describes somebody waiting behind
  trees; the subsequent story and default encounter identify quarry workers
  robbing travellers. The existing attacker fits that role. No Dorin duplicate,
  new character identity, dialogue or encounter roster change was introduced.
- **Cause:** `discoveryMarkers` creates NPC definitions, so all discoveries had
  inherited the human scale in `ExploreScene`. The procedural `npc.guard` key
  separately caused the green spear figure. Both rendering backends applied the
  provided scales correctly; neither needed edits.
- **Owned changes:** `src/content/maps/world.ts`, only the forest departure
  marker's sprite key; `ExploreScene.ts`, only its marker-scale import and
  render-view assignments; new pure `exploreMarkerScale.ts` and focused tests;
  local review harness/config. The render-view overlap was reported to
  `world_conversations` before editing. No HUD/guidance changes.
- **Interaction and world:** Discovery position `(2,9)`, logical target cell,
  approach/pathfinding, trigger columns, map geometry and story conditions are
  unchanged. The smaller painted marker and pip do not reduce the logical
  Inspect target. Pine dimensions and all environment artwork remain unchanged.
- **Verification:** `npm run verify` passes 810 tests in 91 files, including two
  focused marker-scale/content tests. The first typecheck found a test using
  the string `orthographic` where map definitions represent it by an omitted
  projection; the test was corrected to `undefined`, then full verify passed.
  Production build and CI were not run for this presentation-only source pass.
  Public assets are byte-for-byte unchanged; no new budget requirement.
- **Actual evidence:** `.shots/forest-markers-before/` is visible build `82bcc78`;
  `.shots/forest-markers-after/` is visible build `91b7db9`, under this worktree.
  Each contains `canvas-illustrated`, `webgl-illustrated`, `canvas-fallback` and
  `webgl-fallback`. Each case has `source-build.png`, `entry-64.png`,
  `entry-96.png`, `nest-64.png`, `nest-96.png`, `inspect.png` and `provenance.json`.
  The camera records match exactly for all four before/after pairs. All eight
  cases passed (before 22.7 seconds; after 21.4 seconds), without page exceptions.
- **Capture provenance:** Strict owned port 4259, no existing-server reuse,
  service workers blocked, Edge Chromium, 1280 by 720 viewport. Visible build
  and backend are asserted. Seed `forest-markers-review`, Sura/Riko party,
  motion enabled. The established `newGame`/`enterNode` fixture starts the forest;
  subsequent movement uses normal clicks to `(2,5)` then `(2,8)`, real wheel
  zoom and Follow party. Clicking original nest cell `(2,9)` opens
  `discover_duck_nest` in every case. No direct state or camera mutation.
- **Fallback:** The route aborts `art/units/thug.*`; provenance confirms the
  atlas JSON request was blocked. Both backends display the existing procedural
  bandit fallback and retain Inspect. This verifies failure handling, not art
  parity: the temporary procedural figure retains its different proportions.
- **Visual review:** Art inspected both backends' normal entry/nest views at
  64/96 and forced-fallback entry views. The duck is legible at the intended
  scale and the normal crossing figures use the painted human vocabulary.
  Its procedural drawing still differs from painted assets; this correction
  reduces its dominance rather than claiming complete style consistency.
  Full forest composition, tree scale and physical-device acceptance remain
  separate work. Root has been sent the exact review paths.
- **Reproduce:** Set `FNT_FOREST_REVIEW_DIR` to a fresh ignored directory and run
  `npx playwright test -c playwright.forest-markers.config.ts`. Full verification
  output is retained locally in `verify-forest-markers.local`.
- **Transfer:** Clean committed source is ready for root integration. Port 4259
  stopped automatically after capture and has no listener. No further edits
  planned; preserve the HUD owner's concurrent work when merging ExploreScene.
