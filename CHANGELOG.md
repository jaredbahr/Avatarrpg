# Changelog

## 0.2.11 — release candidate

- Paint the quarry floor's oil pools and mud patch on their own ground. The
  ground generator left every **dynamic** cell transparent, so the Driller
  floor's four spills and one mud patch were procedural slate standing beside
  illustrated stone, tile square and all. Oil (`o`) now packs into the **stone**
  page and mud (`m`) into **dirt**, exactly as rubble (`r`) already did, and only
  water (`~`) keeps its transparent hole because its bed is authored with the
  liquid. Repacking moved `stone.webp` 39,100 → 50,252 B and
  `dirt-{east,west}.webp` 28,026 → 33,068 B and 31,990 → 33,922 B; the Cutting
  has no spill cell and keeps its bytes. Against a frame captured from 0.2.10,
  the quarry floor moves 4.572% of pixels on Canvas `-fit` (52,916 up / 4,119
  down) and 4.912% on WebGL `-fit`, overwhelmingly lighter, while the village,
  road, gate and cutting frames stay inside animation-timing noise.
- Paint the two bare village lawns from accepted material. The 0.2.10 palette
  step matched the fields' tone but carried no texture, and two fields had no
  plate over them at all — south-west `x1..4,y10..14` and north-east
  `x18..22,y1..5`. They are now two regions beside the four existing courts in
  `scripts/art/ba-dan-neighborhood-ground.ts`, assembled by the same packer from
  the same verified opaque source interiors with the same 0.4-cell exterior
  feather, each overlapping its neighbours by two or more cells so two feathers
  cannot leave a band between pieces. Two plates ship,
  `northeast-lawn-ground.webp` (1024×512, 36.5 KB) and
  `southwest-lawn-ground.webp` (832×416, 24.4 KB); the map family goes
  820 KB → 881 KB and precache 17.62 → 17.67 MB of 25 MB, and re-running the
  packer leaves the four existing plates byte-identical. Village cells with no
  opaque plate fall 144 → 86, the south-west field 20/20 bare → 0/20 and the
  north-east 25/25 → 0/25; the remaining 86 are the deliberate rim rows and tree
  columns. On the review fixture the default village view moves 9.753% of pixels
  on Canvas and 10.558% on WebGL, all of them up in luminance and onto green.
- Lift the procedural road and paving tones into the illustrated family. Push
  the exposed rim and apron bands against light illustrated paving and the
  mismatch was 1.95x on stone and 2.06x in the east road-band window. `road`
  `#5b5044/#4a4036/#6b6053` → `#776f5d/#665f4f/#877f6c` and `stone`
  `#565452/#434140/#666461` → `#8a8880/#77756e/#9a988f`, mirrored into the WebGL
  terrain colours at the Canvas values, plus the four apron bands that carry the
  road or paving reach. Re-measured, the window step is 1.65x and stone 1.61x.
  The blast radius is the fallback the plates do not own, and every moved pixel
  moves toward its board: at tile scale every terrain centre on the authored
  board is unchanged except one stone cell that moves 100.9 → 101.9. The
  decision to keep the change global rather than add a village-only key is
  recorded with the per-board table in
  `docs/coordination/handoffs/village-paving-tone.md`.
- Give the gallery's playback settle a per-project budget. The iPad-WebGL
  software rasteriser can spend seconds on a single 2x frame, and `waitForIdle`
  was the last wait in that path still on a fixed 20 s while `settleTimeout`
  already carried 60 s and the curtain 30 s. `waitForIdle` now takes a timeout,
  `Stage.idleTimeout` is `max(20_000, settleTimeout)` — 60 s on WebGL, 20 s on
  Canvas — and the gallery beats pass it; specs outside the gallery keep the
  20 s default. A timeout still fails and now names which way the budget was
  wrong: `N ms of playback left`, or `no frame reached the end of playback`.
- Pin that a load settles and the route survives it. The schema tests hold what
  a blob contains, but nothing held what a **load** does to a run, and every
  load runs the load-time discipline repair — so a repair that granted or
  recomputed something on every read would have let a reloading player watch
  their numbers drift. `src/core/save/continuity.test.ts` now loads the save of
  a loaded save across a mid-battle state, the walk home at both custody
  outcomes and a party at the discipline gate with no pick taken — the one
  fixture the repair actually rewrites — and asserts it is the run that was
  saved. The same file then asks the route question rather than the field
  question: the same objective, Gao offering the same scene for the outcome that
  was saved, and Mira remembering the same decisions. Verified by making
  `reconcileDisciplines` ignore its `alreadyOffered` guard, which fails the
  gated fixture with a second pending pick and passes once the guard is back.
- Still open and deliberately not claimed: no played browser save route, so the
  continuity test is a unit-level property and not a session saved, reloaded and
  walked through by hand; no visual acceptance against the approved references,
  only the fixture frames and the per-board tables above; and no device or
  listening evidence — physical iPad and Surface touch, pinch, rotation and PWA
  behaviour are untested, and the audio has not been listened to on hardware.

## 0.2.10 — release candidate

- Keep a partial scene's ground on screen. 0.2.9 shipped each apron as twelve
  band plates, which took Ba Dan from 16 distinct scene images to 27 and the
  forest road from 10 to 21 — over the sixteen-entry LRU that caches them. A
  partial scene paints its authored ground only when every ground and scenery
  piece is resident at once, so both scenes fell back to the procedural board
  permanently, and re-decoded their evicted pieces every frame while they did.
  The cap is now 32 and named `SCENE_IMAGE_CAP`, and `scene.test.ts` holds every
  partial scene under it, so content that splits another piece fails the suite
  instead of silently deleting the village. Decoded cost stays modest: the
  village's 27 pieces are 22.9 MB against the ~35 MB a quarry scene already
  keeps resident. No rendering path changed.
- Lift the procedural grass the illustrated ground is drawn over into the
  family the art is painted in. The cells still carried the legacy board tone
  `#41552f` (`#425730` once shaded) against an authored lawn measured at
  `#8d9557`: a 1.79x luminance step along long, straight seams inside the Ba Dan
  board, where the south-west and north-east fields met the plaza. Every
  authored source in the game — the legacy complete paintings, the ground
  plates, the approved player-view reference — already uses a light grass, so
  the cell tone was the outlier and the cell tone moved: `#7d8850` fill,
  `#717a40` edge, `#95a060` detail, mirrored into the WebGL terrain shader at
  the same value so the two backends still agree. The same fixture re-measured
  on this build puts the step at 1.19x on Canvas and 1.24x on WebGL.
- The village's exterior apron is cut again from the new tone, because it
  paints the procedural grass outward past the rim; the forest apron mirrors
  the forest's own authored pixels and is untouched. Nothing else inside a
  board moved: no rule, collision, save, camera or content change.
- Still open and deliberately not claimed: the road and paving side of the same
  step (`TERRAIN_STYLES.road`/`stone` are still the legacy tones, so the apron's
  road band at the east exit remains a dark band), and the two bare fields are
  still flatter than the plates — the tone matches, the texture does not.

## 0.2.9 — release candidate

- Ship each scene's outer apron as twelve bands instead of one plate. The plate
  was the ring's axis-aligned bounding box — 3200 px for the village and 2688 px
  for the forest road, over the 2048×2048 ceiling `docs/device-matrix.md`
  promises every iPad in the family takes. 84.8% of the village plate's texels
  and 83.3% of the forest plate's were fully clear, and a software-WebGL
  screenshot pays to read back the whole plate. The bands are cut from the same
  pixels the plate held, so the ground past every rim looks unchanged.
- The bands are ordinary ground pieces in each scene's table, taken from the
  board's own oblique lattice, so no rendering path is special-cased and a band
  can never exceed the texture ceiling. The scene's ground bound rises 12 -> 32
  to make room for a ring that cannot be one piece under the cap.
- Bytes fall slightly with the overdraw: the village apron 30.3 KB -> 27.8 KB
  and the forest road 166 KB -> 162 KB. Nothing inside a board changed.

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

## 0.2.8 — release candidate

- Carry every scene's own ground past its edge instead of letting the board meet
  the bare page along one diagonal. Ba Dan, the forest road and the quarry gate
  all had ground that stopped at the rim they were painted to cover: the village
  grass, plaza paving and western road, the pine road's banks and both of its
  ends, and the gatehouse terrace now continue outward and dissolve before the
  camera can follow them.
- Each apron is made from its own scene's material rather than a generic fill.
  The forest road and the quarry gate continue the exact authored pixels they
  were already drawn with, so the road leaves the board as road and the terrace
  as terrace; the village apron is painted in the colours its procedural cells
  use, then ramps into grain and recession.
- Nothing inside a board changed. Every apron plate is transparent wherever the
  board can be walked, so paths, cover, water, elevation and collision play
  exactly as before, and both renderers agree about it.

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
