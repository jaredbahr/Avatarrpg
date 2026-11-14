# Available file guidance when browser storage reads fail — #601

Owner: `root/save-guidance601-20261110`.
Branch: `codex/save-guidance-601`.
Claim: <https://github.com/jaredbahr/Avatarrpg/issues/601#issuecomment-6779636825>.
Base: canonical main `95596b54296ba90c799a1794b17a1281140f18c4`.

## Correction

Without a loaded game, title **Load a save** offered Import and Close but warned
players to Export, an unavailable action. The warning now uses the same actual
game-state condition as its existing Export footer: recommend Import without a
game, retain Export guidance when a game exists. The condition also handles a
paused game's Load dialog correctly; dialog mode does not determine whether a
game can be exported.

Only the existing warning text changes. Slot, import/export, parser, save schema,
storage, cancellation and modal/focus behavior remain intact. Previous SaveMenu
PR534 and storage PR550 are merged; no current open/draft scope owns this hunk.
No assets, helper, package, workflow or security change is included.

## Evidence and gates

Retained original discovery shows the title contradiction and a real chooser,
and a real in-game export: two browser cases passed in 8.428s, log SHA256
`152333cfed1e6ca8e55faa7785d380c1e71a3469fae7f9af4d4c74ecf524c6a6`.
Its original manifest identifies the clean runtime-equivalent producer but did
not capture the outside probe/config digests; do not retroactively claim those
sources were frozen. The new regression records its own source/config/build
identities. Its unchanged-runtime counterfactual is **1 FAIL / 2 PASS**, zero
skips/retries/flaky cases, 24.322s: only the title Import-guidance assertion fails;
chooser/cancel/state-null and both Save/Load export controls pass. Log SHA256:
`b94223a2c5476929ffd2ac1871351acf75efac26c73f8cb22d35c9110ef290f5`.
Its checkout-stability flag is false because root added this new handoff document
while that baseline ran. A separate scope-stability receipt enumerates that one
added path and verifies every existing source, new E2E probe/config and all 409
clean producer outputs unchanged. Do not describe the whole baseline checkout as
stable. The clean rendered producer is `62b9ce70ff4d65d1ee677a1e5ef729c42a4848b5`,
tree `29ab2d2d12a696eede8fcbffcbc64767e7974176`; only its three separate new tests/
docs differ from main, and runtime source/assets match this branch's base.

The three native regressions cover title guidance, enabled Import, the actual
single-file chooser and controlled cancellation with no loaded state. Both
in-game Save and Load modes retain Export guidance and complete a real download;
its JSON state/session/RNG exactly match the running game, which remains
unchanged. This uses actual controls, not a substituted serializer. No unit test
mirroring a string conditional is added.

The controlled failure replaces `Storage.prototype.getItem` with a SecurityError:
it establishes read-failure handling, not denied writes or physical privacy-mode
acceptance. Chooser cancellation is dispatched on the actual chooser-created
input; physical OS/browser chooser behavior remains separate. This change does
not claim title import adoption or a new parser roundtrip acceptance.

Freeze reviewed exact clean source before gates. Required `npm run ci:local`
must pass on that exact final head before any push/public branch or draft PR.
Native results obtained before full CI transfer only if all head/tree and every
fresh production output path, byte count and SHA256 match their rendered
producer; otherwise run the native cases on the fresh CI build. Preserve all
original failures, exact receipts, screenshots, downloads and logs at
`/workspace/avatarrpg-env/save-guidance601/`; the PR records actual results and
hosted leaf jobs, including skips. No unrun native or hosted check is implied.

Keep DRAFT. Physical browser-privacy/OS chooser, WebKit/Safari/PWA and device
acceptance remain open. No Ready/formal approval, merge, deployment, dispatch,
install, paid request, generated/replacement art or credential/security change.
