# Forest objective guidance — partial #629

Session `root/forest-objective629-20261111`; branch `codex/forest-objective-629`.
[Claim](https://github.com/jaredbahr/Avatarrpg/issues/629#issuecomment-6788449484).
Base is main `96770384ad28b94a02346c93e05bc43b468bc15e`, tree
`8ef3c4c56e7c49f3cd56728f44bc44886b8b19c5`, including the approved demo ending.

The owner requested a specific forest objective for strangers playing the demo.
Only the forest map's default objective and the legacy `forest_explore` override
change: follow the road east to the quarry gate, past the roadblock, with Ba Dan
to the west. “Past” describes the landmark without presenting it as an unfinished
task after a pre-rescue backtrack. No new story fact, destination or reward.
The matching generated `docs/story/world.md` node label is refreshed using the
existing generator; only its matching `n34` label changes on the new graph.
The ending's graph numbering and Ba Dan homecoming trigger remain intact.

All IDs, conditions, exits, triggers, positions, routes, other node fields,
post-fight and homecoming objective variants remain unchanged. No core, App,
scene, camera, renderer, style, helper, existing test, asset, package, workflow
or budget change. The pointer, NPC name tags, exit-arrow direction, Dema visual
identity and road-art subtasks are excluded. This partial delivery keeps #629
open and does not claim those findings are fixed.

An independent SOL High Standard author froze the new native spec before any
production edit, SHA256
`dedea22ee79d3e6c87b2ce34ae620412b5d3acedd97c57fbcb6208c52e6918b3`.
It uses semantic east/roadblock/quarry expectations, not a full-prose golden.
At the owner's 1180x820 viewport, four outbound cases cover actual map-arrival
fallback and legacy-node override on Canvas/WebGL. Every real text glyph must
fit its clipping ancestors and receive a centre hit; the whole dock is visible.
Actual Local map input checks the east exit's condition and the west exit.
An actual projected road-tile click is compared to the independent public
reducer's complete state, with session/RNG/story and camera evidence.

Two additional backend cases each observe the post-roadblock node, earned
return node and earned return map variant. The post-fight entry fixture does
not claim an earned fight. Return fixtures reuse the existing legally earned
trade-route checkpoint through the Driller, with its complete transcript;
fixtures are serialized and reconciled before loading through the real UI.
These cases do not cover every pre-rescue backtracking state or constitute a
full browser campaign, animation or physical-input acceptance.

Earlier main `f9ee46ab` baseline: **4 fail / 2 pass**, stable 105.108s. Each outbound case
fails only the soft `/roadblock/` expectation; glyph visibility, map, safe walk,
complete state and direction controls all execute successfully. Baseline log:
`c50fcae07ff05de40705ddbc1e20a734dead7db970b00085942130b9c7dbc27b`.
The production strings were unchanged at that point; no fixture or numerical
oracle correction was needed. The original failures and source are retained.

Earlier preliminary candidate native: **6/6 pass**, zero skips/retries/flaky/errors, stable 81.879s.
Log `30225414a3bbaf19b7eefb380e3edebcb991e06c1d0641a6815b51949bf2a949`.
Normal-scale Canvas/WebGL screenshots show the complete new objective clearly.
The new spec is byte-identical to its original RED version. Production source
review found only the two strings and generated label changed.

The first clean committed candidate then failed two existing trade/escort
return-objective unit assertions expecting `/east to the quarry/` (4,651 pass /
2 fail). This was a candidate wording regression, not a setup or baseline
failure. Its complete CI log is retained:
`cb481314c95e5f0c1ebf1da6fe98953f31d9dcc2652bfa336259113427a40299`.
Reordering the destination before the roadblock preserves that existing phrase;
all 14 unchanged return-objective tests pass, log
`2fa426d1430b32a2d0a83c95cb263e5e5c0065c783ec3691c36171e6e4d01bbf`.
No existing assertion or native oracle changed. The earlier six native passes
qualify the previous word order only; the corrected final head still requires
its own full CI and fresh rendered qualification before publication.

Before publication, main advanced to the approved demo-ending merge
`96770384`. Exact clean corrected `13cb7470`, tree
`d78d04e7809ec86ed593db34c6716f0b86a11557`, had passed **12/12 local CI steps**,
342 files / 4,653 tests, log
`bf956acad4918b6f487370f1320c778354a370f59131c5619cc179ff2990493c`.
Its fresh own-CI native checks passed **6/6**, zero skips/retries/flaky/errors,
stable 83.213s, log
`151dbe8418c0ec99f6d54eabb70ceed5cab1a7197f31a79fdaaaa802ba2cf601`.
All 437 output paths/hashes/bytes matched that CI producer; glyphs, controls,
complete state and cameras passed. Those results and exact source are retained
under `superseded13cb-evidence`; they do not qualify the new base.

All 28 incoming ending paths are retained. The new ending legitimately changes
earned-return transcripts and visited state, so a fresh current-main baseline
replaces the older baseline for final full-state comparisons. Fixtures still
stop in Forest Road before the new Ba Dan homecoming trigger.
Fresh `96770384` build passed, then native baseline **4 fail / 2 pass**,
stable 106.031s, log
`aa3d8fe4cbe7ade6ec3a73f4f45d6d05913749ec25212f4eeb2d568676f77786`.
Each outbound case fails only the soft `/roadblock/` expectation; glyph/map,
safe walk, complete state and camera controls execute successfully. Both new
ending earned-return direction cases pass. Production strings were unchanged
at that point. No fixture or numerical oracle correction was needed.
The new spec remains byte-identical to the original RED version, and the old
return-objective guard remains SHA256
`0c32a415aa9255ef3125b626a7a8df68027528b9509c5d0f0f018c2a89477afd`.

Expensive checks run serially. Before publishing, require exact clean final-head
`npm run ci:local`, fresh native checks on its own CI outputs, complete output
paths/SHA256/bytes identity and independent final review. The final exact commit,
tree and actual results belong in the draft PR and publication receipt; this
source checkpoint does not claim the publication gate has run. Evidence/media:
`/workspace/avatarrpg-env/forest-objective629/`, outside Git and not uploaded.

Keep DRAFT. Physical iPad/input, WebKit/Safari/PWA, browser floors, device
performance and owner acceptance remain open. No merge/Ready/deploy/dispatch,
install, paid request, art generation/replacement or access/security change.
