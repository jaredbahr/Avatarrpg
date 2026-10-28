# World-style figure test: Kaya, Sura, Bo and Gao in the world's rendering

Jared, 2026-10-28: "Look at the characters and the rest of the world. Do you see how they still don't fit. The
animations are off." His chosen direction to test: **characters match world**. The Ba Dan painting stays exactly as it
is, and the figures are redrawn in its rendering, at its size, with designed animation.

**This is a style test, not a rollout.** Nothing ships by default. The four test sheets show only with `?style=world`
(for example `/?style=world&renderer=canvas`), so one build shows the old and the new figures in the same Ba Dan slice.

## Verdict

**The direction works for the still figure, and works in part for the walk.**

- **Size and grain: fixed.** The figures stand 72–76 world px, which is about 0.9 of Gao's door. They are drawn at
  exactly 1 art px per world px, so at the default zoom (N = 2) each art px is a crisp 2×2 block, the same grain as the
  painting. The shipped figures are resampled soft at 1.25. The difference is plainest at 4× (`review/crop-4x-gao-door.png`).
- **Rendering: much closer.** The restyle pass gives the figures the painting's mottled tone clusters, warm
  upper-left light and soft dark edge instead of the clean, flat, hard-outlined G look. Gao by his door and the party by
  the market table now read as part of the scene.
- **Walk: readable and planted, with two faults.** The six designed poses (contact, down, passing, twice) give clear
  contact and passing poses with a 2 px bob. The stride is long enough for the move speed, so the walk plays at about
  100 ms a cel at the current 750 ms a tile, with no pace change. Fault 1: single cel pairs still jitter. Fault 2: the
  walk cels are flatter than the restyled idle (see Known faults).
- **Not fixed: the viewing angle.** The bodies still read slightly side-on. The restyle keeps the drawing it is given,
  and the roots came from the G1 drawings. Only the feet follow the 2:1 ground, because the walk's skeleton is projected
  onto it.

My recommendation: take this route for the redraw, with two changes. Draw new roots at a steeper camera before the
restyle, and give the walk a texture pass that does not redraw each cel (below). Judge the two videos side by side
before deciding.

## How it was made

Every PixelLab call goes through `tools/pl.py`, which writes the call to `ledger.json` with its settings, inputs,
billed generations, balance and verdict. A job the ledger already holds is never paid for twice. Run the steps from the
repo root with `python3 -I`; the generators need `PIXELLAB_API_KEY`.

| step | tool                    | what                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | cost        |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1    | `compose.py`            | the curated G1 idle roots (party-g1, residents-g1) in the four diagonals, scaled 1.25 to ~74 px and set on a 512×512 crop of `world-g1-grounded.png` (1040,980), one character a row                                                                                                                                                                                                                                                                                                                                      | 0           |
| 2    | `restyle.py`            | **the world's own restyle**: `edit-images-v2`, `edit_with_text`, the world's style sentence, seed 11, no reference image. The only change from `ba-dan-route-a/tools/world.py` is that "No people" becomes "keep every person … render each person with the same painterly pixel texture … as the ground"                                                                                                                                                                                                                 | 25          |
| 3    | `extract_roots.py`      | cut each figure back out by its placed alpha and **hue-lock** it to its source (`colour.py`: OKLab lightness and texture from the restyle, hue from the source, chroma 55/45). The restyle had pulled Sura's back views toward the grass green                                                                                                                                                                                                                                                                            | 0           |
| 4    | `skeletons.py`          | `estimate-skeleton` on each 128×128 root                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 1.6         |
| 5    | `design.py`             | **the designed walk, no mocap**: six key poses in the body's own frame. Each foot sits at +½, +⅙, −⅙, −½ of a step while it stands (so it moves back exactly ⅓ step a cel), then swings at −¼ and +⅛, lifted. The pelvis drops 1.2% at contact and 2.5% at down. The arms swing against the legs, and the knees come from two-bone IK. The step is 0.45 of body height, projected onto the 2:1 ground along each diagonal. Both feet are first set on one ground line, so the root's set-back far foot cannot make a limp | 0           |
| 6    | `gen_walk.py`           | `animate-with-skeleton-v3`, first frame the restyled root, one designed skeleton a cel, seed 22                                                                                                                                                                                                                                                                                                                                                                                                                           | 3 a heading |
| 7    | `assemble.py`           | idle = the root plus a 1 px breath cel (the rows above the chest line lifted, nothing redrawn). The walk cels get binary alpha and a **palette lock** to the root's own colours, and specks under 4 px are cleared. **Stride**: in each stance pair the sole patch at the designed ankle is matched in the next cel within ±7 px of the designed travel; the median gives the loop length (`stride.json`)                                                                                                                 | 0           |
| 8    | `pack.py`               | one atlas per character (`public/art/units/style-test/`), plus `src/content/assets/worldStyleTest.ts` (timing)                                                                                                                                                                                                                                                                                                                                                                                                            | 0           |
| 9    | `review.py`, `video.sh` | the review files, from the Playwright captures (`e2e/style-test.review.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                               | 0           |

```sh
python3 -I art/source/style-test-world-chars/tools/compose.py 1040 980 1552 1492
python3 -I art/source/style-test-world-chars/tools/restyle.py r1-roots-s11 11
(cd art/source/style-test-world-chars && python3 -I tools/extract_roots.py raw/r1-roots-s11/00.png roots \
  && python3 -I tools/skeletons.py && python3 -I tools/design.py 0.45 \
  && python3 -I tools/gen_walk.py 22 kaya:south-east ... gao:north-west && python3 -I tools/assemble.py 22)
python3 -I art/source/style-test-world-chars/tools/pack.py && npx prettier --write src/content/assets/worldStyleTest.ts
for s in current world; do FNT_STYLE=$s FNT_STYLE_VIDEO=1 npx playwright test -c playwright.style-test.config.ts
  cp .shots/style-test/test-results/*/video.webm .shots/style-test/$s/run.webm
  sh art/source/style-test-world-chars/tools/video.sh $s .shots/style-test/ba-dan-walk-$s.mp4; done
python3 -I art/source/style-test-world-chars/tools/review.py
```

## In the game (`?style=world`)

`useWorldStyleTest()` (`manifest.ts`) is called from `main.ts` when the query asks for it. It replaces four keys:
`unit.fire.kaya`, `unit.water.sura`, `unit.earth.bo` and `npc.shopkeeper`.

- **One art px per world px with no new scale code.** The test atlases declare 80 px a tile, so the oblique figure
  scale (1.25, unchanged) lands each art px on exactly one world px. Pixel sampling then sees a whole ratio and draws
  nearest at every integer zoom on both backends (`worldStyleTest.test.ts`).
- **Shadows and grounding** are ADR 0093's, untouched. The contact band follows the drawn soles, and the cast is the
  heading's idle cel.
- **Timing** (data only; the pace is unchanged at `TIMING.strollStep` 750 ms a tile). The walk is authored at 120 ms a
  cel, and its clip ms per tile = 6 × 120 / loop tiles × 1.25, because the animator divides by the figure scale. No
  `walkCelMs` is declared, so the brisk cap (`BRISK_WALK_CEL_MS`) does not apply and the fit holds the planted foot.

| heading                        |      Kaya |      Sura |        Bo |      Gao |
| ------------------------------ | --------: | --------: | --------: | -------: |
| loop SE (tiles)                |     0.786 |     0.768 |     0.805 |    1.049 |
| loop SW                        |     0.805 |     0.693 |     0.730 |    0.993 |
| loop NE                        |     0.749 |     0.899 |     0.899 |    0.805 |
| loop NW                        |     0.693 |     0.787 |     0.843 |    0.805 |
| ms a tile written              | 1118–1299 | 1001–1299 | 1001–1233 | 858–1118 |
| real ms a cel at 750 ms a tile |    87–101 |    87–112 |    91–112 |  101–131 |

So **the move pace stays 750 ms a tile**. The cadence comes out at **87–131 ms a cel (mean about 101)**, or 140–200
steps a minute. The drawn step is about 9.4 world px a cel along the diagonal; the design asked for 10.1. If the
quicker headings bother you, the dial is the pace: 850 ms a tile would put every heading at 98–149 ms a cel.

- **Idle**: the root and its 1 px breath cel, 1300 and 1100 ms. **Rest**: the root.
- **Cardinals** borrow the nearest diagonal: E → SE, S and W → SW, N → NW.
- Locomotion only. Kaya, Sura and Bo's casts, hits, knockouts, stances and bends fall back to the idle under the flag
  (ADR 0003's table). Use the flag in Ba Dan exploration, not in a fight.

## Review files (`review/`)

| file                                    | what                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slice-current-vs-world.png`            | the Ba Dan slice at the scene's default zoom (128 px tiles, N = 2, Canvas). Shipped figures on top, test figures below; same camera, moves and moment |
| `crop-4x-gao-door.png`                  | Gao by his door at 4 screen px a world px, current on the left and test on the right                                                                  |
| `crop-4x-market-table.png`              | Kaya and Bo by Gao's market table, the same                                                                                                           |
| `walk-<char>.png`                       | each heading (rows SE, SW, NE, NW): idle, breath cel, the six walk cels, 4×, on the world's paving                                                    |
| `walk-<char>.gif`                       | the four headings walking at that character's mean in-game cel time                                                                                   |
| `roots-restyle.png`                     | each source figure (G1 root × 1.25) beside its world restyle, before the hue lock                                                                     |
| `probe-walk-restyle-kaya.png` / `.json` | the rejected probe: Kaya's walk restyled in the world crop (each heading: locked cels above, restyled below)                                          |
| `metrics.json`                          | per heading: height, colours a cel, upper-body boil, stride pairs, real cel time                                                                      |

The two recordings (Playwright, Canvas, real time, the load cut off) are not committed. The party crosses the slice from
the road's west end to the bridge, then walks up to the market table: `ba-dan-walk-current.mp4` and
`ba-dan-walk-world.mp4`. Rebuild them with the commands above.

## Known faults

1. **Viewing angle.** The bodies keep the G1 drawings' slightly side-on camera, because the restyle keeps composition.
   The feet follow the steep ground. A real fix is new roots at a steeper camera before the restyle, for example
   `create-character` with `view: high top-down`, curated per heading as ADR 0089 did.
2. **The walk is flatter than the idle.** The restyled roots carry 195–763 colours; the walk cels, after the palette
   lock, carry 18–49. `animate-with-skeleton` redraws in PixelLab's own flatter hand, and the lock only maps that onto
   the root's colours. So there is a visible texture step when a figure starts or stops walking. The fix I tried,
   restyling the walk cels in the world crop like the roots (`p1-walk-kaya-s11`, 25 generations), brings the texture
   back, but upper-body boil rises from 23–30% to 36–47% of the figure per cel pair (`probe-walk-restyle-kaya.json`).
   **Rejected.** Untested options: a texture transfer from the root that is deterministic per body part, or restyling
   only the root and moving its pixels with the skeleton.
3. **Single cel pairs jitter.** The loop length is the median over the stance pairs. Single pairs travel 1–18 px
   against about 9.4, because the drawn foot does not move evenly. The worst cases are Kaya's and Sura's north-west and
   Bo's south-west pairs. As with the shipped walk, the mean is fit and single steps are not.
4. **Boil.** Within the walk, 11–44% of the upper body changes per cel pair after the best 2 px shift (`metrics.json`).
   Some of that is the arm swing; some is redraw (coat tails, Gao's peppers and waterskins). The idle cannot boil:
   its second cel is the first with a 1 px lift.
5. **Gao's errands** amble at 2 s a tile on the fitted stride, which is about 250–330 ms a cel. It reads as a slow
   shuffle, with the foot planted.
6. **Edges.** A few silhouettes keep 1 px of the ground they were restyled on, for example Kaya's south-east coat edge.
   The extraction cuts by the placed alpha, not by what the restyle drew.
7. **Colour.** The hue lock keeps each character's hue. Chroma is a 55/45 mix of the restyle and the source, so the
   figures are a little more muted than the shipped ones. That is intended, toward the world.
8. **Not measured:** the occlusion veil's probes (they assume the G1 grid at 1.25), WebGL (Canvas only), and the
   cardinal headings (borrowed). The recording's frame pacing is this container's software renderer, not a device's.

## Credits

| job                                | generations | verdict                                          |
| ---------------------------------- | ----------: | ------------------------------------------------ |
| `r1-roots-s11` (16 roots, one job) |        25.0 | used                                             |
| `skeletons-roots` (16 calls)       |         1.6 | used                                             |
| `walk-kaya-south-east-s21` (pilot) |         3.0 | rejected: the trailing heel drew as a run's kick |
| `walk-*-s22` (16 headings)         |        48.0 | used                                             |
| `p1-walk-kaya-s11` (probe)         |        25.0 | rejected: boil about doubles                     |
| **total**                          |   **102.6** | balance 443.8 → 341.2                            |

## What a full rollout costs

This uses the measured unit costs: one 512 restyle job (25) holds 16 figure-headings, a skeleton is 0.1, and a 6-cel
skeleton animation is 3. The rollout covers 12 families in 8 headings, every clip.

| item                                                                                |     generations |
| ----------------------------------------------------------------------------------- | --------------: |
| idle roots, 96 headings (6 restyle jobs) + stance roots for the 6 fighters (3 jobs) |             225 |
| one retake round on roots (about half, as ADR 0089 needed for far-side headings)    |             110 |
| skeletons                                                                           |              15 |
| walks, 96 × 3, plus 30% retakes                                                     |             375 |
| hits 48 × 3, knockouts 24 × 3                                                       |             220 |
| bends, party 24 headings, two seeds each                                            |             150 |
| **subtotal: every clip that ships today**                                           | **about 1,100** |
| a natural-stride jog for the brisk pace, 96 × 3 plus retakes                        |            +375 |
| steeper-camera roots first (fault 1), if `create-character` is the route            |     +100 to 200 |
| a per-cel texture restyle (fault 2), as probed (rejected here)                      |           +600+ |

Expect **about 1,100 for the clips that ship today, or 1,500–1,700 with the jog and steeper roots.** That fits ADR
0094's 1,500–2,000 estimate. Mirroring is allowed only for figures with no handed details. Bo and the bandits qualify;
Sura's braid and Gao's props do not. That could save about 150.
