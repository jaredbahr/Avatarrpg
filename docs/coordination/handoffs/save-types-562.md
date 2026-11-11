# Typed save key contract (#562)

Owner: continuous gameplay quality, `root/save-types562-20261110`.
Branch: `codex/save-type-contract-562`, from main `30815ebb`.
[Verified pre-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/562#issuecomment-6765951738).

The save writer and reader used assertions through `unknown`, allowing an added
state field to compile even when the save schema would strip it on load. A
compile-time recursive key contract now guards the rules and inferred save
shapes in both directions, including nested battle state, arrays and records.
Type-only negative fixtures protect the contract; existing runtime save tests
and schemas are preserved.

The contract compares keys and container structure, not scalar value domains.
Today's schema accepts status/surface IDs and terrain IDs as strings while the
rules name narrower unions. This existing validation boundary is retained and
documented rather than disguised as enum validation. The writer's mutable type
view constructs or mutates nothing; loaded state keeps its existing assertion
about those ID domains. No save-format, migration, content, rules, renderer,
story, art, workflow or dependency change is intended.

Only `serialize.ts`, new `typeContract.ts`, new `typeContract.typecheck.ts` and
this handoff are owned here. Other owners retain `types.ts` and schema work.

Validation retained in `/workspace/avatarrpg-env/save-types562/`:

- Original serializer: unchanged and four planted key-drift controls compile.
  The retained clean PR573 producer has byte-identical core serializer source
  to the main baseline; it is identified separately from this candidate.
- Candidate: unchanged compiler control passes; five real schema/state drift
  controls fail at the production guard. Replacing the guard with `true`
  exposes all 24 unused negative directives, proving those fixtures are live.
- Typecheck, scoped lint/format and the unchanged nine save suites pass:
  188 tests, including golden byte identity and 2,080 corruption mutations.
- Unminified esbuild serializer JavaScript is byte-identical to main
  (`e982be8db2124c2b9db4f359fe309ae3ba5e2ebc371b121a52bb139b8badb051`).
  The helper and type fixtures emit no runtime code. No native behavior change
  is introduced or new native acceptance claimed.
- Independent SOL High source review and mutation-log inspection are clear.

Initial directive-placement and empty-object lint failures are retained; the
same negative expressions remain. An initial erasure comparison found only a
new inline comment emitted by esbuild; the redundant comment was removed,
retaining the helper documentation and the exact byte-equality assertion.

The guard does not distinguish an optional tuple index from a required tuple
index whose value includes `undefined`; current saved state has ordinary
arrays. It does detect added tuple indices and nested tuple-member keys.

Publication requires exact clean final-head `npm run ci:local`; record that
result and actual hosted jobs/skips in the PR with exact commit/tree identity.
Keep DRAFT. No merge, deployment, rerun/dispatch, install, paid request, generated
asset or security/access change is authorized by this handoff.
