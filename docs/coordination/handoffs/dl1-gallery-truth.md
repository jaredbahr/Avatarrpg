# Handoff — the gallery tells the truth (DL-1)

Owner: DeepSeek Flash worker in two bounded sends under the OpenClaw
avatar-supervisor (Claude Fable 5.1), 22 September 2026. Branch
`codex/dl1-gallery-truth`, clone `D:/AvatarRPG-work/dl1-gallery-truth`, base
`9d64ca9` (`origin/main`). Capture-harness and dialog-layout work only: no art,
no palette, no colour.

## Why

The design audit of the `7c0b82a` gallery found four beats whose still did not
show its own subject, so the route could not be reviewed as one game from the
gallery at all: the illustrated opening was a blank beige frame, the boss storm
frame had neither boss nor storm, the "driller on the floor" still showed the
party alone, and the Largest-text save sheet hid Import and Close below its edge.

## What changed

- `e2e/gallery/beats.ts`, `03b-illustrated-opening`: decoding the image is not
  painting it. The beat now waits for the mounted `.interlude-art` to hold a
  decoded bitmap at a real CSS size with the caption text resolved, then settles
  the layout, before the still.
- `e2e/gallery/grumbler-beats.ts`, `36-grumbler-portrait`: the camera focuses
  the driller **before** the floor still, so the two-tile machine is in frame;
  the inspector shot resets both the panel and the body scroll.
- `e2e/gallery/beats.ts` + `e2e/gallery/stage.ts`, `14-boss-blast`: new
  `focusStagedBlast` frames the 5x5 area around the driller with Kaya as a
  witness; a beat-local `STORM_TIMES` adds a 620 ms sample so the 2x projects'
  middle frame lands inside the storm's visible window (impact at ~375 ms, bolt
  strokes 240 ms). `CAST_TIMES` is unchanged, so no other beat moves.
- `src/styles/hud.css`, dialog scroll: the dialog panel no longer scrolls as a
  whole. The body (`.dialog > .stack`) is the scroll region, so the header stays
  pinned in every dialog; in the save sheet the slot list scrolls first, so its
  footer with Import and Close stays inside the box at every text size.
- `e2e/saves.spec.ts`: new test at 1194x834, Largest text: the slot list is the
  scrolling region and Import/Close sit inside the sheet and the viewport.

## Verification (this head, Windows, Playwright 1.63)

| Check                                                                                     | Result                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`, `npm run lint`, `npm run format:check`                               | pass                                                                                                                                                                                       |
| `npx playwright test e2e/saves.spec.ts`                                                   | 5 passed                                                                                                                                                                                   |
| gallery `-g "03b\|14-boss-blast\|20-save-recovery\|36-grumbler-portrait"` on `ipad-webgl` | 4 passed                                                                                                                                                                                   |
| Captures inspected by the supervisor                                                      | painting + caption visible; driller centre frame with a visible storm and damage numbers at the f1 frame; Import and Close inside the Largest-text sheet; driller on the floor beside Kaya |

## Not claimed

- Other gallery projects (Surface, Canvas, portrait) were not re-captured locally.
- The `14-boss-blast-floor` still keeps the frame-time readout over the title
  plate; that is the `.stats` move in the HUD Large-text change, not this branch.
- No visual acceptance beyond "the still shows its subject".

## CI cost

One push, one pull request (verify only), one e2e dispatch on the branch.
