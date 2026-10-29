# ADR 0097: The party in the world's rendering (phase 2a)

**Status:** accepted, 2026-10-28 (owner: "Yes, roll it out", relayed; "go ahead" in the session, 2026-10-28)

Follows #317's style test (`art/source/style-test-world-chars/`), ADR 0089 (the party at native G1), ADR 0093 (pixel
grounding and its figure and planting amendments) and ADR 0094 (figure scale). Changes an asset format (a new sheet
family at 80 px a tile with 192 px combat cels) and so is recorded here.

## Context

The owner chose "characters match world" after #317 and asked for every native-G1 figure to be redrawn that way, in
phases: (a) the party, (b) the bandits, (c) the residents, each switching to the new art by default when its group
lands, and the interim (`?style=world`, the 1.25 figure scale) removed with the last group. His other asks: a steeper
camera on the bodies, a natural-stride jog only if it reads right, no boil, all eight headings for every clip, and
mirroring only where a figure is truly symmetric. The PixelLab balance was about 341 generations.

## Decision

1. **Recipe.** The curated party-g1 roots (idle and stance, eight headings) are scaled 1.25 onto a 512 crop of the
   world painting, sixteen to a job, and restyled with #317's settings (`edit-images-v2`, the world's style sentence,
   seed 11), then cut out by their placed alpha and hue-locked to their source. Every clip that moves is
   `animate-with-skeleton-v3` from those roots: the walk from #317's designed six-pose walk, extended to the cardinals
   (they walk the grid diagonals); the hits, knockouts and bends from party-g1's own CMU retargets, mapped onto the new
   roots by the crop, scale and offset each figure took (`remap.py`): no new retarget, the motion exactly as shipped.
   Idle, rest and stance are not generated: the root and a 1 px breath. Every cel is palette-locked to its root.
   `art/source/party-world/README.md` has the steps and the ledger.
2. **Headings.** Eight drawn headings for idle, rest, walk, stance, hit and bend; Bo's three west-facing headings are
   his east-facing ones mirrored (no handed detail). Knockouts stay in the four diagonals: the engine's contract
   (`KO_HEADINGS`, ADR 0059) maps the eight headings onto them, and eight would be an engine change at twice the cost.
3. **Format.** One sheet per character at 80 px a tile (one art px a world px at the oblique figure scale), 128 px
   cels for locomotion, stance and hits; a second page of 192 px cels for the knockouts; the hit and knockout clips in a
   clip file at the shipped sheets' own timing; a bend set (party-g1's shipped frames, timing, key frames and attacks,
   with this family's cels, sockets from the requested skeleton's wrists and ankles, and foot point) on its own 192 px
   page. Untrimmed: the store plants every standing and walking cel on its own soles (ADR 0093's planting amendment).
4. **Legacy clips.** `cast` (the mirrored clip non-bend abilities play) is the east bend's stance, last wind-up and
   first strike, and `ko` (a non-diagonal fall) the south-east knockout's last cel, on the 192 px page, as party-g1
   packs them. Kaya's and Sura's riverside wave and tea are not redrawn: the G1 cels, 1.25x nearest onto this grid.
5. **Not yet the default.** The party's sheets replace #317's under `?style=world` (Gao keeps #317's). Making them the
   default retires the G1 party sheets, which 41 art and animation tests pin by design (the 8-cel stance, the G1 walk
   fit, the bend pins, the bandits' height against the party's body). That migration is its own change, made once the
   owner has seen the new party in a fight; the brief's "switch each group by default" is deferred to it.

## Not done, and why

- **Steeper camera.** Two levers were probed and neither reads steeper: `create-character-v3` rotations at the high
  top-down view keep identity but stand as side-on as the roots, and a restyle told to raise the camera came back
  nearly unchanged (ledger `rot-kaya-s4101`, `p1-kaya-diag`). A steeper body needs redrawn roots, a per-heading
  generation (about 5 a heading, 120 for the party) that the balance did not cover.
- **The jog.** Not drawn. The walk is the mover (ADR 0095's amendment); a natural-stride jog is about 3 a heading.
- **Boil.** Not re-measured cel by cel; the walk keeps #317's method, whose boil measured 11–44% of the upper body per
  cel pair.

## Consequences

`public/art/units/world/` adds 0.81 MB to the units family (6.97 of 8.5 MiB with the G1 party sheets still on disk; #317's party test atlases are removed). The flag shows the whole party in the
new rendering in exploration and in a fight; the default is unchanged until the last group lands.

## Amendment, 2026-10-29: Kaya polish

Owner, 2026-10-29: "lets get kaya with the polished animations and directions then show me that. If its good we can push
it on the rest." Kaya's world sheet is redrawn as the reference for the other eleven figures
(`art/source/party-world/README.md`, "Kaya polish"); Sura's and Bo's stay as above, and the default is unchanged.

- **Steeper roots.** Each heading's idle is redrawn from #321's by `edit-image-pro-flash`, told to raise the camera to
  the town map's high oblique and keep adult proportions, then restyled into the world with #321's settings. She stands
  70 world px (72-76 before): the steeper view foreshortens her. This retires "Not done: steeper camera" above.
- **One palette, one rendering.** One 64-colour Kaya palette for every clip and heading (each heading had its own).
  Every generated cel takes its heading's root back part by part (`kp_texture.py`); the walk's head and torso are the
  root's own pixels, so its boil falls from 15% to 1% of the trunk a cel pair.
- **Timing, unchanged contract.** Clip names, frame counts, key frames and the shipped hit, knockout and bend timing
  are kept; the walk's step is 0.5 body heights, so at 750 ms a tile it plays at 105-128 ms a cel (87-101 before) and
  the brisk cap is never reached. The hit's motion is 1.7x and the bend's reach 1.35x so both read at zoom 1.
- **Riverside.** Kaya's wave and tea are drawn in the new rendering (the G1 cels before).

The sheet is 23 KB smaller than #321's Kaya. Faults and credits are in the README.
