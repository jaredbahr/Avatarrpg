# ADR 0091: The Ba Dan residents and the forest bandits at the world's native G1 grid

**Status:** proposed, 2026-10-28 (draft PR for the owner's review)

Follows ADR 0089 (the party at native G1), whose recipe this applies, and ADR 0085 (Route A: one art pixel a world pixel).
Changes nine sheets, their grid, their asset format and the units budget's measured use, so it is recorded here.

## Context

With Kaya, Sura and Bo on the world's grid (ADR 0089), the six Ba Dan resident families (household adult, relief watch,
Mira, Gao, Pella, Dorin) and the three forest bandits (thug, slinger, bruiser) were the last figures in the first two
scenes still drawn as the old G sheets: a 128x192 cel (the bruiser's 160x192), soft painted edges and hundreds of colours a
cel, drawn at half size. Beside the party and the G1 ground they read as a finer, softer hand. The owner asked for
"consistent art and animation"; the party's README names the residents and bandits as the recipe's next users.

## Decision

**Grid.** The nine sheets are packed at 64 px a tile (`RESIDENT_SHEET_PX_PER_WORLD_PX = 1`): a 64x96 cel, the foot anchor
where it was (0.5, 0.85), the same pages (`<name>-g`; for a bandit also `-g-2` knockouts and `-g-3` hits and
`<name>-g-clips.json`), the same clip names, frame lists and timing, so exploration, the Ba Dan scene and combat play them
unchanged. The thug's and the bruiser's cels are 80 and 96 px wide (ADR 0032's wider cel): the club's swing in their
west-side walks reached past a 64/80 px cel. Pages are lossless WebP; `scripts/art/residents-g1.ts` packs them and pins
every decoded cel in `art/source/residents-g1/pins/`, which `art:validate` holds the sheets to.

**The party's recipe** (`art/source/residents-g1/README.md` has every step): each heading's idle redrawn natively from its
own shipped cel reduced 2x (`edit-image-pro-flash`), curated per heading with every non-default pick's reason in
`curate.json`; the idle breathes on one root to CMU 77_02 (1 px chest lift, nothing redrawn); the walk is CMU 08_01
retargeted onto each root's estimated skeleton with the party's two corrections (legs from the root's leg midpoints, track
0.35, bob x2), sampled at the shipped 8 cels; ADR 0050's registration places each heading. The bandits' hits (79_73) and
knockouts (90_18) are the takes they already used, retargeted onto the new roots, and start and end on idle cel 0 because a
bandit has no fighting stance.

**Four departures from ADR 0089, each forced by these sheets:**

1. _The palette is cut from the curated roots_ (40 colours plus `#1b1410` per name), not from the shipped cels. The shipped
   residents and bandits are soft painted art; locking the redraws to their muddy cut made a flat coat alternate between
   two entries and turned the thug's red bandana brown. One palette per name still keeps every heading and frame on the
   same colours. The takes were regenerated from the re-locked roots, so a figure keeps its colours when it starts to walk.
2. _Knockout hold._ The take's last cel (90_18 frame 170) smeared or ghosted in about half the diagonals, and the
   bruiser's south-west stood back up; cel 6 now repeats cel 5 (frame 142, already lying flat) on every diagonal. Frame
   list and timing are unchanged.
3. _The legacy cast is redrawn, not animated._ The bandits' mirrored three-cel `cast` is the old sheet's swing, each cel
   redrawn at 64x96 like a root. Their one-cel `hit` and `ko` become trimmed cels (the east hit's deepest flinch, the
   south-east knockout's last cel) with their own rectangles and anchors (`src/content/assets/banditsG1.ts`, generated),
   as the party's cast and KO are.
4. _A walk may move up to 2 px sideways_ to keep a swinging prop out of the clear margin (Mira's west stick).

**Retired.** `resident-g.ts`, `thug-g.ts`, the thug's, slinger's and bruiser's clip packers and `enemy-clips.ts`
described sheets that no longer ship; their art sources stay as the record, each README marked as history. `enemy-g.ts`
and `bandits-g.ts` remain for the quarry bender, still a 128 px G sheet.

## Budget

|                                      | before (main `de7d933`) |    after |
| ------------------------------------ | ----------------------: | -------: |
| units family                         |                 6.41 MB |  5.13 MB |
| the nine sheets, pages and clip data |                 2.63 MB |  1.30 MB |
| precache                             |                20.72 MB | 19.45 MB |

No ceiling is raised. Generations: 1,043.6 of the 1,884 on the account at the start, in 316 jobs; about 320 of
them are the superseded first round of takes (every job, seed and verdict is in `art/source/residents-g1/ledger.json`).

## Consequences

- Every figure in Ba Dan and on the forest road is drawn by one hand: a crisp dark contour, 12-33 flat colours a cel, no
  soft edge, at the world's pixel.
- Known faults ship as they are, pending review (the README lists them all): the watch's south-east walk drops its spear
  in four cels; the bruiser's north-west club swings in from behind his left side; Dorin's south-east spear point is split;
  Gao's peppers read as a dark strap; every knockout ends on a held cel 5; a few 1-2 px foot specks.
- Credits: CMU 08_01 and 77_02 are credited for the residents' and bandits' walks and breathing; the Mixamo walk credit
  narrows to the quarry bender.
