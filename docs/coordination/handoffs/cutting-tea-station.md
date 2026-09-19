# Cutting tea-station handoff

- **Updated:** 2026-09-19; owner `/root/quarry_composition`; integration `/root`.
- **Outcome:** replace the oversized procedural discovery icon with a grounded
  waist-height worktable, six cups, kettle, washing bowl/seventh cup and cloth.
  Original tea painter remains the missing-image fallback. Root accepted the
  source comparison and actual Canvas96/WebGL64 candidate views.
- **Location:** `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-cutting-tea-station`,
  branch `codex/cutting-tea-station`, base `ff243ab`. No push, PR, CI or version bump.
  This belongs to the next integration batch; current PR64 is untouched.
- **Scope:** one manifest key `world.tea_station`, one public PNG, original source
  and exact prompts, deterministic importer, credits/NOTICE, exact-key image
  fallback in `painters/registry.ts`, one focused regression and local review
  harness. No camera, geometry, gameplay, other marker or unit-art changes.
- **Source and size:** [art notes](../../art/tea-station.md) explain the one
  taller-leg correction, original files and source credit. PNG 50,114 B;
  props total 317,482 B under unchanged 4 MiB. Square256px frame; alpha bounds
  219 × 165px; 85% foot line. Existing NPC scale1.5, position (3,9), collision,
  interaction target, dialogue and story flags are preserved. It is one static
  depiction; it does not change to match each revisit line.
- **Verification:** full `npm run verify` passed 824 tests in95 files, typecheck,
  lint and formatting. `npm run art:validate` and production build passed.
  Deterministic repack matches the shipped PNG SHA256
  `3ef622b0207cf777c516a4b4980ce2d6d729a290c9481bf7cb3a88f7b36bf287`.
  The first verification stopped on generated NOTICE formatting; formatted it
  and reran the complete gate successfully. A focused test initially used a
  matcher newer than this Vitest version; replaced it with supported equivalent
  call-count and argument assertions, then passed full verification.
- **Actual evidence:** `.shots/tea-baseline/{canvas,webgl}` is clean runtime
  `ff243ab`; `.shots/tea-candidate/{canvas,webgl}` is `ff243ab-modified` with the
  tea patch. Each folder includes title build capture, `tea-64.png`, `tea-96.png`,
  `tea-96-reduced.png`, `discovery.png` and exact camera/setup provenance.
  `.shots/tea-fallback/{canvas,webgl}` runs the candidate with the real PNG request
  blocked and asserts that a request failed. Both renderers show the original
  kettle fallback and still reach the discovery.
- **Capture method:** strict4265, source-build title assertion, local Edge channel
  selected through `FNT_REVIEW_BROWSER_CHANNEL=msedge`; default config remains
  bundled Chromium. New seeded Sura/Riko game, explicit Cutting fixture at (4,8),
  actual wheel/pan and normal map taps (4,9) then (3,9). Both candidates passed
  the ordinary walk and the opening seventh-cup text. Reduced-motion captures
  are idle stills; no animation claim. This is not a full-route playthrough.
- **Visual limits:** small wire repair is visible at source/dialogue size, not
  promised at normal map scale. Pip remains above the vessels. Ground contact
  and table/adult scale accepted in both-backend review. Broader Cutting scene
  composition and other procedural markers are outside this change.
- **Transfer:** clean implementation and final source-identified captures will
  be reported to root. Strict4265 is owned only for local checks and stopped
  at completion. Integration owner handles next-batch CI and delivery.
