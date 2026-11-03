# ADR 0089: The party at the world's native G1 grid

**Status:** proposed, 2026-10-27 (draft PR for the owner's review, issue #284)

**Amended by ADR 0094 (2026-10-28):** the figures are drawn at 1.0 on oblique boards, not 1.25, so they sample
nearest at every integer zoom.

Follows ADR 0085 (Route A: one art pixel a world pixel), ADR 0086 (the effects at G1) and ADR 0087 (the forest road at
G1). Changes the party's sheets, their grid, their asset format and the units budget's measured use, so it is recorded
here. ADR 0088 is reserved for the camera.

## Context

Ba Dan and the forest road are drawn at G1; Kaya, Sura and Bo were still the G sheets, twice as fine: a 128x192 cel,
128 px a tile, about 900 colours a cel and a soft edge, drawn at half size. Draft #290 compared three ways to put them on
the world's grid, and the owner chose its variant A on 27 October 2026 ("1. Rebuild."): natively redrawn PixelLab art at
about 59 px tall, motion from motion capture. #290 listed what A had to fix before it shipped:

1. **Identity per heading.** Its rotations drifted: Kaya's boots lighter, a gold hem, a gibberish "L" on the hip, a
   board-like coat tail seen from the east; Sura's braid missing from the back views or sticking straight out.
2. **Idle flicker.** Its idles boiled 36-54% against the shipped 14-26%.
3. **Foot registration.** The two steps of a walk landed 5-7 px apart on screen, with no head bob.

## Decision

**Grid.** The three sheets are packed at 64 px a tile: a 64x96 cel, the foot anchor where it was (0.5, 0.85), the same
pages (`<name>-g`, `-g-2` stance, `-g-3` knockouts, `-g-4` hits, `-g-bend`), the same clip names, frame lists, holds,
timing, key frames, attacks and sockets' meaning, so combat, exploration and the Ba Dan practice play them unchanged.
`pixelsPerTile` accepts 64; the renderer already draws any grid by its pixels a tile. Pages are lossless WebP, which
for 20-33 colours a cel is smaller than the lossy pages were. `scripts/art/party-g1.ts` packs them and pins every
decoded cel in `art/source/party-g1/pins/`; `art:validate` holds the sheets to those pins.

**Identity: every heading redrawn from its own shipped cel** (`tools/gen_root.py`, `edit-image-pro-flash`). Each
heading's idle and fighting stance is redrawn at 64x96 from the shipped G cel of that heading reduced 2x (#290's B),
not from a rotation model's guess at the back of the character; Kaya's model G is the costume standard (direction log,
2026-09-25). The redraw keeps the shipped silhouette (alpha IoU 0.96-1.00 with it) and the curated roots are then
snapped to each character's shipped palette (`tools/palette_lock.py`, OKLab nearest), which also pulls Kaya's boots back
to the shipped browns. Back views carry a facing sentence and, where the first seed drifted, a retake: Kaya's north-west
had turned to face the camera, her north-east and north backs grew gold ornaments, and Sura's back-view stances moved
her front skirt spiral onto her back. Every pick and every reason is in `curate.json`. Result: no gold hem or hip mark,
Kaya's east coat tail hangs as cloth, and Sura's braid hangs down her back in every back view, cel for cel.

**Idle and stance: one curated cel and a skeleton-driven delta** (`tools/breath.py`). At 59 px a generated loop either
redraws every cel (the boil) or comes back frozen, so neither loop is generated. One breath cycle of a CMU take (77_02
standing for the idle, 77_03 ready stance for the guard) times the loop; a breath moves the chest about 2 mm, under a
pixel, so the cycle is normalised to a 1 px peak and a cel whose delta rounds to 1 lifts the rows above the chest line (35%
of the way from the neck to the hips on the root's estimated skeleton) by one pixel. Nothing is redrawn. Boil, #290's
measure: idles 7-14% (was 36-54%; the shipped G 14-26%), stances 9-17%.

**Walk: CMU 08_01, retargeted with two corrections** (`tools/motion.py`). The delta retarget is the residents' and the
thug's, with one fixed scale per character (the median over its eight headings; a heading whose skeleton estimate came
out short no longer moves less). #290's uneven steps came from the root itself: a standing figure has one foot a little
ahead, so the two ankles sit rows apart on screen and the gait was added to them. The walk's legs now start from the
root's leg midpoints set apart by the performer's own mean pose; the gait track is narrowed to 0.35 and the pelvis bob
doubled. On the drawn cels the two contacts land 0-3 px apart (most 0-1), the head bobs about 2 px, and ADR 0050's
registration (`walkDy`, north drawn level with idle, the mean lowest row within 2 px of idle's) places each heading.
The rest cel is the passing cel that best overlaps idle cel 0, set on idle's sole.

**Combat clips, same takes and timing.** Hits: CMU 79_73, 76_03 and 77_09 as before (ADR 0063). Knockouts: Kaya and
Bo as before (90_18; 77_16 reversed); Sura now falls to 90_18 like Kaya, because 77_18 reversed retargeted into a
crumpled ball at this size. Bends (ADR 0055): Kaya's jab and cross from 143_23 (punching), Sura's circling palm push from
12_04 (tai chi), Bo's knee lift and stamp from 135_04 with 143_23's jab as his drive (the take's full front kick swung
the foot 20 px below the ground seen from the south). Every take starts and ends on that heading's stance cel, alpha
exact. The action text names an empty-hand form: the first takes, asked for "fire bending", painted flames into the
cels, and the element is the painted effect's (ADR 0086), not the drawing's. A few detached wisps under 60 px are
dropped. Sockets are the requested skeleton's wrists and ankles, each wrist snapped to the drawn hand within 3 px.

**The legacy one-offs.** The mirrored `cast` (non-bend abilities) is the east bend's stance, last wind-up and first
strike, and the one-cel `ko` fallback the south-east knockout's last cel, each a trimmed cel with its own rectangle and
anchor (`src/content/assets/partyG1.ts`, generated). Kaya's and Sura's riverside `wave` and `tea` are not in this
rebuild's scope: they are the shipped cels reduced 2x by #290's rule, now on page 1, and the separate riverside page and
its packer are retired.

**Validation at any grid.** `art:validate`'s pixel bounds (foot line, stride envelope, centring, mean foot row, the clear
margin) are written for 128 px a tile; on a coarser sheet each scales by its pixels a tile over 128
(`gridScale`). A finer sheet keeps the 128 px figures, so nothing that passed before is held tighter.

**Recipe.** `art/source/party-g1/README.md` is the recipe the residents and bandits follow next: roots, curation,
skeletons, motion, breath, assembly, pack.

## Budget

|                                                                 | before (main) |    after |
| --------------------------------------------------------------- | ------------: | -------: |
| units family                                                    |      7.64 MiB | 6.41 MiB |
| the party’s sheets, clip and bend data (and the riverside page) |       2.45 MB |  1.15 MB |
| precache                                                        |       23.5 MB | 22.23 MB |

No ceiling is raised. Generations: 600 of the ~1,500 budgeted (179 jobs; every job, seed and verdict is in
`art/source/party-g1/ledger.json`).

## Consequences

- The party is drawn by the same hand as Ba Dan, the forest and their props: a crisp dark contour, 20-33 flat colours a
  cel, no soft edge, faces that read at 59 px.
- Known faults ship as they are, pending review (the README lists them all): Sura's east stance and bend read grey (seen
  side-on her pale front panel covers most of her, as in the shipped east stance; three seeds kept it); a few gold studs
  on Kaya's north stance back; Sura's skirt spiral shows in her north-west walk; Bo's north idle hair is a shade light;
  the riverside wave and tea are reductions, not redraws; a few bend in-betweens smear a hand.
- Credits: CMU 08_01, 77_02, 77_03, 143_23, 135_04 and 12_04 are added for the party's walks, breathing, stance and
  bends; the knockout line drops 77_18.
- The old party packers (`g-sprites.ts`, `g-clips.ts`, `bend-sprites.ts`) no longer describe what ships for the party;
  they stay for the helpers the enemy and resident packers share, and their party data is history.
