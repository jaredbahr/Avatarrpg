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
