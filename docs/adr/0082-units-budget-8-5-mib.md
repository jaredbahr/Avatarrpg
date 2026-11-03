# ADR 0082: Raise the units art family to 8.5 MiB

**Status:** Accepted  
**Date:** 2026-10-20

Supersedes the 6.75 MiB units ceiling of ADR 0051. The owner approved the raise on 20 October 2026.

## Context

The units family (`public/art/units`) held 6.42 MiB of its 6.75 MiB budget (ADR 0051) once the forest road bandits got
their own hit reactions and knockouts (ADRs 0078 to 0080), leaving room for one more resident sheet. The current goal is
to finish Ba Dan and the forest road as one consistent work with complete animations, which means generated eight-way
sheets for Ba Dan's residents too. The first one measured (the household adult's idle, walk and rest in eight headings,
on an unmerged branch) is 279,003 bytes, about 0.27 MiB.

## Decision

`UNIT_BUDGET_MB` in `scripts/check-asset-budget.mjs` is 8.5. The precache budget stays at 25 MB and the other family
budgets are unchanged.

## Consequences

- About 2.1 MiB of units headroom, room for about seven resident sheets of that size.
- The 25 MB precache budget is now the tighter limit (the script reports 23.64 MB of 25 MB on 20 October 2026; its "MB"
  is MiB), so each new sheet is still measured with `npm run check:assets` after a build, and larger additions need their
  own decision.
