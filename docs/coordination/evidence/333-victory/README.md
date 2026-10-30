# Issue #333 victory beat — focused visual evidence

Captured from source commit `1aadf4eb795130eb5f490ff9340cc52700dd8544` on 2026-10-30 UTC. The `13-victory` gallery passed on `surface-canvas`, `surface-webgl`, and `ipad-canvas` (3/3, one worker, zero retries, terminal exit status 0); the terminal overlay browser checks passed on `surface-touch` (2/2, one worker, zero retries, terminal exit status 0). The respective terminal transcripts are [gallery.log](gallery.log) and [live-e2e.log](live-e2e.log).

| Project               | Undimmed party beat             | Result card                     |
| --------------------- | ------------------------------- | ------------------------------- |
| Surface, Canvas       | [beat](surface-canvas-beat.png) | [card](surface-canvas-card.png) |
| iPad viewport, Canvas | [beat](ipad-canvas-beat.png)    | [card](ipad-canvas-card.png)    |

The WebGL project passed the same gallery case; its generated captures remain in ignored `gallery/surface-webgl/13-victory-f1.png` and `13-victory.png` in this worktree. The selected images above keep the review artifact small. Captures show the four living party members in frame before the card, with an unobscured board and an accessible **Show result** button. The card retains its existing wording and action.

The gallery is **fixture-staged victory evidence**: its case moves the party to dispersed legal tiles, marks enemies defeated, ends the active turn, and advances a controlled clock. It tests framing and the resulting presentation under Canvas and WebGL; it is not a recording of a naturally won fight or proof of the final-hit animation timing. The scene-level animator-boundary tests cover that timing, while the separate live browser tests exercise the actual overlay skip and reduced-motion card/camera behavior on a running combat scene.

The local browser used `/usr/bin/chromium` via external Playwright configs `/tmp/avatarrpg-333-gallery.config.ts` and `/tmp/avatarrpg-333-e2e.config.ts` so no repository browser setting changed. The gallery ran with `FNT_E2E_PORT=43633`, selecting `13-victory` in the three named projects; the live check ran with `FNT_E2E_PORT=43634`, selecting `e2e/victory-beat.spec.ts` on `surface-touch`. Both built and served this worktree through their Playwright `webServer` config. The screenshot and log files were copied without modifying the source after those runs.

Equivalent invocations from this worktree, using the external configs above and pinned local Playwright:

```sh
FNT_E2E_PORT=43633 ./node_modules/.bin/playwright test e2e/gallery/gallery-a.spec.ts --config=/tmp/avatarrpg-333-gallery.config.ts --grep 13-victory --project=surface-canvas --project=surface-webgl --project=ipad-canvas --workers=1 --retries=0
FNT_E2E_PORT=43634 ./node_modules/.bin/playwright test e2e/victory-beat.spec.ts --config=/tmp/avatarrpg-333-e2e.config.ts --project=surface-touch --workers=1 --retries=0
```
