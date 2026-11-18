# Art cohesion: design a place, then dress it

The owner, 2026-11-17: "right now we're kind of throwing all the stuff on the screen to see if it fits — I want the
world to feel like that's how it should be, not like we're just throwing stuff on it."

Every map is **designed first and dressed second**. Before a single prop is placed, write a short design note for the
place (who lives and works there, what happens in a day, where people walk, where things are kept, the one thing the
eye lands on), draw the plan from it, and only then place set pieces that serve the plan. Every placed object must
answer "why is this here?" from the note. If it cannot, it goes.

The classic SNES towns are the inspiration, not a template. What they teach is in the rules below; the palette lock
and the calm ground support the design, they are not the point of it. ADR 0119 records the pipeline changes.

## Worked example: Ba Dan square

The square is the cohesion pilot (2026-11-17). Its plan is data in `src/content/maps/oldVillage.dressing.fixture.ts` (frozen with the old 24 x 16 board; the live village's set pieces are `src/content/scenes/baDan.setpieces.ts`), and
`src/content/setPieces.test.ts` holds the layout to it.

### What this place is, and who is here

Ba Dan's square is the paved heart of the village, where the canal from the west meets the road to the quarry. Facts
from the story bible and the shipped dialogue, with the design's own readings marked as such:

- **Mira's house** (NPC-01) faces the square, and **Mira's table** stands in front of it by the canal. It is where the
  village eats together: Mira sets out bowls at dawn, there is a shared meal at midday and company in the evening, and
  the welcome home happens there. The crews built its bench from offcuts; the cloth lives under the bench.
- **Gao's shop** (NPC-02) is next door: a counter, lamp oil, water skins, wrapping paper, a scale, a storeroom, and
  the plant he turns to the light every morning. He trades from his shopfront on the lane.
- **The gate post** where the east road leaves the square: Dorin (NPC-04) keeps the watch by day and Hanru (NPC-25)
  by night, with the notice board and the lamp Hanru keeps lit for anyone coming down from the quarry in the dark.
  Dorin's handcart is the one people borrow. The stone carts water their animals at the trough on their way through.
- **South of the road**, past the canal, are the households: Pella's (NPC-03), the south-east house, and the well
  between them. Pella's court is beside the well; the school lane runs south past it. Bo-shan took vegetables up to
  the quarry on his cabbage cart; the design reads the cabbage beds and the road stall west of Pella's house as the
  household's (a reading the story does not contradict, not a fact it states).

### What happens here in a day

Dawn: bowls on Mira's table, Gao turns his plant to the light, Dorin takes the gate from Hanru. Morning: Gao's
customers, Pella down the school lane, Mira hearing people's concerns at her table. Midday: the shared meal. Afternoon:
Gao restocks from the alley beside his shop; somewhere across the square a broom scrapes. Evening: company at the
table, the handover at the gate, lamps along the canal. Night: Hanru's lamp at the gate.

### Where people walk

- The **east road**: from the flooded ford in the west to the gate in the east. The way through; nothing stands on it.
- **Gao's door** to his shopfront, over the bridge to the road; and up the alley to his stock.
- **Mira's door** down to her table, and across the canal head to the road.
- **The gate post** to the road.
- **The well lane**: from the road between the south houses to the well, and along the south doors to the school lane.

### Where things are kept or worked

Against walls and where the work is: Gao's herbs and lamp oil against his shopfront, his display on the trodden
forecourt across the lane, stock in the alley; Mira's broom by her door and her washing beside the house; the notice
board and the handcart at the gate post; the trough and hay at the carters' stop; the south-east house's barrels
against its side wall; the household's beds, pots and harvest crate by its stall.

### The focal point

**Mira's table.** It is where the story keeps returning, so it is where the eye should land first: a table and the
crews' bench on a floor of their own (worn flagstones), with Mira and Pella standing at it. The gate has its own focus
one screen east (the wayside shrine, beside the road the missing went up), and the well court one screen south (the
well and its wet stones).

### The plan

The annotated plan (paths, work areas, quiet ground, focal points, what moved and what went) is kept outside the repo
with the pilot's screenshots. As data:

| Set piece        | Anchor           | Satellites                                   | Apron                        |
| ---------------- | ---------------- | -------------------------------------------- | ---------------------------- |
| Mira's table     | the table        | the crews' bench                             | flagstones (focal)           |
| Gao's shop       | Gao's house      | herbs, lamp oil, display, stock, shop banner | trodden earth, weeds         |
| Mira's house     | Mira's house     | broom, washing line                          | trodden line, weeds at posts |
| Gate post        | notice board     | Dorin's handcart                             | trodden earth, weeds         |
| Gate lamps (run) | north lamp       | south lamp                                   | weeds at their feet          |
| Wayside shrine   | the shrine       |                                              | a flagstone step (focal)     |
| Carters' stop    | trough           | hay                                          | wet ground, strewn hay       |
| Village well     | the well         |                                              | wet stones (focal)           |
| South-east store | south-east house | barrels                                      | weeds                        |
| Cabbage stall    | the stall        | produce, the beds, pots, harvest crate       | trodden earth                |

**Subtracted** (they answered no "why"): two planters, a pot of flowers in the lane, a second market display wedged
behind the shrine, a lone crate, a south banner, a stone lantern, a woodpile no house was near, a flower bed on the open
lawn. **Moved**: the crews' bench from the far bank to Mira's table; the shrine from the canal's end, where it crowded
the table, to the gate; Dorin's handcart behind his post; the hay beside the trough.

## Rules for any map

### Design before placement

1. Write the design note first (the five headings above), from the story bible and the region's dialogue. Invent
   nothing that contradicts them; where they are silent, leave it open.
2. Draw the plan: paths, work areas, quiet ground, one focal point per screen.
3. **Subtract before you add.** Expect to remove and move many existing props. A calm, purposeful place beats a full
   one. A "density pass" that only adds islands is the failure this document exists to stop.
4. Only then place set pieces, aprons and the finish.

### Placement grammar

- **Everything is a set piece**: an anchor, the satellites that serve it, and a ground apron, placed as one unit with
  a stated purpose. A prop that belongs to no set piece is not placed.
- **Props hug** walls, edges and the structure they serve: a satellite stands within two cells of its anchor's
  footprint, never out on the open ground.
- **Paths stay clear.** Desire lines connect doors, the focal point, work places and the exits; no piece stands on one
  and every cell of one is walkable.
- **Quiet ground is left open on purpose**: the middle of a square, a lawn. Nothing stands there.
- **Density is highest against buildings** and falls off toward paths and open ground.
- **Edge runs repeat with rhythm**: lamps, posts, fence posts on one line at an even spacing.
- **One focal landmark per screen** (an explore screen is about 13 by 7 cells): a zone holds exactly one focal set
  piece.
- **Ground aprons tie pieces to the floor**: trodden earth at a door or a work place, flagstones where people gather,
  wet stone at water, hay at fodder, weeds at the foot of posts and walls. They are baked into the plate by code, in
  palette, with organic per-pixel edges (never a rectangle).
- **Purpose over prettiness**: a piece with a story reason ("the lamp Hanru keeps lit") beats a decorative one, and
  where the story names where something is, the art agrees.

### Set-piece format

`DressingPlan` in `src/content/setPieces.ts`, one file per map beside its layout
(`src/content/scenes/<map>.dressing.ts`):

```ts
{
  id: 'carters-stop',
  purpose: 'Where the stone carts water their animals on the way through: …',
  anchor: 'trough',            // a placed object id
  satellites: ['haystack'],    // placed object ids, within HUG_CELLS of the anchor
  aprons: [{ kind: 'wet', x: 800, y: 438, rx: 34, ry: 11 }],   // world px, 40 a cell
  focal: false,                // the zone's one focus
  run: false,                  // an edge run: one line, even spacing
}
```

The plan also names its `scope` (the cells it governs), `paths`, `quiet` rectangles and `zones`.
`validateDressing(plan, objects, blocked)` returns every break of the grammar as a sentence; the map's test asserts it
returns none. Apron kinds: `earth`, `flags`, `wet`, `hay`, `weeds`.

### Calm ground, detailed objects

- The floor is low-contrast and calm; the objects carry the detail. On a paved square keep only the quiet tile
  variants (no rubble stones, cracks or puddles) and draw the paving's contrast in toward its mean (Ba Dan: the
  stone faces keep 0.38 of their own, the dark joints 0.62 so it still reads as cobble; grass 0.72, earth 0.75). Keep
  grass variants few and soft, and leave open grass plain.
- **Calm is not cold.** Pulling everything to its mean turned Ba Dan's cobble a flat, cold grey that read lifeless
  beside the old one (owner, 2026-11-17). Warm the paving's mean toward the art bible's limestone (`#d8cbb0`) and
  packed earth (`#b39064`) family, and keep the cool slate ramp for genuinely cool dressed stone.
- **Wear the paths.** Along the plan's desire lines the paving goes one ramp step lighter (dust and polish) and grass is
  trodden toward earth, in a broad band that wanders off the cell centres and thins to nothing at its edges. A narrow
  band reads as ruled road markings; it has to be most of a cell wide and sparse.
- No pinhole islands: a lone grass vertex inside paving becomes paving, as a lone cobble vertex in grass already
  became grass. Where paths meet, make one court rather than leaving the scraps between them.

### One palette per area

- Each area has one palette of about 40 to 50 colours, as ramps (ink and shadow, stone, cool slate, wood and earth,
  lacquer red, plaster and light, green, water). Derive it from the area's own art (k-means in OKLab, weighted by the
  square root of each colour's count so small objects count), then tidy it by hand into ramps.
- The bake remaps every plate and upright pixel to its nearest palette colour in OKLab, with no dithering. Characters
  are never remapped. The hard shadow tone `#322125` is in the palette.
- Check 3x crops before and after the lock: a missing ramp shows as a hue jump (Ba Dan's cool plinth greys fell to the
  water's blue until a slate ramp was added).
- The lock is a per-board option (`GroundLook.palette`); a map is untouched until its own pass turns it on.

### Scale chart

Target drawn heights, as a share of a person (a figure stands 46 px in its 48 px canvas). Drawn height includes the
top face the low top-down view shows. A placed sprite more than 25 % off its target fails
`scripts/art/topdown/scale-chart.test.ts`; redraw it, swap it, or record a waiver with its reason.

| Kind                                    | Persons | Kind                        | Persons   |
| --------------------------------------- | ------- | --------------------------- | --------- |
| pots, flower pots                       | 0.35    | fence, garden bed, handcart | 0.8       |
| sack, crate                             | 0.45    | haystack, vegetable display | 0.9       |
| trough                                  | 0.5     | jar display                 | 0.95      |
| barrel, rain barrel                     | 0.55    | herb shelf                  | 1.0       |
| table                                   | 0.6     | notice board                | 1.1       |
| bench, produce, beehive, bucket & broom | 0.7     | signpost, washing line      | 1.2       |
| barrel stack                            | 0.7     | well                        | 1.3       |
| crate stack                             | 0.8     | archery target              | 1.4       |
| shrine                                  | 1.6     | stall                       | 1.7       |
| lamp post, banner pole                  | 1.8     | a door (for new buildings)  | about 1.4 |

The Earth Kingdom houses (2026-11-17) predate the chart and are not held to it: their doors are drawn 1.7 to 2 persons
tall. New buildings should aim for a door of about 1.4.

### New art for a set piece

Only when a set piece lacks a kit piece: `create-object-pro-flash`, low top-down, one angle reference image, the size
in px from the scale chart, the Earth Kingdom style named and what it is not. Book every job in the ledger and
`docs/pipeline-trial-log.md` under the region's tag. The Ba Dan pilot needed none.
