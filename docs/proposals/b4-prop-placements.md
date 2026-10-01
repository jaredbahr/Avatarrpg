# B-4 prop placements: measured options, not a balance decision

No shipped content, tuning, or rules changed. Each result is 80 paired AI-vs-AI
trials at the default party sizes (1, 3, 6). Values are baseline → scenario.
`Fire P/E` is mean source-less environmental fire damage to party/enemies; events
cannot attribute that damage to a prop. `I/B/D` is mean prop ignitions, burn-aways,
and douses. It was **0/0/0 in every row**: the AI never used the proposed fire loop.

Placement validation used the authoritative rows plus all party spawns, authored
and variant enemies, reinforcements, existing props, and complete exit areas. A
four-neighbour flood fill with every movement-blocking prop applied kept all
non-blocked spawns and exit cells in the party's component. This proves topological
connectivity; the simulations exercised the actual movement/elevation rules.

Legend for the cropped diagrams: `H` hay, `O` oil flask, `W` water barrel, `|` the
gate oil stripe, `~` water, `=` road, `E` enemy area. Coordinates are `(x,y)`.

## Forest Road

```text
          x=12 13 14 15
y=3        A  .  .  w     A: H(12,3); w: authored W(15,3)
y=4        .  .  B  .     B: added W(14,4)
y=5        B  .  .  .     B: H(12,5)
y=6        .  o  .  .     o: authored O(13,6)
```

- A/light: one `H(12,3)`, fuel 2, radius 1, spread 0, doused by
  water/cold/earth. It is off the through-road and gives either side optional cover.
- B/lively: `H(12,5)` plus `W(14,4)`, beside the authored oil flask. Hay uses
  fuel 3, radius 1, spread 1, and the same douse list.

| Option | Size |   Win % |    Rounds |      Party HP | I/B/D |            Fire P/E |
| ------ | ---: | ------: | --------: | ------------: | ----: | ------------------: |
| A      |    1 | 100→100 | 3.21→3.21 |   35.92→35.92 | 0/0/0 |             0/0→0/0 |
| A      |    3 | 100→100 | 3.25→3.20 |   70.17→70.89 | 0/0/0 |       0/1.15→0/2.20 |
| A      |    6 | 100→100 | 2.73→2.90 | 140.43→131.03 | 0/0/0 | 0.20/0.30→3.21/3.36 |
| B      |    1 | 100→100 | 3.21→3.21 |   35.92→35.92 | 0/0/0 |             0/0→0/0 |
| B      |    3 | 100→100 | 3.25→3.11 |   70.17→75.12 | 0/0/0 |       0/1.15→0/0.20 |
| B      |    6 | 100→100 | 2.73→2.75 | 140.43→139.79 | 0/0/0 | 0.20/0.30→0.53/0.35 |

Risk: A costs a six-player party about 9.4 HP without ever burning; B can make
the water barrel the obvious action and distract an eight-year-old from the map's
intended puddle lesson. Neither tests human ignition safety.

**Recommendation:** if Jared wants one candidate for human playtest, use B. It is
the clearer light/douse choice and has the smaller AI-pathing penalty. Do not infer
fire safety from these inert-AI numbers.

## Quarry Gate

```text
          x=12 13 14 15
y=4        o  .  w  .     authored oil flask/water barrel
y=5        |  B  .  O     B: H(13,5), O(15,5)
y=6        |  .  .  .
y=7        |  A  B  W     A: H(13,7); B: W(14,7)
```

- A/light: `H(13,7)`, fuel 2, radius 1, spread 0, full douse list. It is east
  of the oil stripe, so fire does not begin on the party approach.
- B/lively: `H(13,5)`, `O(15,5)`, `W(14,7)`; hay fuel 3, radius 1, spread 1,
  full douse list. This is deliberately the denser set-piece option.

| Option | Size |    Win % |    Rounds |    Party HP | I/B/D |            Fire P/E |
| ------ | ---: | -------: | --------: | ----------: | ----: | ------------------: |
| A      |    1 |  100→100 | 3.11→3.11 | 29.18→29.18 | 0/0/0 |       2.54/0→2.54/0 |
| A      |    3 |  100→100 | 3.21→3.21 | 77.26→77.26 | 0/0/0 | 4.09/0.17→4.09/0.17 |
| A      |    6 |  100→100 | 3.25→3.23 | 90.61→92.19 | 0/0/0 | 7.08/0.88→7.28/1.34 |
| B      |    1 | 100→93.8 | 3.11→3.09 | 29.18→16.66 | 0/0/0 |      2.54/0→19.06/0 |
| B      |    3 |  100→100 | 3.21→3.21 | 77.26→71.92 | 0/0/0 |    4.09/0.17→3.23/0 |
| B      |    6 |  100→100 | 3.25→3.12 | 90.61→96.30 | 0/0/0 | 7.08/0.88→5.91/3.35 |

Risk: this approach is already known to trap some party sizes. B cuts size-1 HP
by 43% and introduces a 6.2-point loss rate despite zero prop ignitions. It adds
three more objects to an already busy lesson; a child's turn has more plausible
but wrong targets, and human-lit radius/spread fire could seal part of the east lane.

**Recommendation:** A only, and only for a human playtest. Reject B. The authored
gate already supplies a brazier, oil, water, cart, and a meaningful fire decision.

## The Cutting (`ambush_road`)

```text
west                  pinch                    east
==== ==== ==== ====   rows 4-7 only   ==== ==== ==== ====
          ~~~~        no proposed prop        E E
```

- C/none: empty overlay. The four-row crossing, pool, ledges, ally, and large-table
  reinforcements already make this the highest-risk map.

| Option | Size |   Win % |    Rounds |      Party HP | I/B/D |      Fire P/E |
| ------ | ---: | ------: | --------: | ------------: | ----: | ------------: |
| C      |    1 | 100→100 | 3.40→3.40 |   44.01→44.01 | 0/0/0 |       0/0→0/0 |
| C      |    3 | 100→100 | 3.06→3.06 |   92.53→92.53 | 0/0/0 | 0/3.10→0/3.10 |
| C      |    6 | 100→100 | 3.09→3.09 | 172.70→172.70 | 0/0/0 | 0/2.45→0/2.45 |

Risk: a solid bale can narrow one dry lane; a radius-1 fire can make the remaining
crossing feel mandatory or punish a child for advancing. The simulator's 100% AI
rate does not erase the design note that this is the highest-risk human map.

**Recommendation:** no burnables. Preserve the push/high-ground lesson.

## Quarry Floor

```text
          x=12 13 14 15
y=6        w  .  .  E     w: authored W; boss occupies the east area
y=7        .  .  A  B     A: H(14,7); B: W(15,7)
y=8        o  O  .  .     authored oil at x12; B: O(13,8)
y=9        o  .  B  .     B: H(14,9)
```

- A/light: `H(14,7)`, fuel 2, radius 1, spread 0, full douse list.
- B/lively: `O(13,8)`, `H(14,9)`, `W(15,7)`; hay fuel 3, radius 1, spread 1,
  full douse list. The trio sits beside authored oil but off every spawn/exit.

| Option | Size |     Win % |     Rounds |    Party HP | I/B/D |              Fire P/E |
| ------ | ---: | --------: | ---------: | ----------: | ----: | --------------------: |
| A      |    1 |   100→100 |  6.00→4.89 | 21.29→33.40 | 0/0/0 |           0/0→0/23.18 |
| A      |    3 | 86.3→96.3 |  7.65→6.28 | 31.16→33.33 | 0/0/0 | 0.82/13.55→0.38/20.86 |
| A      |    6 | 82.5→92.5 | 10.40→8.70 | 74.83→71.39 | 0/0/0 |  5.55/7.96→4.47/23.62 |
| B      |    1 |   100→100 |  6.00→4.89 | 21.29→33.40 | 0/0/0 |           0/0→0/23.18 |
| B      |    3 |  86.3→100 |  7.65→6.79 | 31.16→63.55 | 0/0/0 |  0.82/13.55→2.55/3.96 |
| B      |    6 | 82.5→92.5 | 10.40→9.94 | 74.83→76.33 | 0/0/0 |  5.55/7.96→6.54/11.11 |

Risk: both options materially buff the party through geometry alone. A pushes
sizes 3 and 6 above the 70–85% target; B makes size 3 automatic and doubles HP
left. A child can spend a turn on an apparently central fire toy while the boss
fight is already asking them to read slam range, mud, oil, cover, and a two-cell unit.

**Recommendation:** ship neither placement. If a Floor fire toy remains desirable,
first find a cell that does not change boss routing, then human-playtest it; these
two options are useful rejection cases.

## Minimal AI proposal (no code)

The AI already enumerates a prop only when it is within two tiles of an opponent,
and its prop score values immediate `onBreak` effects. It does not value starting
the B-2 fuel cycle, future painted fire, a later burn-away, or dousing a burning
prop. Minimal proposal:

1. In prop scoring, add a small deterministic value when fire damage would ignite
   an unlit fuel prop: estimate one round of `ignites` tiles against nearby units,
   using the existing friendly-fire and terrain weights. Do not project the whole
   fuel duration; that would overvalue uncertain future control.
2. Add the mirrored negative danger to movement/target scoring for a fuel prop
   that is burning or can be ignited by adjacent fire, scaled by self-preservation.
3. Value water/cold/earth damage that douses a burning prop when the projected
   fire threatens allies more than enemies. Keep prop targeting gated to the
   existing two-tile opponent/ally neighbourhood so enemies do not shoot scenery.

This would make some enemies light, avoid, or douse a prop without adding a new
planner or randomness. Re-run these exact scenarios afterward; the current numbers
measure geometry and ordinary surfaces, not the intended fuel interaction.

## Decisions for Jared

1. Forest Road: human-playtest B, A, or neither?
2. Quarry Gate: allow the single light hay candidate, or keep the already complete
   authored set-piece? (Recommendation: at most A; reject B.)
3. Confirm no burnables in The Cutting.
4. Confirm both measured Quarry Floor candidates are rejected, or request another
   placement search away from boss routing.
5. Approve, reject, or retune the proposed one-round AI ignition/douse pricing before
   treating simulator fire results as evidence.
6. Decide whether the default baseline's 100% AI win rates on the first three maps
   need a separate balance review; they are outside the stated 70–85% target and
   are not caused by B-4.
