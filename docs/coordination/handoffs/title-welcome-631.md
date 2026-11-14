# Solo welcome and secondary riverside — partial #631

Session `root/title-welcome631-20261111`; branch `codex/title-welcome-631`.
[Claim](https://github.com/jaredbahr/Avatarrpg/issues/631#issuecomment-6789880895).
Base: main `96770384ad28b94a02346c93e05bc43b468bc15e`, complete tree
`8ef3c4c56e7c49f3cd56728f44bc44886b8b19c5`, including the approved demo ending.

The owner requested an explicit welcome for solo play and a smaller secondary
riverside action. `TitleScene.ts` changes in exactly two places: its subtitle
becomes “Play alone or pass the iPad around. A tactical RPG set after Korra.”,
and the riverside button uses the existing ordinary button sizing instead of
`btn-large`. The existing secondary appearance and `--tap` minimum remain.
No new style rule, token, asset, painting, portrait, identity or default style.

All button names, handlers, order, New game/Continue primary logic, autosave
detection, setup, session, preview and restore behavior remain unchanged.
The requested “Start the demo” rename and its twelve existing selector files
are excluded pending explicit PR #362 handoff comment `6788338841`, including
its claimed `e2e/demo-flow.review.ts` selector. No compatibility alias or silent
takeover. This partial delivery keeps #631 open; any later correction stays on
the same branch/PR after coordination. Existing #624 setup ownership is excluded.

An independent SOL High Standard author wrote only the new
`e2e/title-welcome.spec.ts`, first as an external draft. It was frozen and applied
to a verified clean isolated checkout before production edits, SHA256
`0bc93ecc2e69ea6ecb5f7b4aa7fe9bf2e8dd69baebe3a596fd45cba6cbad9274`.
No existing test/helper/package/workflow/budget or App change.

At owner viewport 1180x820, six Canvas/WebGL cases cover:

- Fresh title: semantic solo/shared welcome, all heading/subtitle/action glyphs
  visible and centre-hit, every action within the viewport with the full strict
  existing tap minimum; exactly one unchanged New game primary; riverside
  strictly smaller in actual font and height; real New game click opens setup.
- Returning title: real riverside entry and Leave preview restore the prior
  complete game/session/storage; saving during preview stays blocked.
- Actual Continue disk restore: save a supported game, reload to clear in-memory
  state, then Continue restores its complete game/session without changing storage.
  Continue remains first and the sole primary action.

Fixtures use supported public setup/entry/storage APIs with one existing Bo
slot, not an earned campaign or a change to production party composition.
Existing title-art/hold hooks stabilize the approved painting. The title has
no map backend. Preview and Continue prove the requested backend; Continue proves
the campaign top-down camera. Riverside retains its existing orthographic camera.
Text clipping gets a fixed one-CSS-pixel rounding
allowance declared before RED; tap minima are strict. Requested feature checks
are soft so the unchanged baseline still completes real controls and evidence.

Fresh unchanged-main build passed in 35.020s, log SHA256
`f3e50d3a7b66c1e9895ad635416a2a363b22f238e1fb7f984756658c8dabeb6a`.
Native baseline: **6 fail / 0 pass**, stable 77.723s, zero skips/retries/flaky or
global errors, log SHA256
`a4e9b7f135a56ca81394bafd5247b8c48feb25c0272241e5c686ce86c2dad381`.
Every case has exactly the same five soft requested-feature failures: no explicit
solo/shared welcome, riverside still large, and its measured 18.4px font / 56px
height equal the primary action. No other assertion fails. All six raw JSON
control attachments complete, including actual preview preservation/save block
and actual Continue restore. Original failures, source, media and producer
manifests are preserved. No harness correction or oracle change was needed.

Before publication, require exact clean final-head `npm run ci:local`, fresh
native checks on its own CI outputs, complete output paths/SHA256/bytes identity,
actual screenshot review and independent final review. The exact commit/tree,
final passed/failed checks and hosted leaf statuses belong in the draft PR and
publication receipt; this source checkpoint does not claim unrun gates passed.
Evidence: `/workspace/avatarrpg-env/title-welcome631/`, outside Git; media not uploaded.

Keep DRAFT. Physical iPad/input, WebKit/Safari/PWA, browser floors, device
performance and owner acceptance remain open. Software Chromium is separate
coding validation. No merge/Ready/deploy/dispatch/formal approval, install,
paid service, art generation/replacement or security/credential/access change.
DeepSeek accounting/executor remains unverified: zero requests. Expensive game
checks run serially; #629 finished its local checks before this baseline began.
