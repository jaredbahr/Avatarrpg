# ADR 0054: The riverside draws Kaya and Sura from their G sheets

**Status:** Accepted  
**Date:** 2026-09-28

Amends ADR 0018, ADR 0051 and ADR 0053 where they keep the riverside on the
four-way village sheets. Roster audit item P0.2 (model-roster `REPORT.md`,
2026-09-27): code and data only, no generations.

## Context

Everywhere but the riverside, Kaya and Sura are their PixelLab G sets: eight
literal headings, 12-cel distance-phased walks, one-cel stops (ADR 0050,
ADR 0051, ADR 0053). The riverside still swapped both for the older painted
four-way sheets `riverside-locomotion-{kaya,sura}` (ADR 0018), so the party
changed style and gait at the riverside and snapped between four headings
there. `riversidePose.ts` existed only to time that swap from the drawn sheet
(ADR 0051 consequences). Bo was already drawn from his G sheet there.

Those sheets had two things the G sets do not: a two-cel wave and the
two-cel seated tea (`docs/art/riverside-tea.md`), which the Wave button and
the tea break play.

The life layer that draws the riverside party is one Canvas 2D stage above
either board backend. It mirrored every sheet frame by the actor's facing,
so a G walk west was drawn as its west cel flipped (Bo's riverside walk had
done that since ADR 0051).

## Decision

- **The riverside draws each party member's own sprite.** `unit.village.*`
  and `riversidePose.ts` are gone; the explore scene hands the life layer the
  same clip, facing and clip time it computes for every map.
- **Wave and tea ride on a small lossless page of the G sheet.** Kaya's and
  Sura's G sheets gain a third atlas page, `riverside-{kaya,sura}.png`
  (512 x 192, four 128 x 192 cels) with `wave` (2 cels, 4 fps) and `tea`
  (2 cels, 0.25 fps), as before. The wave cels are byte-exact crops of the
  retired sheets, kept as sources in `art/source/<name>-riverside/wave/`; the
  tea cels are rebuilt from the reviewed imagegen strips by the original
  packing, which reproduced the shipped cels byte for byte.
  `scripts/art/riverside-page.ts` builds both pages and replaces
  `riverside-tea.ts`. Like cast and KO these are preserved legacy side cels:
  mirrored by facing, not authored for both sides. Their tops (rows 42-43)
  sit below the G cels' (33-37), so the battle health bar does not move.
- **Pins cover lossy pages.** `art:validate` holds a cel to its pin only when
  it lives on a WebP page; a PNG page is lossless and is checked as any PNG
  sheet is (size, margin, one page per frame).
- **The life layer flips like the backends.** A frame drawn from a
  `facing: 'both'` sheet in a clip `authoredForBothSides` accepts (idle, walk,
  rest, stance) is drawn unflipped, figure and cast shadow alike; everything
  else still mirrors by facing.
- **The walk is phased at the riverside's figure scale.** A G sheet's
  `walkMsPerTile` is its measured stride at one tile to 128 atlas px. The
  life layer draws figures at `FIGURE_SCALE` = 1.45 tiles to 128 px, so one
  stride covers 1.45 times the ground and the clip advances
  `walkMsPerTile / 1.45` a tile (`riversideWalkTime`); unscaled, the feet
  slide backwards. Four-way sheets keep the fixed 500 ms a tile. The old
  village sheets' 8 fps side walk halving goes with them.
- Resident motion is unchanged: no resident draws a G sheet, and
  `residentMotion.ts` still carries the note for when one does.

## Measurements

| Units family                                    |         Bytes |      MiB |
| ----------------------------------------------- | ------------: | -------: |
| before (`main`, 6d5efa7)                        |     5,426,243 |     5.17 |
| retire `riverside-locomotion-kaya` (PNG + JSON) |      -261,188 |          |
| retire `riverside-locomotion-sura` (PNG + JSON) |      -305,646 |          |
| add `riverside-kaya` (PNG 43,873 + JSON 859)    |       +44,732 |          |
| add `riverside-sura` (PNG 49,405 + JSON 863)    |       +50,268 |          |
| **After**                                       | **4,954,409** | **4.72** |

Net -471,834 bytes. Dropping wave and tea instead would have saved the
audit's full 566,834, at the cost of the Wave gesture and the tea break's
seated pair; generating G wave and tea cels later can retire the page.

| Gate (after, `npm run ci:local`)   |      After | Limit               |
| ---------------------------------- | ---------: | ------------------- |
| Units family                       |   4.72 MiB | 6.75 MiB, unchanged |
| Precache (`dist/`, no source maps) | 18,577,172 | 25 MiB, unchanged   |
| JavaScript, gzip                   |   313.5 KB | 320 KB, unchanged   |

## Consequences

- Kaya and Sura keep one look and one eight-way gait from the village to the
  riverside, on both backends, and turn to diagonals there.
- The wave and the seated tea are still the painted legacy cels, now beside
  G locomotion. A G wave and tea (a few gens per heading used) would replace
  the page without a code change.
- Kaya's and Sura's G sheets load one more small page wherever they draw,
  including battle: one request and a 512 x 192 texture each.
