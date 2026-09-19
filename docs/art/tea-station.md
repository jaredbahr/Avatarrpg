# Workers' tea station

The Cutting's optional discovery at (3,9) now uses an original wooden worktable
beside Sen. Six cups stand beside a kettle; a seventh rests in the washing bowl
with a wire-mended handle. The small wire repair is a source/dialogue-size detail,
not promised to be legible at normal map zoom. The source also includes the cloth
mentioned on a revisit. This one still does not change with discovery flags.

The original image and one targeted taller-leg correction are preserved under
`assets/reference/tea-station/`. Exact prompts, generator filenames and inputs are
in [tea-station-source.json](tea-station-source.json) and
[tea-station-worktable-source.json](tea-station-worktable-source.json). The existing
cart illustration was the material/style reference. Built-in OpenAI image generation
created the original project art on 19 September 2026. Output terms:
https://openai.com/policies/row-terms-of-use/. No exclusive copyright is claimed.

The first source's short legs read as a low sitting bench beside Sen. The second
source lengthens the legs and matching braces into a standing worktable, retaining
the same tabletop equipment. Root accepted the corrected source comparison before
runtime registration. Sources remain outside the public download/precache.

## Registration and scale

`world.tea_station` alone changes from a procedural discovery painter to the
existing square still-image contract: `art/props/tea-station.png`, earth palette.
No new atlas or schema is needed for a stationary prop. The original semantic tea
painter remains the image-loading/failure fallback through one exact-key dispatch
in `src/render/painters/registry.ts`.

The 256 × 256 PNG has alpha bounds (19,53), 219 × 165, with its lowest visible
pixel at row 217 immediately above the 85% foot line. The existing marker scale 1.5
and interaction target remain unchanged. At 64px tiles, the table is 82.1 × 61.9px
and Sen's205px source body is 76.9px high. At 96px, these become 123.2 × 92.8px and
115.3px. These are overall painted bounds including the kettle/bowl, not tabletop
height. The camera, map positions, walkability, discovery rules and dialogue are
unchanged. The marker pip sits above the tallest vessels in actual review.

## Deterministic import

Run `node --import tsx scripts/art/tea-station.ts`. The importer checks genuine
alpha, trims the source, scales uniformly to a maximum 220 × 165px and aligns the
feet with the established baseline. No repainting, key-color removal, palette
quantization or lossy compression is applied. Review output, measurements and
properly composited side-by-side comparisons with Sen at 64/96 are written under
`.shots/tea-station-review/`. Those comparisons are not gameplay screenshots.

Copy only `tea-station.png` from that directory into `public/art/props/` after
review. The shipped PNG is 50,114 B, SHA256
`3ef622b0207cf777c516a4b4980ce2d6d729a290c9481bf7cb3a88f7b36bf287`.
Props total 317,482 B against the unchanged 4 MiB cap, an increase of 50,114 B.
No unit art or other budget changes.

## Runtime review

`e2e/tea-station.review.ts`, run through `playwright.tea-station.config.ts`, uses
strict port 4265 and checks the title build against the worktree HEAD plus tracked
modification state. The default is bundled Chromium; local Edge review uses
`FNT_REVIEW_BROWSER_CHANNEL=msedge`. It creates a seeded Sura/Riko fixture near Sen
at (4,8), then uses actual mouse wheel/pan and ordinary map taps (4,9), (3,9) to open
the discovery. This is a local scene test, not a complete route playthrough.

`FNT_TEA_REVIEW_DIR` chooses the evidence directory. Setting
`FNT_TEA_FALLBACK=1` aborts the real PNG request, asserts that it was attempted and
runs the same interactions. Both backends are reviewed at 64/96 plus a 96px
reduced-motion idle still. A static prop has no separate motion clip to accept.
The local review is excluded from regular CI by its `.review.ts` filename.
