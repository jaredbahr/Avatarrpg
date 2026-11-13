# ADR 0107: Dialogue portraits are detailed pixel art (style B)

**Status:** accepted, owner decision 2026-11-11.

## Context

The owner compared a hand-drawn portrait and two pixel-art treatments of Kaya and picked
**style B: detailed pixel art at 160 px** (about 48 colours, careful shading with selective
dithering, crisp 1 px darker outlines, plain light background) for every dialogue portrait.

## Decision

- Every file in `public/art/portraits/` is a 160 x 160 palette PNG made by
  `prototypes/topdown/tools/portraits_b.py`: the previous portrait resized to 160 px, then
  PixelLab `/edit-image-pro-flash` (method `text`, the B description with the character's own
  features, seed 11, about 6 credits each). A retry changes the seed (with `--base-dir` pointing at the earlier hand-drawn portrait, and per-portrait wording in `REDO`:
  Pella and Jinu were redone at seed 23, 2026-11-11, for noisy hair and curls that read as buns). Calls are in
  `prototypes/topdown/ledger.json` as `t9_portrait_<id>_B`. New portraits follow the same recipe.
- Dema and Sen now have their own portraits (`portrait.dema`, `portrait.sen`); they used Mira's
  and Gao's. The deserter portrait is a PNG like the rest.
- Display: `assetCanvas` draws a 160 px portrait with nearest-neighbour sampling at a whole
  multiple of its pixels, centred in the box (`drawPixelPortrait`). Boxes that are not within a
  fifth of a multiple upscale to the next whole number and smooth down, so small HUD portraits
  are never sampled at a fraction. The dialogue stage and the conversation panel are 15rem
  (240 CSS px, amended 2026-11-11 at the owner's request: exactly 3x on an iPad at dpr 2, with no
  smoothing; at dpr 3 it is 4.5x, drawn crisp at 4x and centred; at dpr 1 it is 1.5x, upscaled to 2x and smoothed
  down. A box of 3x or more always draws at the whole multiple below rather than smoothing, so Large text
  (4.5x at dpr 2) stays crisp).
  Phone and upright boxes keep their smaller sizes (6rem and 5rem).
- Size: the portraits fall from about 4.2 MB (512 px) to about 0.27 MB. No budget changes.

## Consequences

Portrait art is judged by the owner by eye; changing one means re-running the recipe, not
repainting. Large-text scaling can leave a portrait a little inside its box; it stays crisp.
