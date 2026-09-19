# Ba Dan modular courtyard handoff

- **Updated:** 2026-09-19. Owner: world-conversations task; integration owner: root.
- **Worktree:** `C:/Users/Jared/.codex/worktrees/ba-dan-neighborhood`
- **Branch:** `codex/ba-dan-neighborhood`
- **Renderer commit:** `422eeac` (Canvas/Pixi partial-ground passes and shader split).
- **Contract base:** Luna's `03a559bd99e91a2c7335ea59dbccda2220beee25` is already a separate local commit; root owns its integration.
- **Integration:** root preserved this work as `e83572d` and integrated it as `74355b0`; the prior owner is stopped and release review belongs to root.
- **Preview:** local Chrome evidence used strict port `4297`; root stopped the verified preview process after integration. Frozen combined evidence is recorded in the current playthrough handoff.

Ba Dan now has a bounded modular proof slice. `BA_DAN_SCENE.groundMode` is
`partial`: the renderers paint procedural grid terrain, then local authored
ground pieces, then live water, paths, overlays, effects, and exits. The old
complete ground pages remain available as historical art but are no longer the
authority for active Ba Dan exploration. The partial scene suppresses the
full-map backdrop while retaining scene scenery and the normal map backdrop
contract for other presentations.

The courtyard proof asset is `courtyard-ground.webp`, registered at projected
`x640,y256,width1152,height576`, covering the logical `x5..15,y3..11` envelope
with transparent feathered edges. The canal uses transparent `canal-banks.webp`
at `x928,y368,width576,height288`; its bounds are derived from all six water
diamonds and its stone coping contains no water pixels. The runtime surface
shader therefore paints the six walkable `~` cells exactly once. The dry road
cell `(9,6)` has a two-depth bridge: `canal-bridge.webp` is the deck/back layer
and `canal-bridge-front.webp` is the near-rail layer. Both retain the same
schema footprint; depths `6.25` and `6.75` put actors on the deck between them.

The map keeps permanent water at `(6..8,6)` and `(10..12,6)`, with `(9,6)` as
the dry crossing. Rows 5, 7, and 8 stay open for north/south approaches. The
south market display and garden reuse existing prop art. No destination, rule,
collision, save format, camera, VillageLife, or story contract changed here.

Focused source checks pass:

- `npm run typecheck`
- `npx vitest run src/content/scenes/baDan.test.ts` (6 tests)
- `npm run build` (910 modules; entry gzip 292.69 kB in this worktree)

The latest installed-Chrome proof uses 1280×720, fresh one-player Kaya state,
Canvas and software-WebGL. Both backends completed the actual route
`(3,7) → (8,7) → (9,5) → (9,6) → (9,7)` with no page errors. Exact evidence:

- [north approach Canvas](C:/Users/Jared/.codex/worktrees/ba-dan-neighborhood/.shots/ba-dan-runtime/partial-canvas-cross-north.png)
- [bridge Canvas](C:/Users/Jared/.codex/worktrees/ba-dan-neighborhood/.shots/ba-dan-runtime/partial-canvas-cross-bridge.png)
- [south approach Canvas](C:/Users/Jared/.codex/worktrees/ba-dan-neighborhood/.shots/ba-dan-runtime/partial-canvas-cross-south.png)
- [bridge WebGL](C:/Users/Jared/.codex/worktrees/ba-dan-neighborhood/.shots/ba-dan-runtime/partial-webgl-cross-bridge.png)
- [crossing states](C:/Users/Jared/.codex/worktrees/ba-dan-neighborhood/.shots/ba-dan-runtime/bridge-crossing.json)

The separate [save/reload evidence](C:/Users/Jared/.codex/worktrees/ba-dan-neighborhood/.shots/ba-dan-runtime/save-reload.json)
exercised Save here, a real NPC conversation, return to exploration, reload,
and Load a save in both backends. It restored the saved bridge position `(9,6)`
and `village_explore` story state; conversation advanced four lines and
returned without page errors. [Conversation Canvas](C:/Users/Jared/.codex/worktrees/ba-dan-neighborhood/.shots/ba-dan-runtime/partial-canvas-conversation.png)
and [reloaded WebGL](C:/Users/Jared/.codex/worktrees/ba-dan-neighborhood/.shots/ba-dan-runtime/partial-webgl-save-reload.png)
show the retained scene. This is technical browser evidence; it is not a claim
of physical-device, listening, or final visual-quality acceptance.

The superseded water-bearing `canal.webp` was moved to the ignored local
evidence directory and is not shipped or referenced. The bridge source and
front-mask helper remain reproducible from the packed bridge through
`scripts/art/ba-dan-bridge-front.py`; the courtyard and coping are reproducible
from the reviewed material atlas with the two TypeScript art scripts. Do not
reintroduce a complete-map painting to cover the partial scene or suppress live
water to hide registration errors.

Root integrated renderer source `422eeac` as `e4369ba` and the Ba Dan source/art
as `74355b0`. Combined verification passed 860 tests and the full local Chrome
suite passed 176 cases with one environment-premise skip. The current playthrough
handoff owns subsequent water polish and release evidence. No physical-device
or final aesthetic acceptance is implied by these checks.
