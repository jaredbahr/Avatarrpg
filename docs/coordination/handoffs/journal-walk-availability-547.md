# Journal feedback during playback — #547

Session `root/journal-walk547-20261111`; branch `codex/journal-walk-availability-547`.
[Claim](https://github.com/jaredbahr/Avatarrpg/issues/547#issuecomment-6791700829).
Base main `d634c5490750a94d4eb6fd36510d3ccbbba2918f`, complete tree
`fd1c4f37b4443ff4053b955a446dc8c3cb37b7e8`.

Travel journal looks enabled during party playback, but its existing busy guard
silently drops activation. The callback now uses the existing polite, nonmodal
info-toast channel: “Let the party finish, then open the journal.” The wording
covers other playback, including practice, without asserting every busy frame
is walking. The original guard and ordinary idle opening remain unchanged.

Only that callback changes in production. No disabled-state tracking, frame or
lifecycle field, focus/menu/movement policy, camera, party, route, clock, core,
App, TravelJournal, Toasts, content, style, token, art or default-style change.
There is no new dialog or permission to open the journal during playback.

This resumes root's existing owned finding, not a duplicate discovery. Its
original blocker was PR #450's ExploreScene ownership. PR #450 merged on
2026-11-10T14:13:18Z, after handoff request `6738959725`. Live issue/PR claim
checks found no retained ExploreScene write claim and none of twenty open PRs
changed that file. #547 had no production claim, branch, candidate or PR;
only its own preserved diagnostic. This is a completed ownership scope, not
permission inferred from silence. A new claim and clean isolated checkout were
verified before edits. #627 camera work remains separate and later.

Original own evidence remains under
`/workspace/avatarrpg-env/journal-busy-discovery/`: probe SHA256
`5048de8ca2b8f39eb553c945fae0db768cd9c56538f2de6450a4e98109b40f05`,
observations, media, report and producer receipt. Original log SHA256
`6feac192bf33488431915717b2ed6cabaf031d89380b2377c382fd62ec506536`.
Those results qualify old `087b35db` only; they are not transferred to this base.

An independent SOL High Standard author froze the new
`e2e/journal-walk-availability.spec.ts` before production, SHA256
`0c5fecd577486520ebc9ba89821ee3d473493240ac64d799d2d294cc5b31fe68`.
Four fresh fixtures exercise real pointer or Tab/Enter activation on Canvas and
WebGL at 1180x820 with normal application motion. Supported public setup/entry
and a legal four-tile walk establish the fixture; this is not an earned campaign
or physical movement-input acceptance. Each case has its own activation, so the
existing 900ms toast dedup cannot mask a broken input path.

The new feature oracle requires NEW semantic journal/wait feedback in the actual
`.toasts[aria-live=polite]` region; the existing walking status alone cannot pass.
It does not freeze a full sentence. Hard checks preserve enabled/focus behavior,
no dialog while busy, complete GameState/session/RNG/camera/backend, application
time and the animation deadline across each frozen request. The same walk then
finishes normally, using the unchanged existing 20s idle helper, and the same
real input opens and closes the journal. No synthetic completion command.

Finite CSS entry animation is finished for stable screenshots only; the
application's normal-motion setting and frozen request clock remain unchanged.
Feedback must be visible, fully opaque, polite and noninteractive, with every
real glyph inside its viewport/clipping ancestors (fixed pre-RED 1 CSS-pixel
rounding allowance). The button's existing tap minimum is strict. Noninteractive
toast text has no invented centre-hit requirement. No style override or mock.

Fresh unchanged-current-main build passed in 33.253s, log SHA256
`8facf18f33a71ca231e4d40ac23110cfb93b45465b238b9ea419aeba6fb97823`.
Native baseline: **4 fail / 0 pass**, stable 115.106s, log SHA256
`8cff8568844ab58cb5ab0bbe0d4a2d6397a07292ee8fcfd88351fa8f9868c16a`.
Every case fails only the single soft missing-feedback assertion at frozen line 264. All four raw payloads and busy/idle control checks complete, with no other
errors, skips, retries, flaky or global errors. No harness/oracle correction was
needed. Original failures, media, source and complete producer manifests remain.

Before publication, require exact clean final-head `npm run ci:local`, fresh
native checks on its own CI outputs, full source/output identity, actual visual
review and independent final review. The final commit/tree, passed/failed tests
and actual hosted leaf statuses belong in the draft PR and publication receipt;
this source checkpoint does not claim unrun gates passed. Evidence/media:
`/workspace/avatarrpg-env/journal-walk547/`, outside Git; media not uploaded.

Keep DRAFT. Physical iPad/input, WebKit/Safari/PWA, browser floors, device
performance and owner acceptance remain open. No merge/Ready/deploy/dispatch,
formal approval, install/purchase, art generation/replacement or
security/credential/access change. Expensive game checks run serially. DeepSeek
executor/shared ledger remains unverified: zero requests, uncertain reservation
retained.
