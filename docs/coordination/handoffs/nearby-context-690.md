# Look around during area replacement (#690)

Owner: root/nearby-context690/2026-11-13. Same claim
[6841040943](https://github.com/jaredbahr/Avatarrpg/issues/690#issuecomment-6841040943),
branch `codex/nearby-context-690`, draft [692](https://github.com/jaredbahr/Avatarrpg/pull/692).

When the logical party has reached Forest Road but departure playback still draws
Ba Dan, Look around previously offered Visit even though the departing scene
refused the walk. Visit closed the dialog without going anywhere. The Look
button now checks the drawn scene against the current exploration context at
creation and activation. Same-area walking retains Look/Back; arrival restores
Look/Visit and Dema dialogue. Wait, Practice and Map behavior are unchanged.

The correction integrates merged main `135ef073420f88eac7ab233cf478bad5202400e2`
(tree `b99ee0a5ba7043b1e1b5991ed4dfdd7bf8da0b5f`). All eight incoming paths,
including the owner's framing, actor readiness, names and packed sheet inputs,
are inherited byte-exact except the independently owned Look callback/options.
The inline callback keeps the fresh state guard; synchronous creation uses the
already captured nonnull buildHud state. No helper closure or new queue policy.
No Map fix from #687/689, core, camera, movement, pointer, style, art generation,
dependency, workflow, assertion or budget change. Rejected #693 marks edits are
dropped; marks.ts is byte-identical to main. Only ExploreScene's Look hunk, the
new regression file and this handoff are authored relative to current main.

Acceptance keeps the original three native cases and all assertions, actual
trusted input, full unnormalized reducer/session comparisons, one real RAF,
1,500 ms departure window, 60 s cases, 10 s expectations and zero retries.
The native file remains SHA256
`54d30fb25e3e621c121b7c99be8f4de0625e8e1e5600b3aea07d58906167bdea`.
Controlled public startGame/enterNode fixtures are not an earned campaign or
physical-device acceptance. Retained Wait controls and the owner's original
pointer/objective/dialogue cases must run against fresh own CI output.

Prior exact published head `ce68b0a39ea9bce3fce7dccfbfb8ef1f2065ebae`
(tree `448df9f59653155b9a82a6dd641c33cf70356d60`) passed unchanged CI
12/12 stages, 354 files/4,794 tests, plus native 3/3 and retained Wait 2/2.
Its hosted integration actually checked out `f2e40ea0`, tree `5fe23aac`, and
FAILED the unchanged 419,840 B bundle limit after fresh-lock unit/build passes.
Actual E2E/gallery leaves were skipped. Raw hosted log SHA256
`6ebbb96d24bfe6b67f9d44d640a76aa3318c300d3b317234e5448411acf5b3fb`.
Those old passes do not qualify the new combined source.

Preserved failures include the original unfixed one Visit failure/two positive
passes; an optional NPC-position test type error; the first candidate's
pre-paint driver-readiness failure/two passes; and paired corrected-driver
before/after diagnostics. The driver correction waits one real animation frame
without changing any assertion, time budget or original Visit oracle.
F7 baseline measured 419,819 B; both bounded Look forms measured 419,860 B
(20 B over). E4 baseline measured 419,837 B; inline Look and the independent
#693 experiment both measured 419,878 B (38 B over). #693 gave zero gzip gain,
was independently rejected and closed without publication. All source patches,
Git bundles, complete compiled outputs, raw logs, reports and media remain
preserved. No full CI/native was wasted on those known-red budget candidates.
Merged #694 has now changed the budget inputs, enabling one fresh bounded check.

Evidence root: `/workspace/avatarrpg-env/nearby-context690/`; new correction
under `integrate-f7/`; original RED under `nearby-exit-discovery-20261113/`.
The canonical main object and all eight blob identities were verified locally;
the isolated checkout uses a shallow boundary at main135 because the unrelated
owner parent history is absent. No commit metadata or public ref is rewritten.
Final canonical history must retain published ce68 as first parent and main135
as its additional parent. Before any ref update, exact clean final-head
`npm run ci:local`, fresh native checks and independent source/state/media/output
review are required. At this authored freeze these new gates are UNRUN; their
results belong to immutable receipts and the draft description, not a claim of
transferred prior acceptance.

Existing approved tools have 20 disclosed dev/transitive patch differences
from the updated lock, including Vite 6.4.3/6.4.6 and Prettier 3.9.6/3.10.1.
No installation or package/lock change. Fresh locked native reproduction,
WebKit/Safari, physical input, PWA/device performance and owner acceptance stay
open unless demonstrated. Original WebKit/pointer handoff remains outstanding;
Chromium source/rendered checks do not stand in for it.

Delivery stays DRAFT on the same branch with expected remote ce68. No Ready,
formal approval, merge, deployment, dispatch, new art, paid service, credential,
permission or security change. Preserve all original gates and failed evidence.
