# ADR 0051: Sura and Bo take G locomotion, and the units budget grows for the party set

**Status:** Accepted  
**Date:** 2026-09-26

Extends ADR 0050 to Sura and Bo, amends its placement rules, and supersedes the
4.75 MiB units ceiling of ADR 0035. Jared approved raising the unit-art budget
through an ADR on 2026-09-26.

## Context

Sura's and Bo's PixelLab G eight-way walk and idle sets are approved
(party-consistency, 2026-09-25; Bo's mouth fix applied, palettes kept as
drawn). They are the same shape as Kaya's: 192 px root-locked cels, four idle
and twelve walk cels per heading, a `gates.json` per walk with the measured
root travel, and `checks.json` with the planted sole's offset from the idle
baseline. They replace the four-way `walking-sura` and `walking-bo` sheets,
which the party uses as followers in explore and as units in battle
(ADR 0010).

The units family cannot hold them. On `main` it measured 4,950,063 bytes
against a 4,980,736-byte (4.75 MiB) ceiling, 30,673 bytes of room.

The G party will grow. After walk and idle, each of Kaya, Sura and Bo is
planned to gain a fighting stance (8 cels) and one bend (about 12-16 cels)
in every one of the eight headings.

## Decision

- `unit.water.sura` and `unit.earth.bo` use G atlases (`sura-g`, `bo-g`) on
  the ADR 0050 contract unchanged: `facing: 'both'`, the eight-way
  `locomotion` declaration, 0.75 nearest-neighbour scale into 128 x 192
  frames at 128 px a tile, anchor (0.5, 0.85), four idle cels at 4 fps,
  twelve walk cels at a nominal 114 ms, one rest cel per heading, and
  distance-phased walks at each heading's measured root travel
  (`speed_px_per_frame` in its `gates.json`), accumulated per route segment.
  Their existing cast and KO cels are kept as pinned source cels
  (`art/source/<name>-actions`, byte-exact crops of the retired sheets) and
  packed beside the locomotion, as Kaya's were. No recolour: the palettes
  stay as drawn.
- One build serves the party. `scripts/art/kaya-g.ts` becomes
  `scripts/art/g-sprites.ts --character <kaya|sura|bo>`, with a placement
  table and a pin file (`art/source/<name>-g/pins.json`) per character. The
  generalised build reproduced Kaya's shipped atlas and pins byte for byte
  before any placement changed.
- One placement rule for all three, measured on the placed cels (the
  `g-sprites.ts` header carries it in full):
  - walks put their planted sole on the idle baseline
    (`-round(planted_sole_minus_baseline x 0.75)`), except north, drawn
    level with its idle and left there;
  - a walk whose mean lowest row then sits more than 3.5 px below idle cel
    0's is raised the fewest pixels that bring it inside, and none is
    lowered past the 10 px sunk-stride bound (Bo's south-east stays at 0);
  - a walk whose head and torso sit more than 2 px from idle's (mean
    upper-body registration) moves by the rounded offset: every west walk
    (6-8 px), Sura's north, north-west and south-west and Bo's north and
    south-west (2-3 px);
  - the rest cel is the walk cel that best overlaps idle cel 0 among those
    that stand like idle: lowest row within 3 px of idle's, feet within
    10 px of the anchor column, head and torso within 4 px of idle's; where
    that pick is still mid-stride and a feet-together cel of the same walk
    meets the same limits, the stop takes it (Kaya north-west, Sura east, Bo
    north-east). That last step is judged by eye: leg-band and ground-contact
    widths were measured and neither separates a stride from feet together
    across side, front and diagonal views (side idles stand 17-19 px wide,
    and Bo's north-east stride is within 3 px of his idle's width), so no
    stance-width limit is added;
  - idle never moves, unless it stands outside the 6 px standing tolerance:
    Sura's north idle stood 7 px above the line and her whole north heading
    moves 1 px down.
- Applied to Kaya, the rule changes only what the reviews flagged: her
  north-east and north-west walks rise 1 and 2 px (their mean lowest rows
  sat 4.4 and 5.5 px below idle's), and her south, south-west and
  north-west stops take the cels that stand like idle (the south and
  south-west stops had stood on a lone foot 15-16 px off the column; the
  north-west stop is her feet-together cel 9). Her south stop, cel 10, is
  still a short stride: the one feet-together south cel (4) stands 12.7 px
  left of the column with her torso 4 px off, outside the stop limits.
  Her east walk measures within 1 px of idle by head, chest and upper-body
  registration, so it is not moved.
- `art:validate` holds the rule's results: each walk and rest clip's mean
  lowest row within 4 px of idle cel 0's in the same heading (Kaya as
  shipped measured N +0.6, E -0.25, W -0.17, S +3, NE +4.4, NW +5.5), and
  each rest cel's feet within 12 px of the anchor column. Both apply to
  every sheet that declares eight-way locomotion.
- **Units budget: 4.75 MiB to 6.75 MiB (7,077,888 bytes).** Every other art
  and audio family stays at 4 MiB, the precache at 25 MiB, and the
  JavaScript gate at 320 KB gzip (ADR 0048). All three G atlases are lossy
  alpha WebP at quality 90, validated on their decoded pixels against a
  SHA-256 pin per cel.

## Measurements

| Units family                       |         Bytes |      MiB |
| ---------------------------------- | ------------: | -------: |
| `main` before this change          |     4,950,063 |     4.72 |
| retire `walking-sura` (PNG + JSON) |      -288,351 |          |
| retire `walking-bo` (PNG + JSON)   |      -264,500 |          |
| add `sura-g` (WebP 300,684 + JSON) |      +327,096 |          |
| add `bo-g` (WebP 303,506 + JSON)   |      +329,636 |          |
| Kaya's re-placed cels, re-encoded  |          +412 |          |
| **After**                          | **5,054,356** | **4.82** |

Each G atlas is 2048 x 1728, 132 cels (128 locomotion, 4 action). At
quality 90 the three average 2,269 bytes a cel in WebP and 199 bytes a frame
in the atlas JSON.

The planned set adds 8 x (8 + 16) = 192 cels per character at the upper
bend length, 576 in all: 576 x (2,269 + 199) = 1,421,568 bytes, for a
planned units total of 6,475,924 bytes (6.18 MiB). The 6.75 MiB ceiling
leaves 601,964 bytes (about 9%) of headroom over that plan: a stance or bend
that encodes a quarter heavier than walk cels still fits, a fourth G
character does not.

| Gate                               |     Before |      After | Limit             |
| ---------------------------------- | ---------: | ---------: | ----------------- |
| Units family                       |   4.72 MiB |   4.82 MiB | 4.75 -> 6.75 MiB  |
| Precache (`dist/`, no source maps) | 18,613,061 | 18,717,207 | 25 MiB, unchanged |
| JavaScript, gzip                   |   313.0 KB |   313.0 KB | 320 KB, unchanged |

The planned set brings the precache to about 20,139,000 bytes (19.2 MiB), inside
25 MiB, so the precache ceiling does not move.

## Consequences

- Sura and Bo turn, walk, settle and idle in eight directions in explore
  and battle on both backends, with no code change beyond the manifest: the
  animator, renderers and validation already key off the declared
  capability (ADR 0050).
- The riverside still draws Sura and Kaya from their four-way village sheets
  (ADR 0047), so their walk clip and clip time are read from the sheet
  drawn there, not from the unit art (`src/app/village/riversidePose.ts`).
  Timed from the G gait instead, the four-cel village walk played 2.9-5.6
  times too fast (1,428 ms a tile east and 2,779 ms north against 500) and
  diagonals fell back to front and back cels; Kaya's riverside walk had done
  so since ADR 0050.
- Like Kaya's, their G walks are sharper and more pixel-art-forward than the
  painted maps and the rest of the cast. Their side walks are drawn with
  bent knees, so the head sits 3-6 px lower mid-stride than standing (Bo's
  south-east most); that is the art, not placement, and it is not
  rescaled.
- The north idles of all three stand 5-7 px above the other headings'
  (157-158 against 162-165 in the frame), so a turn in place to north lifts
  the feet. The standing tolerance accepts it; levelling every heading's
  idle to one line is a later, separate change.
- The stance and bend sets will not fit the 2048 px atlas beside
  locomotion (144 slots at 128 x 192; locomotion takes 132). Adding them
  needs a second atlas page per character or a smaller frame, and its own
  ADR; this one only budgets the bytes.
- `src/app/world/residentMotion.ts` derives a resident's footfall squash
  from 500 ms of clip a tile, the four-way gait. An eight-way sheet's clip
  time runs at its declared `walkMsPerTile` instead, so were a G character
  ever to stroll as a resident, its bob would drift from its feet. Every
  resident today draws an `npc.*` or village sheet, all four-way; the code
  carries the note where the constant is.
