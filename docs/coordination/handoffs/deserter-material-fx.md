# Deserter material FX handoff

- **Updated:** 2026-09-19, quarry composition owner → root integration, next quality
  revision. The active v0.2.1 movement release is independent and must not receive
  this patch during its running CI.
- **Location:** `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-deserter-material-fx`,
  branch `codex/deserter-material-fx`, original base `b036c59`. A local rebase onto
  current release `fc37c6a` and final combined budget validation follow the bounded
  implementation checkpoint; final results are appended below.
- **Outcome:** Fire Blast and Oil Flask leave measured deserter palms; Fire Blast
  explosion/area and oil spill retain their exact ground destinations. Oil Flask
  reuses the existing terracotta prop as a small tumbling projectile, replacing
  the oversized pale boulder. Actor art, bandit scale, gameplay and timing stay
  unchanged.
- **Contract:** No new emitter fields, backend code, GPU texture size or budgets.
  [ADR 0021](../../adr/0021-bending-animation-cels.md) already permits the four-cell
  clip. Shared texture uses 61/64 slots. A failed flask image falls back to a small
  dark droplet; reduced motion continues to suppress emitters.
- **Provenance:** [Art note](../../art/deserter-material-fx.md), deterministic
  `scripts/art/flask-cels.ts`, original `public/art/props/flask.png`; no generation,
  code repainting or upscaling. Four cel copies retain all nonzero-alpha source
  pixels. New strip 58,423 B; SHA256
  `eed25a4b055a1b9a1cbc63b35afd6501b2af8c4eeefd31ea3a72fed4b1ffecd1`.
- **Tests:** Focused tests preserve old sound, flight and impact/area tracks for
  both abilities, left/right facings and empty/occupied target tiles; verify the
  captured release scale/offset, measured palm geometry, fallback, reduced motion,
  unchanged oil speed/arc and deterministic repack within atlas/gutter limits.
- **Actual evidence:** `.shots/deserter-fx-stationary-before` has all four normal
  Canvas/WebGL × 64/96 cases on base `b036c59`. The corresponding `-after` directory
  has eight normal/reduced cases on `b036c59-modified`, all passed. Explicit
  fixture: real gate roster/map, stationary deserter (8,4), Sura (5,4), real reducer
  Oil Flask then Fire Blast, AP 4 → 2 → 0, unchanged movement/actor positions.
  Returned events enter the normal animator; no fabricated animation events.
  Both resulting states are already computed during queued playback, so the
  surface shown during early oil frames is the final burning state, not proof of
  intermediate surface timing. Per-case provenance stores commands, events,
  sampled poses/emitters, visible source build and actual zoom/backend.
- **Review frames:** At 96px, `canvas-96-normal/motion-276ms.png` shows small flask
  release; `motion-440ms.png` shows arrival at target ground. Fire launch is
  `webgl-96-normal/motion-1104ms.png`, ground explosion is
  `canvas-96-normal/motion-1270ms.png`. Root directly reviewed both launch frames
  and accepted the bounded visual correction. Ground impacts remain separately
  demonstrated and pinned by tests.
- **Failure evidence:** `.shots/deserter-fx-fallback` has both 96px normal cases
  with `art/fx/flask-cels.png` aborted; both passed without page errors. Example
  `webgl-96-normal/motion-335ms.png` shows the dark primitive in flight. Reduced
  endpoint: `deserter-fx-stationary-after/webgl-96-reduced/motion-77ms.png`.
- **Reproduction:** `npx playwright test --config playwright.deserter-fx.config.ts`.
  Strict4265, default bundled Chromium, optional local
  `FNT_REVIEW_BROWSER_CHANNEL=msedge`; `FNT_DESERTER_REVIEW_DIR` selects output,
  `FNT_DESERTER_FALLBACK=1` blocks only the new FX strip. Initial accidental run
  under `.shots/deserter-fx-before` used the prior walking fixture and is not the
  matched stationary baseline; use the explicit `-stationary-before` directory.
- **Initial budget:** Production build on `b036c59` candidate passed: FX1.46 MiB,
  total precache17.43 MiB, JS299.4 KiB/300 before final credit text. All limits are
  unchanged. This is not the final combined movement-release budget; measure that
  exact result before integration.
- **Transfer constraints:** No push, CI, version bump, broad particle redesign or
  bandit scale change. Root owns integration and final release. Physical tablet
  testing and complete route acceptance are not claimed. Port4265 stopped after
  each review run; no shared worktree was edited.
