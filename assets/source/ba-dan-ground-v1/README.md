# Ba Dan shared ground material

Generated 6 October 2026 with the built-in OpenAI image-generation tool. The
approved forest material sheet, the current forest gameplay capture, and target
B were style/material references. The output is original project art; no
exclusive copyright in generated output is claimed. Runtime coverage is already
provided by the existing `art/maps/ba-dan-scene` credits entry.

- Native source: `material-sheet.png`, 1254 × 1254.
- SHA-256: `df3cc8cd501fed8a6e0e05501589e5d89e8d9361e9f31cd87f18a82b22102c5a`.
- Round-2 tool output: `exec-18bf8df1-f253-48d0-82be-758811ed11d1.png`.
- Exact prompt: `prompt.txt`.

The left half is crisp village grass; the right half is desaturated worn earth.
It is now a colour reference only: `ba-dan-village-material.ts` paints grass and
earth procedurally on the world-pixel lattice (the sheet's 12-25 px star tufts
cannot be removed from a sampled copy without flattening it).

`courtyard-paving.webp` is the lossless courtyard plate as first accepted. The
courtyard generator reads its paving, alpha and registration from it, because the
shipped plates are lossy and reading one back would lose a generation each run.
