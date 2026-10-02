# Early-fight difficulty: measured options

## Decision summary

This is a proposal and measurement sheet, not a balance change. The three fights
before the quarry floor currently report 100% party wins at one, three, and six
players, usually with substantial HP left. The project target is 70–85% party
wins. That target is stated in `scripts/balance.ts`, documented as the range high
enough for a family table without making combat automatic, and is also the
criterion used by item 6 of `docs/proposals/b4-prop-placements.md`.

The scenarios below change one lever at a time in the offline balance overlay.
They do not change shipped encounters, enemies, rules, or AI. HP percentages are
rounded to the nearest whole authored HP point. Stat scenarios cover every enemy
type that can appear in that encounter, including variants and table-size
reinforcements. The extra-body scenarios append one low-tier melee enemy before
ordinary small-table trimming and large-table reinforcement scaling.

Run 80 paired deterministic trials per party size. In PowerShell, set the shared
inputs once:

```powershell
$env:BALANCE_TRIALS='80'
$env:BALANCE_SIZES='1,3,6'
```

Each command prints paired baseline and scenario rows with `Win %`, `Rounds`,
`Deaths`, and `HP left`, matching the ordinary balance report. The tables give
each value as `1 / 3 / 6 player` results; paired runs use the same seeds, so
the baseline row is the same in every run. `Deaths` is the report's count of
party members down at combat end.

## Decision (2026-10-03)

Jared approved the recommendation: the Forest Road and the Quarry Gate stay as they are, and
The Cutting's enemies get 40% more HP. Shipped as base HP on the three mercenary definitions
(blade 36 to 50, crossbow 28 to 39, sergeant 44 to 62). The crossbow also stands in the boss
fight's alternate roster, which measured easier than the authored one, so that branch gets a
little harder too. The `cutting-hp-*` scenario files now describe changes against the old
numbers and are kept only as the record of what was measured.

## Findings (measured 2026-10-02, 80 trials per party size)

- The 70-85% win band is not reachable in the three early fights with any single mild lever. The simulated party wins 100% of trials in 32 of the 36 scenario rows; only the Quarry Gate at HP +40% (three and six players) and two solo rows (the extra-enemy rows in The Cutting and at the Quarry Gate) dip below. Read the extra-enemy rows with the two cautions noted under their tables.
- Win rate is therefore the wrong gauge here. HP left and members down show the real differences: the Quarry Gate is already tense (six players: 48% HP left, 2.2 down), while the Forest Road and The Cutting are gentle.
- Recommendation: leave the Forest Road (tutorial) and the Quarry Gate as shipped. If anything changes, give The Cutting's enemies 40% more HP so the third fight asks more than it does now (it would still leave the party more HP than the Quarry Gate at one and six players). Confirm with a family playtest before shipping; see the last section.

## Ambush on the Forest Road (`enc_forest_road`)

This level-1 tutorial introduces the central puddle and the Wet, cold, and
lightning interactions. Its comments explicitly say a full table should be able
to make mistakes and still walk away. It should remain the easiest fight: aim
for the top of the 70–85% band, or just above it if preserving tutorial safety
requires that.

| Scenario   | Lever                                             |     Win % (1 / 3 / 6) | Rounds (1 / 3 / 6) | Deaths (1 / 3 / 6) | HP left % (1 / 3 / 6) |
| ---------- | ------------------------------------------------- | --------------------: | -----------------: | -----------------: | --------------------: |
| Baseline   | Shipped content                                   | 100.0 / 100.0 / 100.0 |    3.2 / 3.1 / 2.8 |    0.0 / 0.0 / 0.7 |    94.5 / 81.7 / 83.7 |
| HP +20%    | All encounter enemies have about 20% more base HP | 100.0 / 100.0 / 100.0 |    3.3 / 3.3 / 3.0 |    0.0 / 0.1 / 0.9 |    92.9 / 79.4 / 79.9 |
| HP +40%    | All encounter enemies have about 40% more base HP | 100.0 / 100.0 / 100.0 |    3.4 / 3.3 / 3.0 |    0.0 / 0.1 / 1.0 |    91.7 / 78.7 / 77.1 |
| Power +1   | All encounter enemies gain 1 base power           | 100.0 / 100.0 / 100.0 |    3.2 / 3.1 / 2.7 |    0.0 / 0.0 / 0.8 |    93.5 / 79.6 / 82.4 |
| Extra thug | Add one low-tier melee bandit at (16,6)           | 100.0 / 100.0 / 100.0 |    3.7 / 3.1 / 2.8 |    0.0 / 0.3 / 0.8 |    87.8 / 78.0 / 82.5 |

Exact commands:

```powershell
npm run balance -- --scenario scripts/balance/scenarios/early/forest-road-hp-20.json
npm run balance -- --scenario scripts/balance/scenarios/early/forest-road-hp-40.json
npm run balance -- --scenario scripts/balance/scenarios/early/forest-road-power-plus-1.json
npm run balance -- --scenario scripts/balance/scenarios/early/forest-road-extra-thug.json
```

Measured (80 trials): no single lever moves the win rate; the party wins every trial in every row. The extra-thug row understates its lever: each trial draws one of this encounter's roster variants, a variant replaces the authored roster, and the added thug is only in the authored one, so it is present in roughly half the trials. The fight lasts about three rounds and the party keeps 77-94% of its HP. As the tutorial it can stay as it is.

## The Quarry Gate (`enc_quarry_gate`)

This level-2 fight teaches oil and spreading fire: a deserter can ignite the
channel, while the brazier and water barrels give the party ways to act first or
douse it. Its comments say the oil is what makes the encounter, not head count.
The bluffed roster removes the fire user, so HP and power scenarios cover both
the normal and alternate enemy types.

| Scenario   | Lever                                             |     Win % (1 / 3 / 6) | Rounds (1 / 3 / 6) | Deaths (1 / 3 / 6) | HP left % (1 / 3 / 6) |
| ---------- | ------------------------------------------------- | --------------------: | -----------------: | -----------------: | --------------------: |
| Baseline   | Shipped content                                   | 100.0 / 100.0 / 100.0 |    3.1 / 3.2 / 3.2 |    0.0 / 0.0 / 2.2 |    69.5 / 74.3 / 48.3 |
| HP +20%    | All encounter enemies have about 20% more base HP | 100.0 / 100.0 / 100.0 |    3.3 / 3.8 / 3.5 |    0.0 / 0.1 / 2.7 |    61.5 / 64.6 / 40.0 |
| HP +40%    | All encounter enemies have about 40% more base HP |   100.0 / 98.8 / 96.3 |    3.6 / 4.4 / 4.3 |    0.0 / 0.6 / 3.4 |    51.9 / 51.2 / 27.8 |
| Power +1   | All encounter enemies gain 1 base power           | 100.0 / 100.0 / 100.0 |    3.1 / 3.2 / 3.3 |    0.0 / 0.0 / 2.5 |    66.6 / 71.6 / 44.4 |
| Extra thug | Add one low-tier melee bandit at (15,6)           |  97.5 / 100.0 / 100.0 |    4.0 / 4.2 / 3.9 |    0.0 / 0.8 / 3.3 |    40.1 / 46.2 / 30.1 |

Exact commands:

```powershell
npm run balance -- --scenario scripts/balance/scenarios/early/quarry-gate-hp-20.json
npm run balance -- --scenario scripts/balance/scenarios/early/quarry-gate-hp-40.json
npm run balance -- --scenario scripts/balance/scenarios/early/quarry-gate-power-plus-1.json
npm run balance -- --scenario scripts/balance/scenarios/early/quarry-gate-extra-thug.json
```

Measured (80 trials): this fight already costs something. At six players the shipped fight leaves the party 48% of its HP with 2.2 members down. HP +40% is the only stat row that dents the win rate (98.8% at three players, 96.3% at six) and it leaves a six-player party at 28% HP with 3.4 down; the extra thug leaves 30% with 3.3 down (at one player the small-table rule trims the added thug and the authored thug at (17,6) returns, which is the same kind of enemy). Recommendation: leave it as shipped. These commands measure the ordinary unflagged roster; scenario mode cannot yet pin the bluffed roster, so measure that branch before shipping any change here.

## The Cutting (`enc_ambush`)

This level-3 fight teaches positioning. The narrow road, central pool, facing
ledges, high-ground accuracy, and safe ledge shoves create a chokepoint problem;
Ruon also fights beside the party and can strengthen a hero. The encounter's
reinforcement list already adds professional melee, ranged, and support enemies
as the friendly side grows.

| Scenario    | Lever                                             |     Win % (1 / 3 / 6) | Rounds (1 / 3 / 6) | Deaths (1 / 3 / 6) | HP left % (1 / 3 / 6) |
| ----------- | ------------------------------------------------- | --------------------: | -----------------: | -----------------: | --------------------: |
| Baseline    | Shipped content                                   | 100.0 / 100.0 / 100.0 |    3.4 / 3.1 / 3.1 |    0.0 / 0.4 / 1.1 |    95.7 / 79.8 / 80.3 |
| HP +20%     | All encounter enemies have about 20% more base HP | 100.0 / 100.0 / 100.0 |    4.0 / 3.3 / 3.5 |    0.0 / 0.4 / 1.4 |    88.6 / 74.8 / 74.8 |
| HP +40%     | All encounter enemies have about 40% more base HP | 100.0 / 100.0 / 100.0 |    4.3 / 4.0 / 3.9 |    0.0 / 1.0 / 1.5 |    80.5 / 58.5 / 69.8 |
| Power +1    | All encounter enemies gain 1 base power           | 100.0 / 100.0 / 100.0 |    3.4 / 3.1 / 3.1 |    0.0 / 0.5 / 1.2 |    93.7 / 77.4 / 79.1 |
| Extra blade | Add one low-tier melee mercenary at (16,8)        |  86.3 / 100.0 / 100.0 |    4.8 / 3.4 / 3.5 |    0.1 / 0.8 / 1.3 |    41.2 / 65.9 / 76.0 |

Exact commands:

```powershell
npm run balance -- --scenario scripts/balance/scenarios/early/cutting-hp-20.json
npm run balance -- --scenario scripts/balance/scenarios/early/cutting-hp-40.json
npm run balance -- --scenario scripts/balance/scenarios/early/cutting-power-plus-1.json
npm run balance -- --scenario scripts/balance/scenarios/early/cutting-extra-blade.json
```

Measured (80 trials): this is the soft spot. It is the third fight, at level 3, yet the party keeps 80-96% of its HP, more than at the Quarry Gate before it. HP +40% keeps every party size at 100% wins while making it a four-round fight: HP left 80.5 / 58.5 / 69.8% and 0.0 / 1.0 / 1.5 members down. The solo cell of the extra-blade row is not an extra blade: with one player the small-table rule trims the last enemy, so the added blade is dropped and the authored crossbow returns. That cell (86.3% wins, 41% HP left) measures the crossbow coming back, and it is too sharp for a solo player. At three and six players the row is what it says. Power +1 does almost nothing. Recommendation: HP +40% here, and nothing else, if the owner wants the third fight to ask more than it does now.

## What this does not measure

The simulator gives party characters fixed element-appropriate AI profiles and
lets the same tactical action scorer drive both sides. It can move, attack,
heal, buff, value cover and elevation, avoid hazards, score local surface
reactions, and recognize immediate shove/ledge value. It does not communicate
between characters, assign roles around a human plan, or deliberately build a
multi-turn party combo. That can make a coordinated human party stronger than
the simulated party.

The reverse is also possible. The AI knows the legal action space, applies its
scoring consistently, and never overlooks a control because the board is busy.
A young or first-time player may miss a surface interaction, choose a tempting
but weak action, split damage, or struggle with the chokepoint, making the human
party weaker than the simulation. These numbers rank controlled options; they
do not replace a family playtest. Before shipping any winner, play the tutorial
for clarity, the gate for fire recovery, and the cutting for whether a down
feels earned rather than sudden.
