# HUD compact initiative prototype

Branch: `codex/hud-compact-prototype` from `b809b04`.

Added a short-landscape-only CSS prototype in `src/styles/hud.css`. At widths of at least 53rem and heights up to 48rem, initiative chips stay in the in-flow `.turn-strip`, use horizontal portrait plus label layout, retain `var(--tap)` minimum height, and keep the strip horizontally scrollable for crowded orders. The compact rule applies only when `html[data-large-text='off']`; portrait and Large/Huge text layouts retain baseline styling.

Validation: `npm run build` passed and `git diff --check` passed. Using the owned preview on port 4301 with installed Chrome, the runner clicked the visible “I'm ready” handoff, waited for the action dock, and captured playable combat. Same-roster 1280x720 comparison:

- `.shots/integration/hud-proof-baseline.png`: baseline vertical chips, strip 91.09px, canvas 424.70px, action dock present at y=590.22px.
- `.shots/integration/hud-proof-prototype.png`: compact chips, strip 59.39px, canvas 456.41px, action dock present at y=590.22px. This recovers 31.70px of battlefield height while preserving 50.39px chip heights.

A crowded order was also measured with ten chips in the prior `.shots/integration/hud-prototype-crowded-landscape.png`; portrait/Huge retained baseline layout and scroll behavior in `.shots/integration/hud-prototype-crowded-portrait-huge.png`. The preview server was stopped after capture. The ignored `.shots/integration/hud-proof.mjs` runner and screenshots are retained for review.