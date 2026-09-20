# Fire Nation Deserter source checkpoint

- **Updated:** 2026-09-19. Owner `/root/quarry_composition`; integration owner `/root`.
- **Outcome:** original adult red/brown unarmed caster source and a nine-pose
  review package. This is a future release candidate, not a runtime replacement.
- **Location:** `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-fire-deserter-art`,
  branch `codex/fire-deserter-art`, base `380b3b5`. No PR or push was requested.
- **Completed:** two byte-identical generator sources under
  `assets/reference/fire-deserter/`; exact prompts, reference inputs, credits and
  measurements under `docs/art/fire-deserter-*`; review-only importer
  `scripts/art/fire-deserter.ts`.
- **Source review:** root accepted the original identity, cel style and empty-hand
  cast direction. The first walking pair repeated one leading leg. The targeted
  walking source supplies opposed planted legs in right-column cells 1 and 3;
  left-column cells are discarded. Seven retained frames remain byte-identical.
  Arms remain near-static; runtime gait and full animation are unreviewed.
- **Evidence:** run `node --import tsx scripts/art/fire-deserter.ts`. Output is
  `.shots/fire-deserter-review/`, including `contact-128-on-grey.png`,
  `contact-96-on-grey.png`, `contact-64-on-grey.png`, nine normalized frames and
  the candidate atlas. These are local, reproducible review files, not shipped
  assets. Ordinary grey-background compositing shows clean alpha edges; apparent
  flecks in the transparent preview were hidden/near-zero-alpha RGB. No cleanup
  painting or extra generation was needed.
- **Contract and size:** 128 × 192 frames, 128 pixels per tile, 1 × 1 footprint,
  anchor (0.5,0.85), 151px idle body. Atlas 1152 × 192, nine occupied slots and no
  unused slots. PNG 130,860 B + JSON 3,409 B = **134,269 B**. One lossless alternate
  deflate pass was larger and rejected. No quantization was used.
- **Capacity:** base units 4,715,934 B; this candidate would make 4,850,203 B,
  **131,611 B over the existing 4.5 MiB cap**. This is measured against the base,
  not a reservation against the parallel Riko correction. No budget changed.
- **Verification:** source splitting, baseline margins, deterministic atlas
  repack, all seven retained-frame byte comparisons, script ESLint, TypeScript
  and Prettier passed. PNG SHA256 is
  `37b3e2b7c466c481ba961b1159cbd983a46f25ace5f323f426252f8e1dc3cce0`.
  Full verify, build, runtime captures and CI were not run at this source-only
  checkpoint. No server was started.
- **Coordination:** no manifest, public asset, renderer, schema, rule, ability,
  camera, UI, fallback or version edits. Root reviews source and capacity before
  authorizing runtime integration. Riko's common renderer/schema ownership is
  preserved. Current release is independent of this work.
- **Next:** review the composited contacts; reconcile final units capacity with
  Riko; only then authorize a narrow asset allocation decision and runtime
  integration. Preserve the deserter's original bandit/fire/bender fallback and
  distinguish this fire caster from Ruon's sword choreography. Actual normal
  and reduced-motion Canvas/WebGL validation remains required after integration.
- **Transfer:** source milestone preserved locally; editing paused for root's
  source/capacity review. Detailed rationale and prompts are linked from
  [the source review](../../art/fire-deserter-review.md).
