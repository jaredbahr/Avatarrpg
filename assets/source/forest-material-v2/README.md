# Forest material source candidate

Generated 19 September 2026 using the built-in ImageGen tool, one candidate and
no correction. Exact prompt: `prompt.txt`. Native source: `material-sheet.png`,
1254 × 1254, four equal 627 × 627 quadrants. SHA256:
`a172c9bf8e7558aa751f9bfab263dbf67cc7b10e4d7f1e65ae1761a42acb6aa7`.

Original output is preserved at
`C:/Users/Jared/.codex/generated_images/01a0ba44-1cce-7002-b849-fadff21875c2/exec-acf1cfb0-327d-4373-a8b5-7827029e7d57.png`.

References, used only for material vocabulary and painted style:

- Original four-quadrant atlas `exec-22de7f0e-aa14-4a25-babd-e401a920a86b.png`
  documented in `docs/art/forest-scene-registration.md`.
- Previous forest gameplay screenshot in the `hud-compact-prototype` worktree,
  `.shots/integration/hud-proof-prototype.png`.
- Approved `assets/reference/player-view-2026-09-17/ba-dan-exploration.png`.

This is a reusable material sheet, not a painted map. Top-left supplies earth;
top-right supplies olive grass and needles. Bottom quadrants are corresponding
variations, not water or limestone. Do not pass this sheet to old packers that
expect water/limestone in the lower quadrants.

The unchanged `scripts/art/forest-route-ground.ts` consumes its upper quadrants
successfully at its existing 192 source pixels per logical tile. The isolated
packed preview is deliberately excluded from the source commit; integration
owns final packing, local grass-region composition, checks and budgets.

## Bounded visual review

Preview based on `7f9bd00` with only regenerated route-ground asset; Chrome,
1194 × 834 and 834 × 1194 touch emulation, both Canvas and WebGL. Existing
forest capture script used seed `forest-modular`, solo Kaya, forest battle entry,
reduced motion. Screenshots remain in this worktree's
`.shots/forest-material/`. Inspected landscape WebGL and portrait Canvas.

The earth reads as broader painted marks with fewer tiny gravel flecks; it is
warmer and more golden than the previous source. Olive edge grass has more
purposeful paint shapes and matches the trees better. The mirrored sampling
still produces visible mottling. The flat procedural grass beyond the current
route envelope remains the dominant mismatch: compose separate reusable local
grass regions using this material before deciding on another source correction.
Runtime water, pine assets, collision and geometry were not changed.

This is source-material review, not full scene acceptance. No full verification,
CI, physical-device or continuous-playthrough claim accompanies this source.
