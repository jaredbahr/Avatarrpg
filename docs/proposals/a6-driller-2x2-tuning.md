# A-6 Driller 2x2 tuning options

Status: Option A approved by Jared on 2026-10-01. The square-footprint default is on.

## What changed in the experiment

The Driller is `grumbler`: 100 HP, 5 AP, move 3, power 7, defence 5, speed 4, with Slam, Oil Spray, Debris Throw, Churn the Ground, and Raise Rubble. Its `boss` AI values damage and kills, values terrain more than the other profiles, barely values self-preservation, and does not value cover or elevation.

The quarry floor is 20×12. The party enters on the west in a staggered column; the Driller starts at (15,5), beside the eastern pit/shaft. Tier-one stone/oil benches run across the north and south, with ramps near their ends. Mud occupies the middle floor, and walls, pits, the shaft, and height changes leave a large 2×2 unit far fewer legal anchors than the legacy 2×1 body. With the square gate on it must keep all four cells on one elevation and cannot be shoved off a ledge. That explains the regression: it loses access to bench targets and spends less time applying its short-range pressure.

The synchronized square-footprint gate constants are on in shipped rules and content validation. Scenario runs were restricted with `BALANCE_ENCOUNTERS=enc_grumbler`. The encounter's existing table-size reinforcements remained active; no new body was added. The authored comments and prior measurements say head count is unusually explosive here, so adding another reinforcement is a poor family-table lever.

## Baselines

Supervisor measurement, 80 trials per size:

| Footprint  | Players |    Win | Rounds | HP left |
| ---------- | ------: | -----: | -----: | ------: |
| Legacy 2×1 |       1 | 100.0% |    6.0 |   46.3% |
| Legacy 2×1 |       3 |  86.3% |    7.7 |   26.9% |
| Legacy 2×1 |       6 |  82.5% |   10.4 |   34.8% |
| Square 2×2 |       1 | 100.0% |    5.9 |   61.8% |
| Square 2×2 |       3 | 100.0% |    6.6 |   61.6% |
| Square 2×2 |       6 |  93.8% |   10.3 |   44.2% |

The new switch reproduced the square rows exactly at 80 trials. In the 100-trial paired sweep, the square baseline was:

| Players |    Win | Rounds | Deaths | HP left |
| ------: | -----: | -----: | -----: | ------: |
|       1 | 100.0% |    5.9 |    0.0 |   60.8% |
|       3 | 100.0% |    6.5 |    0.4 |   61.8% |
|       6 |  93.0% |   10.2 |    2.5 |   44.8% |

AI-vs-AI is a floor for a human party. One percentage point is one outcome at 100 trials, so small differences should not be over-read.

## Sweep

Every row below is 100 paired, deterministic trials at each of 1, 3, and 6 players with the square gate on. Cells are `win% / rounds / deaths / HP left%`.

| Candidate                   | 1 player               | 3 players              | 6 players              |
| --------------------------- | ---------------------- | ---------------------- | ---------------------- |
| HP 115 (+15%)               | 100 / 6.4 / 0.0 / 53.8 | 100 / 7.1 / 0.5 / 58.8 | 91 / 11.1 / 2.7 / 42.2 |
| HP 130 (+30%)               | 99 / 6.9 / 0.0 / 45.7  | 100 / 7.7 / 0.6 / 54.8 | 89 / 11.9 / 2.9 / 40.3 |
| HP 145 (+45%)               | 96 / 7.4 / 0.0 / 39.2  | 99 / 8.3 / 0.8 / 52.3  | 84 / 12.7 / 3.0 / 37.6 |
| Debris range 8 (+1)         | 100 / 5.9 / 0.0 / 60.8 | 100 / 6.5 / 0.4 / 61.8 | 93 / 10.2 / 2.6 / 45.6 |
| Debris range 9 (+2)         | 100 / 5.9 / 0.0 / 60.8 | 97 / 6.5 / 1.4 / 41.9  | 96 / 10.1 / 2.4 / 47.1 |
| Move 4 (+1)                 | 97 / 5.8 / 0.0 / 38.7  | 91 / 7.0 / 1.8 / 24.8  | 93 / 9.8 / 2.7 / 41.8  |
| Power 8 (+14%)              | 100 / 5.9 / 0.0 / 56.8 | 100 / 6.5 / 0.5 / 60.1 | 90 / 10.4 / 2.8 / 41.6 |
| Power 9 (+29%)              | 99 / 5.9 / 0.0 / 52.7  | 100 / 6.5 / 0.5 / 57.3 | 86 / 10.3 / 2.9 / 39.7 |
| Churn cooldown 2            | 100 / 5.9 / 0.0 / 62.3 | 100 / 6.5 / 0.7 / 53.9 | 90 / 10.6 / 2.8 / 41.8 |
| Debris cooldown 1           | 93 / 5.8 / 0.1 / 39.2  | 100 / 6.9 / 1.1 / 47.4 | 77 / 10.7 / 3.6 / 30.4 |
| HP 130 + Debris range 8     | 99 / 6.9 / 0.0 / 45.7  | 100 / 7.7 / 0.6 / 54.8 | 88 / 11.8 / 2.9 / 40.5 |
| HP 115 + Debris cooldown 1  | 86 / 6.4 / 0.1 / 28.2  | 100 / 7.6 / 1.3 / 43.0 | 68 / 11.7 / 3.8 / 27.7 |
| Debris range 8 + power 8    | 100 / 5.9 / 0.0 / 56.8 | 100 / 6.5 / 0.5 / 60.1 | 90 / 10.3 / 2.9 / 40.3 |
| Debris range 9 + cooldown 1 | 93 / 5.8 / 0.1 / 39.2  | 99 / 6.6 / 1.1 / 44.2  | 83 / 10.5 / 3.4 / 34.4 |
| Move 4 + HP 115             | 96 / 6.3 / 0.0 / 32.5  | 87 / 7.5 / 2.0 / 21.6  | 89 / 10.9 / 3.0 / 38.5 |
| Move 4 + HP 120             | 95 / 6.4 / 0.1 / 31.8  | 85 / 7.7 / 2.0 / 20.8  | 89 / 11.2 / 3.1 / 37.7 |
| Move 4 + HP 125             | 93 / 6.6 / 0.1 / 29.7  | 83 / 7.9 / 2.0 / 19.7  | 88 / 11.4 / 3.1 / 37.2 |
| Move 4 + HP 130             | 91 / 6.8 / 0.1 / 27.3  | 82 / 8.1 / 2.0 / 18.7  | 81 / 11.8 / 3.2 / 36.3 |
| Move 4 + HP 145             | 83 / 7.3 / 0.2 / 21.5  | 77 / 8.6 / 2.1 / 15.2  | 75 / 12.8 / 3.4 / 33.5 |
| Move 4 + Debris cooldown 1  | 98 / 5.8 / 0.0 / 32.0  | 58 / 6.9 / 2.3 / 9.3   | 85 / 9.6 / 3.4 / 33.5  |
| Move 4 + power 9            | 88 / 5.8 / 0.1 / 28.5  | 81 / 7.0 / 2.0 / 20.0  | 84 / 9.9 / 3.2 / 34.8  |
| Move 4 + HP 115 + power 8   | 90 / 6.3 / 0.1 / 27.0  | 82 / 7.5 / 2.0 / 20.0  | 89 / 10.8 / 3.2 / 35.3 |

The strongest structural result is that move 4 repairs the lost ability to pressure a small party on the flat floor. HP mainly affects the six-player damage race. Range 8 is a no-op; range 9 changes target selection but does not reliably make the fight harder. Shortening Debris to every turn is volatile and punishes the six-player cluster without solving the three-player row by itself. Churn's shorter cooldown spends turns on control rather than enough direct pressure.

## Three options for Jared

### Option A — Mobile endurance: move 4, HP 130

Measured `91 / 82 / 81%` wins at 1/3/6 players. This is the closest numerical match to the requested 85/80 shape and the old 6-player feel. Rounds become 6.8/8.1/11.8. The machine closes across flat ground and survives long enough to keep acting, without increasing the damage of any individual hit.

For a family with an eight-year-old, this is readable: the machine is visibly faster and tougher, but the existing warnings, cooldowns, and damage numbers stay truthful. The concern is attrition at three players: two heroes down on average and 18.7% HP left is harsher than the old 26.9% HP reference even though the win rate is close.

### Option B — Fast threat: move 4, power 9

Measured `88 / 81 / 84%` wins. Rounds are shorter at 5.8/7.0/9.9 and HP left is 28.5/20.0/34.8%. This makes the Driller feel like a dangerous machine that can reach the fight and make each connection matter, rather than a long health-bar exercise.

For a family table, the shorter fight is attractive, but burst is less forgiving: a child gets fewer turns to recognize a bad position and recover. Power also strengthens every damaging ability, which is less legible than changing one named attack. This option is inside the full-table band but slightly harder than requested for three and slightly easier for six.

### Option C — Forgiving pursuer: move 4, HP 120

Measured `95 / 85 / 89%` wins. Rounds are 6.4/7.7/11.2. It restores the old three-player win rate almost exactly while leaving a larger safety margin for solo play. The machine becomes a persistent pursuer, not a burst-damage spike.

For an eight-year-old, this has the clearest recovery window and the highest chance that a mistake does not end the session. Its six-player result remains above the 70–85% target, so choose it only if accessibility is more important than fully restoring the large-table threat. HP 125 barely changes that six-player result (88%), while HP 130 is the point where the seeded outcomes step down to 81%.

## Recommendation

I would start a human-play candidate from **Option A (move 4, HP 130)**. It is the only measured option that puts both three and six players near the requested win-rate shape without faster repeat area damage or bigger individual hits. Its fiction also fits a heavy tracked machine confined to flat ground: it can build momentum along the quarry floor but still cannot climb benches. Before shipping, I would specifically watch whether two average deaths and 18.7% HP at three players feels exciting or exhausting for the child at the table. If it feels too severe, Option C is the clean fallback; I would not quietly split the difference because the 120–130 HP sweep is nonlinear at six players.

## Decisions Jared needs to make

1. Choose Option A, B, C, or no retune. No option is approved by this proposal.
2. Decide whether the primary acceptance signal is old win rate, old HP-left feel, or the gentler family-session recovery margin; the simulator cannot make those identical after the geometry change.
3. Decide whether move 4 is acceptable fiction for the heavy machine. If not, the measured non-movement levers do not restore the three-player threat, and a new directional ability/AI design would need a separate proposal.
4. Decide whether one-player success around 88–91% (Options A/B) is still “very winnable,” or whether the 95% accessibility of Option C is required.
5. Require a human family-table playtest before any chosen values ship; AI-vs-AI is deliberately a floor and does not judge clarity, frustration, or whether a child understands why the 2×2 machine cannot follow onto a bench.

## Decision

Jared approved **Option A — Mobile endurance** on 2026-10-01. The shipping
`grumbler` base stats are move 4 and 130 HP; no other enemy stat, ability, AI or
XP value changes. The measured square-footprint result remains 91 / 82 / 81%
party wins at 1 / 3 / 6 players over 100 trials.
