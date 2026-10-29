# The party in the world's rendering (phase 2a, ADR 0097)

Kaya, Sura and Bo redrawn the way #317 redrew its test figures (`art/source/style-test-world-chars/`), now in all
eight headings and for every clip the party plays. Owner, 2026-10-28: "Yes, roll it out", then "go ahead" for this
phase. The sheets draw under `?style=world` (with #317's Gao); the default switch is its own change (ADR 0097, 5).

## How it was made

Every PixelLab call goes through `tools/pl.py`, which ledgers it in `ledger.json` (settings with images replaced by
their input names, inputs, billed generations, balance, verdict) and never pays twice for a job it already holds. Run
from the repo root with `python3 -I`; the generators need `PIXELLAB_API_KEY` (never printed).

| step | tool                       | what                                                                                                                                                                                                                                                                                                               | cost                    |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 1    | `rotate.py`                | probe: `create-character-v3` rotations of Kaya's south root at the high top-down view, for a steeper body. Identity held, the camera did not change: not used                                                                                                                                                      | 2                       |
| -    | (`p1-kaya-diag`)           | probe: the world restyle told to raise the camera, four frames at 128 with the background removed. Barely changed, trimmed outputs: not used (settings in the ledger)                                                                                                                                              | 10                      |
| 2    | `compose.py`, `restyle.py` | the curated party-g1 roots (idle and stance, eight headings) x1.25 on #317's 512 crop of the world painting, sixteen a job, restyled with #317's settings (`edit-images-v2`, seed 11)                                                                                                                              | 25 a job, 3 jobs        |
| 3    | `extract.py`               | each figure cut out by its placed alpha and hue-locked to its source (`colour.py`, #317's lock); `roots/<char>/<idle\|stance>/<dir>.png`, 128 canvas, sole on row 112                                                                                                                                              | 0                       |
| 4    | `skeletons.py`             | `estimate-skeleton` on the 24 idle roots                                                                                                                                                                                                                                                                           | 0.1 each                |
| 5    | `design.py`, `gen_walk.py` | #317's designed six-pose walk, the cardinals walking the grid diagonals; `animate-with-skeleton-v3` from each idle root                                                                                                                                                                                            | 3 a heading             |
| 6    | `remap.py`, `gen_clip.py`  | party-g1's CMU retargets for the hits, knockouts and bends (`party-g1/design/`), mapped onto these roots by the crop, scale and offset each figure took; `animate-with-skeleton-v3` from each stance root (128 canvas for hits, 192 for falls and bends)                                                           | 2 a hit, 3 a ko or bend |
| 7    | `assemble.py`              | cels: idle and stance (root + 1 px breath), rest (root), walk, hits, knockouts and bends palette-locked to their root; Bo's west-facing headings mirrored from his east-facing ones; the stride (`stride.json`); the bend sets (party-g1's shipped data, these cels, sockets from the requested wrists and ankles) | 0                       |
| 8    | `pack.py`                  | `public/art/units/world/<name>.*` (the 128 page, the 192 page with the knockouts, cast and ko, the bend page and set, the clip file) and `src/content/assets/worldParty.ts`                                                                                                                                        | 0                       |
| 9    | `review.py`                | `review/` from the review captures (below)                                                                                                                                                                                                                                                                         | 0                       |

```sh
python3 -I art/source/party-world/tools/compose.py
python3 -I art/source/party-world/tools/restyle.py 11 0 1 2
python3 -I art/source/party-world/tools/extract.py 11 && python3 -I art/source/party-world/tools/skeletons.py
python3 -I art/source/party-world/tools/design.py 0.45 && python3 -I art/source/party-world/tools/gen_walk.py 22 kaya:south ... bo:north
python3 -I art/source/party-world/tools/remap.py hit ko bend
python3 -I art/source/party-world/tools/gen_clip.py 23 kaya:hit:south ...   # 24 for ko, 25 for bend
python3 -I art/source/party-world/tools/assemble.py 22 && python3 -I art/source/party-world/tools/assemble.py 23 hit
python3 -I art/source/party-world/tools/assemble.py 24 ko && python3 -I art/source/party-world/tools/assemble.py 25 bend
python3 -I art/source/party-world/tools/pack.py && npx prettier --write src/content/assets/worldParty.ts public/art/units/world
```

## What ships

| clip                  | headings                   | cels                                                            | timing                                   |
| --------------------- | -------------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| idle, stance          | 8                          | the root and a 1 px breath                                      | 1300 / 1100 ms                           |
| rest                  | 8                          | the idle root                                                   | -                                        |
| walk                  | 8                          | six designed poses                                              | 120 ms a cel, fitted to the drawn stride |
| hit                   | 8                          | the stance, then the take's three                               | the shipped G sheets' own frame times    |
| knockout              | 4 diagonals (the engine's) | the stance, then the take's six (192 px)                        | the shipped frame lists and times        |
| bend                  | 8                          | the stance, then the take's 9-10 (192 px)                       | party-g1's shipped bend sets             |
| cast, ko (legacy)     | mirrored                   | the east bend's stance, wind-up, strike; the SE fall's last cel | as party-g1                              |
| wave, tea (riverside) | -                          | the G1 cels, 1.25x nearest (not redrawn)                        | as shipped                               |

Bo's west, south-west and north-west headings (and his south-west and north-west knockouts) are mirrors.

## Review (`review/`)

Before is main under `?style=world` (#317's figures: locomotion only, every combat clip falling back to the idle); after
is this change under `?style=world`. Canvas.

| file                | what                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `slice.png`         | the Ba Dan slice at N = 2, before above after                                                           |
| `crop-4x-*.png`     | Gao's door and the market table, 4x, before left, after right                                           |
| `forest-bend.png`   | Kaya's Fire Jab in the first fight: before (her idle stands in for the bend), after (her bend)          |
| `<char>-clips.png`  | each heading (rows east, SE, S, SW, W, NW, N, NE): idle, the six walk cels, stance, the hit's three, 2x |
| `<char>-combat.png` | the four knockouts, then the east, south and north bends                                                |

The recordings (Ba Dan walk and the forest fight, load cut) are not committed.

## Known faults

1. **Not steeper.** The bodies keep the G1 drawings' camera (two probes, above). A steeper body needs redrawn roots.
2. **No jog.** The walk is the mover; a natural-stride jog was not drawn.
3. **Walk texture.** As #317: the walk cels are flatter than the restyled idle, and single cel pairs jitter.
4. **Colour drift.** A few restyled roots drift: Sura's east stance is greyer than her other views; some walk cels
   darken the trousers. The hue lock keeps the hue; the lightness is the restyle's.
5. **Combat cels are untrimmed 192 px cels**; the knockout and bend pages carry transparent margin.
6. **Wave and tea** are the G1 cels scaled, so they show the G1 rendering at the riverside.
7. **Credits.** 293.4 generations ledgered, 6 of them the two north bends submitted before a container restart,
   billed but never collected (`lost-at-restart-...`). The balance fell 308.4 (341.2 to 32.8): the other 15 were billed
   between the camera probe and the restyles and are unexplained (most likely the probe billed as a 512 edit).

## Kaya polish (2026-10-29)

Owner, 2026-10-29: "Pixel lab is refreshed. lets get kaya with the polished animations and directions then show me that.
If its good we can push it on the rest." Kaya alone is redrawn as the reference the other eleven figures will copy; it
replaces #321's Kaya under `?style=world` (Sura and Bo are unchanged, and so is the default). Every call is ledgered in
`ledger.json` (job names `kp-*` and `walk-kaya-*-s531/532`).

| step | tool                                            | what                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | cost                    |
| ---- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1    | `kp_probe.py`                                   | **steeper roots**: `edit-image-pro-flash` (text) on each of #321's restyled idle roots, told to raise the camera to the town map's ~40 degrees (crown, shoulder tops and feet seen from above) and, from seed 520, to keep adult proportions (502/503 came back with childlike heads). `create-image-pro-flash` with the root as style image was probed and rejected (a clean anime figure, not steeper)                                                                                                                                                                                 | 6 a heading a seed      |
| 2    | `polish/curate.json`, `kp_pre.py`               | one candidate a heading (seeds 521, 522; reasons in the file), scaled to one 70 px standing height (the steeper camera foreshortens her; #321 stood 72-76) on a 128 canvas, sole on row 112                                                                                                                                                                                                                                                                                                                                                                                              | 0                       |
| 3    | `kp_skel.py`, `kp_stance.py`                    | `estimate-skeleton` on the new idles and #321's stances; #321's stance as a per-joint offset from its idle, scaled and pressed 0.9 vertically, laid on the new idle's skeleton; `animate-with-skeleton-v3` poses the new idle into it (last of 3 frames)                                                                                                                                                                                                                                                                                                                                 | 2 a heading             |
| 4    | `kp_restyle.py`                                 | the 16 new roots (8 idle, 8 stance) on #321's world crop, restyled with #321's settings (seed 11), cut out and hue-locked to their source: `roots/kaya/`                                                                                                                                                                                                                                                                                                                                                                                                                                 | 25                      |
| 5    | `kp_walk.py`, `gen_walk.py`                     | design.py's six-pose walk on the new skeletons, the ground in #321's body heights (75 px) so a step covers the same ground, the step 0.5 body heights (#321: 0.45) for a calmer cadence; seed 531 (east retaken at 532, kept 531: `polish/takes.json`)                                                                                                                                                                                                                                                                                                                                   | 3 a heading             |
| 6    | `kp_clips.py`                                   | hits, knockouts and bends: #321's motions (party-g1's CMU retargets) carried onto the new stance skeleton as per-joint offsets, scaled and pressed 0.9; the hit's offsets 1.7x and the bend's arms 1.35x so they read at zoom 1 (seed 542; the knockouts 541)                                                                                                                                                                                                                                                                                                                            | 2 a hit, 3 a ko or bend |
| 7    | `kp_riverside.py`                               | the wave (`animate-with-skeleton-v3` from the south-east idle, one arm raised and swung) and the seated tea (`edit-image-pro-flash` from the south idle; tea 1 edited from tea 0, with tea 0's folded legs pasted below the lap)                                                                                                                                                                                                                                                                                                                                                         | 2 + 6 + 6               |
| 8    | `kp_palette.py`                                 | **one Kaya palette**: k-means (64, seeded) in OKLab over the 16 roots: `polish/palette.json`. Locking the roots to it moves a pixel 0.0024 OKLab on average (just noticeable is about 0.02)                                                                                                                                                                                                                                                                                                                                                                                              | 0                       |
| 9    | `kp_texture.py`, `kp_body.py`, `kp_assemble.py` | **one rendering**: every generated cel gets the heading's root back, part by part (head, torso, eight limb segments from the skeletons; each part mapped onto the root's by its bone, nudged to the best silhouette overlap; a pixel takes the root's colour where the root's same part has a close one). The walk's head and torso are the root's own pixels, moved by one offset: no boil there by construction. Then every cel of every clip goes through the one palette. Idle: root + 1 px breath; stance: root + a 1 px sink of the body above the hips (a ready loop); rest: root | 0                       |
| 10   | `pack.py`                                       | as #321, Kaya's riverside from her new cels                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 0                       |
| 11   | `kp_review.py`, `kp_report.py`                  | `review/kaya-polish/turntable-*.png` (every clip in every heading she draws, 4x) and `metrics.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 0                       |

```sh
python3 -I art/source/party-world/tools/kp_probe.py edit 521 south ... && python3 -I art/source/party-world/tools/kp_probe.py edit 522 south ...
python3 -I art/source/party-world/tools/kp_pre.py && python3 -I art/source/party-world/tools/kp_skel.py kp-skel-pre-idle-2 polish/pre/idle/<dir>.png ...
python3 -I art/source/party-world/tools/kp_stance.py 512 south ... && python3 -I art/source/party-world/tools/kp_restyle.py compose 512
python3 -I art/source/party-world/tools/kp_restyle.py restyle 11 && python3 -I art/source/party-world/tools/kp_restyle.py extract 11
python3 -I art/source/party-world/tools/kp_skel.py kp-skel-roots roots/kaya/<idle|stance>/<dir>.png ...   # then into roots/kaya/<kind>/skeleton/
python3 -I art/source/party-world/tools/kp_walk.py && python3 -I art/source/party-world/tools/gen_walk.py 531 kaya:south ...
python3 -I art/source/party-world/tools/kp_clips.py 542 hit:south bend:south ... && python3 -I art/source/party-world/tools/kp_clips.py 541 ko:south-east ...
python3 -I art/source/party-world/tools/kp_riverside.py wave 553 && ... tea0 551 && ... tea1 561 551
python3 -I art/source/party-world/tools/kp_palette.py 64 && python3 -I art/source/party-world/tools/kp_assemble.py
python3 -I art/source/party-world/tools/pack.py && npx prettier --write src/content/assets/worldParty.ts public/art/units/world
python3 -I art/source/party-world/tools/kp_review.py && python3 -I art/source/party-world/tools/kp_report.py <#321's cels/kaya>
FNT_KP_LABEL=after npx playwright test -c playwright.kaya-polish.config.ts   # recordings; cut the load with timing.json
```

### What changed for Kaya

| item              | #321                                                     | polish                                                                                        |
| ----------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| camera            | the G1 drawings' slightly side-on body                   | redrawn roots seen from the board's high oblique: crown, shoulder tops and feet from above    |
| height            | 72-76 world px                                           | 70 (foreshortened by the steeper view)                                                        |
| palette           | one per heading (each clip locked to its heading's root) | one for the whole sheet, 64 colours                                                           |
| walk texture      | 25 colours a cel against the idle's 434: a visible step  | 55 against 57                                                                                 |
| walk boil (trunk) | 15.4% of head and torso a cel pair (5.7-25.3)            | 1.1% (0-2.6)                                                                                  |
| walk cadence      | 87-101 ms a cel at 750 ms a tile                         | 105-128 (loops 0.84-1.03 tiles; opposite headings share the mean of their two measured loops) |
| hit               | #321's flinch, barely visible                            | 1.7x the offsets: a clear recoil                                                              |
| bend              | jab at 1.15 reach                                        | 1.35 reach                                                                                    |
| wave, tea         | the G1 cels, scaled                                      | drawn in the new rendering                                                                    |
| sheet size        | 294 KB                                                   | 271 KB                                                                                        |

Boil is `kp_boil.py`: the head and torso of each cel (from its requested skeleton), the next cel shifted by up to 3 px
to its best match, the share of that region that still differs. Hits, knockouts and bends turn and drop the trunk
itself, so their figure is mostly motion, not boil; measured the same way they fall from 63 to 46% (hit), 83 to 73%
(knockout) and 35 to 30% (bend). `review/kaya-polish/metrics.json` has every heading.

### Known faults (Kaya polish)

1. **Faces in the front views are small.** The steeper camera hides the eyes under the fringe in the south and
   south-west views, and the restyle smooths the face to a few skin tones; the south stance has no readable features.
   A face inpaint on the four front headings would cost about 24.
2. **The walk's contact cels are long strides**, east and west most (0.5 body heights a step at a pace of about 2.8 m/s,
   which the 750 ms a tile pace forces): at zoom 1 they read as a brisk walk. East cel 5 smears the boots (both seeds).
3. **Texture transfer limits.** The limbs keep the generator's own drawing where the root has no close colour, so a
   swinging coat tail or a sleeve over the coat stays flatter than the trunk; a few cels keep 1-2 px stray hair at the
   ponytail tip.
4. **Knockouts and bends** keep small smears from the generator (the south-east fall's last coat cel, the south-west
   fall's fourth cel).
5. **Credits.** 426 generations ledgered; the balance fell 591 (20,000 to 19,409). The gap is spread over the run,
   most of it (65) between the last stance job and the restyle's submission, 11 on the 512 restyle itself (the same
   gap #321 saw on its 512 jobs), and two jobs (a hit and a bend) whose connection was reset while polling and were
   resubmitted (`pl.py` now polls through a reset).
