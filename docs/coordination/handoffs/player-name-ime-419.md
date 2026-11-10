# Player-name IME confirmation — #419

Root session `ime419-20261103` owns `codex/player-name-ime-419`, based on main
`207c8eec`. [Claim6618043013](https://github.com/jaredbahr/Avatarrpg/issues/419#issuecomment-6618043013)
was recorded and read back before edits. All 23 open PR file scopes were checked;
none owns PartySetupScene. Claude's integration PR418 and its 18 source branches
remain untouched.

The name field previously treated an IME's composing Enter as submission,
replacing the input with element selection before name editing was finished.
The handler now submits only a non-composing Enter. It leaves browser defaults,
explicit Next, trimming/default names, wizard order and final player setup intact.
No App/session/core, character, content, artwork, shared-helper or config change.

The dedicated unit captures the actual rendered name handler: composition keeps
the step/input/text without rendering or cancelling browser defaults; subsequent
ordinary Enter trims or defaults the name; Next still submits. Unchanged source
fails two cases while the Next control passes; the one-line fix passes all three.

Rendered reproduction uses the frozen main207 production build, Chromium's
`Input.imeSetComposition` and real keyboard Enter. Its captured key event has
`isComposing=true`; original source removes the input and advances. The ordinary
Enter control passes. The complete dedicated review adds desktop mouse and portrait
touch setup controls, composition completion/further editing, ordinary Enter,
explicit Next/default fallback and final session name. The existing setup-polish
case retains its original assertions. No fabricated game state, synthetic key,
accelerated clock, retry, skipped case or raised budget is used.

Exact final-head ci:local must pass before push; source/tree identity, full gate
and rendered before/after results are recorded in the PR and external receipts.
Raw videos, images, reports, original failures and hashes stay outside Git at
`/workspace/avatarrpg-env/discovery-ime/`. Initial missing-browser setup failures
are separate; validation uses the existing approved `/usr/bin/chromium` and
encoder profile, with no install or new access.

Local Chromium input protocol and rendered viewports are not physical OS IME,
WebKit/Safari/PWA or device acceptance. Those remain open. Latest direct user
requires DRAFT-only delivery, no ready/merge/deploy/dispatch. DeepSeek accounting
and executor remain unverified: no calls. No generation, paid service, installation
or credential/security change.
