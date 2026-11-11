# Compact save size guard (#567)

Owner/session: continuous gameplay-quality goal, root/save-size567-20261110.
Branch: `codex/save-size-budget-567`, based on exact main
`30815ebb817a410bae375df3c0f7ebc5473f53ce`, full base tree
`671a37cd2bf25a38edb1bc1b6884c846735ee771`.
[Verified pre-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/567#issuecomment-6762857897).

Only the new `src/core/save/sizeBudget.test.ts` and this handoff change. Existing
serializer/schema, golden files, quarry producer, tests, content, app, assets,
dependencies and other owners' files stay untouched. Open PR heads/file scopes
and duplicate/claim searches were checked before editing. Root owns integration
and serialized execution; retained SOL High `encounter563_review` authored the
new test, independently reviewed read-only by `discipline564_review`.

## Original measurements and frozen caps

An external probe imported only existing main modules and measured `serialize()`
once before filling the new test's literals. The new test was not imported by
that probe. Exact base/tree, stable tracked source, probe/helper/golden hashes,
serialized JSON digests, metadata and measurements are retained in
`/workspace/avatarrpg-env/save-size567/original-measurements.json` and its
execution receipt. Original producer execution passed in 2.434s, log SHA256
`a59f47e19a952d34caab0c583504becede1b74313144c3e00802755871b02605`.
The source checkout had only the new untracked test; it was not a clean final
commit, and this measurement is not substituted for final CI.

| Fixture               | Compact UTF-8 bytes | Frozen cap: ceil(original × 1.5) |
| --------------------- | ------------------: | -------------------------------: |
| Four-party fresh game |               2,397 |                            3,596 |
| Six-party mid-Driller |              41,404 |                           62,106 |
| Four-party homecoming |               4,335 |                            6,503 |

Limits are literal constants, never derived from the current observed size. A
policy consistency check requires each frozen cap to equal the frozen baseline's
150% ceiling. Every run reports all three observed sizes and limits before
checking them. UTF-16 string length is reported only as a storage proxy, not as
measured Safari quota consumption. This guard covers compact `serialize()`, not
pretty export file size or physical browser storage acceptance.

Fresh and postgame use the unchanged merged #486 v5 golden saves. That historical
corpus used its explicitly permitted forced-victory fixture adapter followed by
real rewards/routing/homecoming; no legally won four-party campaign is claimed.
The new test does not regenerate or edit those saves. It loads and reconciles
through the existing App-order loader and checks stage, table, progression and
session identities before measuring.

There is no six-party golden. The existing main canonical escort producer plays
the unmodified campaign legally and supplies 392 public commands. A fresh game
with its exact seed and roster replays the accepted prefix, stopping at command
203: active Driller round 2, 27 accepted Driller commands, observed real movement
and casting, six party units and the living four-cell boss. It never copies the
postgame state back into a battle or fabricates HP/AP/flags/RNG. The captured
state is serialized with fixed savedAt `1700000000000` and fixed metadata; full
state/session official-load roundtrips must preserve it.

An over-budget failure reports the five largest envelope fields and five largest
state fields, counting each JSON key/colon/value contribution. A separate,
explicitly synthetic oversized-JSON control proves rejection and field-name
diagnostics; it is not represented as a playable save. The original mid-battle
state's battle field contributes 33,803 bytes; `battle.grid` itself is 27,748
bytes (67.0% of the complete save). No grid is removed: battle terrain can change,
so this observation does not establish that its snapshot is redundant or safe
to discard. Any save-format optimization remains separate.

## Checks and publication

Focused check: **2 tests passed**, 1.497s tests /3.509s wrapper, stable source;
log SHA256 `5f41875f07540446f70e27301069d9c32f0b6d34c36ffe362fc5d9fa39f28f12`.
The observed fixture bytes match the independent original measurements exactly.
No product failure is invented: this adds a requested regression budget and a
real six-player checkpoint beyond the broader existing golden-save limits.
The author's explicit zero placeholders were replaced from the retained original
measurement before any budget test executed; no placeholder failure is claimed.

Independent source review is clear; final static checks, exact clean-head full
`npm run ci:local`, canonical publication and actual hosted jobs/skips are pending
at this handoff's source checkpoint. The PR and external receipts record their
exact results and source identities separately. No existing threshold, corpus,
assertion, timeout or retry is weakened.

Keep DRAFT. This is headless test tooling; no new rendered/device/storage-quota,
WebKit/PWA, gameplay, balance or style acceptance is inferred. Protected
#423/#443/#479 and separate PR570/571/572 ownership stay intact. No merge,
deployment, dispatch/rerun, install, paid request, art generation or security/access
change. No DeepSeek request; approved executor/shared cumulative ledger remains
unverified.
