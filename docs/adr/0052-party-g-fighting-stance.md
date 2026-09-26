# ADR 0052: The G party fights from its stance, on a second atlas page

**Status:** Accepted, amended by ADR 0053  
**Date:** 2026-09-26

Amends ADR 0050 and ADR 0051. Jared approved raising the unit-art budget
through an ADR on 2026-09-26; measured, this change does not need it, and the
ceiling stays where ADR 0051 set it.

## Context

The PixelLab G fighting stances for Kaya, Sura and Bo are approved
(party-combat-se, 2026-09-25 and 2026-09-26): an 8-cel guard loop at 150 ms a
cel in all eight headings, drawn on the same 192 px root as each heading's
idle (idle cel 0 is the base still they were generated from), gated for one
body a cel, size pop, planted-foot drift and facing. Every idle, walk and
stance request used one camera, PixelLab `high top-down`. The bends drawn
with them are not approved yet (a redo is pending) and do not ship.

In a fight the party stood in its idle: `CombatScene` asked the animator for
`idle` as the resting pose.

Jared ruled on 2026-09-26 that Sura and Bo take half-strength tone toward
Kaya's brightness, skin excluded, Kaya unchanged (party-consistency
`tone/tone.py` with frozen `tone/params.json`).

ADR 0051 left two things open: the stance does not fit the 2048 px atlas
beside locomotion (a 2048 px page holds 160 frames of 128 x 192; locomotion,
rest and actions take 140), and the three north idles stood 5-7 px above the
anchor's foot line, so a turn in place to north lifted the feet.

## Decision

- **A fighting stance is a clip family.** `stance`, `stanceNorth` ...
  `stanceNorthWest` join the clip vocabulary (1-8 cels). A sheet that carries
  one must declare eight-way locomotion and carry all eight headings. A sheet
  without one draws its idle for the same heading (`resolveClip`), so the
  four-way party (Lin Mei, Nilak, Tenzo and the rest) is unchanged.
- **Combat rests its party in the stance.** `CombatScene` asks
  `Animator.locomotion` for `stance` where it asked for `idle`: walk, then the
  one-cel rest stop, then the guard loop in the heading the unit last faced.
  Enemies, explore and the riverside are unchanged. A cast, hit or KO still
  plays its preserved legacy cel, as before.
- **Both backends read one test.** A `facing: 'both'` sheet draws its idle,
  walk, rest and stance unflipped; `authoredForBothSides(clip)` in
  `clips.ts` is that test, and Canvas 2D and WebGL both call it (ADR 0002).
- **A sheet may span atlas pages.** `SheetEntry.atlasPages` lists further
  atlas JSON files beside `atlas`, each with its own image, each within
  2048 px. A frame name lives on exactly one page. The sheet store loads every
  page before the sheet draws, so a clip never draws from half a sheet, and
  any failed page fails the whole sheet to its drawn placeholder. The frame a
  backend receives carries its own page image, which the WebGL texture cache
  already keys on. `art:validate` holds every page to the same checks, and
  rejects a frame on two pages. Each G character ships page 1
  (`<name>-g.webp`, 2048 x 1728, locomotion and actions, unchanged layout) and
  page 2 (`<name>-g-2.webp`, 2048 x 768, the 64 stance cels).
- **Stance placement** (`scripts/art/g-sprites.ts`, measured on the placed
  cels): the stance takes idle's place in its heading, never moved sideways,
  since it is drawn on idle's root; then the walks' rule applies to it: where
  its mean lowest row sits more than 3.5 px from idle cel 0's, it moves the
  fewest pixels that bring it inside. A guard stands feet apart, so facing
  the camera the forward foot reaches 5-6 px below idle's feet, and facing
  north-west the feet stand up to 5 px above them.

  | Stance dy (px) |   E |  NE |   N |  NW |   W |  SW |   S |  SE |
  | -------------- | --: | --: | --: | --: | --: | --: | --: | --: |
  | Kaya           |   0 |   0 |   0 |  +1 |   0 |   0 |  -2 |   0 |
  | Sura           |   0 |   0 |   0 |  +1 |   0 |   0 |  -2 |   0 |
  | Bo             |   0 |   0 |  -1 |  +2 |   0 |  -1 |  -3 |   0 |

  `art:validate` holds each stance to the stride's envelope per cel (feet no
  more than 12 px above where the figure stands, 10 below the line, their
  centre within 32 px of the column, since the forward foot of a guard
  reaches 22 px from it) and to the 4 px mean-foot-row tolerance per clip.
  Shipped, every stance clip's mean lowest row sits -3.0 to +3.4 px from its
  idle's.

- **North stands on the line.** Every north heading (idle, walk, rest and
  stance together) moves down onto the anchor's foot line, row 163: Kaya
  6 px, Sura 6 px more (7 in all, with ADR 0051's 1) and Bo 5 px. The north
  walks keep their relation to idle (Kaya's mean lowest row still 0.6 px
  below).
- **Sura and Bo ship toned.** Their idle, walk and stance sources are
  `tone.py apply` outputs with the frozen parameters (SHA-256
  `1def5d5cc54037e0670d6a8eae7f2dc27d6888b263bb196c10bf83bea9c1374d`,
  recorded in their pin files). Re-running the tool reproduced the
  supervisor's 384 toned frames byte for byte; its gates held (alpha and
  skin identical, outline weight unchanged). Decoded from the shipped
  atlases, every one of the 140 page-1 cels has alpha byte-identical to
  main's, north compared after undoing its shift. Kaya is not toned. The
  preserved legacy cast and KO cels are not PixelLab frames and are not toned.
- **Units budget stays 6.75 MiB.** Measured below, the stance fits with the
  bends still to come inside the ADR 0051 ceiling, so the approved raise is
  not taken. Every other ceiling is unchanged.

## Measurements

| Units family                                |         Bytes |      MiB |
| ------------------------------------------- | ------------: | -------: |
| `main` before this change (6c65127)         |     5,054,356 |     4.82 |
| add `kaya-g-2` (WebP 129,582 + JSON 12,187) |      +141,769 |          |
| add `sura-g-2` (WebP 121,930 + JSON 12,251) |      +134,181 |          |
| add `bo-g-2` (WebP 129,858 + JSON 12,121)   |      +141,979 |          |
| `sura-g` toned, north levelled, re-encoded  |       -20,164 |          |
| `bo-g` toned, north levelled, re-encoded    |       -13,412 |          |
| `kaya-g` north levelled, re-encoded         |          +216 |          |
| **After**                                   | **5,438,925** | **5.19** |

A stance cel costs 1,986 bytes of WebP and 190 of JSON, against 2,269 and
199 for a walk cel. The bends still to come are about 8 x 16 x 3 = 384 cels:
at the walk rate 947,712 bytes (units 6,386,637, 6.09 MiB), and a quarter
heavier 1,165,440 (6,604,365, 6.30 MiB), inside 6.75 MiB (7,077,888) with
473-691 KB to spare. They need a third page per character (page 2 has 96
free slots), which `atlasPages` already allows.

| Gate                               |     Before |      After | Limit               |
| ---------------------------------- | ---------: | ---------: | ------------------- |
| Units family                       |   4.82 MiB |   5.19 MiB | 6.75 MiB, unchanged |
| Precache (`dist/`, no source maps) | 18,717,166 | 19,102,852 | 25 MiB, unchanged   |
| JavaScript, gzip                   |   313.1 KB |   313.4 KB | 320 KB, unchanged   |

Decoded, each page 2 is 2048 x 768 RGBA, 6.3 MB of texture per character
while the party is in view.

## Consequences

- The party stands guard between moves in every heading on both backends;
  a four-way party member stands in its idle as before.
- A turn in place to north no longer lifts the feet. The south idles still
  stand 3-4 px above the line and the north-east and north-west 3-5 px, inside
  the standing tolerance; they are not moved here.
- A hit still shows the preserved east/west idle or legacy cel, and the
  cast is still the legacy side cel, so a unit facing north cuts from its back
  guard to a side cast. The approved bends, when they ship, replace that.
- Page 2 costs one more JSON and image request per G character when it
  first draws.
