# ADR 0109: JavaScript budget 410 KB gz

**Status:** accepted, 2026-11-12. Amends the JS budget of ADR 0104 (404 KB gz, 2026-11-11).

## Context

After the defeat choice (#654) the shipped JavaScript sat at 403.7 of 404 KB gzipped. The demo
still owes features a stranger meets in the first ten minutes: the victory results card (#630) and
the guided first fight (#625). The results card alone is a little under 1 KB gz, and it already
reuses the reducer (a dry run of `resolveBattle`), the defeat panel's structure and the shared
`.bar`, so there is nothing left to trim from it without dropping what it shows.

## Decision

The owner approved raising the JS budget to **410 KB gz** on 2026-11-12 (comment on #625), to be
done in the first PR that needs it, after reasonable trimming. `scripts/check-bundle-size.mjs`
now reads `BUDGET_KB = 410`. Only the JS number changes; the art, audio and other asset budgets
are untouched.

## Consequences

About 6 KB of headroom for the rest of the demo. Lazy-loading stays the first answer for anything
large and not needed at boot; the next raise needs the owner again.
