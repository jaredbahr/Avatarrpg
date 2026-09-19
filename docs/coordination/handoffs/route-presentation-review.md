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
## Solo gate loss and continuation

Sura moved four points onto the rear plank and banked AP. The deserter advanced
and cast Fire Blast twice for 10 and 12 damage; Burning dealt another 3 at
turn start, leaving Sura at 5/30. A three-point approach and five Water Whips
dealt 7, 6, 6, miss, and 7, leaving the deserter at 1/27. Sura then lost.
The loss continued through retreat, the opened gate and Ruon's surrender.
Level 3 offered Healing Stream or Water Pull; choosing Healing Stream and
escorting Ruon returned to gate exploration at 34/34 with an east-cutting
objective. This is normal-input evidence for one loss branch, not proof that
the encounter is balanced across solo kits.

An independent PR64 legal-command probe found the plank at (5,3) exposed to
movement plus splash while the preceding bare tile (4,3) was safe for all 64
sampled first turns. The next-turn Water Whip counterattack won 57/64 before
another enemy turn; seven remained active. This justifies clearer threat
information before considering numerical changes. A separate 16-seed all-ten
AI screening flagged Air/non-bender solo weakness for deeper strategy review;
AI wins alone are not player balance acceptance. The audit owner preserves
the reproducible scope and follow-up evidence separately.

The same run walked east into the Cutting, visited Sen and inspected the tea
station through normal controls. Both three-line conversations returned to
roaming; the east exit correctly remained locked until Jin's confrontation.
Walking to the visible mercenary began the escort fight: Sura level 3 at 34/34,
Ruon at 48/48 and two mercenaries at 37/37. Healing Stream is available. The
autosave lists the Cutting checkpoint; Slots 1–3 remain the earlier village,
forest and pre-gate-fight saves. Review continues from round 1 in browser tab 2.

PR64's completed E2E job `105835253927` failed after 30.2 minutes with 112 tests
passed and 223 not run. The reported case is forced-WebGL target visibility at
the desktop lower edge, timing out during an eight-step mouse drag in both
attempts. The release owner is inspecting the completed job log and trace
artifact `10577653136` before a coherent local repair; no restart was requested.
The gallery was still running at this checkpoint. This is a release blocker,
not a passing route or deployment claim.

## Cutting victory and Driller arrival

The normal-input escort run won the Cutting in round 3. Ruon advanced, gave
Sura Inspired and damaged the second mercenary. Sura used Water Whip, then
Healing Stream on Ruon: the forecast showed +15 HP and the result changed
30/48 to 45/48. Sura finished at 34/34. Inspecting and cancelling Ice Path
showed its actual diagonal line missing the selected mercenary; no AP was
spent. Healing targets still use the same red highlight as attacks, a visual
clarity issue to revisit with the combined presentation.

The victory dialogue returned to exploration and opened East → Quarry Floor.
Normal walking reached the floor and then the machine. The authored quarry
interlude played through its three beats, followed by the barred-gallery
narration. The fight opened as Grumbler round 1: solo Sura level 3, 34/34 HP,
Water Whip / Ice Path / Healing Stream, versus Grumbler at 54/54 HP. Browser
tab 2 now holds this checkpoint; the build remains the old port4200 composition.

Release repair review caught and corrected double-counted canvas offsets in
the synthetic setup drag before accepting `c08ebb9`. The updated test asserts
actual camera movement and lower-edge target placement while retaining real
target taps and decision assertions. Exact release head `0c04719` includes its
handoff and passed local verification. CI run `35421799207` is active; obsolete
`35419645940` and intermediate `35421724476` are cancelled. No latest-head CI,
merge or deployment success is claimed yet.

## Driller self-heal failure

The same normal-input run reached round 2 with Sura at 23/34 after one
11-damage Debris Throw. Water Whip dealt 3 damage to the armored Grumbler
(51/54 remaining). Ice Path painted four tiles across the mud and applied
Chilled; it did not freeze or immobilize the boss.

Healing Stream allowed Sura to select herself and confirm, spent 2 AP and
started its cooldown, but left her at 23/34. The log reported only the cast.
This contrasts with the earlier successful 15-HP heal on Ruon. Source review
found the generic recipient filter excluding the caster unless the ability
uses a self-shaped target. The combat-preview owner is correcting shared
resolution/forecast recipient rules and adding self-heal/cleanse regressions.
The browser remains paused at this failure; boss completion is not claimed.
Resume from the Driller checkpoint on the combined corrected preview.

## Corrected preview and normal-input retest

Local branch `codex/route-review-preview` at `57187d4` combines PR64,
guidance/camera, combat forecasts, caster healing, pending support AP, movement
threats and the corrected Driller/return copy. It passed `npm run verify`
(784 tests / 85 files), build, and three focused Chrome touch checks for prop
confirmation, movement threats and fitted-camera reflow. It remains local;
these checks do not establish required CI or deployed release acceptance.

Port 4200 was deliberately transferred from the old southwest preview to this
build. After the cached worker updated and a second reload, the title visibly
showed `v0.2.1-preview.1 · build 57187d4`. The existing Driller autosave loaded
normally, preserving the earlier route and slots. Sura again approached and
took 11 damage; the movement confirmation had warned that Grumbler could hit
there. Healing Stream on Sura now changed 23/34 to 34/34 and logged 11 healed.
The forecast still showed +15 and generic 'Clears effects' with none present;
the preview owner is correcting those remaining outcome-label inaccuracies.

After moving into the boss's row, Water Whip dealt 3 damage. Ice Path crossed
the mud into its front occupied cell and actually applied Chilled, reducing
Grumbler's next movement allowance to 2. The confirmation incorrectly said
'Nobody in the area' because surface-only effects yielded no direct target
entry. This is now a separately reproduced preview finding. The run continues
in round 2 with Sura at full health and Grumbler at 51/54.

Gameplay's `Avatar RPG-combined-0.2.1` worktree is the sole final integration
owner. Root's preview is frozen for this saved-run review; no duplicate PR or
CI is authorized. World conversations and final Cutting/Driller scene opt-in
belong in that final integration, not in another root release branch.

Round 3 checkpoint: Grumbler moved around the ice and used Churn the Ground
and Oil Spray; Sura stayed at 34/34. Slot 2 now preserves this mid-battle state
(replacing the earlier forest test save), with Grumbler at 51/54. Slot 1 remains
the village, Slot 3 the pre-gate fight, and autosave the Driller entry. The game
is paused in its Save game dialog. The log floods with one line per painted
tile during Churn; aggregation is a remaining readability improvement, not a
new rules defect.

## Integrated Driller victory and saved continuity

The normal run exported its round-3 state through Save game and imported it
into the sole combined preview on port 4210, initially `829e9f3` / v0.2.1.
This brings the same solo Sura route into the registered oblique Cutting and
Driller scenes and retained-world conversation implementation. No campaign
state or battle outcome was injected. The export is the local Downloads file
`four-nations-tactics-lv3-2026-09-19.json`.

The imported state had Sura 34/34, Grumbler 41/54, 1 AP and 4 movement.
Moving through mud spent the movement and applied Rooted. Banking the AP,
taking the next attack, then saving produced port 4210 Slot 1: round 4,
Sura 23/34, Grumbler 41/54, 5 AP. An unexpected development-server refresh
returned to title; normal Load restored this checkpoint correctly.

Self-healing worked repeatedly. Round 4 healed 11 and three Water Whips
reduced Grumbler to 25/54, including a 9-damage critical. Rounds 5 and 6
used healing plus two Whips each; the machine pushed Sura back and repainted
the floor. Round 7 began at Sura 9/34 and Grumbler 10/54. Four Whips
(4, miss, 4, lethal) won through normal controls. This is a legitimate solo
victory, not proof that every party or strategy is satisfying or balanced.

Actual dynamic mud/oil still forms large opaque geometric patches over the
painted floor, with conspicuous ice tiling. That presentation is not accepted;
the surface-rendering owner has a bounded Canvas/WebGL cohesion assignment.
The repeated heal-and-Whip sequence also does not by itself establish the
party-combo goal; the earlier Ice Path successfully chilled the boss and
Water Whip deepened mud, but other party plans still need practical review.

Continue reached the five-beat `A Road Home` outcome. Its illustration could
not load while the preview server was stopped for owner checks; audio fetches
also failed then. Treat these as interrupted local infrastructure observations,
not a deployed-asset defect or listening review. Restore a stable preview,
review the outcome illustration, and finish the return before claiming route
completion. The victory screen and preceding fight are verified; return is open.

The preview was restored as a static server. Restart scene then loaded the
victory artwork, confirming the missing illustration was caused by the stopped
server. Beat 2 incorrectly used Mira's village-table image for rescuing workers;
writer correction `2e1bb8b` now maps it to the existing rescue illustration.

Normal Continue exploring, Map route buttons, and walking traversed the cleared
Quarry Floor → Cutting → Gate → Forest → Ba Dan without repeated fights. Sura
reached level 4, 23/38 HP. The lead walked into the square and read all three
lines each for Dorin, Pella, Mira and Gao. The world remained visible throughout
these contextual conversations, and the manually chosen wide zoom persisted.
Mira's spared-Ruon branch explicitly connects his statement and the maker-plate
rubbing to her province report. Pella reunites with Bo-shan and Gao offers food;
the homecoming remains immediate, without claiming the river is already repaired.

Port 4210 Slot 2 now holds the completed Ba Dan return at 00:42 local time;
Slot 1 retains round 4 for combat review. A normal Export to file also completed
for the level-4 state. This completes this continuous normal-input route review,
across the explicitly recorded local source updates. It is not an exact-final-head
release check or final visual/audio approval. Desktop exploration still shows
unnecessary footer and one-member party scrollbars; the conversation/UI owner
is correcting the overflow with portrait, Huge text and six-party checks.
A full browser reload then visibly showed `v0.2.1 · build be67cef-modified`;
Continue restored Ba Dan, Sura level 4 at 23/38, the homecoming objective and
Gao's location. The displayed modified suffix is retained here rather than
claiming a clean exact-head runtime. The integration owner must produce a
clean final snapshot. The root-only static preview processes for ports 4200
and 4204 were retired after their useful saves were carried into 4210; their
worktree and source commits remain preserved.

## Follow-up combined preview checks

After the next service-worker update, the title visibly reported
`v0.2.1 · build d35178b-modified`. The integration owner identifies this as
the content later committed in `c0fa812`; a clean final stamped build is still
required. Normal Load of Slot 1 restored round 4, Sura 23/34, Grumbler 41/54,
5 AP. Healing Stream now forecasts exactly `+11 hp`, without the false generic
clear-effects message. Ice Path through the machine now forecasts
`Grumbler: Ice contact — 40% Chilled`, plus four ice tiles, rather than falsely
saying nobody is affected. Both confirmations were inspected without spending AP.

The default compact frame is stable but gives roughly 45-pixel-tall Sura at
1280×720. A modest manual zoom produces a more readable intermediate frame
while retaining both combatants. Gameplay is reviewing a stable intermediate
normal-text default, with smaller framing reserved for constrained layouts.
The Ice Path confirmation also consumes too much vertical space through
redundant contact/surface prose; the lower combat-UI owner has that review
finding after the practical party-combo check. Do not accept a tiny full-board
camera merely because its geometry tests pass.

The next static build visibly reports clean `v0.2.1 · build 42e2856` after the
service-worker update. Normal Load of Slot 1 again preserved round 4, Sura
23/34, Grumbler 41/54 and 5 AP. At 1280×720, the new intermediate default keeps
both combatants visible and more readable through ready, Ice Path aim and
confirmation. Clicking the machine produces the correct four-tile footprint and
40% Chilled contact forecast without spending AP. This accepts the bounded
camera improvement. The confirmation still has an oversized lower panel and
scrollbar; its compact content correction remains in progress. Distant enemies
in the separate forest fixture can remain offscreen with focus controls available.
