# The Ba Dan residents and the forest bandits at native G1 (ADR 0091)

The six Ba Dan resident families (household adult, relief watch, Mira, Gao, Pella, Dorin) and the three forest bandits (thug,
slinger, bruiser) on the world's own grid: 1 art px = 1 world px, 64 px a tile, a 64x96 cel, by **the party's recipe**
(`art/source/party-g1/README.md`, ADR 0089). This folder is the whole source of the nine shipped sheets.

## What each family ships (unchanged clip names, frame lists and timing)

| family                                                | clips                                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| residents (household, watch, Mira, Gao, Pella, Dorin) | idle (4 cels), walk (8) and rest (1) in eight headings                                                                      |
| bandits (thug, slinger, bruiser)                      | the same, plus hits (8 headings, 4 cels), knockouts (4 diagonals, 7 cels), the mirrored legacy cast (3), hit (1) and KO (1) |

No resident has a bend or an attack; the bandits' only attack is the legacy `cast`. The bandits have no fighting stance, so
their hits and knockouts start and end on idle cel 0, as they did.

## The recipe, step by step

Every PixelLab call goes through `tools/pl.py` (copied from the party's), which writes the job to `ledger.json` and returns
a job the ledger already holds instead of paying twice. Run everything from the repo root with `python3 -I`;
`PIXELLAB_API_KEY` must be set (never printed).

| step | tool                                            | what it does                                                                                                                                                                                                        | cost       |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 0    | `extract.py`, `reduce.py`                       | cut the shipped G cels out of main's atlases into `ref/` (untracked) and reduce them 2x into `b/` (the party's reduce, unchanged)                                                                                   | 0          |
| 1    | `gen_root.py SEED name:kind:dir[:cel]`          | redraw each heading's shipped idle cel natively at 64x96 (the bruiser's 80x96), and the bandits' three legacy cast cels (`edit-image-pro-flash`)                                                                    | 5 a job    |
| 2    | `curate.json`, `roots_palette.py`, `curate.py`  | pick one candidate per heading (reasons in `why`); cut one palette per name from its own picks; palette-lock the picks into `roots/`                                                                                | 0          |
| 3    | `skeletons_g1.py name:idle:canvas`              | `estimate-skeleton` on each root on the 96 canvas (walks, hits) and, for the bandits, the 128 canvas (knockouts)                                                                                                    | 0.1 a call |
| 4    | `motion.json`, `motion.py name cand`            | the party's CMU retarget, unchanged but for the canvas origin of a cel wider than 64 px                                                                                                                             | 0          |
| 5    | `gen_clip.py SEED name:cand:dir`                | `animate-with-skeleton-v3`, first frame the padded root, one CMU skeleton per frame                                                                                                                                 | 3 a job    |
| 6    | `breath.py`                                     | the idle (4 cels) from one root: the party's 77_02 breath cycle, a 1 px chest lift, no generation                                                                                                                   | 0          |
| 7    | `assembly.json`, `assemble.py`                  | which take each clip uses; palette lock, island clean, registration, trimming; writes `cels/<name>/` and `pack.json`                                                                                                | 0          |
| 8    | `node --import tsx scripts/art/residents-g1.ts` | lay out, encode lossless WebP, write the atlases, the bandits' clip data and `src/content/assets/banditsG1.ts`, pin every decoded cel in `pins/` (run `npx prettier --write src/content/assets/banditsG1.ts` after) | 0          |
| 9    | `review_g1.py`, `compare.py SHOTS`              | `review/`: walk strips and GIFs, faces, the bandits' actions, `metrics.json`; the before/after composites from the review captures                                                                                  | 0          |

`shipped/` freezes the bandits' clip data as of main `d815440`: the frame lists and timing this rebuild keeps exactly.
`tools/cmu/` is downloaded by `fetch-cmu.sh` (untracked).

### Where this differs from the party's recipe

1. **The palette is cut from the roots, not from the shipped cels** (`roots_palette.py`, 40 colours plus `#1b1410`). The
   residents' and bandits' shipped cels are soft painted art; locking the redraws to their 48-colour cut put a flat coat
   between two muddy entries (the watch's coat alternated between them) and turned the thug's red bandana brown. The
   roots already carry the identity, and one palette per name still keeps every heading and frame from flickering. The
   takes were then regenerated from the re-locked roots (seed 9711), so a figure does not change colour when it starts
   to walk; the s9701 takes stay in `raw/` and the ledger as history. The skeletons were estimated on the first lock;
   the alpha is identical, so they stand.
2. **8 walk cels, not 12**: the shipped resident and bandit walks are eight cels (the manifest's enemy stride timing);
   one 08_01 gait cycle is sampled at 8. The rest cel is a passing cel (2 or 6) whose feet stand within art:validate's
   rest bound, else any walk cel that does (Mira's south: her stick tip sits in the lowest rows).
3. **Idle only breathes**: no fighting stance; hits and knockouts register on idle cel 0, as the shipped bandit clips did.
4. **Wider cels for the clubs**: the bruiser's root is 80 px wide (his shipped cel was 160 at 2x); the thug's and the
   bruiser's packed cels are 80 and 96 px (`pack_w`) because the club's swing in the west-side walks reached past the
   64/80 px cel and was being clipped. Every cel is centred on the wider one, so the feet keep the anchor column.
5. **Clearance**: a walk whose ink still enters the 4 px clear margin moves the fewest pixels, at most 2, that clear it.
6. **Knockout hold**: the take's last cel (CMU 90_18 frame 170) smeared or ghosted in about half the diagonals (the
   bruiser's south-west stood back up), so on every diagonal cel 6 repeats cel 5 (frame 142, already lying flat). The
   clip's frame list and timing are unchanged.
7. **The legacy cast is redrawn, not animated**: the old sheet's three cast cels, each redrawn at 64x96 from its 2x
   reduction like a root. The one-cel `hit` is the east hit's deepest flinch (cel 2) and `ko` the south-east knockout's
   last cel, each a trimmed cel with its own rectangle and anchor (`banditsG1.ts`).

## Motion (all CMU Graphics Lab, mocap.cs.cmu.edu; credited in `NOTICE.md`)

| clip                      | take           | notes                                                                        |
| ------------------------- | -------------- | ---------------------------------------------------------------------------- |
| walk, 8 cels, 8 headings  | 08_01 walk     | one gait cycle from a left-foot contact, root-locked; track 0.35, bob x2     |
| idle, 4 cels              | 77_02 standing | one breath cycle on one root, 1 px chest lift (`breath.py`)                  |
| hit, 8 headings (bandits) | 79_73 (48-72)  | idle, H1, H2, H3 (H2 at 0.4), idle; amplitude 1.35 (as the thug's, ADR 0063) |
| knockout, 4 diagonals     | 90_18 (64-170) | the party's and the thug's bone-rotation retarget; cel 6 holds cel 5         |

## Generations

| endpoint                   | jobs | generations |
| -------------------------- | ---: | ----------: |
| `edit-image-pro-flash`     |   85 |       425.0 |
| `animate-with-skeleton-v3` |  219 |       609.0 |
| `estimate-skeleton`        |   12 |         9.6 |
| **total**                  |  316 | **1,043.6** |

About 320 of the animation generations are the superseded first round (s9701, s9702), animated from roots locked to the
shipped palette (see "Where this differs", 1); they stay in `raw/` and the ledger. Balance after: about 744.

Measured (`review/metrics.json`, world grid): 12-33 colours a cel; idle boil 2-9% (#290's measure); the two walk contacts
land 0-2 px apart (most 0-1); every walk's mean foot row is within 1.75 px of its idle's.

## Fault list

- **The watch's south-east walk** loses the spear in cels 1-2 and 6-7 (two seeds, s9701 and s9702, did the same).
- **The bruiser's north-west walk**: his club, hidden in front of him in the idle, swings in from behind his left side in
  cels 1-2 before it settles in his right hand (three seeds did this).
- **Dorin's spear** keeps a small split point in the south-east heading, and is mostly hidden behind him in the north-west,
  as in his shipped cel.
- **Gao**: the pepper string at his shoulder reads as a dark brown strap at game zoom, his grey-flecked beard picks up a few
  green-grey pixels, and the north-east back keeps a pale waterskin edge at the hip (the first seed drew a white X strap).
- **Tonal mottle**: the redraws carry a little cloth texture (the watch's coat, Gao's beard) that reads as noise at 4x and
  as cloth at 1x.
- **Foot specks**: a few south walk cels (Gao, Pella, the slinger) keep a 1-2 px toe or shadow pixel under the sole; it
  touches the body, so the island clean keeps it.
- **The thug's south-west knockout** has a faint smudge beside the head in its fourth cel.
- **Knockout hold**: every knockout's last cel repeats cel 5, so the fall loses its final settle (the take's own last cel
  smeared too often).
- **Mira's south rest** is a contact cel (0), not a passing cel: both passing cels put her stick tip off the rest bound.
- **Captures**: canvas backend only; the WebGL pass timed out on this container's software rasteriser.

## Review files (`review/`)

| file                                                 | what                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ingame/ba-dan-slice-{before,after}.png`             | `e2e/ba-dan-demo.review.ts` slice at game zoom, canvas backend, main `de7d933` vs this branch |
| `ingame/ba-dan-figures-4x.png`                       | Gao, Mira and the household adult cropped from the slice at 4x, before over after             |
| `ingame/forest-*-{before,after}.png`                 | `e2e/forest-g1.review.ts`: the fit, the 96 px move, props and aimed-jab frames                |
| `ingame/forest-bandit-2x.png`                        | Kaya and the thug at the aimed jab, 96 px tiles, 2x nearest, before over after                |
| `faces/faces-4x-before-after.png`                    | idle cel 0's head, S and SE, at 4 screen px per world px: shipped over G1                     |
| `faces/<name>-faces-4x.png`                          | S, SE, E and SW heads of the G1 idle at 8x                                                    |
| `walk/<name>-walk.png`, `walk/<name>-walk-<dir>.gif` | idle cel 0, the 8 walk cels and the rest cel in every heading at 3x; GIFs at 114 ms a cel     |
| `walk/walk-se-before-after.png`                      | the south-east walk of every name, shipped (at half size) over G1                             |
| `actions/<name>-actions.png`                         | the bandits' hits, knockouts and legacy cast, hit and KO                                      |
| `curate/<name>-<kind>.png`                           | the curation sheets: each heading's reduced shipped cel over every root candidate             |
| `metrics.json`                                       | colours a cel, idle boil, walk contact rows, the walk's mean foot row against idle's          |

The WebGL captures were not taken: on this container's software rasteriser the demo slice timed out (the CI runners
take the 2D path for the same reason, `CLAUDE.md`).

## Rebuild

```sh
python3 -I art/source/residents-g1/tools/extract.py     # ref/ from main's atlases (untracked; run on d815440's sheets)
python3 -I art/source/residents-g1/tools/reduce.py household watch mira gao pella dorin thug slinger bruiser
sh art/source/residents-g1/tools/fetch-cmu.sh           # tools/cmu/ (untracked)
python3 -I art/source/residents-g1/tools/roots_palette.py
python3 -I art/source/residents-g1/tools/curate.py
python3 -I art/source/residents-g1/tools/breath.py
python3 -I art/source/residents-g1/tools/assemble.py
node --import tsx scripts/art/residents-g1.ts && npx prettier --write src/content/assets/banditsG1.ts
python3 -I art/source/residents-g1/tools/review_g1.py
```

`motion.py` needs `tools/cmu/`; the design JSON it wrote is tracked, so the steps above rebuild the shipped sheets from
tracked files and the ledgered `raw/` takes alone.
