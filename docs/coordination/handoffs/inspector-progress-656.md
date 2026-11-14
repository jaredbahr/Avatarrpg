# Inspector progress before a level threshold (#656)

- **Updated:** 2026-11-12 UTC; owner/session `root/inspector-progress656-20261112`.
- **Outcome:** the party inspector reports 99% while XP is still needed, instead
  of rounding the last half percent to 100%. Ordinary nearest-integer rounding
  and the existing maximum-level message remain intact.
- **Acceptance:** a supported level-3 save at 449 XP shows
  `Level 3 — 99% to level 4 (1 XP to go)`. Preserve the level-9 start and halfway
  labels, maximum-level wording, real roster activation, both dismissal paths,
  focus return, text visibility, and full state/session/camera preservation.
- **Location:** `jaredbahr/Avatarrpg`, branch `codex/inspector-progress-656`,
  `/workspace/avatarrpg-env/inspector-progress656/source`; base
  `4af04601e256ada4f987d038ec96096dc16eafd8`. Exact qualified head/tree and draft
  publication are recorded in the PR and external receipts after final CI.
- **Completed:** only the existing XP-label calculation in
  `src/app/ui/UnitInspector.ts`, an appended near-threshold fixture and accurate
  fixture comment in `e2e/inspector-level-cap.spec.ts`, and this handoff. Core XP,
  progression, content, saves, styles, character identity and assets are unchanged.
- **Decision:** retain `Math.round`; limit its result to 99 only when
  `xpToNextLevel` is positive. This keeps ordinary 49.5% rounding to 50%, and
  permits 100% when no XP remains. The latter preserves the existing display
  contract for a stale level at its completed threshold, not an earned save.
- **Verification:** unchanged-main production with the new frozen fixture fails
  all four phone/iPad Normal/Large cases solely on the new label: actual 100%
  with 1 XP remaining. The original three fixtures complete their 24 real
  open/close cycles before those failures. Candidate build and all four rendered
  cases pass after the display correction, with no skipped or retried cases.
  Fixtures use normal serializer/deserializer validation and public `adoptSave`,
  followed by actual roster controls; they are not earned campaign progression.
- **Evidence:** external immutable baseline/candidate logs, reports, source and
  output manifests, PNGs and videos live in
  `/workspace/avatarrpg-env/inspector-progress656/`. Baseline native log SHA256
  `583dc9e15d1154b876905890dde58986a8a127c62d0aa7c5bc9404c42365efb5`;
  candidate native log SHA256
  `c943b8d8b8a5d251a6e6f26739fa8a94095486bfe4be71449f750e8da31a54fd`.
- **Coordination:** issue claim
  [6815864015](https://github.com/jaredbahr/Avatarrpg/issues/656#issuecomment-6815864015).
  Prior #543/PR544 is finished and merged; this is a separate below-cap display
  defect. Other open PR scopes do not own these two source/test files. Root owns
  integration and serialized validation; SOL High reviews source and evidence.
- **Worktree/next actions:** freeze these three paths, qualify the exact clean
  final head with `npm run ci:local`, then run fresh rendered checks on its own
  CI output. Publish only a reviewed draft with actual hosted job results and
  skips. Candidate results alone do not qualify a later commit or output.
- **Completion/transfer:** pending final qualification and draft publication;
  consult the live PR/claim before editing. No merge, deployment or formal
  approval. Physical iPad/input, WebKit/Safari, browser floors, PWA, device
  performance and owner acceptance remain open; local software Chromium does
  not replace those gates.
