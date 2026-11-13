# Staged dialogue backdrop header (#698)

- Owner: root/staged-header698/2026-11-13, branch
  `codex/staged-header-backdrop-698`,
  [claim 6846131429](https://github.com/jaredbahr/Avatarrpg/issues/698#issuecomment-6846131429).
  Base frozen merged main `e668b68927273869481b27032960bb80ce0abe5f`;
  tree `5da87736073898968b89100258fb585979facd81`.
- Scope: append one backdrop-scoped visibility rule to `src/styles/hud.css`,
  new `e2e/staged-header-backdrop.spec.ts`, and this handoff. The entire existing
  stylesheet prefix stays byte-identical. App already controls the backdrop
  class and input/accessibility lifecycle. No App, scene, core, story, camera,
  portrait, art, dependency, workflow, budget or existing-test changes.
- Behavior: while staged dialogue retains exploration behind it, its old header
  and objective no longer paint through the speaker header. `visibility: hidden`
  preserves the header allocation and the exploration canvas geometry. The map,
  staged controls and ordinary compact world Talk keep their existing behavior;
  the exploration header becomes visible again when staged dialogue ends.
- Regression: six Canvas/touch cases cover Ruon and Mira staged transitions plus
  ordinary Mira Talk at Normal/Largest, 1180x820 DPR1, normal motion. They check
  actual text paint independently of inert/ARIA, original canvas/background
  identity and geometry, trusted controls, and complete unnormalized core/session
  state against the reducer. Public startGame/enterNode fixtures skip campaign
  entry and fights; this is not an earned playthrough or physical-input proof.
- Preserved BEFORE: the first driver had a nullable node-ID type error, corrected
  without a cast. Initial native 4 fail/2 pass reproduced header/objective paint,
  but Largest Mira also stopped at an intentionally scrollable ending. Existing
  ending CSS and `ending-summary-layout.spec.ts` explicitly require stage
  scrolling. The corrected driver sends one real trusted wheel only when needed,
  verifies scroll progress and unchanged full state, then uses the same strict
  clipped/viewport/hit checks and trusted touch. No automatic DOM/locator scroll,
  force, timeout, assertion, font or tap-target relaxation. Corrected BEFORE:
  4 fail/2 pass, only the intended paint failures, log SHA256
  `6550b8c975029b5a0c7f1e880e1f9191ea20c1af9f4e13d8d5d3bfb675a54dac`.
- Preliminary own-output six-case native: 6/6 passed, no skips/retries; log
  `1106e5bce32975ff56c5103446e774c5dac0fe2f565a2a499320a46eee787f96`.
  Build passed; an incorrectly named budget wrapper failed after the build and
  remains recorded. The authoritative unchanged bundle check separately passed.
  These dirty diagnostic results do not qualify the final commit.
- Final acceptance at this authoring freeze: exact clean canonical final-head
  unchanged `npm run ci:local` and fresh own-CI-output native are UNRUN. Require
  the same six frozen new cases, retained dialogue 6, world-speaker 3,
  ending-summary 8 and map-curtain 1 (24 total), with original assertions,
  deadlines and zero retries. Bind source/probes and all outputs/raw state/media
  to the actual producer; independent review precedes DRAFT publication.
- Limits: existing installed tools differ from the lock at 20 disclosed patch
  versions; fresh locked native reproduction stays open. Chromium touch/software
  rendering does not qualify physical input, Safari/WebKit/iPadOS, PWA or device
  performance. Preserve those gates and actual hosted job/skipped-leaf results.
  No Ready, formal approval, merge, deployment, dispatch, install, security/access
  changes, new service, art generation or replacement assets are authorized.
  Evidence: `/workspace/avatarrpg-env/staged-header698/`.
