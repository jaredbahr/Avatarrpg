# Local map arrival context (#687)

- **Owner:** root/local-map-context687, 2026-11-12; branch
  `codex/local-map-context-687`, base `0d184e29efff1d4f16a0f4db71e96debdedc5a45`.
- **Outcome:** prevent the Map control from opening an outgoing area while
  normal departure animation finishes. It checks the current logical screen
  and map against this exploration scene at render and activation, then passes
  that current state to LocalMapDialog. Ordinary same-map walks stay available.
- **Scope:** only the Map button closure/options hunk in ExploreScene.renderHud,
  new `e2e/local-map-context.spec.ts`, and this handoff. No movement, lifecycle,
  map dialog, route, objective pointer, camera, renderer, style or asset change.
- **Reproduction:** existing qualified producer `059c1c5a` (old dependency lock),
  one failed regression /one passed same-map walking control, stable 41.102 s;
  log `dc192cdacc06c9056b9908bf220346222af500fbb1235e372c1457e7799387f6`.
  During an actual Map touch with 4,958 ms departure playback left, core map was
  Forest Road, drawn map Ba Dan, and the open dialog was Ba Dan. That old dialog
  and its routes persisted after the drawn map became Forest Road. Complete
  core/session matched the real reducer result. No errors, skips or retries.
- **Fixture limits:** controlled public startGame/enterNode setup, not an earned
  campaign; subsequent movement uses legal reducer-checked public commands,
  normal animation and actual touchscreen Map taps. No fake clock or state edit.
  MapDialog/Dialog and Map activation/App.dispatch source parity with current
  main is recorded externally. This diagnostic is not new-lock qualification.
- **Acceptance:** no outgoing-area dialog during cross-context departure;
  current destination Map re-enables and shows Forest Road after arrival; Map
  remains usable during ordinary same-area walking. Preserve full core/session,
  all original native oracles, 60 s cases and zero retries. No blanket walking
  disable or change to route rules. Candidate native GREEN has NOT been run.
- **Coordination:** [issue 687](https://github.com/jaredbahr/Avatarrpg/issues/687),
  [claim 6836748703](https://github.com/jaredbahr/Avatarrpg/issues/687#issuecomment-6836748703),
  [exact-hunk notice 6836748975](https://github.com/jaredbahr/Avatarrpg/issues/629#issuecomment-6836748975).
  Active #629 pointer/camera scope remains separate; no integration hooks are
  touched. If its unpublished work overlaps this exact Map hunk, stop for handoff.
  PR609 label/style files and LocalMap.ts remain untouched. SOL authored only the
  new frozen native file; its lease is released. Root owns source and integration.
- **Qualification correction (2026-11-13):** the earlier stop before even
  executing CI/native on existing tools was our overly strict interpretation,
  not a failed gate or an extra user/AGENTS requirement. Original local receipts,
  source review, patch and bundle remain historical evidence. Run the unchanged
  full `npm run ci:local` once on this same approved executor, then fresh native
  acceptance against its own output; preserve any actual failure unchanged.
  No install, dependency/lock edit, skipped stage, assertion/budget/deadline/retry
  change, new runner, access change or alternate-executor bypass is authorized.
- **Toolchain limitation:** current main's #686 lock has 20 installed-version
  differences. Existing tools include Node 22.23.4, npm 11.9.0, TypeScript 5.9.3,
  Vite 6.4.3 (lock 6.4.6), Prettier 3.9.6 (lock 3.10.1), tsx 4.23.13 (lock
  4.23.15), and Playwright 1.63.0. Package ranges and the Pixi/Playwright/Zod
  runtime are unchanged. A pass qualifies only the exact source/output on these
  recorded installed tools; reproduction with the updated lock stays OPEN.
  [Existing matching-runner request](https://github.com/jaredbahr/Avatarrpg/pull/686#issuecomment-6836433253)
  remains an additional reproduction request, not permission to install.
- **Preserved native failure / driver repair:** the first candidate run on
  `1118a24e` had one failed exit case and one passed same-map control (33.298 s;
  log `390a1a6179a0322f71efa7aad3daaba66236de8a4d28408b072dce694ccb0480`).
  The exit case failed before the touch: separate visibility and bounding-box
  reads were consistent with HUD button replacement; the retained DOM showed a visible,
  correctly disabled Map. Read one attached element's geometry atomically,
  keeping the real touch, positive dimensions, all state/dialog/window/route
  oracles and existing deadlines/retries. No production change was needed.
  Earlier full CI on that exact head passed 12 stages /354 files /4,794 tests;
  that historical pass does not qualify the amended final source. Re-run full
  exact clean final-head CI and native acceptance before publication.
- **Publication gate:** exact clean final-head unchanged `npm run ci:local`,
  fresh relevant native acceptance and final independent evidence review must
  actually pass before push. Publish only a DRAFT disclosing the toolchain
  limitation and exact results. No unrun check is passed by this handoff.
  Physical input/WebKit/iPadOS/PWA/device performance stay open.
  No Ready, formal approval, merge, deployment, generated assets or new service.
