# Combat simulation soak (#495)

Codex owns integration on `codex/sim-soak-495`, based on main
`85ad186880063b707dbf46808349c35b340409b1`.
[Claim and current validation](https://github.com/jaredbahr/Avatarrpg/issues/495#issuecomment-6735558446).
The PR records the exact delivered head, complete tree, final checks and hosted jobs.

`npm run soak` now runs every authored encounter, every eligible authored fallback
and every pinned roster variant at sizes 1–6. The default is 200 deterministic
seeds per cell: eight roster passes × six sizes = 9,600 attempted battles. It uses
existing balance parties, seed labels, expected levels and the unchanged 60-round
cap. `SOAK_TRIALS` accepts positive safe integers; `--json PATH` selects an output
path. The default `soak-report.json` is ignored. No retries or discipline sweep run.

The table and JSON distinguish attempted, completed and thrown battles, round-cap
incidents, legal-but-idle turns, median and maximum rounds. Every throw and cap
case retains its encounter, variant, size, seed, trial and zero-based command
index. Setup failures have index `-1`. Idle examples are bounded to 20 per cell;
all idle turns are counted. Completed rounds include capped battles; all-throw
cells report null round statistics. Progress prints after every completed cell.

Any throw or more than 1% capped battles in any cell fails. Exactly 1% remains
allowed. Other simulation anomalies, unexpected rosters and missing diagnostics
also fail. Intentional AI waiting can be legal, so idle counts are diagnostic.
The cap's existing stalemate message is represented by its incident/rate rather
than silently imposing a zero-cap threshold.

Diagnostics are opt-in. They inspect real action events and check pre-command
legal actions only when an actor ends without moving or using an ability.
They do not change commands, state, RNG, scoring, content, tuning or presentation.
Ordinary simulations retain their original exceptions; diagnosed command failures
preserve their cause and failing command index.

Initial validation: typecheck and focused lint pass; supported files pass
Prettier. The 12 focused tests pass, including 96 real battles covering every
cell in 12.694 seconds against the unchanged 30-second limit. Controls cover
complete event/result/RNG parity, exceptions, real legal-idle and rooted fixtures,
report completeness, medians and the 1% threshold boundary. Independent source
review is clear. These preliminary checks precede final metadata.

Delivery requires exact clean-head `npm run ci:local` plus the full default
`npm run soak`. Their final results belong in the linked PR and claim; this file
alone does not claim those gates passed. Source-bound logs, reports, receipts and
original failures are retained at `/workspace/avatarrpg-env/sim-soak495/`.
No rendered gameplay or hardware acceptance is inferred from headless tooling.
No merge, deployment, dispatch, installation, art or security change is included.
