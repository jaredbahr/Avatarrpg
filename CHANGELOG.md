# Changelog

## 0.2.7 — release candidate

- Let standing water show what it sits on. The forest pond's bank now wanders
  inside its own water cells instead of tracing the rules' eight-cell cross, and
  the water carries the forest floor beneath it, darkened and cooled with depth,
  so the pond reads as shallow silt at the edge and deeper water in the middle
  rather than a flat teal field. The village canal gets the same treatment from
  the village's own paving, under a kerb dressed toward grey with a wet band at
  the waterline.
- Plant the pond's bank. Three low reed fringes, cut and feathered from the
  flood-bank reeds the road already uses, stand on the cells that touch the
  water, so the waterline carries growth instead of meeting the road as a bare
  edge. They are passable scenery: no wall, no collision and no ground disk.

## 0.2.6 — release candidate

- Ground props and figures instead of leaving them on a hard dark rim. The
  shared contact shadow is now a feathered pool that fades to nothing at its
  edge and dips a hair down-screen the way the board's ledge shadows fall, and
  a prop drawn from art measures its own base so the shadow's soft edge shows
  past the art that stands on it. Barn crates, stone piles, the quarry cart and
  the road rubble all sit in the ground rather than on a stamped ellipse.

## 0.2.5 — release candidate

- Let a pool of oil, mud or rubble fade at its bank instead of stopping on the
  tiles that hold it. The wash now thins over a ragged outline, the bank and
  the rim wander with it and the material gathers unevenly along the edge, on
  both renderers, so a spill reads as something poured on the quarry floor
  rather than a filled rectangle. The hazard still covers every tile it really
  covers; only the painted outline is softened.

## 0.2.4 — release candidate

- Join ground materials where they meet instead of ending each one on a bare
  line: the neighbouring material bleeds into the tile in a ragged wedge, so
  the pine road runs out under the grass, paving is edged with laid chips, dirt
  leaves a mud rim and the quarry floor keeps grit where it meets stone. The
  join is drawn from the rules grid over the authored ground as well, so it
  lands where the materials really meet rather than only where a picture was
  painted.
- Treat standing water as a material of its own. A pond now keeps a sandy bank,
  bank stones and reeds where it meets dry ground and leaves a wet rim on the
  bank, which breaks the tile-shaped outline the water used to have, on both
  renderers.

## 0.2.3 — release candidate

- Paint water on the Canvas 2D backend as a film with a soft shore, quiet drift
  and a flow line instead of one flat opaque fill, and drop the bright rim that
  made a pond, canal or puddle read as a filled polygon. WebGL already looked
  like this; the two backends now agree about the same water.
- Read quarry oil as a slate-green film rather than a hole: a lighter body and a
  stronger sage sheen on both backends, with the surface outline that marks the
  hazard cells unchanged.

## 0.2.2 — release candidate

- Compose Forest Road from local road, grass and dry-bank regions while preserving live water, scenery and gameplay geometry.
- Replace Quarry Gate's complete ground pages with registered material regions and remove visible seams between them.
- Give the battlefield more room with compact initiative chips on short landscape screens at normal text size.
- Let followers finish walking to dry, unoccupied places during village conversations instead of stopping on canal water.
- Preserve elevated terrain and live-surface layering across scene changes and High Contrast toggles.
- Extend the village with the remaining integrated local material regions across its approaches and courts.
- Build modular ground for the Cutting and Driller routes, including the quarry's connected material composition.
- Add the reviewed six-cell forest raised shelves with preserved playable exit space and procedural fallback.
- Replace the forest nest icon with a small illustrated family and borrowed sock, keeping the discovery and its story intact.
- Time battlefield health bars and fallen states to hit, healing and knockout feedback rather than revealing damage while an attack is still travelling.
- Show the abandoned nest, flattened reeds and dried silt beside the forest pond as an environmental clue.

Shipped as v0.2.2: PR64 merged as `5403473`, its required checks passed on the
exact head and the Pages deployment published a build that shows
`v0.2.2 · build 5403473`. Combined local route and browser checks pass on their
recorded checkpoints. This does not establish final visual, audio or device
acceptance.

## 0.2.1 — unshipped changes included in 0.2.2

- Match Ruon, blade mercenaries and sergeants to the party's adult scale with illustrated poses and distinct walking contacts.
- Build Ba Dan's courtyard from local ground and scenery, with a crossable bridge, runtime canal water, and actor occlusion through the bridge; both renderers retain procedural fallback when scene art is unavailable.
- Omit unused development validation and Pixi atlas initialization to retain the 300 KiB JavaScript budget.
- Give the Cutting and Driller floor connected stone surroundings, grounded terraces, quarry cover and save-compatible wall art, while keeping mud, oil, ice and props live.
- Make water whips flow as ribbons with restrained droplets and a clearer waterskin draw, preserving attack contact and timing.
- Keep nearby combatants readable on short screens, preserve manual camera framing, and make surface confirmations more compact without hiding costs or chances.
- Forecast actual healing, surface contact, prop reactions and displacement. Healing Stream now works on its caster and previews only the health that can be restored.
- Preserve support AP granted before an ally's turn, show possible enemy attack reach during movement planning, and disable player action buttons during enemy turns.
- Keep the explored world visible during conversations, return keyboard focus to local actions, and remove unnecessary exploration-dock scrollbars.
- Add the Riverside dock and seated tea interaction, including the sip activity and return to walking.
- Clarify route guidance, quarry discoveries and the village homecoming; show the rescue scene's matching illustration.

Local verification includes both trade and escort campaign returns with save/reload.
The normal solo route has also been played through the Driller and homecoming.
Current-head remote checks and deployment remain pending. Listening quality and
physical Surface/iPad behavior remain unverified; this is not full-target signoff.

## 0.2.0 — unshipped changes included in 0.2.1

- Add registered oblique Forest Road and Quarry Gate scenes, including a connected western gatehouse with shared cutaway and missing-art fallback.
- Keep combat targets readable through unit focus, retained manual pan and resize redraw; align health bars and elemental effects with visible actors.
- Refine elemental release/contact timing and bounded fire/earth audio recipes while preserving combat rules, saves, credits and renderer fallbacks.
- Keep dialogue portraits visible on mobile and short screens, with headers naming the resolved speaker.
- Slow ordinary combat walking and align its steps to distance traveled.
- Preserve the title's commit build identifier alongside the version for reports.

These changes are included in the combined 0.2.1 candidate above. The later
quarry composition and water motion corrections supersede those earlier gaps;
listening review, physical Surface/iPad validation and full reference-target
acceptance remain open.

## 0.1.0

Existing live baseline at build `44ed3f6`: playable village–quarry–return route and calibrated Ba Dan courtyard.
