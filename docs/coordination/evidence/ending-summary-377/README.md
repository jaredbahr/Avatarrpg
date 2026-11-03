# Ending summary page scrolling — #377 / PR #358

The existing widened summary still inherited the dialogue panel's height cap.
At Huge text, scrolling a button into view scrolled that inner panel instead of
the ending page. The correction lets the panel grow naturally and makes the
ending stage own vertical scrolling. Other dialogue stages retain their layout.

These captures show Huge text after revealing the actions. They are native
Chromium captures converted to WebP at quality 90 for review storage, with no
cropping, resizing, compositing or retouching. Original PNGs, measurements and
failed-run diagnostics remain in the external evidence directories below.

| Viewport            | Before                         | After                        |
| ------------------- | ------------------------------ | ---------------------------- |
| Desktop 1280 × 800  | [Before](desktop-before.webp)  | [After](desktop-after.webp)  |
| Portrait 834 × 1194 | [Before](portrait-before.webp) | [After](portrait-after.webp) |

Before: exact source `e93f8dd918817b0fb1f0abc97fabbdf144bcb66c`, native visible
build `v0.2.11 · build e93f8dd`. The retained independent review passed three
Normal profiles and failed all three Huge profiles on scroll ownership; text,
controls and the Continue exploring transition remained functional. After
revealing actions, desktop panel scrollTop was 260 and portrait was 231; the
ending page stayed at zero.

After: merge producer `40d4da123bfe3c6ebb22d0036cf6bf9fe03a7d9e` plus the
reviewed CSS/test patch, visible build `v0.2.11 · build 40d4da1-modified`.
The CSS blob is `c4bcddc7f97ba136dcacc19d23be386127a34df9`; the tracked
regression test blob is `0a0cadd7483b3f9a9789bf1a8c4e450b7b401df4`. Native
evidence therefore identifies the modified producer explicitly; final-head
verification is recorded in the PR.

| Huge text viewport   | Panel client / scroll height | Stage client / scroll height | Panel / stage scrollTop after actions |
| -------------------- | ---------------------------- | ---------------------------- | ------------------------------------- |
| Desktop 1280 × 800   | 786 / 786                    | 703 / 812                    | 0 / 109                               |
| Landscape 1194 × 834 | 911 / 911                    | 737 / 937                    | 0 / 200                               |
| Portrait 834 × 1194  | 922 / 922                    | 1097 / 1097                  | 0 / 0                                 |

All three Normal profiles also have no inner scrolling. The tracked focused
suite passed all eight profiles in 19.2 seconds, including the existing 820 ×
1180 Normal and 390 × 844 Huge cases. An independent capture/geometry fixture
passed all eight in 19.9 seconds. Both use one worker, zero retries and the
repository's unchanged 60-second case / 10-second expectation budgets.
Assertions cover centered full-width layout, text containment, scroll ownership,
fully reachable controls at least 48 CSS pixels high, no page errors and the
real Continue exploring transition to `quarry_after_explore`.

The first external capture attempt stopped before gameplay: its build identity
expectation omitted the truthful `-modified` suffix. That failed fixture, raw
log and eight diagnostics were retained separately. Only the external identity
expectation was corrected; no product assertion or budget changed.

External retention locations (local paths, not public artifact links):

- Before: `/workspace/avatarrpg-env/review-377/results/`.
- After: `/workspace/avatarrpg-env/throughput-358/acceptance-results/`.
- Source identities, measurements and logs:
  `/workspace/avatarrpg-env/throughput-358/evidence-provenance.txt`.
- Initial fixture failure: `/workspace/avatarrpg-env/throughput-358/acceptance-identity-failure-results/`
  and `acceptance-identity-failure.log`.

This directly enters the real ending node to check layout; it is not a campaign
playthrough, WebKit, Safari/PWA or physical-device result.
