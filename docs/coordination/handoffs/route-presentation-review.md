# Route presentation review at b0fbc8b

Lead review, 19 September 2026 UTC. Source: successful CI gallery artifact
10574883948 from run 35412143302, PR #64 head `b0fbc8b`. Retained locally under
`gallery/release-b0fbc8b/` in the lead worktree. These are staged screenshots,
not a continuous campaign or motion/listening review.

Compared with all three approved player-view references. Source inspection of
`src/content/maps/combat.ts` confirms the Cutting and quarry floor still use
orthographic backdrops while village, forest and gate opt into oblique scenes.
The discontinuity below is product content, not solely a gallery fixture.

| View                                            | Observed gap                                                                                                                                                                                              | Required correction and evidence                                                                                                                                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `surface-canvas/36-player-view-exploration.png` | Adult characters and the compact dock are useful progress. Broad empty lawn and repeated paving dominate; settlement detail is peripheral.                                                                | Review the normal walk through the village before adding content. Compose existing conversations, shop and paths as a inhabited neighborhood, preserving collision and reachability.                                                            |
| `surface-canvas/21b-ambush-road.png`            | The Cutting switches to a distant orthographic arena. Small painted heroes and large simple guard figures disagree in scale/style. Rectangular water and repeated border rocks remain visually schematic. | Convert this existing encounter to the shared oblique scene contract, with registered ground, cover and walls. Review at actual default play zoom, real movement/target selection and return traversal.                                         |
| `surface-canvas/21c-quarry-floor.png`           | Driller encounter switches to another distant orthographic arena. Boss is visually small; dark square terrain patches and isolated blocks dominate an otherwise empty floor.                              | Author a coherent quarry working floor using the same projection and visual system. Preserve boss occupied cells, ledges, oil, mud, props and actual rule readability. Review boss approach, legal environmental interactions, defeat and exit. |

Priority after the v0.2.0 checkpoint: resolve the bounded gate foreground-depth
issue, then finish Cutting and quarry floor as the next coherent environment
batch. Do not spend successive releases polishing only gate walls while the
climactic encounter retains a different presentation system. Reuse established
projection, picking, depth and scene contracts; keep architecture changes bounded
to a demonstrated need. Gate completion and these maps remain unfinished.

Acceptance requires both backend renders, portrait controls and actual traversal
through these spaces, not just source atlas inspection. Water/oil/mud must remain
truthful live state; detail cannot paint a false path, resource or cover location.
Normal/reduced-motion combat, save/reload and all required latest-head CI remain
part of the final combined release review. This report does not accept audio,
device behavior, motion, balance or whole-route completion.

## Normal-input local check

Lead used the in-app browser at 1280x720 on the existing port4200 preview,
displayed `v0.1.0 / 5d5952f-modified`, on 19 September UTC. This is an older
local composition, not the frozen PR64 revision. Normal New game selected one
player named Route review, waterbending, Sura; advanced all three opening beats;
entered Ba Dan; used Look around / Visit Gao; walked into his four-line dialogue;
returned to exploration; saved empty Slot1; reloaded and Continued. The UI
reported Game loaded with Sura26/26 near Gao and the same Mira objective.
This establishes that bounded normal-input save continuation, not a whole route.

Concrete findings assigned for the next batch:

- Setup recommends soaking before a fire attack, although Wet halves fire.
  Writing owner `01a0b2e3-170e-7bb1-b2ab-d9e45dd780a9`, clean checkpoint9d743bf,
  was recalled as Luna Medium to correct factual onboarding text against rules.
- Mira is offscreen at arrival. Look around initially offers only Gao; Local
  map shows indistinguishable gold people markers without names or objective
  identification. Gameplay owns accessible map-state-derived named guidance
  using normal pathfinding, with no teleport or duplicate objective logic.
- A single-member exploration roster has unnecessary horizontal and vertical
  scrollbars at Normal text/1280x720 despite ample dock width. Gameplay will
  inspect intrinsic overflow while preserving larger-party/large-text access.

The opening illustration and narration advance coherently in this sample.
Ordinary dialogue replaces the world with a mostly empty parchment screen;
retain this as a presentation concern for later combined review, not a claim
that the dialogue or speaker portrait failed to load. No listening took place.

Independent deployed title check initially showed cached148843f; one normal
reload showed `v0.1.0 / 44ed3f6`. This is browser reload evidence only, not a
physical PWA update test. PR64 remains separate pending fresh exact-head CI.

## Review capability and source correction checkpoint

An explicit tool attempt to listen to a 15-second WAV excerpt from the existing
`moving-38815cf/webgl/audio.webm` returned: "audio content omitted because you do
not support audio input". Therefore this session cannot provide actual listening
acceptance. No sound-quality conclusion was inferred from the waveform, file,
or tool call. Final listening needs a capable reviewer on the final recorded mix;
it stays open while implementation and visual verification continue.

Gameplay source `3c133a1` is held for corrections: display-string parsing should
not decide objective routing; conditional NPC visibility must remain shared;
solo overflow must not clip portrait/large text; and tests must exercise real
walking and visible controls rather than only asserting CSS properties. The
source remains separate from frozen PR64.

Art source scaffolding was clean at `bf2fd6e` before explicit escalation to
Terra High for full-scene registration/packing after unsuitable generic-atlas
approaches. Lead-created ground candidates and registration limits are in
`docs/art/cutting-driller-ground-source.md`. These are not shipped assets.

## Forest continuation and repair review

The same normal-input Sura run continued through all four Mira lines, walked
the east exit, read Dema's three lines and both pine-road introduction beats,
then approached the quarry workers and entered the forest ambush at 26/26 HP.
The old preview retained the Mira objective after her conversation. Gameplay's
separate `b954428` correction uses existing visited state and structured target
metadata; final post-dialogue copy and save/reload coverage remain under review.
The forest NPC/art mixture and blurry ground remain visible presentation debt.

In combat, the Water Whip tooltip still said "Set up the firebender." Writing
is auditing related factual ability/help text for the next batch. Focusing the
enemy through initiative worked, as did zooming out, previewing and confirming
a four-point move, and ending the turn with the two-tap unused-AP warning.
This is partial normal-input route evidence on the old preview, not acceptance
of the release head, complete combat, motion or audio.

Lead reviewed CI repair `fda0c2b`: five composited pixel probes and their
thresholds remain; 7x7 CSS-pixel captures replace expensive full-canvas reads.
The scoped WebGL slow allowance is backed by retained CI timing traces.
Release owner applied it as PR64 head `dac99826d02fb770bb53213168a9c4d9c5161854`
after local verification; all required checks on that head are still required.

Art checkpoint `616baab` provides unreferenced registered ground pages. Root
inspected Cutting west and Driller east; these still need assembled scene
review with upright cliffs. Flat footprint guides were returned for individual
projected-height silhouettes and extraction bounds before painted cliff work.

## Normal-input ambush completion

The same Sura run won the solo forest bruiser encounter in round 3 using legal
movement and six Water Whip actions, ending without taking damage. The aftermath
dialogue identified the attackers as quarry workers, returned to free roaming,
advanced Sura to level 2 with 30/30 health, and changed the objective to the open
east road. Saving into previously empty Slot 2 reported Game saved and listed
the level-2 forest checkpoint. This remains the older port4200 composition,
not PR64 acceptance or a balanced-party/fun verdict.

Repeated attack targeting exposed manual camera loss: zooming out to see both
actors was undone when confirmation changed the HUD height. Independent source
review confirmed the same defect in PR64: CombatScene conflates fitted scale
with absence of manual camera intent, then refits to 96px on HUD resize.
Gameplay owns a separate next-batch fix and scene-level gesture regression.

The combat-depth audit found substantial existing tactical rules but missing
prop/displacement outcomes in confirmation. A separate isolated combat-preview
agent owns shared rule-backed forecasts and the lower confirmation UI; gameplay
owns only the camera methods in the same file. Art is preparing exterior-rim
guides because tall scenery over walkable A/^ terrace cells would contradict
the current actor elevation lift. Writing is implementing concise return
discovery variants; chronology review keeps recovery gradual and consistent
with the existing Dema and Sen conversations. None of these sources is shipped.

## Quarry gate save continuation

Normal input continued from the forest through the optional nest's three lines
and walked the east route to the quarry gate. The watch marker was reached by
walking the visible open lane. Sura's party had the open approach available;
fire/earth approaches displayed their unavailable-party explanations. Choosing
the open approach entered the gate fight with Sura level 2, 30/30 HP, Water
Whip and Ice Path, against the solo-scaled Fire Nation Deserter at 27/27 HP.

Saved round 1 into previously empty Slot 3, reloaded the page, chose Load a save
and Slot 3. The UI reported Game loaded and restored round 1, those health
values, four AP and four movement points. The reload again identified the old
local build as `v0.1.0 / 5d5952f-modified`; final-release continuation is not yet
verified. Gate ground remains oversized/blurred and its watch marker remains
a generic painter figure, both visible presentation debt.

The first restored fight displayed its HUD but a blank battlefield. Browser
errors requested `webworkerAll-Cx1EEp_b.js`, while the shared preview's rebuilt
dist contained `webworkerAll-CyP8CGPP.js` and a different main bundle. A fresh
reload followed by Continue restored the visible battlefield and Sura with the
same saved health, turn and actions. This supports a preview rebuild/cache
mismatch, not a demonstrated save-state defect. Owners were told to keep the
port4200 build stable during review. Manual zoom still resets when movement
confirmation changes HUD height; the pending camera repair remains required.

Lead reviewed art checkpoint `20959a5` using both full assemblies built from
registered runtime ground pages. Exterior cliff registration and full bounds
are accepted for the next runtime integration review. Final packaging must
remove any remaining guide-colored fringe and preserve the recorded transforms,
playable-diamond exclusion and asset budgets. Actual actor/prop scale, both
renderers and final scene composition remain unaccepted until tested in game.
