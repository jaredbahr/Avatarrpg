# Place brief: `saltstep_platform`

**Status (2026-11-20):** plan 2 chosen (owner, 2026-11-19); blockout built (#916); art (stage 6) built on the owner's
yes of 2026-11-20 and waiting for his look. The board is baked by `scripts/art/topdown/boards/rg02boards.ts`: the
region's deck and water, the north step drawn by the baker's `raised` cells, the counter stub (`counter_side`, the one
new piece, 12 PixelLab credits over two takes) and RG-02's own bollards, tide pole, piles, buoys, gulls and Tavi's
rowboat. A fight board only: the party reaches it from the Saltstep market by a conversation, as SF-2.1's riggers are
reached in the power yard; there is no explore map here.

**One line:** a spare market platform, floating loose in the harbour, where the ferry apprentices spar for who
washes the bowls, and it tips toward whichever side has more people on it.

## Stage 0: what the story says

Quoted or summarised from `docs/story/scripts/act2-sparks.md` (SF-2.2) and the Saltstep market brief. Nothing
here is new.

- **Who:** Tavi's ferry apprentices and a crew of channel hands. **Where:** a spare market platform, moored loose,
  at the midday lull. **Why:** nobody is angry. Losers wash the bowl-seller's bowls.
- "The platform tips toward whichever side has more people on it, and going in the water counts as out."
- **Tavi:** "No bending the platform. Bend whatever else you like. If you fall in, swim to the left. The right's
  where the fish-seller empties her bucket."
- **Win:** the channel hands wash, the party dries. **Carry on:** the bowl-seller hands over sixty bowls and sand.
- Saltstep's stalls sit on platforms that rise and drop with the tide; tall poles show the water level in bright
  paint (Scene 2.2). The market brief's landmark is the painted tide poles.
- **The rules** are ADR 0122 (owner, 2026-11-19): 0 HP or a shove into the water is out, with no help-up; at each
  round's end the heavier half slides one cell toward its edge.

**Not in the story, so asked, not decided:** what the platform normally holds (its stall is gone; "spare"), where
in the harbour it floats, and whether anyone watches from boats. See open questions.

## Story

- **Why the player comes here:** an optional, friendly bout in the middle of a busy act: the first fight in the
  game where nobody is an enemy, and where the board itself is the opponent's best weapon.
- **What it was before:** a net-mender's stall, who moved ashore when the platform's moorings went slack; nobody has
  claimed it since, which is why it is spare (the writing pass, #914). Nobody says this in the bout.
- **Feeling on arrival:** silly, wobbly, a dare. **On leaving:** wet and laughing.
- **Later states:** none on the board. After the bout it is not visited again.

## People

| Who (role)        | Where                | What they do in a day                     | Why the player would talk to them        |
| ----------------- | -------------------- | ----------------------------------------- | ---------------------------------------- |
| Ferry apprentices | Tavi's landing       | Pole and row the ferry, mind the ropes    | They issue the challenge (in the market) |
| Channel hands     | The harbour channels | Clear weed and wreckage from the channels | The other half of the opposing crew      |
| Tavi (referee)    | On a boat beside it  | Runs the ferry                            | Says the rules (the script's one line)   |

## Daily life

- **Ordinary day:** the platform floats empty; gulls use it; at the lull people row out to it to eat in the sun.
  Nothing is made or sold on it now, so the deck shows only the marks of the stall that was there.
- **Desire lines:** none across the deck; the only way on is from a boat at its edge.

## Shape

- **Battle intention:** stay on, push them off: the middle is safe and crowded, the edges are where bouts are won.
- **Focal point:** the deck's centre seam, where it tips. **Entry view:** the whole deck at once (it is small).
- **Edges:** water on every side; the map edge falls into the void beyond the water (ADR 0103).
- **Size:** one view of deck, about 9 by 6 cells, in a board about 15 by 11, so the whole bout is on one screen at
  the combat zoom and the water reads round all of it.
- **Pivot:** a north-south seam down the middle (`tipping: { axis: 'x' }`), so the halves are west and east, the
  party starts west and the crew east, and the tip runs along the screen's long side.

## Three plans (stage 2)

1. **A bare square deck** with nothing on it. Clean, but a flat open rectangle (core F3): no cover, no reason to be
   anywhere but the middle, and no clear choke. Lost.
2. **A deck with a low centre rail** where the stall's counter stood: a one-cell line of blocked cells along part of
   the seam, with two gaps. Gives two routes across the middle (F2), a choke at each gap, and cover from the far
   side; the tip still slides everyone, because the rail runs along the seam, not across it. **Chosen.**
3. **Two platforms roped together** with a plank between. A clear choke and very readable, but the plank is a
   single-width bridge that decides every bout (F4 allows one with a way round; here there is none), and two decks
   do not match "a platform". Lost.

**Chosen plan (2), in words:** a deck of about 9 by 6 cells. Down the seam column, a three-cell stub of the old
counter (blocked, cover) in the middle, open at both ends, so there are two ways across, north and south. Two
mooring bollards (blocked, cover) at diagonal corners pull a little fight to the edges. A low step along the
north rim (one tier up, a ramp at each end) gives a small high ground that is also the nearest cell to the water.
Spawns: the party on the west half, the crew on the east, each two cells from the seam, so contact comes in the
first round and nobody starts at the edge (F8).

## Look and sound

- **Materials:** the market's planking, rope, painted wood; a tide pole at one corner in the market's bright paint
  (the market's signature, seen from here).
- **Time and weather:** midday, bright, calm water.
- **Music:** the Saltstep track; local sound of slapping water and the deck creaking as it tips.

## Fight needs

- **What the terrain offers:** the edges are danger for whoever stands on them; the counter stub and bollards are
  cover; the north step is high ground with water behind it.
- **What reacts:** the deck itself (the tip, forecast on the board in blue). No reactive props: the bout is about
  shoving, and a barrel would compete with that. Water round the deck already reacts with lightning and ice.

## Set pieces

| Name             | Anchor            | Belongs with it      | Ground under it          | Whose / why                          |
| ---------------- | ----------------- | -------------------- | ------------------------ | ------------------------------------ |
| Old counter stub | Blocked plank run | Two empty bowl hooks | Paler planks (old stall) | The stall that was here              |
| Bollards (2)     | Post              | Looped rope          | Rope-worn plank          | Where boats tie on                   |
| Tide pole        | Pole in the water | Paint bands          | Water                    | The market's level poles (signature) |

## Open questions

1. Is plan 2 right (a short counter stub on the seam, two bollards, a step on the north rim)?
2. Size: a 9 by 6 deck on one screen, or bigger (more room to dodge the edge, longer bouts)?
3. Where the party starts the bout from: the market conversation goes straight into the fight (as SF-2.1), with no
   boat crossing shown.
