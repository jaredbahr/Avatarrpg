# ADR 0060: A zod-compatible runtime validator in place of zod

**Status:** accepted, 2026-09-28

## Context

ADR 0057 recovered about 8 KB under the 320 KB JavaScript gate, and main had
climbed back to 317.3 KB with bend choreography and combat wiring still owing
3–5 KB. The gate stays where it is.

Per-module attribution from the production sourcemap put zod at about 10.3 KB
gzipped: `v3/types.js` alone is 7.9 KB, because zod v3 ships every combinator
whether or not it is used. Only four shipped modules call it:
`core/save/serialize.ts` validates saves, and `content/fx.ts`,
`content/sounds.ts` and `content/tuning.ts` parse their authored tables to fill
defaults. Between them they use twelve combinators. `content/schemas.ts` is
already dev-only (a `DEV`-gated dynamic import) and `content/bends.ts` ships
types only (ADR 0055), so neither is in the bundle.

`zod/v4-mini` was measured and rejected: on a representative schema it bundles
to 8.9 KB against v3's 14.0 KB, so it would save about 5 KB, and it changes
defaults, error shapes and syntax enough to be a port of its own.

## Decision

`src/core/schema.ts` implements zod v3's API for exactly what the four modules
use: `number` (`int`, `finite`, `min`, `max`, `gt`, `positive`), `string`
(`min`, `max`), `boolean`, `literal`, `enum`, `array` (`min`, `max`),
`object` (`strict`, `partial`), single-argument `record`, `tuple`, `union`,
`discriminatedUnion`, and on every schema `optional`, `nullable`, `default`,
`refine`, `parse` and `safeParse`, with the `infer` and `input` types. The four
modules change only their import, `import * as z from '.../core/schema'`, so
every schema reads exactly as it did.

The contract is zod's behaviour, not a description of it: the same verdict,
the same output (unknown keys stripped, defaults parsed like input, an
undefined result kept only where the input had the key, zod's key order, and
`__proto__` dropped from records), and the same issues at the same paths in the
same order, including zod's distinction between an aborted result (wrong type:
the enclosing object aborts and skips its refinements) and a dirty one (a
failed bound). `deserialize` shows the first issue's path to the player, so the
order is part of the interface. Issue _messages_ are plainer than zod's; no
player sees them.

`src/core/schema.test.ts` enforces this by loading the real serialize, fx,
sounds and tuning modules a second time with zod mocked in for `schema.ts`, and
comparing both builds on every authored recipe and sound, the tuning block, a
real mid-battle save and an explore save, each mutated about 3,000 ways
(fields dropped, retyped and pushed out of bounds, keys added, arrays cut and
grown), plus `deserialize`'s player-facing message. Planting a divergence in
the key-keeping rule or in the refine-after-dirty rule fails it.

`scripts/check-bundle-size.mjs` fails the build if `ZodError` appears in the
shipped JavaScript, so a value import of zod from a shipped module is caught
the way ADR 0057's stubs are.

Measured on the local production build:

| Production JavaScript | Before (KB) | After (KB) |
| --------------------- | ----------: | ---------: |
| Application bundle    |       304.3 |      292.9 |
| Service worker        |         3.9 |        3.9 |
| Workbox runtime       |         5.1 |        5.1 |
| Browser helper chunk  |         3.8 |        3.8 |
| Registration          |         0.1 |        0.1 |
| **Total**             |   **317.3** |  **305.8** |

## Consequences

A shipped schema that needs a combinator the validator lacks adds it to
`schema.ts` with a case in `schema.test.ts`; importing zod instead fails the
gate. CI-only validation (`content/schemas.ts`, the bend packer's schemas)
stays on zod, and zod stays a dependency for it and for the differential test.

The risk is a zod behaviour the fuzz never reaches. It is bounded by the
combinator set being small and fixed, by the fuzz running the real schemas
rather than lookalikes, and by the save tests, which still exercise every
migration and every damaged-save message through the new validator.
