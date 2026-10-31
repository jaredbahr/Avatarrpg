# Quarry return campaign budget — #370

The fourth branch dispatch, `41037590127`, on published integration head
`567e6dbd` passed 35 WebKit iPad landscape cases before stopping at the
original escort `quarry-return.spec.ts` campaign test. Both attempts exhausted
its unchanged 600-second whole-case limit during a real Map click near the
final return routes, leaving 93 shard cases unrun. The button had resolved,
but Playwright was still retrying stability or attachment when the case budget
ended. This does not establish a broken Map handler.

This route proof checks actual campaign destinations, dialogue, battle
victories, flags, journals, saves and reloads. It does not assert interior
walking frames or pick combat targets from camera pixels. The test now installs
Playwright clock before boot and uses the existing `completeAuthoredPlayback`
helper after its walk and route commands, which advances to the real animator
finish and still waits for idle. Its state-driven battle driver continues to
use the real party turn and hand-off path, while opting out of the four-frame
camera-settle sample it does not use. Other callers retain the helper's camera
settle default. Product source, all campaign assertions, the 600-second limit
and retries are unchanged.

The earlier walk-only candidate passed the complete escort and trade cases
in production-preview system Chromium at iPad-like 1194×834 DPR 2, in 8.0 and
4.0 minutes respectively, one worker and zero retries; receipts are
`/workspace/avatarrpg-env/370-quarry-clock-{escort,trade}.{log,receipt}`.
The final state-only turn optimization passed pinned TypeScript, scoped ESLint,
Prettier and diff checks. On exact source `5f6f3d5b`, the original full escort
case passed in 6.3 minutes and the full trade case passed in 3.9 minutes in
the same iPad-like Chromium profile. Both used one worker, zero retries and
the unchanged 600-second limit. Exit receipts and logs are
`/workspace/avatarrpg-env/370-quarry-clock-final-5f6-{escort,trade}.{log,receipt}`.
Hosted WebKit and the remaining shard cases are still unverified; this isolated
branch has not been pushed or merged into the integration branch.
