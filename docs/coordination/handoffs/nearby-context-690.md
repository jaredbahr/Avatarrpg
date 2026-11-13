# Look around during area replacement (#690)

- **Owner:** root/nearby-context690/2026-11-13; branch
  `codex/nearby-context-690`, base `0d184e29efff1d4f16a0f4db71e96debdedc5a45`.
- **Outcome:** Look around is disabled while the logical exploration screen/map
  differs from the drawn scene. Activation checks the current context again.
  Once the destination arrives, the existing NearbyPlaces/Visit path works;
  ordinary same-area walking keeps Look around available.
- **Scope:** only a local context resolver beside the existing Look conditional
  and that button's callback/options in ExploreScene.buildHud; new
  `e2e/nearby-area-context.spec.ts`; this handoff. No Wait/Practice, Map,
  NearbyPlaces/Dialog/requestWalk, lifecycle, camera, pointer, NPC, movement,
  queue, route, collision, core, style, art, budget or dependency change.
- **Before-edit reproduction:** existing qualified own producer `9632152b`
  (not a new main/lock baseline), one intended failure and two positive passes,
  70.362 s; log `a874b2d6529b1a6624d1d31561322ea3c7e43253c9ec4462c6d859c399fc6027`.
  Actual trusted Look and enabled Visit clicks landed with 5,021/4,813 ms of
  departure left: logical Forest Road, drawn Ba Dan. Visit closed the dialog
  but left complete state/session unchanged, and no conversation arrived.
  Independent arrival Visit reached forest_dema with exact reducer state;
  same-area walking Look/Back stayed usable. No errors, skips or retries.
- **Evidence:** `/workspace/avatarrpg-env/nearby-exit-discovery-20261113/`
  preserves original probe, raw reports/state/trusted-click captures, screenshots
  and videos. Whole NearbyPlaces/Dialog/walking and Look/requestWalk sections
  match current main. Independent discovery review SHA256
  `d7b1fed6c947449307f4a7a232f4eb39f42af1bd027b8f8cb93cefeffb4b429d`.
- **Acceptance:** do not advertise an unusable enabled Visit during replacement;
  an early disabled/refused Look is valid, with no new queue policy. Keep actual
  trusted input, full unnormalized reducer/session comparisons, normal motion,
  the 1,500 ms window, 60 s cases, 10 s expectations and zero retries. Destination
  Look/Visit must recover; ordinary busy same-area Look/Back must stay available.
  Controlled public startGame/enterNode setup is not an earned campaign.
- **Ownership:** [issue 690](https://github.com/jaredbahr/Avatarrpg/issues/690),
  [before-edit claim 6841040943](https://github.com/jaredbahr/Avatarrpg/issues/690#issuecomment-6841040943).
  Independent current-main branch, without copying #687/PR689's Map fix. The
  active #629 pointer/Map-objective integration and #278 marker work remain
  owned separately. This claim transfers no shared contract or source hunk.
- **Preserved gate history:** initial dirty typecheck caught an optional authored
  NPC position in the new test; an explicit missing-position guard fixed it
  without changing the actual valid Dema/reducer control. Original error,
  pre-fix test and corrected stable typecheck pass are retained. Exact clean
  `318bd1ec` full CI passed all 12 stages /354 files /4,794 tests; its first
  native run had one failure before the Visit oracle and two positive passes
  (58.232 s; log `3b79c7a157444448abe16bc5262c6d858eb8a34e373ec40719569322dc54e0b9`).
  The driver read pre-paint enabled geometry; the next normal HUD frame made
  Look disabled before input, so no click was delivered. No unusable Visit was
  offered and full state/session stayed unchanged. All original source, raw
  reports/media and all 447 original production outputs remain preserved.
- **Driver readiness correction:** wait one real requestAnimationFrame after
  public walk dispatch, before its after-snapshot/target read. The existing
  scene loop publishes the busy HUD on that frame. Every assertion, branch,
  trusted-click requirement, state/session comparison, 1,500 ms window, 60 s
  case, 10 s expectation and zero-retry setting stays unchanged. No fake clock,
  action handler or new queue policy. Independent source-order review SHA256
  `78976fca6de495ff983c14ac6286a6a93ffa9f2a7e323d4d4ea635a2d1103ee0`.
- **Paired driver diagnostics:** the same adjusted driver on the preserved
  unfixed 9632 producer still had one original Visit failure /two passes
  (69.626 s; log `aedc366426c5da866ee3dcefe5c5ea8dcee19c71a5551bc33dd7b3b6cfafdb35`).
  Candidate 318b's unchanged own output with the updated dirty driver passed
  all three (57.973 s; log `79aee3ac4ac51da3900c0b5d01e6cad380e448de3cd31842c248cee96351fdd9`).
  These diagnose the corrected driver; they do not qualify the amended final
  source. Final exact clean CI and fresh native GREEN remain unrun at freeze.
  Require unchanged `npm run ci:local`, fresh own-output regressions/retained
  Wait controls and independent source/state/media/output review before DRAFT.
- **Toolchain:** same approved existing tools; 20 installed dev-tool/transitive
  patch versions differ from the updated lock (including Vite 6.4.3/6.4.6 and
  Prettier 3.9.6/3.10.1). No installation, package/lock edit, new runner or access
  change. Actual passes qualify only their exact recorded source/environment;
  fresh locked verification/native and physical-input/WebKit/PWA/device gates
  stay separately open until demonstrated. No prior PR's gate is transferred.
- **Delivery:** DRAFT only, no Ready/formal approval/merge/deploy/dispatch, assets,
  paid service or security change. Corrections stay on the eventual same PR.
