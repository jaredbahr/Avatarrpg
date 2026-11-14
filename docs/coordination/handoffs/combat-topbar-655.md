# Keep the Largest combat header on screen — #655

Updated 2026-11-12 UTC. Session `root/combat-topbar655-20261112`;
branch `codex/combat-topbar-655`.
[Claim](https://github.com/jaredbahr/Avatarrpg/issues/655#issuecomment-6814983667).
Worktree: `/workspace/avatarrpg-env/combat-topbar655/source`.
Base main `f9185ea5e8e125e2c514ff4708eb17d1d1a6adcd`, tree
`1ba4915afac9fac8d8328c34430ef06190e2c65c`.

At Largest text on 1180×820 landscape, the unbroken header row reduced the
encounter title to zero width and placed Pause 40.90625 CSS pixels beyond the
screen. A Huge-only landscape rule lets the header wrap, reserves space for the
title and Pause on its first row, and keeps every view control at its existing
full tap size. The existing inline tablet controls and phone More menu remain.
The rule excludes short phones, including wide phones, using the existing
34rem height boundary. Normal and Large layouts keep their existing rules.

Scope is exactly three paths: 23 appended lines in `src/styles/hud.css`, new
`e2e/combat-topbar-largest.spec.ts`, and this handoff. The complete original CSS
prefix and all existing tests/helpers are byte-identical. No scene, dock,
camera, renderer, gameplay, asset, character identity, token or budget change.
The title and Pause have earlier visual order at Largest; keyboard Tab retains
the existing DOM sequence through view controls and then Pause.

The independent SOL High Standard test author had an exclusive new-file lease,
now released. The six cases use explicit top-down Canvas/WebGL at 1180×820/DPR2
and 390×844 or 844×390/DPR3. They audit Normal, Large and Largest; all visible
header buttons must fit the viewport and meet the strict computed `--tap` in
both dimensions. The four-character encounter prefix must have visible ink.
Layout/scroll rounding gets 0.5 CSS pixels; tap sizes and the existing tablet
40dvh board floor have no deduction. Real Pause/Resume, phone rotation,
More pointer/keyboard/Escape and complete game/session/RNG preservation are
checked. Supported public setup/encounter APIs and reduced motion are disclosed
fixtures, not an earned play-through or animation/device-performance acceptance.

Evidence before publication, kept outside Git in the worktree's parent:

- Original test SHA `8c5314658b668559218eb849ba87a609d891d74c9f41c7230bcbabdd4ae459bd`:
  initial native 2 fail / 4 pass, log `7a4a9a679708e7e8575d431f6004e29d9435809770397b2fbc274a0e07767a07`.
  Both tablet backends reproduce the title/Pause defect; actual controls and
  state preservation complete. Its additional Normal/Large vertical glyph
  failures were a new test measurement error: Range includes font em extents.
- A separate exact-main font diagnostic proves Range height equals font ascent
  plus descent. The corrected oracle maps the alphabetic baseline to actual
  ink ascent/descent, retains raw metrics, and hard-checks finite metrics and
  height agreement. No clipping allowance or tap/board threshold changed.
  Frozen test SHA `fd9ce37837ec2ca6dbcb837d8b414e23f48c9db210bb7dcd69d48824c65b9c23`.
- Corrected unchanged-main tablet baseline: 2 fail / 0 pass, stable 42.741s,
  log `a7db35632a084c37e0e8b08fabd7ae14bab12be4a5e01875bfba38838aa875ad`.
  Only Largest title/Pause/overflow assertions fail. Normal/Large and real
  controls pass. Original failing source, logs, reports, traces and media remain.
- Candidate build passed; corrected native 6/6 passed, stable 105.264s,
  log `a0343ff5fcec058d871f4be527d2c060abee6450c0ac6a48328d7f1a0e4605f3`.
  Both tablet backends give the title 949.75 CSS pixels, Pause ends at 1162,
  tap minimum is 72, and the board is 329px high. State/session and runtime-error
  guards pass. Root inspected the actual tablet capture.
- Five unchanged existing header/inline-control regressions passed, stable
  40.945s, log `55cf6e4c9dabb812f5c96e95b8ce93dc62a7a9ff5ce7ddd1fb4de64e03a87f13`.
  This includes the existing oblique header/initiative/board-floor guard and
  tablet/Surface normal/Huge inline-controls cases. No old assertion changed.

- Two external gameplay cases passed on both backends with normal motion,
  stable 42.442s, log `5d90b33fd80333e084f405aa770604d2b7ba4308897fa20a0a5875bb46dce009`.
  Real Log→Tab→Pause Enter/Escape preserves full state/session/camera and visible
  focus. Trusted Move, an unobscured legal tile and Confirm emit exactly one
  observed move; its full state/events equal the pure reducer result. Playback
  is busy after dispatch, then a newer actual drawn view has the actor at the
  destination. End turn scrolls into its full tap/clip/hit target without being
  activated. External probe SHA `0aacfb21dbd0a34572ff97fd7c6fff5022efe0cf31616fdd78f1a4c74a41011b`;
  it is acceptance evidence outside Git, not a replacement for shipped tests.

Before any public branch update, require exact clean final-head
`npm run ci:local`, fresh native checks on its own CI output, full output
paths/SHA256/bytes identity and independent source/rendered-evidence review.
The final commit/tree, exact checks, extra gameplay controls and actual hosted
leaf statuses are recorded in the claim, draft PR and external publication
receipt; this source checkpoint does not claim unrun checks passed.

Keep DRAFT. Physical iPad/input, WebKit/Safari, PWA, browser floors, device FPS
and owner acceptance remain open. Software Chromium is coding validation.
No merge, Ready, deploy, dispatch, formal approval, install, paid request,
art generation/replacement or security/access change. DeepSeek accounting and
executor remain unverified: zero requests; uncertain prior reservation retained.
