# Dynamic tactical surface materials

- **Updated:** 2026-09-19 05:43 UTC; combat_depth_audit → root/integration.
- **Outcome:** painted ground remains visible through mud, oil, ice and live rubble. Mud/oil have sparse, static streaks and irregular inner-edge pooling; ice has fine frost veins instead of quantised checker facets. Exact affected tile coverage and exterior boundary remain visible.
- **Location:** `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-material-surfaces`, branch `codex/material-surfaces`, base combined `1a7d687`. Implementation commits `eb67177` then `bee18238c0a34bdc97e3b88996dfda71fd296ce5`. This handoff is a subsequent documentation-only commit. No PR/push/CI requested or performed.
- **Ownership:** only `src/render/palettes.ts`, `surfaceRendering.ts` and its tests, `painters/tiles.ts`, `backends/pixi.ts`, `backends/shaders.ts`. No rules, content, art asset, camera or CombatScene changes. Other owners retain preview/UI/map work.

## Rendering contract

The full tile receives a translucent identity wash; texture never cuts holes in the rules footprint. Same-material neighbours omit internal rims. Pooling stays within 8.5% tile depth inside exterior edges. Shared palette, duration intensity and bank/pool constants keep both backends coherent, with backend-specific material marks. Temporary surfaces fade using the existing WebGL duration curve; Canvas no longer adds a black rectangle when duration reaches one. Existing patterned-ground paths and painted-water/rubble fallback policy remain intact.

Canvas clips all marks to the real tile. WebGL retains one ground pass and existing map texture; exterior material banks add four neighbour texel reads only on ice/mud/oil/rubble fragments. Noise is stationary in world space. Oil loses the animated rainbow and its trigonometric sheen. No new per-frame whole-map scan, texture allocation or generated art. Physical-device frame timing has not been measured.

## Verification and visual evidence

Tested implementation tree is `bee1823` (checks completed immediately before commit):

- `npm run verify`: typecheck, lint, format and **794 tests / 88 files passed**.
- `npm run build`: passed; existing >900 kB chunk-size advisory remains.
- Existing `e2e/painted-rubble.spec.ts`: **2 passed**, Canvas and WebGL, using installed Chrome and isolated Vite port 4214. Local config `.shots/surface-playwright.config.ts` points the original tests at that port; test assertions unchanged.
- Normal UI import of unmodified `C:/Users/Jared/Downloads/four-nations-tactics-lv3-2026-09-19.json`: actual Grumbler Round 3, Sura 34/34. No battle actions or save mutation. Patterned ground + Higher contrast toggled through Settings; battle JSON remained identical before/after in each backend. No page errors in source captures.
- Captures are local evidence under `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-material-surfaces/.shots/surfaces/`: `before-canvas.png`, `before-webgl.png`; final `final-canvas.png`, `final-webgl.png`; normal wheel zoom-out `final-fitted-canvas.png`, `final-fitted-webgl.png`; final accessibility captures `after-accessible-canvas.png`, `after-accessible-webgl.png`. Earlier `after-*`, `refined-*` and `fitted-*` normal captures are intermediate, not final review evidence.

Compared against `docs/player-view-target.md` and its quarry battle reference: improved ground visibility and quieter surface coverage support the world-led target. Oil is dark sage with curved sheen, mud warm with sparse streaks, ice pale with veins. Exact grid-shaped regions intentionally remain apparent. Root requested stronger material character after the first checkpoint; `bee1823` implements that correction. This is a bounded surface improvement, not a claim that the entire current quarry composition matches the reference. Root reviewed final-fitted-webgl and final-canvas and accepted this bounded material improvement for integration; overall quarry composition remains with the art owner. No physical iPad/Surface or full E2E/gallery run here.

## Reproduce and transfer

Start this worktree on a free isolated port (4214 was used; never use 4200/4204/4210). Visit `/?renderer=canvas` then `/?renderer=webgl`; Load a save → Import from file → supplied save. Compare close view; wheel down over board for fitted view. Pause → Settings → Patterned ground and Higher contrast verifies accessibility cues. Local capture scripts are retained in `.shots/` for repeatability; they import the same file via file chooser.

Tracked tree clean after this handoff commit; ignored screenshots/capture scripts/build output remain local. Node modules junction uses combined worktree dependencies. Temporary server on 4214 stopped; no owned browser/server left running. Root may cherry-pick the two implementation commits plus this documentation commit and rerun combined verification. Editing ownership relinquished pending review feedback; no push or CI triggered.
