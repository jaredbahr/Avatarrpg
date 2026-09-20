# Quarry Gate deployment screen

- **Updated:** 2026-09-19 UTC; outgoing owner `world_conversations`; read-only
  diagnostic handed to the integration owner.
- **Outcome:** In-memory comparison of the authored Quarry Gate party deployment
  against eastward shifts of 3, 4, and 5 cells. The screen preserves the map's
  oil, props, enemies, abilities, and AI rules. It does not approve a production
  spawn change.
- **Location:** Avatar RPG worktree
  `C:/Users/Jared/.codex/worktrees/combat-ai-prop`, branch
  `codex/combat-ai-prop`, source baseline `4d0a112` before this handoff-only
  commit. No PR, push, or CI run was made.

## Method

The probe used `createGame`, `createBattle`, and repeated `runAiTurn` reducer
steps against the current AI source. Every party member was level 2 with
`autoChoose: true`; profiles match the simulator (`water: support`,
`earth/air: cautious`, all other elements: `aggressive`).

- Seven two-person pairs used the same `gate-pair-0..19` seeds for every
  deployment: Sura/Riko, Kaya/Riko, Nilak/Riko, Bo/Riko, Tenzo/Riko, Sura/Kaya,
  and Sura/Bo.
- Standard three used the balance harness roster `bo, nilak, kaya`; standard six
  used `STANDARD_PARTY` (`bo, nilak, kaya, riko, nima, sura`). Each used the
  same `gate-standard3-0..19` or `gate-standard6-0..19` seeds at every shift.
- Standard three and six were each run against the normal roster and the forced
  `bluffed` variant.
- Placement validation checked bounds, blocked tiles, duplicate cells, and
  authored props before simulation. The run recorded wins, party-unit deaths,
  mean final round, and Riko's first ability whose affected tiles contained a
  living enemy. Prop-only actions were excluded.

The reproducibility files are retained locally under the ignored directory
`.shots/gate-deployment/`:

- `gate-deployment-audit.ts`
- `gate-deployment-audit.json`

## Placement candidates

| Deployment | Six authored spawns                   | Placement result                                   |
| ---------- | ------------------------------------- | -------------------------------------------------- |
| Current    | `(1,3) (3,4) (1,5) (3,6) (1,7) (3,8)` | Valid                                              |
| East 3     | `(4,3) (6,4) (4,5) (6,6) (4,7) (6,8)` | **Rejected:** `(6,6)` is the authored cabbage cart |
| East 4     | `(5,3) (7,4) (5,5) (7,6) (5,7) (7,8)` | Valid                                              |
| East 5     | `(6,3) (8,4) (6,5) (8,6) (6,7) (8,8)` | Valid                                              |

East 3 pair-only trials were mechanically runnable because their first two
spawns avoid the cart, but it is not a valid map deployment. In standard-six
trials the placement helper displaced a party member in all 20 runs, so those
standard results were rejected as candidate evidence.

## Normal two-person results

Each cell is `wins/20, total party deaths, mean final round, Riko first enemy
action trials/20 @ mean round`.

| Pair       | Current                     | East 4                      | East 5                          |
| ---------- | --------------------------- | --------------------------- | ------------------------------- |
| Sura/Riko  | 0/20, 40, 2.85, 0/20        | 5/20, 30, 2.75, 17/20 @ r2  | **14/20, 19, 2.95, 18/20 @ r2** |
| Kaya/Riko  | 20/20, 0, 3.00, 20/20 @ r3  | 15/20, 10, 2.75, 17/20 @ r2 | 12/20, 17, 2.55, 19/20 @ r2     |
| Nilak/Riko | 20/20, 1, 3.05, 20/20 @ r2  | 20/20, 0, 2.35, 20/20 @ r2  | 20/20, 6, 2.50, 20/20 @ r2      |
| Bo/Riko    | 20/20, 10, 3.05, 20/20 @ r2 | 16/20, 13, 2.70, 13/20 @ r2 | 20/20, 2, 2.25, 18/20 @ r2      |
| Tenzo/Riko | 20/20, 2, 3.10, 20/20 @ r2  | 19/20, 4, 2.15, 17/20 @ r2  | 20/20, 2, 2.20, 20/20 @ r2      |
| Sura/Kaya  | 19/20, 2, 3.00              | 17/20, 8, 2.25              | 17/20, 8, 2.30                  |
| Sura/Bo    | 20/20, 6, 2.55              | 18/20, 11, 2.45             | 8/20, 28, 3.10                  |

## Standard roster results

Values are `wins/20, total party deaths, mean final round`.

| Roster / variant    |         Current |          East 4 |          East 5 |
| ------------------- | --------------: | --------------: | --------------: |
| Standard 3, normal  |  20/20, 0, 3.20 | 20/20, 23, 3.30 | 20/20, 21, 3.05 |
| Standard 3, bluffed | 20/20, 16, 3.95 | 15/20, 43, 4.85 | 14/20, 43, 4.50 |
| Standard 6, normal  | 20/20, 44, 3.05 | 18/20, 65, 3.00 | 20/20, 39, 2.50 |
| Standard 6, bluffed | 20/20, 23, 3.20 | 20/20, 32, 2.90 | 20/20, 59, 3.80 |

## Findings and limits

- East 5 is the first valid shift that gives Sura/Riko meaningful legal-AI
  counterplay: wins rise from 0/20 to 14/20 and Riko attacks in 18/20 trials.
  The first Riko action is Strike in round 2; this is engagement evidence, not
  a guaranteed-win claim.
- East 4 makes Riko attack in 17/20 Sura/Riko trials but wins only 5/20. It is
  less disruptive to the standard bluffed roster than East 5, but does not solve
  the target pair.
- East 5 is roster-sensitive: Sura/Bo falls to 8/20 and standard-three bluffed
  falls to 14/20. No single global east shift is recommended.
- East 5 places party cells at x8 beside the authored exploration watch
  crossing at x8. The world transition and human route were not tested by this
  rules-only screen.
- This is a deterministic AI simulation. It is not human balance acceptance,
  browser evidence, visual acceptance, or physical-device evidence. No status
  weights, character kits, map props, enemies, or production files changed.

## Verification and transfer

The command was run from the owned worktree with the installed dependencies:

```text
node --import tsx $env:TEMP/gate-deployment-audit.ts
```

Current, East 4, and East 5 placements were valid; all their trials terminated
without a turn cap. East 3 was retained only to document the cart collision and
was rejected. The worktree was clean before adding this handoff and remains
limited to this document plus ignored local evidence. No unit suite, `npm run
verify`, browser server, CI, or push was run for this read-only diagnostic.

The integration owner should treat East 5 as a design reference for a possible
conditional two-person gate approach or dry lane, while preserving the global
six-person spawn pattern until the standard-variant regressions are resolved.
