# Issue #341 matched renderer frames

These six PNGs compare the corrected #336 renderer before #341's pixel overlays with the #341 renderer after them. The capture is a staged `MapView` renderer fixture, not a legal playthrough. The same seed (`pixel-overlay-pairs`), authored scene, actor positions, fixed view time, 1280 × 800 CSS viewport, DPR 1, and zoom 2 were used on both builds. Ambient emitters were disabled for the match. The source images are unscaled PNGs so their pixel edges remain inspectable.

| Scene                         | Before                      | After                     | Visible change                                                                    |
| ----------------------------- | --------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| Ba Dan, profiled Gao speaking | [Before](before-ba-dan.png) | [After](after-ba-dan.png) | The talk pip uses a bounded world-pixel shape above the authored resident figure. |
| Forest fight                  | [Before](before-forest.png) | [After](after-forest.png) | Movement, target, area, route, aim and selection marks use stepped pixel edges.   |
| Knockout                      | [Before](before-ko.png)     | [After](after-ko.png)     | The KO cross uses pixel runs over the same fallen figure.                         |

The **before app** was source `694310a182a4f93b288f6c75d4df68482967c1a4` on the corrected #336 parent. The **after app** and capture-fixture producer were `acdf8b072333e3114ed2d2d9fd0af1f8e1524a44` on the #341 branch. The later #341 matrix-fixture commit `1fcb8630a9b0d5a59a3c6460a5d7873f20fc3f75` changes only `e2e/pixel-overlay-rendering.spec.ts`; `git diff --quiet acdf8b07 1fcb8630 -- src e2e/pixel-overlay-pairs.review.ts playwright.pixel-overlay-pairs.config.ts` confirms the shipped renderer and matched-pair fixture are byte-identical between those heads. Each app build completed under activated Node 22.23.4 before capture; logs are `/tmp/341-baseline-build-694310a1.log` and `/tmp/341-build-acdf8b07.log` in the verification workspace.

The successful one-worker Canvas capture commands, run from the #341 worktree with `/workspace/avatarrpg-env/activate.sh` sourced, were:

```bash
FNT_PIXEL_CAPTURE_LABEL=before FNT_PIXEL_CAPTURE_SKIP_BUILD=1 FNT_PIXEL_CAPTURE_APP_ROOT=/workspace/avatarrpg-341-baseline-336 FNT_PIXEL_CAPTURE_PORT=4491 ./node_modules/.bin/playwright test -c playwright.pixel-overlay-pairs.config.ts --grep 'on canvas' --workers=1
FNT_PIXEL_CAPTURE_LABEL=after FNT_PIXEL_CAPTURE_SKIP_BUILD=1 FNT_PIXEL_CAPTURE_APP_ROOT=/workspace/avatarrpg-341-standalone FNT_PIXEL_CAPTURE_PORT=4492 ./node_modules/.bin/playwright test -c playwright.pixel-overlay-pairs.config.ts --grep 'on canvas' --workers=1
```

Both commands exited 0 (one test each), recorded no page errors, and wrote source SHA metadata beside the raw captures. The successful logs are `/tmp/341-before-gao-694310a1-r2.log` and `/tmp/341-after-gao-acdf8b07.log`. Gao was selected by resident ID and sprite, and the fixture waited for his authored `gao-g` sheet resources before drawing. The forest and KO PNGs reproduced byte-for-byte across the corrected Gao recapture.

| PNG                 | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `before-ba-dan.png` | `d95de245fbbf372c71c078c91c57909e9bb1e1ded58dbdbd8a3fe35c3eefed6d` |
| `after-ba-dan.png`  | `e5ab1543a88d3c66fcdc04ec63d0eb7fbb10233754f4fc340b269a65a7c6fd89` |
| `before-forest.png` | `46c6bc6d27824bf0e50b582041065b8e6df6ea5451c6c8f8f3aae82b6cfce90a` |
| `after-forest.png`  | `72be61384b0bd11d4bf9bfe2e198a353c78fdaba2e09568518b59d965580938c` |
| `before-ko.png`     | `9998c37233574aa1e87d91b89ed0d5f00a628b9cdb590a0fa897ee0bc34e85dd` |
| `after-ko.png`      | `b57dc7d212394836f69487a08db1d179f66e0c1d839255d9b5990b7235bb4a9c` |

The separate production browser matrix checks Canvas/Pixi alpha, parity, cache reuse and raised-tile input. These six frames document the visual before/after comparison; they do not establish every device or gameplay state.
