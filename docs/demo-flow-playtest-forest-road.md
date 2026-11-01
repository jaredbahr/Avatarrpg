# Forest Road audit, 2026-11-01

This audit follows the real Ba Dan exit, Forest Road walk and narration, ambush,
first three party turns, actual victory, aftermath and quarry-gate arrival.
3/4 native viewport/backend cases completed the full route. This is a source-bound audit and handoff, not acceptance of the
area's final polish. Confirmed code findings already have owned draft PRs; no
additional small, unowned code correction was established. The new art follow-up
is [#381](https://github.com/jaredbahr/Avatarrpg/issues/381).

The source is based on merged main `0d4c2b93`. Capture producer is local
`63626257654b90f81c6b3871e7575b9736e890df`, tree
`9d4dd61705e1ad096001c223ebb558fc9d790a6e`, displayed build `6362625`.
Its game source and public assets equal that main; only the review fixture is
added. [Exact provenance](coordination/evidence/379/capture-provenance.json)
records source/build/harness hashes, all outcomes and the curated native images.

## Protocol and functional result

Seed `forest-road-polish-379`, Kaya/Sura/Bo, the seed-selected `bruisers` variant
(two bruisers), Normal text and normal motion. Seeded `newGame` skips title/party
setup only. Story and walking use visible controls and real tile taps. Combat
recommendations use the existing production planner and real reachability rules;
commands go through `App.dispatch`, and native playback/AI continue normally.
There is no HP, position, terrain, clock or victory staging. Combat aim/Confirm
controls are not exercised by this driver.

| Profile        | Viewport / DPR | Actual exit |   Runtime | Route / selected attempt                                                     |
| -------------- | -------------- | ----------: | --------: | ---------------------------------------------------------------------------- |
| desktop-canvas | 1280×800 /1    |           0 |  168.19 s | passed; run1-desktop-canvas; native stills and full-route video              |
| ipad-canvas    | 834×1194 /2    |           0 |  215.34 s | passed; run1-ipad-canvas; native stills and full-route video                 |
| desktop-webgl  | 1280×800 /1    |           0 |  959.40 s | passed; run1-desktop-webgl; native stills and full-route video               |
| ipad-webgl     | 834×1194 /2    |           1 | 1813.28 s | failed; run2-ipad-webgl-stills; native stills; extra full-route recorder off |

The corrected portrait WebGL attempt also failed: actual exit 1 / 1813.28 s,
unchanged 1,800,000 ms whole-case timeout during fourth-party-turn handoff settling.
It recorded 14 beats, including the first three completed party turns, and six
accepted commands; victory, aftermath and quarry arrival were not reached. The
page/context-closed error follows the case timeout. Runtime page/console errors
were empty, which does not make this a pass. No third attempt, larger budget,
source workaround or performance/device acceptance is claimed. The corrected
[failure record](coordination/evidence/379/corrected-portrait-failure.md) and
provenance retain the actual failure and trace/context hashes.

The original portrait WebGL attempt failed at the second Ready handoff: the
unchanged 30-second click action timed out after logging the click as done while
waiting for scheduled navigation. Its trace, context, actual exit and partial
beats remain recorded; it is not a 30-minute case timeout or a green run. The
visible failure context already showed Sura's action dock and no Ready card.
One bounded correction disables only continuous video recording for that
portrait WebGL context, preserving native stills, tracing, viewport/DPR,
assertions, deadlines and zero retries. The table uses that
corrected attempt; it does not erase the original failure. Recorder cost is an
investigation hypothesis, not an established sole cause or performance fix.
Portrait WebGL continuous-motion acceptance remains open. See the
[original failure](coordination/evidence/379/original-portrait-failure.md).

The first three profiles share the original guarded build; the corrected
portrait profile uses a second guarded build. Their game source, fixture and shared helper hashes match, but the full
dist hashes differ across the fresh build; provenance binds each run to its own
stable build. No byte equality between those complete build outputs is claimed.

Each invocation uses one worker and Playwright retries: 0, the existing demo-review 30-minute
case cap and unchanged shared helper budgets. These are installed Chromium
viewport/backend checks: WebGL is software-rendered, not physical Surface/iPad,
Safari/WebKit or a performance result. Recorded raw video has no audio, so no listening
acceptance is inferred.

The desktop Canvas run made 31 accepted party commands and won in round 3;
Sura actually fell, so the victory message about patching up is truthful. The
three first-party-turn stills chiefly show movement; later legal commands
exercise Water Whip, earth smothering fire, oil-flask destruction/oil spread and
Fire Jab. The undimmed stills do not capture all of those later impacts, and the
short clip covers the approach/opening. #342's effect readability and motion
therefore remain unevaluated here despite real rule exercise.

Across the 3 completed profiles, the 31 accepted party-command/event traces, terminal battle and retained 100-entry victory logs match exactly. Canonical commands and retained logs are included in provenance so their hashes can be recomputed. This is a fixed-seed/variant observation, not an invented uncapped campaign log or all-seed balance claim. Core/content/public game trees are unchanged from main; the final local gate retains the original progression and balance checks.

## Findings and existing owners

Times below are desktop Canvas beat-clock seconds, sampled before PNG readback.
They are not exact raw-video PTS. Other profiles have their own full beat table
in provenance. Severity follows the existing demo audit: blocker, ugly, nit;
code/art identifies the correction discipline. There is no progression blocker
in the completed runs.

Same-named beats are not matched animation frames: the Canvas opening sample
clips the party, while the WebGL/portrait samples reach the later Ready card.
State is sampled before PNG readback, which can advance several software-rendered
frames. No universal clipping duration or cross-backend pixel equality is claimed.

| Finding                                                                                          | Severity / kind                  | Native evidence                                                                                                                                                           | Disposition                                                                                  |
| ------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Objective card obscures the world/trailing party                                                 | ugly / code                      | East gate26.300s, Forest arrival28.509s and [east approach161.316s](coordination/evidence/379/desktop-canvas-quarry-gate-approach.webp)                                   | #329 / PR #354 owns the objective treatment.                                                 |
| First planning view excludes live enemies and the flask                                          | ugly / code                      | [Turn1,46.260s](coordination/evidence/379/desktop-canvas-combat-turn-1-start.webp); two bruisers and flask are beyond the view                                            | #328 / PR #357. No second camera implementation here.                                        |
| Opening composition clips party at the canvas top; battle spawns differ from the walked crossing | ugly / code                      | [Opening44.316s](coordination/evidence/379/desktop-canvas-ambush-opening.webp); walk reaches(8,4), battle party starts(1,3)/(3,4)/(1,5)                                   | #328/#334, PRs #357/#374. Endpoint/state proof is not a claim about every frame's duration.  |
| Small HP/acting marks and a mostly empty initiative band                                         | ugly / code                      | [Turn3,62.895s](coordination/evidence/379/desktop-canvas-combat-turn-3-start.webp)                                                                                        | #336 / PR #372 owns readability.                                                             |
| Smooth selection/talk/exit/KO marks differ from the painted pixel family                         | ugly / code                      | [Walking37.941s](coordination/evidence/379/desktop-canvas-forest-walking-east.webp), turn3 and [victory145.012s](coordination/evidence/379/desktop-canvas-fight-end.webp) | #341 / PR #375. Talk pip is clear of the viewed head; no pip-overlap defect is claimed.      |
| Aftermath leader is immediately in front of the rubble in projection                             | nit / code                       | [Aftermath149.032s](coordination/evidence/379/desktop-canvas-after-the-road.webp), leader(8,4)                                                                            | #334 / PR #374. Feet remain on the road; no solid-cell collision defect was observed.        |
| Victory modal dims/covers much of the party's area                                               | nit / code                       | [Victory145.012s](coordination/evidence/379/desktop-canvas-fight-end.webp)                                                                                                | #333 / PR #365 owns the victory beat. A still does not prove the absence/duration of a hold. |
| Striped north-west apron opens into a flat green void                                            | ugly / art                       | [Turn3](coordination/evidence/379/desktop-canvas-combat-turn-3-start.webp), also visible in portrait Canvas                                                               | New #381 art handoff; no repaint, offset, runtime shadow or generation here.                 |
| Quarry Gate continuation has softer materials and large flat-edged pads                          | ugly / art, boundary observation | [Arrival164.396s](coordination/evidence/379/desktop-canvas-quarry-gate-arrival.webp)                                                                                      | #345 and #344 / PR #362 cover the quarry route. Forest source scope ends at arrival.         |

The east shelf's deliberately raised cut-stone slabs also warrant owner style
review against Ba Dan's integrated verges. This audit does not establish bad
lift/picking or a misregistered sprite, and selects no source correction from
that observation. Keep it with #379's area/style review and deferred #343;
preserve the authored elevation and geometry.

The reference comparison uses all three approved player-view images and
`docs/player-view-target.md`, with this run's [Ba Dan arrival](coordination/evidence/379/desktop-canvas-ba-dan-arrival.webp)
as the current in-game bar. Forest's palette, readable road, lodge, reeds, pond
and planted tree feet form a coherent route, but the findings above prevent a
final polish claim. Screenshots and successful traversal do not replace Jared's
visual acceptance.

## Review media and limits

[One continuous desktop Canvas approach/opening clip](coordination/evidence/379/forest-road-to-ambush-desktop-canvas.mp4)
is cut from native video without scaling, splicing, retiming or interpolation.
Its source PTS range, codec, byte count and decode check are in provenance. H264
and chroma encoding are lossy; use the exact lossless native stills for pixel
review. The clip's encoding cadence is not game FPS. The raw full videos,
original PNGs, full state/command receipts and canonical failure diagnostics are
retained outside Git; curated review files each remain below8MB.

The narration still was sampled during the scene curtain. Intermittent title
cropping in moving samples and the curtain are evidence observations pending
continuous-video analysis, not demonstrated permanent UI failures. Save/reload
flock behavior and lower-mouth dock Walk routing were source leads only and
were not exercised. Do not promote them into new issues without native proof.

Move/aim/target overlays, ability-header wrapping, coordinate-free prop preview,
enemy-turn controls/toasts, high contrast, reduced motion and audio are not
accepted by this route. Existing #326/#327/#330/#331/#332/#342 owners retain
those gates; there is no duplicate implementation. This is one seed/variant and
three characters, not all-party balance or an exhaustive Forest audit.

The viewed 834×1194 Normal-text combat header remains one row and its unit panel
is compact. This audit does not confirm #330's portrait defects merely because
that issue exists; other sizes, text settings and devices retain their own gates.

The original launcher typo exited2 before any browser started; its receipt is
retained separately and no native failure is relabelled. Native runs use unique
output labels, preserving every prior run. See the
[executed harness snapshot and reproduction notes](coordination/evidence/379/README.md).
Final exact-head validation and current publication/CI identity belong in the
PR and [task handoff](coordination/handoffs/forest-road-379.md).
