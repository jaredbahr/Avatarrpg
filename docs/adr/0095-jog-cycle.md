# ADR 0095: A jog for every native-G1 figure at the brisk pace

**Status:** proposed, 2026-10-28 (draft PR for the coordinator's review)

Amends ADR 0067 (the brisk stride cadence: its pace stays, its 1.825-tile G walk loop no longer times the native-G1
figures), ADR 0089 and ADR 0091 (each sheet gains a jog clip in eight headings) and ADR 0093 (its "walk foot slide"
known fault). Changes the G1 sheets' clip vocabulary, their locomotion timing and the residents' routine pace, so it is
recorded here.

## Context

Figures travel at ADR 0067's 500 ms a tile in exploration and 480 in combat. A tile is 90.5 world px across a screen
row, so a figure 59 px tall crosses three of its own heights a second: running pace. ADR 0091 and ADR 0093 measured
the result: every G walk's planted foot slides 5 to 16 world px each stance cel, because the art's feet cover a fifth
to a third of the ground the game moves the figure. Jared chose, 2026-10-28: **"Jog animation — keep the speed, swap in
a light jog cycle that covers that ground."**

## Decision

**The take.** CMU subject 9 trial 1 (run), one stride cycle, frames 40 to 129: a steady 3.6 m/s run with a flight phase
in 60% of the cycle, the longest natural stride for its body of the eighteen takes measured (02_03, 09_01 to 09_11,
16_35, 16_36, 16_45, 16_46, 35_17, 35_18, 35_22, 35_26, 127_03, 127_06, 141_03, 141_04; 127_06 is faster but still
accelerating). At these figures' retarget scale (about 28 px a performer metre) the game's pace is about 6.4 m/s, so even
09_01 at its own stride would have to play at about 284 steps a minute. The retarget (`motion.py`, both families)
therefore lengthens the knees' and ankles' fore-aft swing 1.6 times about the cycle mean (`stride`) and the arms' 1.2
times (`arms`), scales by the jog performer's own torso (`scale_clip`), keeps the walk's track 0.35 and takes the
pelvis bob at 1.5. Ten cels a loop; every figure and heading is one `animate-with-skeleton-v3` job from its curated
idle root, as the walk was.

**Timing follows the drawn feet.** The clip time is distance-phased (ADR 0050), so a loop timed to the ground its planted
foot covers holds that foot at any pace. `walk_stride.py` (rewritten: below) fits each heading's loop length from the
drawn, placed cels. The fits share one shape across all twelve families, and back views cover about a fifth more
ground than front views as drawn. The manifest therefore stores `G1_HEADING`, the median shape (east 1), and `G1_JOG`,
one east loop length a family:

| family    | Kaya | Sura |   Bo | thug | slinger | bruiser | household | watch | Mira |  Gao | Pella | Dorin |
| --------- | ---: | ---: | ---: | ---: | ------: | ------: | --------: | ----: | ---: | ---: | ----: | ----: |
| tiles E   | 1.00 | 1.02 | 1.03 | 1.13 |    1.08 |    1.23 |      1.06 |  1.07 | 1.21 | 1.15 |  0.84 |  1.15 |
| steps/min |  240 |  235 |  233 |  212 |     222 |     195 |       226 |   224 |  198 |  209 |   286 |   209 |

(steps a minute east at 500 ms a tile; `G1_HEADING` = 1, 0.99, 0.88, 1.1, 1.05, 1.24, 1.17, 1.15 in `HEADINGS` order, so
north runs about 17% slower and south 12% faster.)

**Which clip, by speed.** A sheet whose locomotion declares `jog` plays it for every move at the brisk pace: the party
and the bandits in exploration and combat, the party at the riverside (it draws the animator's clip), and a resident's
placement walks and its call home. The old walk stays on every sheet as `walk`, and plays where the move is slow enough
for its feet: today only a resident's routine errand, which ambles at `RESIDENT_AMBLE` (4) times the stroll, 2 s a tile,
read from the errand animator on a slowed clock. There the residents' walk covers 0.43 of its jog's loop (`G1_AMBLE`,
the six residents' median), which sets its rate on the jog's clock, so it plays near its authored 114 ms a cel (912 ms a
loop for the household) with its planted foot on the ground. An errand leg that the party's approach cuts short, or that
a tap calls home, is brisk and jogs: the player is waiting on it. **The rule:** a move plays the clip whose feet cover
the ground at that move's pace — the jog at the brisk stroll, the walk at about 2 s a tile — so the planted foot moves at
most about 1 world px a stance cel; a future slow or scripted move plays the walk on a clock whose ms a tile is the
walk's own, never the jog's at the brisk pace.

**Registration.** As the walk (ADR 0050), but the two contact cels' soles are set on idle's sole in every heading (the
walk's north rule, level with idle, sank a run's back views 2 to 3 px), and with no clip-level mean-row bound, because
the flight cels leave the ground. `art:validate` holds a jog to a per-cel envelope of 14 px lift and 28 px foot
centring at G1 (`JOG_ABOVE` 28, `JOG_CENTRE` 56 at the 128 px grid; the measured worst are 13 and 26.5), and to the
walk's sink bound. Pixels a long stride or a raised spear puts inside the clear margin are cleared (`clamp_margin`).

**Code, under a 12-byte bundle margin.** `LocomotionDef.jog`, one branch in `Animator.locomotion` (`jog` for `walk`),
`jog` in `authoredForBothSides` and the residents' `idleOf`, the errand's slowed clock in `residentMotion.ts`, and
`g1Locomotion` in the manifest, which now builds every G1 sheet's idle, rest, walk and jog and its locomotion (the
quarry bender's 128 px sheet keeps ADR 0067's walk through the same helper). To pay for it: the fallback table in
`resolveClip.ts` is derived by rule (identical to the table for all fifty existing clips, checked name by name), the
shipped clip-name list is generated and leaves out the jog names (`BAKED_CLIP_NAMES` for painter bakes; the full
`CLIP_NAMES` is CI-only), and the three CMU credit entries are folded into one, as #301 folded the walks. The bundle
ended 23 bytes under the 360 KB gzip budget of the time (main: 12); ADR 0094's PR has since raised it to 380 KB.

## Measurements (`art/source/grounding/tools/walk_stride.py`, world px a stance cel)

The tool was rewritten for this: per heading it finds the planted foot in each stance cel pair (the take's world-frame
contacts, the sole nearest that foot's requested ankle in the placed cel) and compares its travel with the game's over
the same cel, along the clip's real screen heading (diagonals at a slope of one half, 71.6 px a tile; ADR 0093's first
measure used 45 degrees). `--manifest` reads the timing from the shipped manifest. Slide is signed: + the foot lags
the ground, − it outruns it. The tables at figure scale 1.0, which ships with ADR 0094 (at 1.0 one art px is one world px),
with the old 1.25 beside them.

| family    | before: walk at 500 ms (mean range, mean of abs) | @1.25 | after: jog (range, mean of abs, worst pair) | @1.25 | errand walk at 2 s a tile |
| --------- | -----------------------------------------------: | ----: | ------------------------------------------: | ----: | ------------------------: |
| Kaya      |                                 +5.1..+10.5, 8.0 |   7.3 |                       −1.0..+0.8, 0.51, 5.0 |  1.84 |                         – |
| Sura      |                                 +5.3..+10.6, 8.0 |   7.4 |                       −0.6..+0.4, 0.30, 4.9 |  1.92 |                         – |
| Bo        |                                 +5.2..+10.6, 7.9 |   7.2 |                       −0.9..+1.3, 0.43, 6.0 |  1.85 |                         – |
| household |                                +7.7..+15.8, 11.9 |  10.9 |                       −1.8..+0.9, 0.48, 6.7 |  2.12 |                      0.56 |
| watch     |                                +7.7..+15.4, 11.5 |  10.5 |                       −0.6..+2.0, 0.53, 6.5 |  1.71 |                      0.60 |
| Mira      |                                +7.3..+14.7, 11.1 |   9.9 |                       −2.2..+0.9, 0.77, 5.2 |  2.40 |                      0.55 |
| Gao       |                                +7.7..+15.1, 11.4 |  10.3 |                       −0.8..+0.4, 0.26, 5.3 |  2.24 |                      0.43 |
| Pella     |                                +8.0..+16.5, 12.5 |  11.6 |                       −1.2..+1.1, 0.48, 2.5 |  1.61 |                      0.41 |
| Dorin     |                                +7.2..+15.1, 11.2 |  10.0 |                       −1.2..+0.5, 0.42, 6.4 |  2.28 |                      0.58 |
| thug      |                                +7.5..+15.3, 11.5 |  10.4 |                       −0.2..+0.9, 0.34, 4.5 |  1.82 |                         – |
| slinger   |                                +7.7..+15.2, 11.5 |  10.4 |                       −0.8..+1.5, 0.50, 9.3 |  1.93 |                         – |
| bruiser   |                                +7.2..+15.0, 11.1 |   9.9 |                       −1.0..+0.9, 0.51, 6.4 |  2.38 |                         – |

The rows behind the table are `art/source/jog-g1/review/stride-before.json` and `stride-after.json`.

## Budget

|                                           | main `8567471` |     after |
| ----------------------------------------- | -------------: | --------: |
| units family (budget 8.5 MiB)             |       5.13 MiB |  6.17 MiB |
| the twelve page-1 sheets                  |        1.51 MB |   2.59 MB |
| precache (budget 25 MiB)                  |      19.45 MiB | 20.49 MiB |
| JS bundle, gzip (budget 360 KB = 368,640) |        368,628 |   368,617 |

No ceiling is raised. Generations: 297 of the ~350 budgeted (balance 740.8 to 443.8): 97 ledgered jobs at 3 each (the
96 jog takes, the two pilots among them, and one retake, the thug's east, whose s9901 club came apart in two cels), and
6 billed for jobs in flight when the container restarted, which returned nothing. Every ledgered job is in the two
`ledger.json` files.

## Consequences and known faults

- **The cadence is quick.** PixelLab drew the strides about 15% shorter than the skeletons asked (Kaya's east: 1.18
  tiles a loop asked, 1.0 drawn), so the loop that holds the foot plays at 195 to 240 steps a minute east (Pella, the
  child, 286), slower to the north. A retake at stride 1.9 would bring it near 200 for the party but costs about 290
  generations, outside this budget.
- **Single cel pairs jitter.** The mean slide is under 1 px on most headings, but a drawn foot does not move evenly:
  the worst single stance pair is 2.5 to 9.3 px (the slinger's), and a few headings' means reach ±2 px where the
  shared heading shape fits worst (Mira's south-east and north-west, the watch's north-east, the household's south).
  Per-family per-heading timing would remove the mean error and cost about 250 bundle bytes.
- **The timing assumes figure scale 1.0** (ADR 0094, now on main). At the old 1.25 the feet travelled 25% further
  than the ground, a 1.6 to 2.4 px backward slide; a future change of draw scale must refit `G1_JOG` by that ratio.
- **Clamped margins.** The watch's south jog loses its spear tip (72 px over seven cels, the take raised it past the cel
  top) and seven headings lose 2 to 24 toe pixels at the cel's side.
- **Who jogs.** Mira, the elder, jogs on her placement walks and when called home, her stick coming and going between
  cels; whether an elder should jog at all is the owner's call. Her ambling routine walks.
- **Errands take longer.** A routine leg now takes four times as long, so the routines cycle more slowly through a phase;
  their holds are unchanged.
- **The walk stays on every sheet** (party and bandits included) for a future slow move, at no new byte cost.
- **The quarry bender** is still the 128 px G sheet with ADR 0067's walk; not native G1, so out of scope.
- **Captures** are canvas only (the WebGL path times out on this container's software rasteriser, as ADR 0091's did).
- Credits: CMU subject 9 trial 1 joins the folded CMU entry.
