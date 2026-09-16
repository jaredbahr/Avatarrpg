# Roadmap: cross-device, art, animation and the world

Four Nations Tactics runs on a Surface in landscape as an installable PWA. The
next targets are an iPad in the hand, art that fits the cel-shaded look of the
source material, animation that makes a fight worth watching, and a free-roam
world worth living in — without giving up the pure rules core, the
deterministic tests, or the balance simulator.

Decisions this roadmap rests on live in `docs/adr/`. The art specification is
`docs/art-bible.md`. Device tiers and the manual checklist are
`docs/device-matrix.md`.

## Settled decisions

| Question          | Decision                                                                                                                      | Record                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Engine            | Stay on Pixi v8 with the hand-written Canvas 2D fallback                                                                      | `adr/0001-stay-on-pixi-v8.md`       |
| Backend parity    | Board-correctness parity mandatory, fidelity parity not                                                                       | `adr/0002-backend-parity-policy.md` |
| Art tier          | Cel-shaded frame sheets: few key poses, motion from the animator                                                              | `adr/0003-asset-contract.md`        |
| Art source        | AI-generated against the art bible, painters remain the fallback                                                              | `art-bible.md`                      |
| Animation runtime | Evolve `src/app/animator.ts`; no tween library                                                                                | `adr/0004-animation-runtime.md`     |
| Device tiers      | Surface and iPad landscape first; portrait and desktop second; phones work but are not tuned                                  | `device-matrix.md`                  |
| Presentation      | One self-hosted display face; tokens with no literal outside `:root`; a CSS backdrop and a curtain, never an async scene swap | `adr/0005-presentation-layer.md`    |
| World model       | Maps own their exits; the world fires the story; the journal is derived from flags                                            | `adr/0006-free-roam-world-model.md` |
| Progression       | Hybrid: hard-gate region entry by condition, absorb ±2 levels inside a region with `difficulty.ts`                            | `adr/0006-free-roam-world-model.md` |

## Phases

| Phase                       | Scope                                                                                                                                                                                                                                                                                                                                                                                                                | Blocks on     | Exit criteria                                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1 Device foundation** ✅ | Pinch, wheel and pan; camera zoom and the tappable-tile rule; iPad standalone metas; portrait layout; device-resolution sprites with bounded caches; WebGL tile markers; touch tooltips; per-frame gating; `?stats=1`; WebKit iPad test projects; these documents                                                                                                                                                    | —             | CI green on Chromium and both WebKit projects; the manual iPad checklist passes                                                                                                        |
| **P Presentation**          | **P1** identity and surfaces: tokens v2, the display face, the ink-and-parchment surface system, the backdrop and its mood, the title, dialogue staged as a visual novel, scene and dialog motion. **P2** combat HUD: initiative timeline, ability glyphs, unit-panel portrait, confirm bar, log scroll. **P3** board atmosphere: ground-shader vignette and edge shading, transparent clear and the map-margin wash | A1            | Every scene reads as one designed surface at Normal and Largest text on a Surface and an iPad; no colour literal outside `:root`; e2e green on all three projects; JS budget unchanged |
| **A2 Asset contract**       | `sheet` entries in the manifest with zod validation; atlas loader for both backends; the placeholder baker that renders painters into the same sheet shape; clip runtime; asset budget gate; `scripts/art/` normalise, pack, validate                                                                                                                                                                                | A1            | Every unit animates through placeholder sheets on both backends; a real test atlas swaps in with no code change                                                                        |
| **A3 Choreography**         | Easing and timelines; per-event choreography (approach, wind-up, cast, projectile, impact, recoil, floater, KO); camera focus and shake; particle recipes per element as content; hit-stop and flash                                                                                                                                                                                                                 | A2            | Every existing event kind plays through the new runtime; reduce-motion and `waitForIdle` unchanged; 60 fps on an iPad                                                                  |
| **B Pilot art**             | The 17 portraits, one hero (Kaya), one enemy (bandit thug), the fire effect set                                                                                                                                                                                                                                                                                                                                      | A2, art bible | Pilot assets pass `validateContent` and the QA checklist on a real iPad; regeneration rounds per hero recorded                                                                         |
| **C Full art pass**         | Remaining 9 heroes, 9 enemies, 4 NPCs, 6 props, terrain decals over the shader ground, title screen                                                                                                                                                                                                                                                                                                                  | B             | Every manifest key resolves to real art; painters stay as the fallback; asset budget holds                                                                                             |
| **D Polish**                | Audio through Web Audio with unlock on first gesture; camera work; haptics where the platform has them (not iOS)                                                                                                                                                                                                                                                                                                     | A3            | A fight reads as complete on an iPad and a Surface                                                                                                                                     |
| **W1 World topology**       | `MapDef.exits` with `requires` and `lockedHint`; regions and their level bands; `location.world` memory and the save migration; `progression.test.ts` rewritten over the region graph                                                                                                                                                                                                                                | —             | Two maps connect both ways; a refused exit says why; a round trip restores the return position; the region test is green                                                               |
| **W2 Free roam**            | `StoryState.nodeId: null` as the ordinary wandering state; leaving a node returns to the world; the explore HUD stops assuming an objective                                                                                                                                                                                                                                                                          | W1            | The party can wander with nothing active, talk to anyone, and leave a conversation back onto the map                                                                                   |
| **W3 Triggers**             | `MapDef.triggers` (node and encounter kinds, `when`, `once`); `location.world.fired` and `cleared`; `startBattle` loses its story-graph search                                                                                                                                                                                                                                                                       | W2            | A tile fires a scene once and never again; a place-owned fight can be walked into and stays cleared                                                                                    |
| **W4 Journal**              | `src/content/quests.ts` — stages and their completion `Condition`; the journal as a projection over flags; a journal panel in the HUD                                                                                                                                                                                                                                                                                | W2            | Quest state exists in exactly one place; the panel reads correctly after a save round trip                                                                                             |
| **W5 First region**         | One region authored end to end against the new shape: its maps, exits, NPCs, triggers, encounters and dialogue, split as `src/content/story/<region>.ts`                                                                                                                                                                                                                                                             | W3, W4        | The region is genuinely explorable for an hour without a story node driving; what the authoring format still needs is written down                                                     |
| **W6 World at scale**       | Remaining regions; `validateContent` world-graph checks; region content split; fast travel decided with the map in front of us                                                                                                                                                                                                                                                                                       | W5            | Every region reachable under some sequence of conditions; no region enterable below its band on any route                                                                              |

Phase W runs in parallel with the art phases and blocks on neither: the
inversion it makes touches `src/core/story/`, `location` and the content
schemas, and `src/core/rules/` not at all, so combat, the balance simulator and
the art pipeline are all unaffected by it. The one ordering rule is that
**W1 lands before any region content is authored** — `progression.test.ts` is
rewritten there, and content written against the old single-exit shape would
have to be rewritten with it.

New enemies and arcs are authored against the frozen asset contract once A2
lands, with placeholder painters. Portrait generation can start as soon as the
art bible is committed, in parallel with A2, because portraits use the `image`
entry kind the manifest already has.

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
- [ ] P2: initiative timeline, ability glyph sprite, unit-panel portrait, confirm bar, log scroll; 48 px holds at Largest
- [ ] P3: ground-shader vignette and edge shading (WebGL), vignette only on Canvas 2D; transparent clear and `.map-wrap` wash (ADR)
- [ ] Screenshot pass at 1368×912, 1194×834 and 834×1194, plus Largest text and High contrast, before each slice merges

### A2 Asset contract

- [ ] `AssetEntry` gains `sheet`; zod schema in `src/content/schemas.ts`; `validateContent` checks required clips
- [ ] `src/render/sheets/` loader: Pixi `Assets` for WebGL, parsed JSON plus `drawImage` for Canvas 2D
- [ ] Placeholder baker paints painter poses into an in-memory atlas of the same shape
- [ ] `RenderUnit.clip` and `clipTime`; both backends pick frames from the sheet
- [ ] `scripts/art/normalise.mjs`, `pack.mjs`, `validate.mjs`
- [ ] Asset budget: 4 MB per scene bundle, 25 MB precache; `workbox.globPatterns` gains `webp,json`
- [ ] README "Swapping in real art" rewritten for sheets

### A3 Choreography

- [ ] `src/app/anim/easing.ts`, `timeline.ts`, `choreography.ts`
- [ ] Camera tracks (focus, shake) applied by the scene per frame
- [ ] `src/content/fx.ts` particle recipes keyed `fx.<element>.<name>`, validated
- [ ] `MapView.emitters`; seeded particle simulation in the Pixi backend; flash-only on Canvas 2D
- [ ] Hit-stop, flash, recoil; floater easing
- [ ] Reduce-motion collapses everything; `busy()` and `finishesAt` unchanged

### W Free-roam world

- [ ] W1: `MapDef.exits` with `toMapId`, `toPos`, `requires`, `lockedHint`; `MapDef.exit` removed
- [ ] W1: regions with `minLevel` / `maxLevel`; region membership on every map
- [ ] W1: `GameState.location.world` (`returnPos`, `fired`, `cleared`) **and its zod schema in `serialize.ts`, same commit**
- [ ] W1: save version bump and migration for the old single-exit shape
- [ ] W1: `progression.test.ts` rewritten over the region graph — bands, not points; no global "pick option N" index
- [ ] W2: `StoryState.nodeId: null` as the ordinary state; explore HUD without a mandatory objective
- [ ] W3: `MapDef.triggers`; `once` honoured across a save; `startBattle` loses the story-graph search
- [ ] W4: `src/content/quests.ts`; journal derived from flags, never stored; journal panel at Largest text
- [ ] W5: one region authored end to end; authoring-format findings written down
- [ ] W6: `validateContent` world-graph checks — exits resolve, triggers resolve, every region reachable, none enterable below its band
- [ ] Screenshot pass per region at 1368×912, 1194×834 and 834×1194

## Governance

- **ADRs** in `docs/adr/` for any decision that changes an engine, a contract or a budget.
- **Budgets checked in CI:** 300 KB gzipped JavaScript (`scripts/check-bundle-size.mjs`); asset budgets arrive with A2.
- **Parity:** anything the rules care about is drawn on both backends (ADR 0002).
- **Determinism:** presentation randomness (particles) is seeded per instance and never touches the game RNG.
- **Art QA:** every generated asset passes the checklist in `docs/art-bible.md` before it is committed.
- **Device gate:** Tier 1 changes are checked on a real iPad against `docs/device-matrix.md` before a release tag.
- **World gate:** a new region ships with its `validateContent` checks green — every exit resolves, every trigger resolves, the region is reachable, and no route enters it below its band (ADR 0006).
- **Save schema:** a field added to `GameState` or `BattleState` lands in the zod schema in `src/core/save/serialize.ts` in the same commit. There is no follow-up commit for this.
