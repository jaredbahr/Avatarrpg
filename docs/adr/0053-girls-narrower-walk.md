# ADR 0053: Kaya and Sura walk the narrower "A" gait

**Status:** Accepted  
**Date:** 2026-09-26

Amends ADR 0050, ADR 0051 and ADR 0052 for Kaya's and Sura's walks only.
Bo's walk is unchanged.

## Context

Jared found Kaya's and Sura's G walks stepped too wide for them, and approved
the narrower candidate "A" walks of party-consistency `girls-walk-v2` in all
eight headings on 2026-09-26 ("much, much better"). They are twelve 192 px
root-locked cels a heading, like the walks they replace, drawn from the same
first frame and camera (PixelLab `high top-down`), and gated for travel
direction, facing, feet against the idle baseline, height, root lock, leg
alternation, slip, one body and palette (`girls-walk-v2/stage2/REPORT.txt`).
Sura's are the `tone.py apply` outputs with the frozen parameters ADR 0052
records; re-running the tool on the untoned A walks reproduced all 96 frames
byte for byte. Kaya is not toned.

The narrower gait is also a shorter stride. Measured by planted-sole travel
per 114 ms cel, the A walks cover 3.4-3.8 source px walking north against
4.75-5.8 south, and 8-14 on the diagonals and sides, against the 6.1-13.6 of
the walks they replace.

## Decision

- **The walk cels are the A walks**, packed into page 1 of `kaya-g` and
  `sura-g` in the places the old walks had. The page layout, idle, stance
  (page 2, byte-identical), actions and every other rule are unchanged; no
  page is added.
- **Placement follows the ADR 0051 rule, re-measured on the A cels.** A
  measurement script that reproduced every shipped walk offset of the old
  walks gave the new ones:

  | walk dx, dy (px) | E    | NE    | N    | NW    | W    | SW    | S     | SE    |
  | ---------------- | ---- | ----- | ---- | ----- | ---- | ----- | ----- | ----- |
  | Kaya, was        | 0, 0 | 0, -2 | 0, 0 | 0, -1 | 6, 0 | 0, -1 | 0, -4 | 0, -1 |
  | Kaya, now        | 0, 0 | 0, -2 | 0, 0 | 0, -1 | 6, 0 | 0, -1 | 0, -4 | 0, 0  |
  | Sura, was        | 0, 1 | 0, -2 | 2, 0 | 2, 0  | 8, 0 | 3, 0  | 0, -3 | 0, -1 |
  | Sura, now        | 0, 1 | 0, -2 | 0, 0 | 0, 1  | 7, 0 | 3, 1  | 0, -4 | 0, -1 |

  Kaya's south-west takes 0 from the rule and rises 1 px, because at 0 its
  first cel's leading foot sits 11 px below the line, past the 10 px
  sunk-stride bound (as Bo's south-east is held at 0 for the same bound).

- **North stays on the line.** Seen from behind, the A walks' planted sole is
  the leading foot, 7.0-7.4 source px up-screen of the idle baseline (the old
  walks measured 6.1-6.5), so north keeps its exception: drawn level with its
  idle and moved with the whole heading by ADR 0052's levelling (Kaya 6 px,
  Sura 7). Placed, the north walks' mean lowest row sits 1.3 px (Kaya) and
  1.1 px (Sura) below idle cel 0's, which stands on the foot line, row 163.
- **The stops are re-picked by the same rule**, the best-overlapping cel that
  stands like idle, then by eye a feet-together cel where that pick is
  mid-stride: Kaya E 3, NE 9, N 9, NW 3, W 3, SW 3, S 2, SE 9; Sura E 3, NE 9,
  N 2, NW 9, W 3, SW 3, S 2, SE 9. Kaya's south stop is now a near feet-together
  cel (ADR 0051 had left it on a short stride).
- **The walks are timed from their own strides.** `G_TRAVEL` in the manifest
  takes each A walk's `speed_px_per_frame`, so `walkMsPerTile` rises with the
  shorter strides (Kaya north 3,049 to 5,107 ms a screen tile, Sura north
  2,779 to 5,792). Route duration stays gameplay-timed (280 ms a tile); only
  the distance-phased cel choice changes, as ADR 0050 set it. Kept on the old
  timing, the new cels slid 0.5-2.8 px a cel at game scale; timed from their
  own strides they slide 0.3-0.6 px, against 0.3-0.8 for the old walks.
- The riverside is unchanged: it draws both from their four-way village
  sheets at that sheet's 500 ms a tile (ADR 0051), and no resident uses a G
  sheet.

## Measurements

| Gate             |     Before |      After | Limit               |
| ---------------- | ---------: | ---------: | ------------------- |
| Units family     |  5,438,925 |  5,426,243 | 6.75 MiB, unchanged |
| `kaya-g.webp`    |    294,628 |    288,328 |                     |
| `sura-g.webp`    |    280,520 |    274,138 |                     |
| Precache         | 19,102,834 | 19,090,146 | 25 MiB, unchanged   |
| JavaScript, gzip |   313.4 KB |   313.4 KB | 320 KB, unchanged   |

## Consequences

- Kaya and Sura walk with narrower, lighter steps in every heading, in
  explore and battle, on both backends; their idles, stances, stops' rules
  and Bo are unchanged.
- The shorter north strides need more cels a tile: at the 280 ms a tile the
  party walks, a north cel is on screen about 8-9 ms (15-16 ms before), so at
  60 Hz the north walk shows about every other cel. The feet stay planted,
  but a slower walk speed north, or a faster-travelling north walk, is a
  separate change.
