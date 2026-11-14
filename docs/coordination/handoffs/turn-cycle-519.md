# Turn-order property test (#519)

- **Outcome.** Twenty-four encounter and table-size combinations each run thirteen
  seeded battles through `runCombat`, with its ordinary AI, authored encounter levels
  and default round limits. The matrix uses the existing bounded worker pool and
  asserts under 20 seconds from dispatch through all result assertions.
- **Contracts.** The test follows living unit IDs in their actual initiative order,
  accounts for partial terminal rounds and deaths during upkeep, and counts the
  size-2 boss by unit ID. This roster has no mid-battle summon mechanism. Draft
  observers forward the real operations and distinguish status application or
  cleansing from duration ticks. A cooldown installed with value N matures on
  its Nth subsequent owner-start. Another restriction, such as insufficient AP,
  can still prevent use. A one-turn skip consumes the activation even as it expires.
- **Baseline.** The [previous issue claim](https://github.com/jaredbahr/Avatarrpg/issues/519#issuecomment-6730922768)
  records the original single-lane CJS failure (236 battles at 20.035 s) and the
  corrected ESM failure (272 at 20.154 s). The original external seed script
  was unavailable here. This branch declares `turn-cycle:<encounter>:<size>`
  with trials 0–12. Main now includes the shared combat worker pool.
- **Reproduce.** Run `npx vitest run --project serial src/core/rules/turnCycle.property.test.ts`
  for the recorded matrix. Run `npm run ci:local` for the complete local project
  configuration. The test validates headless rules, so physical device or
  rendered gameplay is outside this evidence.
