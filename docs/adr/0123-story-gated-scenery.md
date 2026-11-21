# ADR 0123: Story-gated scenery on the top-down boards

**Status:** proposed, 2026-11-20. Builds on ADR 0104 (the top-down boards, their shadows baked into the plates), ADR
0112 (what a save remembers) and ADR 0103 (grounding).

## Context

A top-down board bakes every piece that lies flat (a bedroll, a cold fire) into its ground plate, and every standing
piece's cast and contact line with it; only the upright art is drawn at run time. So the plate is the board as it was
on the day it was baked, whatever the story has done since.

SF-2.3 ("The bridge toll", #927) needs the river road to change with the fight. Before it, the guards' pole is down
across the bridge and their camp stands beside the road. After a win, the pole is up and the camp is gone. After
Carry on, the pole is up and one sack of cabbages sits by the cold fire. The kit has every piece (`toll_bar_diag`,
`toll_bar_up`, `cabbage_sack`), but the board had no way to show one piece and hide another by the story. A later
region will want the same: a market stall gone after a fire, a bridge rebuilt, a camp struck.

## Decision

### 1. A map names its gates, and a scene piece names its gate

- `MapDef.sceneGates?: Record<string, Condition>`: each gate is a name and the condition it holds under. It is
  content data, so the zod schema validates it, `validateContent` cross-references it (a `visited` node must exist),
  and it can be described back to a player like any other condition.
- `TopDownObject.gate?: string` in a layout, and `SceneImage.gate?: string` in the shipped scene, on both ground
  images and scenery. A piece without a gate is always drawn, so every board that has none is unchanged.

The scene carries a gate's name, not its condition, so the runtime scene schema (`topdownSceneSchema.ts`, on
`src/core/schema.ts`) needs only a string and no recursive condition schema. Pieces that come and go together share
one name, which is also how the baker groups them.

### 2. The renderer never reads the story

`sceneForStory(map, state)` (`src/app/world/sceneGates.ts`) hands the renderer the map's scene with every piece whose
gate does not hold left out. Both the explore scene and the combat scene call it where they build the view. It
returns the same object while no gate changes, so the renderer's caches keyed on the scene stay warm. A piece naming
a gate its map does not define is never drawn, and a test refuses it in a shipped scene. Both backends draw whatever
scene they are handed, ground images in order and scenery by depth, so neither changed.

### 3. A gated piece is never baked into the plate; its ground ships as an overlay

The baker grounds only the always-there pieces into `ground.webp`. For each gate it bakes the plate again with that
gate's pieces added, in layout order. Every pixel that differs from the plate without them is kept, whole and
opaque, as that gate's overlay: its flat art, its cast, its contact line and the grass it presses.

All the gates' overlays share one atlas, `overlays.webp`. In `scene.json` each overlay is a ground image, laid over
the plate while its gate holds. A gated standing piece's upright goes into the board's own upright atlas as usual,
with its gate.

The plate plus an overlay is the plate that piece would have been baked into, so a gated piece is grounded exactly as
a baked one is. On the river road, the plate with the `camp` and `pole_down` overlays laid on it was byte for byte the
plate shipped before this ADR. It now differs only where the owner's "almost everything gets a shadow" (2026-11-21) gave
the camp's packs, fire ring and rubbish their contact and cast (`TopDownObject.grounded`).

### 4. What the checks hold

- **A gated piece is never solid.** The rows are fixed, so blocking cannot follow the story. A piece that comes and
  goes can never be what blocks a cell, and its deck carries no way over water (`validateTopDownLayout`). The camp's
  crates on the river road stand on blocked `F` cells, so they stay in every state.
- **Every state is checked.** The board checks of `pack-ground.test.ts` cover the seat, the contact, the cast, the 25%
  shadow floor and the halo. They run on every combination of a board's gates, through `bakedWith(baked, gates)`.
- **Overlays that can show together must not touch.** Each overlay is cut against the plate without the others, so
  two that touch are right only apart. Where two gates' overlay pixels touch, their conditions must never both hold.
  The check enumerates every truth assignment of the leaves they read, which is conservative.
- **Saves.** A `visited` condition in `sceneGates` is a reader like any other, so its scene is in `LATE_SCENES` (ADR
  0112). The river road's two are `open`: no release had SF-2.3.

## Consequences

- Set dressing can follow the story on any top-down board whose baker lays overlays. Today that is the RG-02 baker
  (`boards/rg02.ts`); another baker adopts it by grounding its gated pieces the same way, through `Overlay` and
  `bakedWith` in `lib/board.ts`.
- Each gate costs one overlay in the atlas: the pixels its pieces change, 3.5 KB for the river road's four.
- A combat board does not need gates for its own fight. The river road's bridge crop shows the toll as it stands,
  with the camp and the lowered pole always there.
- Blocking that follows the story (a wall that falls, a gate that opens) is still out of scope. It needs the rows to
  change, which is a rules question and not a dressing one.
