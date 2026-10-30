# Ability header review captures — issue #331

These production-build Chromium captures show the selected Fire Jab header at the two required **Normal text** viewports. Both legal level-three Kaya kits are represented. In every image, the complete authored oil clause is readable through “the target stands in.” Root reviewed all four images. The normal-size action buttons, aim guidance, and Cancel control remain visible beside the board.

| Viewport                                          | Fire Blast kit                                          | Fire Step kit                                          |
| ------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Desktop 1280×800                                  | [Selected header](desktop-fire-blast-normal.png)        | [Selected header](desktop-fire-step-normal.png)        |
| iPad landscape 1194×834, Chromium touch emulation | [Selected header](ipad-landscape-fire-blast-normal.png) | [Selected header](ipad-landscape-fire-step-normal.png) |

Captured from source commit `d393a08172889fd03a486b862b116d10b63f37ba` with `e2e/ability-header.spec.ts`, using `/usr/bin/chromium` and the production preview. That committed source passed **8/8 focused browser cases, zero retries**, crossing these two viewports, Normal/Huge text, and the two legal kits. The spec compares canvas/header geometry against idle for short and authored Fire Jab copy and every selectable Kaya ability; at both text sizes it also taps the painted Oil Flask through real input after refit and checks the correct preview. The ignored local idle/selected captures for all eight cases and the focused log are retained in the source owner's workspace; these four selected PNGs are the PR's durable visual record for the Normal-text clause.

The images are Chromium layout captures at the iPad viewport, not physical iPadOS or WebKit captures. The physical device review remains separate.
