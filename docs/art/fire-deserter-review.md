# Fire deserter source checkpoint

This historical checkpoint is preserved below. The subsequent runtime integration,
walking counter-swing correction and matching portrait are documented in
[fire-deserter-runtime.md](fire-deserter-runtime.md).

Base `380b3b5`, isolated branch `codex/fire-deserter-art`. This is a review source,
not an integrated runtime replacement. No manifest, shipped art, budget, renderer,
schema, rules or abilities have changed. This work does not block the current release.

The original generated adult caster is distinct from Ruon and the party: cropped
receding hair, clean-shaven face, worn red standing-collar tunic, rolled sleeves,
brown flask pouch and charcoal trousers. Empty-hand gather/release/recovery are
appropriate to the existing ranged cast vocabulary. No sword pose is reused.
Actual fire/oil/torch FX remain separate and are not baked into the art.

`assets/reference/fire-deserter/combat-source.png` is the byte-identical generated
source, 1024 × 1536, SHA256
`0895a09ec09f073333d1f33d54fe9bb1b0e23e2bd65b38e700970d69f1723a18`.
The exact prompt/tool/date are in [fire-deserter-source.json](fire-deserter-source.json).
No input bitmap reference was sent; existing mercenary art and the walk pose guide
were inspected when preparing the prompt and comparing style.

Run `node --import tsx scripts/art/fire-deserter.ts` for review-only output under
`.shots/fire-deserter-review`. The script refuses cuts through occupied gutters,
uses one 151px idle-based scale for the seven retained poses, preserves alpha and checks
baseline margins. It makes a normalized three-by-three contact sheet at 128, 96
and 64 tile pixels and packs the established atlas format outside `public`.
Order: idle A/B, walk A; walk B, gather, release; recovery, hit, KO.

The current nine-frame package is 134,269 bytes: PNG 130,860 plus JSON 3,409.
One alternate lossless deflate pass did not reduce it. The 1152 × 192 atlas has
nine occupied 128 × 192 slots with no empty slots. Frame bounds, 128 pixels per
tile, one-cell footprint and (0.5,0.85) anchor already fit the existing contract.
Idle height is 151px; crouching release and KO retain the common scale and remain
shorter. Exact bounds and compression measurements are recorded in
[fire-deserter-measurements.json](fire-deserter-measurements.json).

The standing/casting material and scale read coherently in the contact sheet,
but **runtime walking is not reviewed yet**. The first source repeated one
lead leg. A targeted identity-preserving walking edit now provides distinct
planted legs in the right column (zero-based cells 1 and 3), while its left column
still repeats a contact and is discarded. The seven other normalized poses are
byte-identical to the first candidate. The two walking cels share a scale derived
from their tallest body (151px); their heights are 147px and 151px. Arms remain
near-static. The transparent image preview showed apparent shoulder/head flecks;
decoded-alpha review found one connected component per walking cel at alpha ≥ 8,
and normal alpha compositing on an opaque grey review background shows clean
edges. The hidden/near-zero-alpha RGB is preserved, not painted out. Reproducible
`contact-128-on-grey.png`, `contact-96-on-grey.png` and `contact-64-on-grey.png`
provide the appropriate source-scale comparison. No runtime or continuous
animation acceptance is claimed.

The byte-identical walking source is `assets/reference/fire-deserter/walk-source.png`,
SHA256 `f9c83abfb7a9cd26462fcd1ee452944323c2b511abe3e38062d3c731d2f7e025`.
Its exact prompt and the two input reference paths are recorded in
[fire-deserter-walk-source.json](fire-deserter-walk-source.json). The tool preserved
the original combat source as a separate file. No procedural repainting or alpha
cleanup has been applied to either generated source.

Base units total 4,715,934 bytes against 4.5 MiB, leaving 2,658 bytes. This candidate
would total 4,850,203 bytes, exceeding that cap by 131,611 bytes. Riko's parallel
art correction owns its own final measured budget; this task reserves no shared
headroom and does not propose or change the cap before root's source review.

Credit: original project art made with built-in OpenAI image generation on
19 September 2026. Output terms: https://openai.com/policies/row-terms-of-use/.
No exclusive copyright is claimed. Runtime credits/NOTICE will be updated only
if a reviewed version is integrated.

Checks at this checkpoint: splitter, baseline/margin checks, successful
deterministic repack, script lint and TypeScript check. No server, browser capture,
full verify, build or CI was started for this unintegrated source checkpoint.
