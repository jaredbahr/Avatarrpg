# Act I: optional side fights (the Ba Dan valley)

**Status: DRAFT for Jared (the writing pass, 2026-11-19; issue #908).** Two optional fights for the first
region, in the shape of the ones in Acts II to V. The story bible's rule is "optional side fights in every
region" (owner, 2026-11-15); this is the valley's entry.

Neither is needed for the main line, neither hides a main clue, and each pays its XP on a win and on "Carry on"
alike. The people in them have reasons. Nobody is hurt past a bruise.

## When they open, and what they pay

- **Open:** after Act I is over, won (`demo_complete`) or lost (`act1_lost`), and before the party takes the
  coast road. Not earlier: Act I's four fights are tuned to exact levels.
- **Both outcomes reach both fights.** Each fight below is on the road, not inside the quarry, because after a
  loss the quarry is still held and the party cannot walk up to its gate.
- **XP:** about 130 a head across the two, so a table that plays both reaches level 5 and its first path before
  Saltstep. Suggested split: 65 each. The numbers are the build's.
- **Boards:** `forest_road` for SF-1.1 and `ambush_road` (the Cutting) for SF-1.2. No new art.
- **The driver** is Bo-shan after a win and Dorin after a loss, as everywhere else.

### SF-1.1 — The bend, again (the Forest Road)

**Who:** four of the quarry hands who robbed the Forest Road, two with slings and two without, led by a slinger
called Bessa. **Where:** the bend where the party had its first fight, early, with mist still in the trees.
**Why:** the wages have still not come. After a win the quarry is open again and the back pay is not in it;
after a loss the quarry is shut to them. So they are loading everything the bend took in two months onto a
handcart, to sell over the hill: a sack of Ba Dan's flour, a crate of Dorin's float wheels, and Lanfen's
washing line. Lanfen found them first. She is standing in the road. **The fight:** thugs and slingers, on the
board the table already knows.

**Lanfen:** That is my washing line on your cart. I know it is mine. It has a duck's bite out of it.

**Bessa:** The company owes us two months. The road paid us for three weeks of it. We sell this lot over the
hill and then we're square with everybody.

**Lanfen:** Everybody except the people it belongs to.

**Bessa:** ...Everybody else.

**Driver (Bo-shan):** That crate is Dorin's wheels. Forty of them, each the size of a plum. I carried it up
from the coast myself. You can't boast about a crate that small, so I never have. Until now.

> **Loss branch.** **Driver (Dorin):** Those are my wheels. Forty, lime wood, for the lantern float. I entered
> them as lost on the fourth. I would like to correct the entry.

> **If the party lost the first fight here (`lost_forest_road`).** What the bend took from the party that day
> is on the handcart too, near the top. **Bessa:** Oh. It's you. ...I did say sorry at the time. You were lying
> down.

**Win:** the four of them pull the handcart back to Ba Dan themselves. **Lanfen:** The province pays me for
four hands on this road every spring. I have had two, and both of them are mine. Ditches, from the bend to the
stream. A bowl at noon and a wage on the first. Bring my line back before you start.

**Carry on:** they get the handcart over the hill, but the wheel crate splits on the way and forty small wheels
roll back down the road. **Narrator:** The ducklings find the last of them by evening. **Lanfen:** Thirty-nine.
The duck can keep whichever one it took.

_(Loss branch, after either ending:_ **Driver (Dorin):** "Thirty-nine wheels is nine axles and a spare. I will
redesign the float.")

### SF-1.2 — Edge-on (the Cutting)

**Who:** a crew boss called Tolma, an earthbender, with three of her crew and one more who came for the soup.
**Where:** the Cutting, where she has stood a slab of stone across the road. **Why:** it is a picket, not a
robbery. No stone leaves the valley until the wages do. After a win the quarry is open, and the first thing
the company's clerks asked for was a load. After a loss the company still holds the quarry, and her crew walked
out of it. Either way the slab stops every cart, and for two days that has included Ba Dan's flour and the
cabbages. **The fight:** one earthbender and her bruisers, in the narrow road. The culvert is no part of it,
and the fight neither sets nor reads `cutting_culvert`.

**Tolma:** Nothing with wheels. If I let the cabbages through today, tomorrow there's a stone cart with one
cabbage sat on top of it.

**Driver (Bo-shan):** That's a good trick. I'd have thought of that.

> **Loss branch.** **Driver (Dorin):** I have a manifest. I can show that every item on it is a cabbage.

One of these, by what the table did with Ruon:

- **`ruon_spared`.** **Tolma:** Ruon held that gate two months for the same money we didn't get. Say so, to
  whoever judges him.
- **`ruon_traded`.** **Tolma:** You sold Ruon for a key. He was owed the same as us. I'll hear the cabbages
  out. Not you.

> **If Bo is in the party.** **Bo:** I ran a crew of nine. I got to seven weeks before I stopped counting what
> we were owed. Turn the slab a quarter. I'll show you where.

**Narrator (as it starts):** She sets her feet. The slab doesn't move. Everything else on the road does.

**Win:** the slab is turned edge-on. A farm cart fits past it. A stone cart does not. **Tolma:** Edge-on. Huh.
Cabbages through, stone stays. I can hold that all winter, and feed my lot while I do it. _(Loss branch, her
last sentence instead:_ "I can hold that until the company comes down here and talks.")

**Carry on:** the driver backs the cart down the road and the party sleeps beside it. **Narrator:** In the
morning the slab is standing edge-on. Nobody on the picket will say who turned it. **Tolma:** Wind.

## Trust

Ba Dan's trust rises a little if SF-1.1 is won (its things came home) and if SF-1.2 is played at all (the
flour got through, one way or the other). Nothing falls. Later acts do not read either fight.

## New here, for the owner

1. **Two names:** Bessa (the slinger at the bend) and Tolma (the crew boss at the Cutting). Neither appears
   again in the scripts.
2. **The province pays Lanfen for four road hands** each spring and she has never had them.
3. **Dorin's crate:** forty lime-wood wheels for a lantern float, lost on the road before Act I.
4. **Two months unpaid** is the figure used for the valley's crews, to match the bridge corporal in SF-2.3.

## Build notes

- A new speaker can use an existing sprite: Bessa a slinger, Tolma the bandit earthbender.
- Lanfen speaks in SF-1.1 on both branches; she keeps her portrait.
- What the party lost at the bend on `lost_forest_road` is the build's to name; the script only says it is on
  the handcart.
