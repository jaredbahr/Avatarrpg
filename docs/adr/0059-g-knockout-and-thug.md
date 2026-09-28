# ADR 0059: G knockouts, and the G thug

**Status:** accepted, 2026-09-28

## Context

The supervisor has approved the P0 hand-off for the G party: a knockout on
each of the four screen diagonals for Kaya, Sura and Bo (Bo's north-west
knockout is the r2 retake), and the P1 thug: eight rotations, a four-cel idle
and an eight-cel root-locked walk in every heading (south-east the r2b
retake), toned with the frozen `params-v3.json`. The party's cels are 320 px,
drawn on the stance cel of their heading as the bend's are (ADR 0055); the
thug's are 192 px on the party's own G canvas. Sura's and Bo's cels arrive
toned and are never re-toned; Kaya's are never toned.

The same hand-off carried a G hit reaction in each heading. Its motion is
mocapdata.com capture under CC BY-SA 2.1 JP, which `src/content/credits.ts`
does not accept: its ShareAlike may reach the drawn cels, and main deploys
publicly. The hits do not ship, and no commit on this branch carries their
frames or pins.

Until now a knockout was one legacy cel from the old sheet. The thug drew
from a two-cel mirrored sheet.

## Decision

1. **Clip names.** A G sheet authors `koSouthEast`, `koSouthWest`,
   `koNorthEast` and `koNorthWest`. A sheet that authors any of them authors
   all four and declares eight-way locomotion (`validateContent`). None is
   ever mirrored (`authoredForBothSides`).
2. **Which knockout.** On the oblique combat grid every orthogonal step, so
   every melee adjacency, is a screen diagonal. A diagonal heading falls on its
   own clip; an orthogonal one on the diagonal 45 degrees clockwise of it on
   screen: east to south-east, south to south-west, west to north-west, north
   to north-east (`KO_HEADING`). One fixed turn, so a heading always falls the
   same way.
3. **Timed, trimmed clips.** `ClipDef` gains `frameMs`, a hold per frame that
   replaces `fps` and plays by time whatever frame the choreography names,
   holding the last frame when the clip does not loop; and `frameSize` with
   `anchor`, a clip's own trimmed cel and foot anchor. A body lying flat is up
   to 160 px wide at the G scale, so the 128 px sheet frame cannot hold it.
   The store places a trimmed clip by its anchor; both backends already place
   every frame by the frame's anchor. A frame may name an earlier cel of its
   own clip: a hold is timing, never a second cel.
4. **Packing.** `scripts/art/g-clips.ts` packs each character's four
   knockouts onto a third G page, `<name>-g-3.webp`, and writes their clips
   to `public/art/units/<name>-g-clips.json`. The clip data is fetched with
   the sheet's pages, like the atlas JSON, not imported: it costs the main
   chunk nothing, and a clip never draws from half a sheet. It reuses the bend
   packer's registration: frame 0's alpha is matched pixel for pixel against
   the shipped stance cel, every cel goes through the G build's 75%
   nearest-neighbour map, and frame 0 must reproduce the stance within
   `STANCE_TOLERANCE` or the build stops. Source cels and timing files are
   pinned; decoded atlas cels are pinned; `art:validate` holds each clip's
   frame 0 to the stance cel's exact alpha.
5. **Playback.** A struck party member keeps the legacy hit. A downed one
   plays the knockout its heading falls on when its sheet authors them,
   otherwise the legacy pose. The knockout plays in full at full strength;
   the unit is marked fallen when the body lies still, and then holds the
   last frame. A legacy knockout keeps its timing, sink and fade.
6. **Fallen on the grass.** The fallen fade, to 35% alpha, was tuned for a
   standing cel. Over grass it all but erased a G body lying flat, so a body
   in its G knockout only dims, to 80% (`fallenAlpha` in
   `src/render/view.ts`, which both backends read).
7. **The thug.** `scripts/art/thug-g.ts` builds `thug-g.webp` from the toned
   cels through the G build's `normalise`, placed by the party's own rules
   (ADR 0050, ADR 0051, ADR 0052) measured on each walk's `gates.json`; its
   rest cel is the walk cel that stands like idle and best overlaps idle cel 0. The old sheet's cast, hit and KO cels are copied verbatim into
   `art/source/thug-actions` and stay mirrored. An enemy whose sheet declares
   eight-way locomotion idles and walks through `Animator.locomotion` like the
   party, facing west until it turns, and stands at the party's scale on the
   map's projection. The other bandits keep their art.

## Budget

| file                    | page WebP | page JSON | clip JSON |     total |
| ----------------------- | --------: | --------: | --------: | --------: |
| `kaya-g-3`              |  47,812 B |   5,360 B |   1,502 B |  54,674 B |
| `sura-g-3`              |  49,860 B |   5,204 B |   1,500 B |  56,564 B |
| `bo-g-3`                |  56,542 B |   5,332 B |   1,480 B |  63,354 B |
| `thug-g`                | 261,436 B |  20,542 B |         — | 281,978 B |
| old `thug.png`, `.json` | 134,759 B |   1,748 B |         — | 136,507 B |

Units were 5,570,744 B. With the new files they are 6,027,314 B (5.75 MiB) of
the 7,077,888 B (6.75 MiB) ceiling while the superseded thug sheet is still
on disk, and 5,890,807 B (5.62 MiB) once it is removed. This ADR does not
raise the ceiling.

## Consequences

- A G party member lies where it fell, in its own drawing. A fight with
  knockouts runs about half a second longer per knockout: the fall plays in
  full.
- The contract now carries per-frame timing and per-clip trimming, which a
  G hit drawn from acceptable motion, a bend playback or an enemy G sheet can
  use without another change.
- The knockout motion is retargeted CMU Graphics Lab capture (Kaya 90_18,
  frames 64 to 170; Sura 77_18 and Bo 77_16, each played in reverse), and the
  thug's walk is Mixamo's; both are credited in `src/content/credits.ts`.
- A G hit needs motion under a licence `credits.ts` accepts before it can
  return.
