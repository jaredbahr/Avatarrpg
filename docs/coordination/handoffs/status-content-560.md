# Status and combination content regressions — #560

Owner: `root/status-content560-20261110`, branch `codex/status-content-560`.
Claim: <https://github.com/jaredbahr/Avatarrpg/issues/560#issuecomment-6764889398>.
Base: canonical main `95596b54296ba90c799a1794b17a1281140f18c4`.

## Bounded outcome

Two new tests; production rules, content, existing tests and art are unchanged.

- All 12 shipped statuses: seeded real units, BattleDraft status application and
  real reducer turn handoffs. Two other party activations and an enemy intervene;
  statuses tick only at their owner's start, expire exactly once, and stay gone
  on the extra lap. Burning's final tick still damages. Frozen/Stunned each cost
  one activation, then restore normal resources. Eleven non-upgrading statuses
  refresh without shortening or exceeding stack caps. Wet extinguishes Burning;
  actual applied/expired messages use the person and status display names.
- All 20 combinations: a literal witness inventory must match shipped content.
  Real character/discipline grants establish the first surface on bare authored
  terrain, then another legal reducer cast triggers the combination. Ownership,
  AP/cooldown/status restrictions, target/range/LOS and turn order are checked.
  Exact public surface-change events accompany the observed reaction, including
  duration, spread, status rolls and connected-neighbour damage. The observer
  forwards the existing method unchanged; it never alters rules, events or RNG.
  Cold clearing fire is checked before Ice Spikes' later ice paint. Spread needs
  an actual round wrap; each scenario repeats with identical state/events.

These are disclosed content fixtures: placements/initiative are staged, enemies
use the supported level-10 input so they survive setup plus chain damage, and the
engineering flag/advanced choices are supplied. This does not prove Act 1 grants
those disciplines. No prepainted surface, synthetic ability, seed search, forced
chance success, artificial HP or runtime/content edit establishes a witness.

## Validation and original failures

Final status source passed 93 related cases. External, uncommitted regression
controls fail the actual assertions when all owners tick, expiry runs early or
skip is read after expiry (12, 10 and 2 failures respectively). Removing only the
fire-into-oil reaction likewise fails its real-kit witness. Controls transform
one exact source expression in memory; production files remain untouched.

Retain the original 20-pass/1-fail combination run: the level-7 fixture's victim
had 7 HP before 12 chain damage, violating the explicit survivor assertion.
The supported level-10 fixture passes all 21 cases with every assertion retained.
This is a fixture correction, not a damage/stat/balance or threshold change.
Earlier external-control import-path failures and the combination worker-limit
startup failure collected no tests and are not regression detections.

Evidence, original source copies, full logs and identity receipts are outside
Git at `/workspace/avatarrpg-env/status-content560/`. Independent SOL High source
and evidence review precedes the exact clean-head `npm run ci:local` gate. The PR
records that gate's exact head/tree/result and actual hosted jobs, including
skips. Never transfer an earlier revision's result to a correction.

## Remaining decision and delivery

Repeated Chilled upgrades to Frozen; whether an explicit incoming duration may
carry into that turn-skipping status is the existing unresolved owner decision
in #560. This change covers Chilled's ordinary lifecycle and does not choose an
upgrade-duration policy, skip a failing test or change combat balance. Keep
#560 open for that decision and its eventual regression assertion.

No player-facing runtime change is made, so no new rendered, physical input,
device, WebKit, PWA or aesthetic acceptance is claimed. Keep DRAFT; corrections
stay on this same PR/branch. No install, merge, deployment, dispatch, credentials,
security changes, paid request or generated/replacement art.
