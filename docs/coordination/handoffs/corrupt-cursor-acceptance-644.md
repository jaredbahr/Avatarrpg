# Corrupt combat cursor acceptance (#644, partial)

Owner/session: `root/corrupt-cursor644-20261111`. Branch:
`codex/corrupt-cursor-acceptance-644`.
[Claim](https://github.com/jaredbahr/Avatarrpg/issues/644#issuecomment-6798164866).

## Problem and scope

The existing corrupt-save browser case expected the serializer's technical field
diagnostic in a toast. `SaveMenu` intentionally replaces that diagnostic with
"This save looks damaged. Try another save file." The obsolete assertion stopped
the case before its valid-import and real turn-taking positive controls.

Only that assertion changes: require the warning toast's exact public guidance
and visibility. The parser, runtime and recovery behavior are unchanged. The
fractional-cursor fixture, complete game/session preservation, retained Load
menu, valid-file import and actual trusted two-input End turn controls remain.
Existing serialization tests still reject fractional, negative and out-of-range
cursors and require the diagnostic field path. No timeouts, tolerances, skips,
helpers, configuration, production files or other #644 cases change.

## Reproduction and validation

Baseline is main `31e660cc8f9b8a93536c63d67555482abf0286c7`, tree
`1d4f5db06beb2967767cec4a48e8d8477be8882e`. Its own fresh production build
reproduced the original case on Chromium touch Canvas and forced WebGL: two
failures, each solely the stale line-95 text assertion. The actual warning
contained the intended recovery guidance. The corrected case passed both
renderers, including the previously unreachable valid-import/turn controls,
under the unchanged 60-second case and 10-second assertion budgets.

The existing suite pins this legacy case to oblique until T7. The extra forced
WebGL project changes only renderer selection and the installed executable;
it does not claim a physical Surface, iPad, WebKit or Safari pass.

Before publication, run `npm run ci:local` on the exact clean final head, then
rerun both rendered cases against that head's own CI-produced output. Preserve
original failures and verify source/probe/output identity across each run.
Record exact final results, source identity, actual hosted jobs including skips,
and independent review in the PR and same claim. Do not infer browser coverage
from successful aggregate jobs.

Raw reports, traces, videos, screenshots, before/after manifests and receipts
are retained outside Git at `/workspace/avatarrpg-env/corrupt-cursor644/`.
The remaining #644 cases and existing PR357/443/634 ownership stay open. Keep
this partial repair as a DRAFT; physical-device, WebKit/PWA, performance and
owner acceptance remain separate gates.
