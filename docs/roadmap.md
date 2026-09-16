# Roadmap: cross-device, art and animation

Four Nations Tactics runs on a Surface in landscape as an installable PWA. The
next targets are an iPad in the hand, art that fits the cel-shaded look of the
source material, and animation that makes a fight worth watching — without
giving up the pure rules core, the deterministic tests, or the balance
simulator.

Decisions this roadmap rests on live in `docs/adr/`. The art specification is
`docs/art-bible.md`. Device tiers and the manual checklist are
`docs/device-matrix.md`.

## Settled decisions

| Question          | Decision                                                                                                                                                                                  | Record                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Engine            | Stay on Pixi v8 with the hand-written Canvas 2D fallback                                                                                                                                  | `adr/0001-stay-on-pixi-v8.md`            |
| Backend parity    | Board-correctness parity mandatory, fidelity parity not                                                                                                                                   | `adr/0002-backend-parity-policy.md`      |
| Art tier          | Cel-shaded frame sheets: few key poses, motion from the animator                                                                                                                          | `adr/0003-asset-contract.md`             |
| Art source        | AI-generated against the art bible, painters remain the fallback                                                                                                                          | `art-bible.md`                           |
| Animation runtime | Evolve `src/app/animator.ts`; no tween library                                                                                                                                            | `adr/0004-animation-runtime.md`          |
| Device tiers      | Surface and iPad landscape first; portrait and desktop second; phones work but are not tuned                                                                                              | `device-matrix.md`                       |
| Presentation      | One self-hosted display face; tokens with no literal outside `:root`; a CSS backdrop and a curtain, never an async scene swap                                                             | `adr/0005-presentation-layer.md`         |
| Visual review     | `npm run gallery`: fixed beats captured from the production build on every project, published as a CI artefact and on Pages                                                               | `adr/0006-gallery-review-artefact.md`    |
| Grid              | Hidden in presentation, never removed from the rules: contours, a curved path, eased walking; a setting and High contrast bring the lines back                                            | `adr/0007-hidden-grid.md`                |
| Board atmosphere  | Height as cliff bands inside the lower tile, never shifted tiles; one decor painter for both backends; transparent clear and a wash; edge shading, vignette and ambience motes as content | `adr/0008-board-atmosphere.md`           |
| Sheet loading     | One JSON parser and one `Image` for both backends, never Pixi `Assets`; painters baked into the same sheet shape; a byte-bounded store                                                    | `adr/0003-asset-contract.md`, amended    |
| Particles         | Stateless, seeded per emitter, identical on both backends; Canvas 2D draws a bounded share rather than a flash                                                                            | `adr/0004-animation-runtime.md`, amended |
| Review            | The gallery is the review; the owner's go/no-go in `gallery.md` gates Phase 2 content on the look                                                                                         | `gallery.md`                             |

## Phases

| Phase                       | Scope                                                                                                                                                                                                                                                                                                                                                                                                                | Blocks on     | Exit criteria                                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1 Device foundation** ✅ | Pinch, wheel and pan; camera zoom and the tappable-tile rule; iPad standalone metas; portrait layout; device-resolution sprites with bounded caches; WebGL tile markers; touch tooltips; per-frame gating; `?stats=1`; WebKit iPad test projects; these documents                                                                                                                                                    | —             | CI green on Chromium and both WebKit projects; the manual iPad checklist passes                                                                                                        |
| **P Presentation** 🔶       | **P1** identity and surfaces: tokens v2, the display face, the ink-and-parchment surface system, the backdrop and its mood, the title, dialogue staged as a visual novel, scene and dialog motion. **P2** combat HUD: initiative timeline, ability glyphs, unit-panel portrait, confirm bar, log scroll. **P3** board atmosphere: ground-shader vignette and edge shading, transparent clear and the map-margin wash | A1            | Every scene reads as one designed surface at Normal and Largest text on a Surface and an iPad; no colour literal outside `:root`; e2e green on all three projects; JS budget unchanged |
| **A2 Asset contract** ✅    | `sheet` entries in the manifest with zod validation; atlas loader for both backends; the placeholder baker that renders painters into the same sheet shape; clip runtime; asset budget gate; `scripts/art/` normalise, pack, validate                                                                                                                                                                                | A1            | Every unit animates through placeholder sheets on both backends; a real test atlas swaps in with no code change                                                                        |
| **A3 Choreography** ✅      | Easing and timelines; per-event choreography (approach, wind-up, cast, projectile, impact, recoil, floater, KO); camera focus and shake; particle recipes per element as content; hit-stop and flash                                                                                                                                                                                                                 | A2            | Every existing event kind plays through the new runtime; reduce-motion and `waitForIdle` unchanged; 60 fps on an iPad                                                                  |
| **B Pilot art** 🔶          | The 17 portraits, one hero (Kaya), one enemy (bandit thug), the fire effect set; the prompt packs and the pipeline are in, generation is the owner's                                                                                                                                                                                                                                                                 | A2, art bible | Pilot assets pass `validateContent` and the QA checklist on a real iPad; regeneration rounds per hero recorded                                                                         |
| **C Full art pass**         | Remaining 9 heroes, 9 enemies, 4 NPCs, 6 props, terrain decals over the shader ground, title screen                                                                                                                                                                                                                                                                                                                  | B             | Every manifest key resolves to real art; painters stay as the fallback; asset budget holds                                                                                             |
| **D Polish**                | Audio through Web Audio with unlock on first gesture; camera work; haptics where the platform has them (not iOS)                                                                                                                                                                                                                                                                                                     | A3            | A fight reads as complete on an iPad and a Surface                                                                                                                                     |

Phase 2 content (world map, new arcs, new enemies) proceeds in parallel once
A2 has frozen the asset contract, so new enemies are authored against the
spec with placeholder painters. Portrait generation can start as soon as the
art bible is committed, in parallel with A2, because portraits use the `image`
entry kind the manifest already has.

## The look gate (2026-09-16)

No more story gets written until the owner has seen a semi-finished visual
product and said the look is the one he wants. That reordered the phases
above: the gate is about the look, so A3 (choreography) shipped before A2
(sheets), P3 (atmosphere) before P2 (the HUD), and B's prompt packs before
any generation. What shipped, each with its gallery, on PR #13:

| Slice | What it proved                                                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V0    | `npm run gallery`: the review loop (ADR 0006); real portraits render; the WebGL ground fix the first capture found                                                     |
| V6a   | Seventeen portrait prompt packs, tested for palette hexes and for franchise names                                                                                      |
| V1    | The hidden grid: contours, a curved path, eased walking, a setting (ADR 0007)                                                                                          |
| V2    | Every event choreographed; bending as data; stateless seeded particles on both backends (ADR 0004, amended)                                                            |
| V3    | Cliff bands, canopies, wall masses, pool banks, edge shading, vignette, ambience (ADR 0008)                                                                            |
| V4    | The `sheet` entry live on both backends, painters baked into it, the probe atlas, the art scripts and the asset budget (ADR 0003, amended)                             |
| V6b   | Eleven sheet prompt packs written from the reference figures; the hero portrait packs regenerated to match                                                             |
| V5    | Posed placeholder figures through the baker: every unit in every pose, each hero in the silhouette of their reference figure, the health bar above a measured headroom |
| V7    | The acting unit's portrait in the unit panel and an element glyph on every ability                                                                                     |

Decisions taken on the way, beyond the ADR rows above: the art is generated
by the owner from the prompt packs, with a full-body reference figure per
character as the image reference (nine of the ten heroes have one; Tenzo's and
the bandit's packs generate theirs first); the e2e suite runs under reduce
motion by default now that a cast plays for most of a second; XP, the rules
and `src/core/` were untouched throughout. Two things are still the owner's
to decide: the HUD colourway (the shell is dark ink; the target mockup shows
a light parchment HUD, and both exist as tokens), and whether the locked
palette moves toward the reference figures' garments (navy, maroon, mustard,
saffron) or stays as the element accent on sash, trim and effect.

After the gate: the owner's go/no-go in `gallery.md`; B's generation (Kaya
and the bandit first) through `docs/art/README.md`; painted map backdrops if
the owner wants them (a `MapDef.art` entry under the rules grid, its own
ADR); the rest of P2; then D.

## Milestone 2: from the gate to the mockup (2026-09-16)

The owner answered the gate with a target rather than a verdict: ten
full-body reference figures, two far-horizon renders (a painted temple
explore scene with a walking party, a canal-town fight) and one realistic
one, the forest road as a painting under the party with a parchment HUD,
which he called where the game will likely get. This milestone takes the
game to that picture on the same rules, the same grid and the same DOM.

| Question               | Decision                                                                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HUD colourway          | Light parchment only. The shell tokens moved to the clean mockup's set; the dark ink shell is retired (ADR 0005, amended). No setting, no second colourway. High contrast is re-derived on top of it.                  |
| Painted map backdrops  | Built now, painted by the owner from generated packs. A painting is a field on the map, drawn under the rules grid with the live surfaces over it, on both backends (ADR 0009).                                        |
| Per-ability icons      | Drawn now, generated later. An inline mark per kind of action ships as the placeholder, resolved by fx key then by what the ability does; a generated icon can replace one by key, the way a sheet replaces a painter. |
| Palette                | Stays as the accent. Element colours on sashes, trim, effects and HUD chrome; garments follow the figures. Nothing recoloured.                                                                                         |
| Element-specific forms | Recorded as the next design, not built: see below.                                                                                                                                                                     |

What shipped, each with its gallery, on the same PR:

| Slice | What it did                                                                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2.0  | The gallery's WebGL projects wait 30 s for a layout to settle (a flake on one CI runner); Tenzo's packs written from his figure, all ten in hand                                                                                                                                |
| M2.1  | The parchment shell: every token retuned, the PWA colours, High contrast re-derived, a contrast pass (ADR 0005, amended)                                                                                                                                                        |
| M2.2  | Painted map backdrops on both backends, the ground shader accumulating premultiplied coverage, decor standing down except under High contrast, the probe painting and its e2e spec, `art:map` (WebP through wasm), packs and layout images generated from the content, ADR 0009 |
| M2.3  | The HUD to the mockup: marks for every ability and control, the title plate, element rings, the framed square portrait with its badge, the ability header, the green Confirm, corner brackets, on the existing DOM with every spec contract kept                                |
| M2.4  | The aim arc: a hurled ability's flight, sampled from the projectile's own curve, drawn at aim time on both backends                                                                                                                                                             |

**The storyboard, recorded as the next design.** The owner's four-panel
board (Gather, Strike, Impact, Recover) is the choreography's wind-up,
release, impact hold and recover, which every cast already plays. What it
asks for beyond that is element-specific martial forms in the cast frames:
a fire punch, water's flowing arms, an earth stance, an air spin. That is a
sheet-contract question, not an animator one: optional clips `cast_fire`,
`cast_water`, `cast_earth`, `cast_air` (four frames each: gather, strike,
hold, recover) that the choreography picks by the ability's element when
the sheet carries them and `resolveClip` falls back to `cast` when it does
not. The costs are the clip table (`CLIP_NAMES`, `CLIP_FRAME_COUNTS`, the
fallback table, `BAKED_CLIPS`), the exhaustive `POSES` of the placeholder
rig, a pose row per element in the sheet packs, and the frame-4 hold in the
choreography. It waits on the owner's first generated sheet, so the forms
are drawn against real frames rather than the placeholders.

After this milestone: the owner's paintings through `art:map` (the forest
road first), the first sheets (Kaya and the bandit), his go/no-go against
the mockup on the device checklist, then the far-horizon renders' explore
mode (a party walk with a roster panel) as its own milestone, and D.

## Checklists

### A1 Device foundation

- [x] Gesture recogniser with pinch, wheel, drag, long press, hover; unit-tested
- [x] `Camera.zoomAt`, `fitScale`, `fitted`, `MIN_TILE_PX` rule; unit-tested
- [x] Map scenes wire zoom and pan; Recentre button; acting unit centred where the board cannot fit
- [x] Refits driven by the renderer's canvas observer and `visualViewport`; a pinch zoom survives a HUD reflow
- [x] iPad standalone metas; `-webkit-touch-callout`; portrait HUD layout
- [x] Sprites rasterised at device pixels on both backends; LRU caches
- [x] Elevation, blocked and cover markers on WebGL; `capabilities` on the backend interface
- [x] Tap-to-show tooltips on turn and status chips
- [x] Overlay memoisation; village grid built once; `?stats=1`
- [x] WebKit iPad projects; gesture spec; touchscreen taps; CI installs WebKit
- [ ] Manual iPad checklist run on a real device (`docs/device-matrix.md`)

### P Presentation

- [x] P1: tokens v2 in `base.css`; no colour, size, z-index or duration literal outside `:root`
- [x] P1: Shippori Mincho 700 Latin slice self-hosted, precached, preloaded, on every h1/h2
- [x] P1: ink-and-parchment surfaces; element header bands through `--el`
- [x] P1: backdrop with `data-scene` / `data-mood`; ambience, picked element and speaker element feed it
- [x] P1: title on the SVG wheel; dialogue staged as a visual novel
- [x] P1: curtain reveal after the synchronous swap; dialogs ease in; reduce-motion collapses both
- [x] P2: unit-panel portrait and an element glyph on every ability; 48 px holds at Largest
- [ ] P2: initiative timeline, confirm bar, log scroll (after the gate: they cost HUD height the viewport spec watches)
- [x] P3: edge shading and vignette on both backends, transparent clear and the map-margin wash; cliff bands, canopies, wall masses, pool banks, decals and ambience came with them (ADR 0008)
- [x] Screenshot pass at 1368×912, 1194×834 and 834×1194, plus Largest text and High contrast: the gallery captures every slice on all five projects (ADR 0006)

### A2 Asset contract

- [x] `AssetEntry` gains `sheet`; zod schema in `src/content/schemas.ts`; `validateContent` checks required clips, frame counts and names
- [x] `src/render/sheets/` loader: one parsed JSON plus `drawImage` on Canvas 2D and frame textures as views onto one upload on WebGL; no Pixi `Assets`
- [x] Placeholder baker paints painter poses into an in-memory atlas of the same shape, byte-bounded, at the zoom's bucket
- [x] `RenderUnit.clip`, `clipTime` and `clipFrame`; both backends pick frames from the sheet; the choreography names the frame
- [x] `scripts/art/normalise.ts`, `pack.ts`, `validate.ts` under `tsx`, sharing the runtime's layout and schema
- [x] Asset budget: 4 MB per art family, 25 MB precache (`scripts/check-asset-budget.mjs`); `workbox.globPatterns` gains `webp,json`
- [x] README "Swapping in real art" rewritten for sheets; `docs/art/README.md` is the intake
- [x] Posed placeholder figures through the baker, one pose per frame of the clip table, a silhouette per hero
- [x] Sheet prompt packs for every hero and the bandit, held to the clip table by `prompts.test.ts`

### A3 Choreography

Shipped ahead of A2 in the look-gate milestone (ADR 0004, amendment): the
gate is about the look, and the choreography needs no sheets.

- [x] `src/app/anim/easing.ts`, `timeline.ts`, `choreography.ts`
- [x] Camera shake as a nudge in the view, applied by both backends; focus waits for the gate
- [x] `src/content/fx.ts` particle and stroke recipes keyed `fx.<element>.<name>`, validated, with a family fallback per element
- [x] `MapView.emitters`; one stateless seeded sampler for both backends; Canvas 2D bounded, not flash-only
- [x] Hit-stop, flash, recoil; floater easing
- [x] Reduce-motion collapses everything; `busy()` and `finishesAt` unchanged

## Governance

- **ADRs** in `docs/adr/` for any decision that changes an engine, a contract or a budget.
- **Budgets checked in CI:** 300 KB gzipped JavaScript (`scripts/check-bundle-size.mjs`); 4 MB per art family and 25 MB precached (`scripts/check-asset-budget.mjs`); every sheet the manifest names validated against its files (`npm run art:validate`).
- **Prompt hygiene:** nothing under `docs/art` names the franchise, a character or a faction, and every hex a pack quotes is a palette value (`src/content/prompts.test.ts`).
- **Parity:** anything the rules care about is drawn on both backends (ADR 0002).
- **Determinism:** presentation randomness (particles) is seeded per instance and never touches the game RNG.
- **Art QA:** every generated asset passes the checklist in `docs/art-bible.md` before it is committed.
- **Visual review:** every slice that changes what is drawn ships with its gallery (`npm run gallery`, ADR 0006); the pictures are the review, not a description of them.
- **Device gate:** Tier 1 changes are checked on a real iPad against `docs/device-matrix.md` before a release tag.
