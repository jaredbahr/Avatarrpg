# ADR 0062: The quarry bandits on G sheets

**Status:** accepted, 2026-09-28

## Context

The supervisor has accepted the P1 PixelLab bandits: the slinger
(`bandit_slinger`), the bruiser (`bandit_bruiser`) and the quarry bender
(`bandit_earthbender`), each with eight rotations, a four-cel idle and an
eight-cel root-locked walk in every heading, toned with the thug's frozen
`params-v3.json` and a per-unit skin mask. Three retake rounds replaced some
walks: the quarry bender's north and south-east (round 3), the bruiser's west
and south-west (round 3), and the bruiser's south-east, where the supervisor
took round 4's r4b, a low stride with no crouch-lunge, over round 1's r2,
which met the travel gate but knelt on its first two cels. Its idle stays
take 1's.

The bandits have no G cast, hit or knockout. Each drew from a two-cel
mirrored sheet like the thug's before ADR 0059, with three cast cels, a hit
and a kneeling defeat.

## Decision

1. **One packer.** `scripts/art/enemy-g.ts` holds the thug's packer and its
   placement rules (ADR 0059); `thug-g.ts` and `bandits-g.ts` are definitions
   of it. The thug rebuilds byte for byte.
2. **The cels live in the repo.** `bandits-g.ts --import` copies the selected
   toned cels into `art/source/<name>-g/cels`, refusing any cel its tone
   manifest did not write with the frozen parameters, and pins each with the
   hand-off path it came from. The build reads only the copies.
3. **Placement.** Measured by the thug's rules on each selected walk's
   `gates.json`, with one addition: `headingDx` moves a whole heading, idle
   and walk together, the fewest pixels that bring idle cel 0's feet within
   `art:validate`'s 16 px of the anchor column. Facing south-east the lowest
   six rows hold only the near foot, drawn left of a body that stands on the
   column; the thug's stood 15.4 px off and passed, the bandits' stood
   16.1-19.9 px off. The slinger's south-east moves 1 px right, the bruiser's
   and the quarry bender's 4. No other heading moves sideways.
4. **The bruiser's cel is 160 px wide.** His club reaches past the 128 px
   cel's 8 px margin in five headings, up to 5 px past its left edge facing
   south-west. His sheet declares `frameSize: { w: 160, h: 192 }` (ADR 0032)
   with the same anchor, and every cel, his legacy actions included, is
   centred on it unchanged, so no foot moves relative to the anchor.
5. **Actions.** Each bandit's old cast, hit and KO cels are copied verbatim
   into `art/source/<name>-actions` and stay mirrored, as the thug's did.
   They stood 121 px at the old 1.21-1.28 scales and now stand at the
   party's 1.25 on the oblique map.
6. **Travel.** Each heading's clip time per tile comes from its selected
   walk's `speed_px_per_frame`, as the thug's does.
7. **The old sheets go.** `slinger.png`, `bruiser.png`, `quarrybender.png`
   and their JSON have no reader left and are removed, with their per-sprite
   scales in `actorScale.ts`.

## Budget

| file               | page WebP | page JSON |      total |
| ------------------ | --------: | --------: | ---------: |
| `slinger-g`        | 244,996 B |  20,872 B |  265,868 B |
| `bruiser-g`        | 298,862 B |  20,890 B |  319,752 B |
| `quarrybender-g`   | 221,226 B |  21,422 B |  242,648 B |
| old sheets removed |           |           | -415,584 B |

Units were 5,890,807 B (5.62 MiB). They are now 6,303,491 B (6.01 MiB) of the
7,077,888 B (6.75 MiB) ceiling. This ADR does not raise the ceiling.

## Consequences

- Every enemy on the mandatory route but the crossbow now idles and walks in
  eight headings at the party's scale.
- The bandits' cast, hit and defeat are still the legacy poses. A G action
  needs motion under a licence `credits.ts` accepts, as ADR 0059 says of hits.
- The slinger's south walk is a short, foreshortened stride (4.0 source px a
  cel against the thug's 9.2) and the quarry bender's north r3 a short one
  (5.8); both are measured, so their walks cycle slower per tile rather than
  sliding.
