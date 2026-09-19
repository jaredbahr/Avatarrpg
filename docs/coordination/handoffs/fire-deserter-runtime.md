# Fire deserter runtime handoff

- **Updated:** 2026-09-19 10:33 UTC, quarry composition art owner → root integration.
- **Outcome:** Replace the procedural quarry-gate fire caster with original adult
  red/brown illustrated art, an opposed-leg/arm walking pair, unarmed casts and
  matching initiative/HUD portrait. No rules, FX, camera, geometry or timing change.
- **Location:** `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-fire-deserter-runtime`,
  branch `codex/fire-deserter-runtime`, base `8c91b74`. Root's two documentation
  fixes are carried as `18eb34f` (equivalent `100197b`) and `d284994` (equivalent
  `37210c6`); do not integrate those duplicates. Deserter source checkpoint was
  already in the base and must not be cherry-picked again.
- **Acceptance:** Root reviewed source and actual Canvas96/WebGL96 walking pair,
  matching face, material and ground contact. Simple two-contact mirrored motion
  is accepted for this bounded asset; no full directional or whole-route claim.
- **Implementation:** Manifest sheet and portrait keys, nine-slot atlas, matching
  portrait, original source/edit prompts, deterministic importers, fallback mapping,
  three focused tests, local-only Playwright review and credits. Detailed provenance
  and exact reproduction are in [the art review](../../art/fire-deserter-runtime.md).
- **Budget:** [ADR 0035](../../adr/0035-fire-deserter-art-budget.md) raises units only
  from 4.5 to 4.75 MiB. Units 4,835,087 B, remaining 145,649 B. Portraits 4,176,622 B,
  remaining 17,682 B under unchanged 4 MiB. Other family limits, 25 MiB precache
  and 300 KiB JS caps unchanged. Asset check 17.37 MiB; JavaScript 299.3 KiB.
- **Verification:** Full verify passes 834/98, art validation, build, asset and
  JS budget pass. Atlas and portrait repack byte-identically. The 8-case runtime
  matrix covers Canvas/WebGL × 64/96 × normal/reduced. Both backend failure cases
  at 96 pass with atlas and portrait requests aborted. No push, CI or version bump.
  No physical tablet review performed in this task.
- **Evidence:** Worktree-relative `.shots/deserter-counter-swing-runtime` contains
  all eight cases with build `8c91b74-modified`; `canvas-96-normal/motion-136ms.png`
  and `motion-272ms.png` show both contacts. Matching WebGL96 `motion-272ms.png`
  and `webgl-96-reduced/motion-81ms.png` show the corrected arm and reduced endpoint.
  `.shots/deserter-final-fallback` captures build `d284994-modified` on both backends.
  Every folder contains visible build evidence and exact commands/poses in
  `provenance.json`. This is an explicit legal reducer fixture on real gate terrain,
  not manual control of an enemy or a completed route. Earlier candidate evidence
  is preserved under `.shots/deserter` and `.shots/deserter-fallback`.
- **Known gaps:** Existing pale Oil Flask projectile and Fire Blast palm attachment
  remain separate FX work. Other bandit scale is not corrected here.
- **Transfer:** Root owns integration and current PR. No other worktree edited.
  Port 4265 server stops with the local review; no listener remains. Raw source art
  is committed outside public/precache. Ignored captures remain at the paths above.
  Outgoing owner relinquishes asset editing after final commit handoff.
