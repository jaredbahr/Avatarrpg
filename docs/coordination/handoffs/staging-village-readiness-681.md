# Village staging cache readiness (#681)

- **Owner:** root/staging-readiness-681, 2026-11-12; branch
  `codex/staging-village-readiness-681`; base `4fb84e6d0a5a815ba112df60c185b5ee1f8ff18f`.
- **Outcome:** wait for the first village NPC cache before checking the freed
  workers. Logical map readiness alone can leave the previous Forest Road list,
  which already includes the three workers, available to the subset assertion.
- **Scope:** only the freed-worker readiness assertion in
  `e2e/story-staging.spec.ts` and this handoff. Every existing positive, negative,
  welcome-home and resident assertion, fixture, control and timeout is unchanged.
  No production, renderer, content, art, dependency or budget change.
- **Reproduction:** one unchanged current-main native case failed on Hesra's
  presence in the old road list (including duck_nest/runoff_marker/dema and all
  five returnees). Clean/stable main `4fb84e6d`, tree `68a2a4b9`, 12.343 s;
  log SHA256 `2866785ab03c94927cff9b560ad46ed07dffd9ddff1d5ad75f6e8e0dae62eaa9`.
  Original C56 failure and the once-passing C2 comparison remain preserved;
  the current reproduction does not establish a deterministic scheduling race.
- **Readiness oracle:** unconditional Ba Dan-only `riverside_sign`, checked in
  the exact `lastNpcs` cache used by the unchanged subsequent assertions. It
  does not replace worker checks or merely wait on logical map identity.
- **Acceptance:** exact clean final-head `npm run ci:local`, all four native
  story-staging cases, and independent diff/evidence review before draft push.
  Final results, exact head/tree and evidence are recorded in the linked PR and
  `/workspace/avatarrpg-env/staging-readiness681/`; no check is implied by this plan.
- **Coordination:** issue [681](https://github.com/jaredbahr/Avatarrpg/issues/681),
  claim [6832474677](https://github.com/jaredbahr/Avatarrpg/issues/681#issuecomment-6832474677).
  Prior #628/PR668 ownership completed by merge; live PR/file/claim audit found
  no active staging-test hold. This succeeds the failed acceptance observed for
  #664/merged PR669 and relates to #644. Active #629 and #529 scopes are excluded.
- **Transfer:** draft-only delivery after qualification. This goal performs no
  Ready, formal approval, merge, deployment, installation or permission change.
  Physical input, WebKit/iPadOS, PWA and device performance are not validated by
  these software Chromium checks and remain open where required.
