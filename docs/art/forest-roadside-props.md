# Forest Road roadside props

Eight transparent sprites in ten placements dress the Forest Road, owner approved
on 3 October 2026. Every placed cell **blocks movement** in combat and
exploration; none grants cover and none is interactable.

## Provenance

- **Generator:** built-in image generation (output terms:
  https://openai.com/policies/row-terms-of-use/). No exclusive copyright in
  generated output is claimed. Original designs; no canon names.
- **Prompts, in summary:** a blank two-board fork signpost, a split-rail fence
  section, a woodpile with a chopping stump, a broken cart wheel, a squat
  roadside milestone boulder with a side notch and three tally marks, a crooked
  hand-hewn lantern post, rope-bound quarry blocks, and a mossy fallen log with
  cap mushrooms and shelf fungi; each on a transparent background with warm
  upper-left light, a selective dark warm edge and no ground patch or shadow.
- **Mechanical steps only:** `scripts/art/forest-roadside-props.ts` alpha-trims
  each source in `media/art-sources/forest-roadside-v1/` and encodes lossy WebP
  at quality 88 with alpha. No resampling, no repaint. For the woodpile, log,
  lantern and milestone the generator left remote low-alpha fields; the build
  that produced these sources removed only partial-alpha pixels more than two
  pixels from the opaque silhouette, and the sources carry none.
- **Trimmed sizes (px):** broken-cart-wheel 88x80, lantern-post 58x146,
  milestone 68x58, mushroom-fallen-log 140x68, rope-bound-quarry-blocks 88x78,
  signpost 86x130, split-rail-fence 103x74, woodpile-stump 144x68.
  `forest-roadside-props.test.ts` pins those sizes and holds the shipped bytes
  to the packer.

## Registration

`FOREST_ROADSIDE_PROPS` in `src/content/scenes/forestRoad.ts` lists the
placements. The sprites were reviewed at 1:1 screen pixels on a 96 px tile, which is 1.5 screen
pixels per world pixel, so each is drawn at 64/96 of its trimmed size (an earlier
128/96 drew every prop twice too large), then trimmed by a per-placement `fit` where
the reviewed size read large against a party figure (signpost 0.87, milestone 0.7,
woodpile 0.75, log 0.75, quarry blocks 0.8), standing on the cell centre with 6% of its height below the
foot line, and sorts at the cell centre. The fence runs along the y axis in its
art; the two pieces on row 2 are mirrored (`flip`, ADR 0058) so they run along x.
The quarry blocks stand on the tier-1 bank and are lifted 16 px, the painted tier
lift (`reliefLift`). Runtime lighting applies as to any scenery: a contact shadow,
and a cast shadow that is `reduced` for the fences and the log.

| Cell              | Art                                    |
| ----------------- | -------------------------------------- |
| (4,2)             | signpost                               |
| (2,2) (1,2) (4,3) | split-rail fence (B moved from (3,2))  |
| (2,1)             | woodpile and stump                     |
| (12,2)            | broken cart wheel                      |
| (14,2)            | milestone                              |
| (14,3)            | lantern post                           |
| (17,3)            | rope-bound quarry blocks (tier-1 bank) |
| (2,10)            | mushroom fallen log                    |

## Blocking

The map keeps its authored ground in `FOREST_GROUND_ROWS`; `FOREST_ROAD.rows` is
that ground with each placed cell rewritten to a blocking key. Two legend keys,
local to this map, carry the rule: `f` is blocked grass and `b` is blocked tier-1
bank. Neither blocks sight and neither is cover. Art packers and ground tests read
the ground rows, so no plate's footprint moved. The map brief
(`scripts/art/lib/layout.ts`) classes `f` and `b` as their ground, since the
cells are decoration, not trees. `forestRoadside.test.ts` asserts the ten blocked
cells, that nothing protected was closed, that every spawn reaches every enemy
cell (all roster variants and reinforcements) and both exit mouths, that the
fight is still winnable, and that exploration still routes from the west entrance
to the east exit, the crossings and Dema.

### Deviation from the proposed table

The proposal put fence B at (3,2). With the woodpile (2,1), fence A (2,2) and the
signpost (4,2), that closed every neighbour of Dema at (3,1) that can be reached
without crossing column 4, which holds the one-shot `road_depart` crossing, so
walking to her fired that story node instead. Fence B stands at (1,2) and the gap
at (3,2), straight in front of her, is her way out. `forestRoadside.test.ts`
walks from the west entrance to her and asserts the dialogue opens.
