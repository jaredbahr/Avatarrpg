# Settings radio arrow keys — #604

Owner/session: `root/settings-radio604-20261110`.
Branch: `codex/settings-radio-keyboard-604`.
Base: canonical main `bb3522df25e42fb8e4b41cb7bf09b88c181e5227`,
tree `63059524b1b9dd06a243a94872a3d074a5b8fdfc`.
Claim: https://github.com/jaredbahr/Avatarrpg/issues/604#issuecomment-6781327043.

## Reproduction and scope

Text size and Sound declare radio groups, but ArrowRight on the selected Normal
button changes neither selection nor focus. The actual browser discovery was
2 fail / 1 pass: both arrow cases fail while mouse activation changes text size
and returns focus to the Settings heading. Discovery log SHA256:
`6981b56979f602d5acd553222752b34839cbbb16dd71c96367ba6158c4792af1`.
The clean producer was `1a264b6`; SettingsPanel is identical on the current base.
The initial missing-recorder setup failure is preserved separately. No software
was installed to repair it.

Only SettingsPanel choice-row arrow handling/private focus restoration and this
new browser regression/handoff belong here. Right/Down advance and Left/Up go
back, wrapping within the focused group. Use the existing button activation to
preserve settings updates, UI sound and the established heading-focus guard;
after an arrow, find the rebuilt selected radio inside this Settings overlay.
Consume those arrow events so they cannot reach the scene underneath.

Keep every existing radio Tab stop and click/Enter/Space heading-focus behavior
(#390). No roving tabindex, Home/End extension, global handler or changes in App,
Dialog, TitleScene, ExploreScene, conversation, shared helpers/tests, CSS, core,
content, assets, schema, packages or workflows. Historical Settings owners have
merged; current open PR file scopes and duplicates were checked before claiming.

## Acceptance

Write new probes before production edits. Drive both groups from the title,
paused Mira dialogue and a paused conversation choice. Verify every arrow,
wrapping, one selected radio, live visible keyboard focus, unchanged full game/
session/RNG after every step, saved preferences after reload, all existing Tab
stops, mouse/Enter/Space heading guards and Escape closing one layer. Conversation
positive controls must still advance after closing Settings and Pause.

Native results bind to the exact producer's source/build/probe/config digests;
baseline probe checkout and clean rendered producer are recorded separately.
Preserve every failure. No assertion, threshold or required gate is weakened.
Freeze the reviewed clean final source before `npm run ci:local`; all repository
steps must pass before public branch creation/push and a DRAFT PR. Check actual
hosted leaf jobs and skips. Local browser input is not a physical-keyboard,
WebKit/Safari/PWA or device-performance acceptance claim.

The first full checkout ran out of workspace space. Git removed that failed
worktree. The verified disposable source archive was deleted after reconstructing
the exact server Git tree/signed commit. The replacement complete worktree uses
unique editable text files and read-only hardlinks for identical binary inputs,
verified against exact blob SHAs. No editable source is shared. No asset may be
written by this task. The frozen material candidate remains unchanged.

Evidence: `/workspace/avatarrpg-env/settings-radio-next/` and the original discovery
at `/workspace/avatarrpg-env/discovery-20261110-r2/`. No Ready/formal approval,
merge, deployment, dispatch, software install, art generation/replacement, paid
service or security/access change is authorized. DeepSeek was not used because
the approved executor/shared accounting remain unverified.

## Preserved baseline and corrected candidate

The original nine-case native probe was 6 fail / 3 pass, zero skips/retries/flaky
cases, stable 174.400s. Every arrow case failed the first actual ArrowRight
selection; all three Tab/mouse/Enter/Space heading guards and conversation
positive controls passed. Log:
`408483d6d3504d6272b5b057dc70873a69af2c507f18c724c8892ddcc8cf005b`.
The original probe is retained separately. Independent review strengthened each
intermediate Tab containment check and added unchecked focused-radio transitions.
The strengthened pre-boundary probe's separate four-case unchecked baseline failed all four at
1194×834 and 390×844, stable 66.741s, log:
`ddb181309bffc52ff82d98a90adbc9396823d187fb83db25b66cea920c77407e`.
Those are two recorded probe versions, not a claim of identical source.

Both baselines use a dirty probe checkout on mainbb and the clean CI production
build of `95f06a4` (tree8320). That producer contains the unrelated oil/char fix
and omits newly merged Tenzo/Nilak art. Captured baseline hashes, canonical base
blobs and rendered source match for SettingsPanel, Dialog, DOM helpers, App,
storage, title/exploration/conversation and CSS; this fixture uses Kaya/Mira.
Full manifests remain authoritative; no whole-tree equality is claimed. An
administrative check correctly rejected the already corrected working file;
source identity is established from captured baseline hashes and base blobs.

The minimal +26/-1-line production correction then passed typecheck and its own
production build. All 13 strengthened native cases passed, zero skips/retries/
flaky/errors, stable 124.365s, on the corrected working build. Log:
`65cb31435a31401eb563ff058e7e34f92f856e1f08a0a279ba271e56b92020f6`.
Every arrow preserves full game/session/RNG, wraps correctly and retains visible
focus. The final selected preference differs from its initial value before
reload. Normal and compact unchecked-radio controls prove the step derives from
actual keyboard focus. Existing Tab and click/Enter/Space heading behavior and
Mira/choice positive controls remain. Source and probe hashes are frozen in
receipts; this preliminary dirty-tree result does not substitute for final-head
CI or fresh-CI native acceptance.

Run final native on the exact clean final CI output, including the four unchanged
Canvas/WebGL Settings modal-focus cases. Check all output paths/SHA256/byte counts
against that producer, preserve every failure and keep physical/WebKit/PWA/device
gates open. No public ref exists before exact clean full CI passes.

Review then added explicit Tab boundaries: Done→Tab must focus the first Text size
radio; Shift+Tab must return to Done, while full game/session/RNG stays unchanged.
All three title/Mira/choice control cases passed, stable 55.406s, zero skips/
retries/flaky/errors, log:
`dd5f8bd77c73687878d1bdd5c19b7b3579ec8e7f8f50480a1a53fabd2b0d45d1`.
This final probe version is recorded separately from the earlier nine-case,
four-case and thirteen-case results. The production source did not change.
Root inspected the compact Largest and Sound focus screenshots: the selected
controls are visible, unobscured and have a keyboard-focus outline. Independent
SOL High review found no remaining source/harness blocker before freeze.
