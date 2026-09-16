# Elemental effects — original vector source art

Four original, transparent-background SVG bending-effect concepts, drawn to the palette and visual grammar in [`docs/art-bible.md`](../../docs/art-bible.md). All four use uniform dark-brown outlines, flat color fills, and simplified shapes without gradients, lettering, or franchise characters.

| File | Intended visual |
| --- | --- |
| `fire-ribbon.svg` | A curved flame ribbon with a small amber core |
| `water-whip.svg` | A curling water lash and separated droplets |
| `earth-shatter.svg` | A fractured earth strike with chunky flying slabs |
| `air-vortex.svg` | Wide, overlapping cream wind arcs |

**Status: original source art / review candidates, not imported game assets.** These are 256 × 256 SVGs with transparent backgrounds. The existing asset manifest still points to code-drawn painters; no runtime code or balance data was changed. The game's accepted asset contract calls for PNG sprite/FX frames and validation before wiring up an atlas. Export the approved design to raster art, inspect it at ~40 px, then use the asset pipeline and visual QA checklist in the art bible. SVG elements are intentionally not character pose sheets and should not be registered as animated unit atlases.

Concepts were designed as distinct, reusable elemental visual motifs rather than depictions of existing franchise characters. Keep new character art original as specified in `CLAUDE.md`.
