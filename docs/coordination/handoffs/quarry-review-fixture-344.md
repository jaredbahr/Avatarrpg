# Quarry review fixture — issue #344

- **Updated:** 2026-10-29, America/Chicago; owner and integration owner `/root`.
- **Goal:** review-only title-to-home recordings for trade on desktop Canvas and escort on portrait Canvas, plus a severity-graded audit. Scope is `e2e/demo-flow.review.ts`, `playwright.demo-flow.config.ts`, this handoff, the audit and small source review artifacts. No product source changes.
- **Branch and base:** `codex/quarry-review-draft` in `/workspace/avatarrpg-quarry-review-draft`, from current main `bc77ae2eceb6740dd4c143cae61595a1f4884bc2`. Earlier fixture commits `4304e988` and `3c4138c` and combined recordings remain historical evidence; they included other product work and are not this branch's acceptance captures.
- **Fixture:** legal browser walking and controls, planner commands, and any staged enemy HP after recorded party activations are carried from the prior #344 fixture. This branch waits for the actual destination scene, stopped walk and clear curtain before arrival stills. When main lacks the optional #328 Show enemies control, the fixture logs that fact and uses the existing turn-strip Focus control to show the live boss and health bar, then restores the acting unit.
- **Desktop trade evidence:** clean committed fixture `8071f7343b649da8844ae705e8f8d55eb4be8051`, 83 beats through the final Ba Dan trade response, no page errors, compressed video and source manifest under `art/source/demo-flow/review/quarry-trade-desktop-canvas.*`. The forest fight ended in **defeat** at round 7 and continued via the authored branch; the historical `forest-battle-victory` beat filename is inaccurate. The Driller was staged to 1 HP only after three party activations. The route did not reach or ignite the forest oil flask.
- **Portrait escort evidence:** clean committed fixture `e63013adcdb436d300afd1387777cc7274230b18`, 87 beats through the final Ba Dan escort response at 1241.8 s, no page errors, title `v0.2.11 · build e63013a`. The forest, cutting ambush, and Driller HP shortcuts followed 12, 3, and 3 party activations. The attached Playwright runner exited 0 with `1 passed`; ignored `.shots/demo-flow/verified-e630-ipad-run2.exit` contains `0`, and `.shots/demo-flow/test-results/verified-e630-ipad-run2/.last-run.json` says `passed` with no failed tests. Raw evidence is in ignored `.shots/demo-flow/verified-e63013ad-run2/escort/ipad-canvas/` and `.shots/demo-flow/test-results/verified-e630-ipad-run2/`; the small linked package and severity audit are in `art/source/demo-flow/review/` and `docs/demo-flow-playtest-quarry.md`. An earlier complete capture at `dd039d5d` remains locally as provisional because its runner exit status was lost; it is not the published portrait evidence.
- **Fixture correction:** the forest terminal beat derives its name from the actual battle phase and rejects a nonterminal outcome. This does not relabel or alter the historical desktop raw manifest, whose `forest-battle-victory` filename records an actual defeat. Full `npm run ci:local` on the final commit remains pending. Each authoritative capture shows a clean committed source SHA in its title label and beat manifest.
- **Limits:** route shortcuts prove progression and presentation, not unstaged balance. Automated Chromium portrait is not physical iPad or Safari; Playwright video does not prove audible quality. Claude owns landing; follow the current #348 review and merge policy.

## Review corrections — 2026-11-03

Root session `throughput362-20261103` continues SAME PR362. Current main207c8eec
merged cleanly with a merge commit; existing history is preserved. Reused the
verified `review-362-media` candidates from the exact published originals, with
no re-encoding: trade6,436,716B, escort7,427,019B. Packaged video hashes/probes and
compression disclosure now match; raw capture IDs/hashes, beats, stills and runner
results stay intact. Audit findings QR-01/QR-10 link #377/#378. No product source,
shared helper, generated artwork or test assertion is changed by this correction.

Full final-head ci:local is required before push; exact results belong in the PR
and external `/workspace/avatarrpg-env/throughput-362/` receipts. Capture results
remain bound to their historical producers, not the newly integrated source.
The old media blobs remain in ancestors; compression is not history cleanup.
Claude owns merges and any clean-history integration. Current Jared policy
supersedes the earlier draft-only session restriction; failed checks and explicit
review requests remain gates. No new PR is opened while above the five-PR limit.
