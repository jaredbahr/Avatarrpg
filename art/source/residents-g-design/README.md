# Ba Dan residents, G locomotion (art source, shared tools)

The design and review tools for the six Ba Dan resident G sets of `docs/art/character-lane-plan.md` ("Ordered generation
plan", jobs 1-6; issue #284): `household-g`, `watch-g`, `mira-g`, `gao-g`, `pella-g`, `dorin-g`. Generated, not shipped:
nothing here is in the manifest (ADR 0082 leaves room for two or three sheets; that choice is the owner's).

## The recipe (the thug's, ADR 0059/0078, end to end in PixelLab v2)

1. **South base.** `edit-image-pro-flash` on Kaya's approved G south rotation (`kaya-g-south-base.png`, PixelLab character
   `e8c6638a`, the same base the thug was edited from), method `text` (Mira: `reference`, her portrait fitted to the 192
   canvas as `portrait-ref-192.png`), so every resident inherits Kaya's pixel size, outline weight, light and high
   top-down camera. Each brief is the plan's appearance brief; the named four keep their approved portraits' identities
   (`docs/art/npc-idle-prompts.json`). Takes in `<char>-g/design/south-edit-*`.
2. **Rotations.** `create-character-pro-flash` with that south as `first_frame`, `view: high top-down`: the eight
   192 px rotations in `<char>-g/rotations/`, the PixelLab character id in `rotations/character.json`.
3. **Skeletons.** `estimate-skeleton` on each rotation (`rotations/skeleton/<dir>.json`).
4. **Motion.** `design.py CHAR CAND` retargets CMU mocap onto those skeletons exactly as the thug's `design.py` does
   (delta retarget, yaw per facing, pitch 35, the head riding the neck): a walk is one gait cycle from a left-foot
   contact resampled to 8 cels, root-locked (pelvis travel removed, bob kept), referenced to the cycle mean so the mean
   pose is the rotation; an idle is 4 samples of a standing take. A hand holding a prop (stick, spear, basket, abacus,
   cabbage) keeps a fraction of its swing (`locked`, `locked_amp` in `clips.json`). `mocap.py` is the ASF/AMC reader.
   No pose is hand authored and no PixelLab walk template is used (pillar 7).
5. **Cels.** `animate-with-skeleton-v3`, first frame the rotation, `first_frame_keypoints` its skeleton, one keypoint
   set per cel (`<char>-g/raw/<cand>-<dir>-s<seed>/NN.png`, untoned, 192 px).
6. **Review.** `review.py CHAR` places each cel as the G build does (75% nearest-neighbour into 128x192 at x -8, y 31)
   and draws Kaya's shipped cels beside the resident's at game scale, with a measured fault table.

| Motion (clips.json) | CMU take             | Used by                                   |
| ------------------- | -------------------- | ----------------------------------------- |
| `walk-basket`       | 08_01 walk           | household (left arm on basket)            |
| `walk-spear`        | 08_01 walk           | relief watch, Dorin (right hand on spear) |
| `walk-old`          | 142_07 Elderlyman    | Mira (right hand on stick)                |
| `walk-relaxed`      | 142_13 Relaxed       | Gao (left arm on abacus)                  |
| `walk-child`        | 142_01 Childish      | Pella (both arms on cabbage)              |
| `idle-soft`         | 77_02 standing, 0.6x | all six                                   |

`fetch-cmu.sh` downloads the takes into `cmu/` (untracked); `CMU_DIR` points elsewhere. Shipping any sheet adds the takes
to `NOTICE.md` and `src/content/credits.ts` beside the existing CMU lines.

## Per character

`<char>-g/ledger.json` (every job: id, endpoint, prompt and settings, seed, inputs, billed generations, verdict),
`assembly.json` (the take each heading uses), `review/` (sheets, `gates.json`, `faults.md`), `design/kp` (keypoints sent),
`design/prev` (skeleton previews over the rotation).

The PixelLab account is shared with other sessions, so `balance_before` / `balance_after` move with their spend too; a
job's own cost is its billed `gens`.

Not toned: the thug's frozen tone (`thug-actions-g/tone`) is tuned to his skin and palette; Kaya, whose base these are
edited from, ships untoned. Packing (the `enemy-g.ts` placement rules and pins) happens only when a sheet is chosen to ship.

## Results (2026-10-27)

| Character | Gens | Review                           | Main faults (full list in `review/faults.md`)                                              |
| --------- | ---: | -------------------------------- | ------------------------------------------------------------------------------------------ |
| household | 62.8 | `household-g/review/sheet-*.png` | idle boil 20-29%                                                                           |
| watch     | 62.8 | `watch-g/review/sheet-*.png`     | idle boil 20-32%; east walk retaken (arm swing); faint ghost leg in east cel 7; spear tilt |
| mira      | 65.8 | `mira-g/review/sheet-*.png`      | idle boil 20-35%; short shuffle may slide; stick hand ambiguous W/SW                       |
| gao       | 59.8 | `gao-g/review/sheet-*.png`       | idle boil 21-47%                                                                           |
| pella     | 88.4 | `pella-g/review/sheet-*.png`     | rotation strays (cleaned); cabbage hugged vs held out between headings; idle boil 21-38%   |
| dorin     | 62.8 | `dorin-g/review/sheet-*.png`     | idle boil 21-46%; N/S stride 13-14 px below line (packed 4-5 px higher)                    |

Idle boil is measured after the best whole-body shift of up to 3 px; Kaya's shipped idles measure 6-17%. It is PixelLab
redrawing small detail each cel, not the motion: a quieter motion and an 8-cel take did not lower it on Pella.
