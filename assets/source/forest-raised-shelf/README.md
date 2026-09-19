# Forest raised shelf source

Generated 19 September 2026 with the built-in ImageGen tool as one candidate. The final native source is `raised-shelf.png`, 1254x1254 RGBA, SHA256 `d5600c336f0e34bad28300088fa863d824b763a4bba2666f6869fc6b4a390792`. The first candidate is preserved as `raised-shelf-initial.png`, SHA256 `a5650a9651bb7f90754d37660174b543fcf90f51807022932cc365bd1aa08856`.

Final corrective output is preserved at `C:/Users/Jared/.codex/generated_images/01a0b7dd-d15a-72a2-8aa3-8fcbe01c8545/exec-efab72ae-5411-46be-bbcb-3408cdeaf3af.png`; the initial output remains at `C:/Users/Jared/.codex/generated_images/01a0b7dd-d15a-72a2-8aa3-8fcbe01c8545/exec-72f5d763-88c9-4547-b83e-887be03c4286.png`.

The generated image is a style and material source. `scripts/art/forest-raised-shelf.ts` registers its two alpha components independently to the matching projected cell groups, uses verified opaque interior crops for complete top coverage, and blends only opaque rim pixels on exposed edges. It then clips the result to the exact authoritative `^` cells in `FOREST_ROAD`, leaving the east exit cell (19,4) transparent. It does not supply collision, elevation or a complete map.

Existing `assets/source/forest-material-v2/material-sheet.png` and the accepted forest route captures supplied palette and material vocabulary; `public/art/maps/quarry-gate-scene/limestone.webp` was inspected as a low-shelf reference only and is not copied into this asset.
