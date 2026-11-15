# ADR 0112: The balance tripwire reads measures that still move, against a committed baseline

**Status:** accepted, 2026-11-14 (#797, from #777 finding 8). Builds on ADR 0110 (the difficulty
setting). It changes what the CI "Balance report" step fails on. It changes no fight, enemy, ability,
tuning number, AI weight or difficulty profile.

## Context

`npm run balance` printed "Target band for a full table is 70-85%" above a table in which every cell
read 100.0%: all four fights at 1, 3 and 6 players. #659 made the default difficulty forgiving on
purpose, so on Story the AI party wins every simulated trial. A measure at its ceiling cannot show a
change, and the CI step failed only on an anomaly, so it passed whatever a change did to a fight.
#779's enemy AI fix moved party HP left by 1 to 8 points in some fights, and nothing reported it.

Whether "the AI party always wins on Story" is the target, and what becomes of the 70-85% band, is the
owner's decision (#777). This ADR does not make it. It makes the report able to see a change either way.

## Decision

### 1. Measures, each with an interval

One row is one encounter, one roster variant, one table size and one difficulty. The pure simulator
keeps every trial's outcome (`TrialSample` in `src/core/sim/balance.ts`), and every number in a row is
derived from those same trials (`summariseTrials`):

| Measure                            | Printed as                            | Gated |
| ---------------------------------- | ------------------------------------- | ----- |
| Win rate                           | rate with a 95% Wilson score interval | yes   |
| Party HP left (share of max)       | mean ± 1.96 standard errors           | yes   |
| Rounds                             | mean ± 1.96 standard errors           | yes   |
| Party deaths                       | mean ± 1.96 standard errors           | yes   |
| Trials with at least one hero down | share of trials                       | no    |
| HP left, 10th percentile           | the value nine trials in ten beat     | no    |

The Wilson interval is used for rates because it stays honest at the ceiling: 120 wins of 120 is
96.9% to 100%, not "100% ± 0". The standard error of a mean is the sample standard deviation (n - 1)
over √n. The two tail measures are printed because a mean hides danger (a fight can keep 80% HP on
average while somebody goes down in half the trials); they are not gated, to keep the number of
comparisons down.

The report shows **Story and Hard** by default. On Hard the win rate is not at its ceiling, so it is a
working measure there. `BALANCE_DIFFICULTY=story` or `=hard` narrows the report to one.

### 2. A fixed sweep and a committed baseline

`npm run balance:check` (the CI step, and the last step of `npm run ci:local`) always runs the sweep
in `GATE_SETTINGS` (`scripts/balance/gate.ts`):

- both difficulties;
- table sizes 1, 3 and 6 (the lone hero, the party real play fields, the full table);
- every roster variant on its own row, the authored roster included wherever it can still spawn
  (`encounterPasses`), because an unpinned run hides a bad variant inside the average;
- **120 trials a row.**

Today that is 8 rosters × 3 sizes × 2 difficulties = 48 rows and 5,760 fights. It refuses to start if
`BALANCE_TRIALS`, `BALANCE_SIZES`, `BALANCE_VARIANTS`, `BALANCE_DIFFICULTY` or `BALANCE_TUNING` is
set, so a run is never compared with a baseline made at other settings.

The baseline is `scripts/balance/baseline.json`: one row a line, holding for each row the trial count,
the wins, and the mean and standard error of HP left, rounds and deaths. It is written only by
`npm run balance:baseline`.

### 3. The comparison rule

The simulator is deterministic, so unchanged code reproduces the baseline to the digit and every shift
is exactly zero. But a one-line AI change re-rolls every trajectory, and the new numbers then behave
like a **fresh sample** of the same fight. A digit-for-digit comparison would fail on every such
change, and the baseline would have to be rewritten in every AI or content pull request. With a merge
about every 30 minutes that file would conflict constantly (the problem #777 finding 4 describes for
the save digests).

So each measure of each row is compared as two samples:

- win rate: the two-proportion z test with the pooled standard error;
- HP left, rounds, deaths: z = (current − baseline) / √(se₁² + se₂²).

A measure **trips** only when both hold:

1. **Significant:** |z| ≥ z\*, where z\* keeps the chance of any false alarm in a whole run at 1%.
2. **Material:** |shift| ≥ the measure's minimum shift.

**z\*.** One run makes rows × 4 comparisons: 48 × 4 = 192 today. Bonferroni gives each two-sided test
0.01 / 192 = 5.2 × 10⁻⁵, which is z\* = 4.05 (the two-sided normal tail beyond 4.05 is 5.1 × 10⁻⁵, and
192 × 5.1 × 10⁻⁵ = 0.98%). `familyZ` computes z\* from the number of rows, so a new encounter raises it
instead of quietly raising the false-alarm rate. Bonferroni needs no independence between the tests,
which matters because every table size replays the same seeds.

**Minimum shifts** (`MEASURES` in `scripts/balance/gate.ts`):

| Measure      | Minimum shift       | Why                                                                                                                                          |
| ------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Win rate     | 5 percentage points | One more loss in twenty fights.                                                                                                              |
| HP left      | 5 points of max HP  | The Story fights at three players sit between 70% and 83%; five points is about 40% of that whole range. #779 moved fights by 1 to 8 points. |
| Rounds       | 0.5                 | Fights run 3 to 8 rounds; half a round is every unit acting once more in every second fight.                                                 |
| Party deaths | 0.25                | One more hero down in every fourth fight.                                                                                                    |

**Why 120 trials.** The smallest shift a comparison can trip on is the larger of the minimum shift and
z\* × √2 × se. Measured at 400 trials, a Story row's HP left has a standard deviation of 3 to 17 points
of max HP; at 120 trials that is a standard error of 0.3 to 1.6 points and a detectable shift of 1.6 to
9 points. So for most Story rows the minimum shift decides, and only the noisiest (the Driller at six,
the Cutting) need more than 5 points. Hard rows that are sometimes lost are much noisier (HP left is
near zero in a defeat): there the gate needs a shift of up to 17 points of HP left, or up to 26 points
of win rate. Halving those needs four times the trials. `balance:check` prints these figures on every
run ("Smallest shift the gate can see").

Cost, measured on a busy 4-core container (upper bounds): 12.7 minutes of CPU, against 2.9 for the old
step (40 trials, Story only, variants unpinned). The rows run on up to four worker threads
(`scripts/balance/pool.ts`), so the wall time was 5 min 20 s there with other jobs running, and should
be about 3 to 4 minutes on four idle cores. A row's result depends only on its own seeds, so the lane
count cannot change a number.

### 4. What fails

- A tripped measure. The message is a table: row, measure, baseline with its 95% interval, current
  with its 95% interval, the shift, the minimum shift and z, then the command to regenerate.
- A structural mismatch, each with its reason: a baseline row the run no longer has, a run row the
  baseline does not have (a new encounter or variant), another trial count, another party level, other
  settings, or a baseline that does not parse.
- An anomaly (a stalemate, impossible HP), exactly as before.

### 5. Regenerating

`npm run balance:baseline` rewrites the file and prints a before/after table of every measure that
moved by at least its minimum shift or by more than noise explains. Regenerating is a deliberate act: it belongs in the same pull
request as the change that moved the fights, with that table and the reason in the description.

- **Do not regenerate to be tidy.** A run that passes needs nothing. Regenerating without need puts the
  baseline in every pull request and brings the merge conflicts back.
- **Drift accumulates.** Every comparison is against the committed baseline, not against the previous
  commit. Ten changes that each move a fight by one point pass one by one and trip on the tenth. The
  pull request that trips is then not the only cause: read the table and decide whether the fight
  should be where it now is.
- **A new encounter or variant** fails structurally until the baseline has its rows. That is the
  moment to look at where the new fight sits.

### 6. The 70-85% line

The report no longer prints the band as if it were the gate. It prints how many rows sit at the
win-rate ceiling (on Story, all of them), says that the tripwire therefore also reads HP left, rounds
and deaths, and says that the band's status is an open decision (#777).

## Consequences

- An AI or content change that moves a fight meaningfully fails CI with the numbers in front of the
  author. One that does not passes without touching the baseline.
- The pure statistics live in `src/core/sim/stats.ts`. `runBalanceReport` keeps its seeds: a trial's
  seed still depends only on the encounter, the variant and the trial number, and no extra random
  number is drawn. The numbers at the old settings are unchanged.
- The unit suite simulates nothing new. `stats.test.ts` holds the arithmetic; `gate.test.ts` holds the
  rule on hand-written rows (a meaningful shift fails with its table, a sub-threshold shift passes, a
  structural mismatch fails) and the committed baseline's shape (the gate's settings, exactly the rows
  the content has, a family-wise rate of 1% or lower). That the unmodified tree reproduces the baseline
  is checked by the CI step itself.
- The normal approximation is rough for rare events (a death rate near zero) and for a row with no
  spread in the baseline. The minimum shift covers both: a rare event has to become a quarter of a hero
  per fight before it counts.
- The gate knows nothing about what a good fight is. It reports movement. Where the fights should sit
  is still decided by a person.

## Open

- The minimum shifts are a first setting, and each is one number in `MEASURES`. Tried once on a real
  change (the thug's power raised from 5 to 8 in a working tree, then reverted): HP left fell 4.2 and
  3.4 points in the Story thug rows at one and three players (z −6.3 and −5.2, so real) and stayed
  under the 5-point minimum; the gate failed on the Hard one-player row (−8.9 points, z −5.5). A
  3-point minimum for HP left would have failed three rows. Lower it if a change of that size should
  stop a merge on Story alone; the cost is more pull requests that must regenerate the baseline.

- Whether Story is meant to win every simulated trial, and whether the 70-85% band is retired or
  restated in another measure (#777). If a target band is set (for example "HP left between X and Y at
  three players"), it can be added to this gate as a second check on the same rows.
- #445 was written against the 70-85% band. Its "Done when" needs restating once the band is decided.
