# ADR 0082: units art family raised to 8.5 MiB

Status: accepted (owner, 20 October 2026).

## Context

The units family (`public/art/units`) held 6.42 MiB of its 6.75 MiB budget (ADR 0051) once the forest road bandits got
their own hit reactions and knockouts (ADRs 0078 to 0080). The current goal is to finish Ba Dan and the forest road as one
consistent work with complete animations, which means generated eight-way sheets for Ba Dan's residents too. A single
resident sheet (idle, walk and rest in eight headings) costs about 0.27 MiB, so the old budget had room for none after the
first.

## Decision

`UNIT_BUDGET_MB` in `scripts/check-asset-budget.mjs` is 8.5. The owner approved the raise on 20 October 2026. The
precache budget stays at 25 MB and the other family budgets are unchanged.

## Consequences

- About 2.1 MiB of units headroom: room for the remaining Ba Dan residents' locomotion sheets.
- The 25 MB precache budget is now the binding limit (23.6 MB used on 20 October 2026), so each new sheet is still
  measured with `npm run check:assets` after a build, and larger additions need their own decision.
