# Discarded feedback on save replacement (#421)

Owner: Codex root; same branch and draft PR413 as the audio lifecycle repair.
Claim: [6618662312](https://github.com/jaredbahr/Avatarrpg/issues/421#issuecomment-6618662312).
Claude's PR422 landed and handed the audio drafts back; current main `2ba71a01`
was merged before edits. No new PR or takeover of a claimed branch was needed.

Real Wait → Save Dawn on day 2 → Wait Morning → Load Slot 1 restored the entire
saved state correctly, while “Morning arrives.” remained above “Game loaded.”
The original main207 capture and immediate native failure are retained in
`/workspace/avatarrpg-env/discovery-wait/`. This was stale feedback, not save
corruption. The initial exact `Wait` locator failure was a harness mistake;
the actual accessible name is `Wait Mira's table`, and that failure is separate.

`App.adoptSave` now clears the old toast context before state reconciliation and
installation. Dismissal callbacks therefore run against the discarded game,
before new-world presentation or its load confirmation. `Toasts.clear` also
forgets prior dedup timestamps so rapid replacement can show identical fresh
feedback. Ordinary duplicate suppression and its 900 ms window are unchanged.

The App lifecycle regression failed before clear was added; a deterministic
real-Toasts regression separately failed when clear retained dedup memory.
Existing callback/timer/duplicate tests stay intact. Only two existing App test
doubles gained the newly called `clear` method; no expected behavior was relaxed.

`e2e/load-feedback.review.ts` drives real wait/save/load controls. At the actual
load call it records the old Morning node before and after, proving the node is
present, laid out and unfaded before replacement. The immediate result must
contain only “Game loaded.” and the old node must be disconnected. This avoids
a false green from natural expiry. Full saved-state equality, Dawn in the
journal, and fresh Morning feedback are positive controls. The same-task DOM
activation is explicit scheduling evidence, not physical-input acceptance.

Final exact-head checks and evidence identities belong to PR413 and its external
`gate-correction20261104` receipts. No source/generated media or assets were
added, no save schema or game rule changed, and no timeout/assertion/budget was
weakened. Keep the PR a draft under the current user instruction; device,
WebKit/Safari/PWA and physical-input acceptance remain distinct follow-ups.
