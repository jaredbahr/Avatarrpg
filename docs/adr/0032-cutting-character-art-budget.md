# ADR 0032: Units budget for the Cutting character correction

Status: accepted for the current village–quarry–return presentation correction.

The Cutting still showed procedural Ruon, blade mercenary and sergeant figures
among illustrated heroes and quarry enemies. Replacing those three live-route
figures requires complete identity-consistent idle, walk and combat sheets.
The units family was already near its 4 MiB limit. A bounded lossless PNG
repacking experiment could save only 9,059 bytes, insufficient for the three
required sheets. Existing art was not degraded or recompressed.

Raise **only the units family** ceiling to 4.5 MiB. All other art/audio families
remain at 4 MiB and the complete precache remains limited to 25 MiB. Keep all
existing atlas limit, required clips, alpha margins and art validation.
The nine-pose PNG/JSON packages add 540,375 bytes. Original high-resolution
sources stay outside `public` and therefore outside precache.

## Explicit frame bounds for adult-scale art

The default 121-pixel standing figures appeared too short beside heroes, whose
oblique view applies a 1.25 scale. These three nondirectional figures therefore
use 151-pixel standing bodies. They must not shrink to fit extended sabres.
The importer measures every scaled pose and selects the smallest padded frame:
Ruon 139 by 192, mercenary 169 by 199, sergeant 147 by 203. The source images have
sufficient resolution; no regeneration or upscaling is needed.

Add optional per-sheet `frameSize: { w, h }` declarations. Undeclared sheets
retain their exact prior width/height validation. Declared dimensions must match
every frame exactly, cannot be smaller than the original frame, and are bounded
by twice the footprint width and twice pixels-per-tile height. Integer dimensions,
eight-pixel alpha margins and the 2048 atlas cap remain enforced. The schema
also rejects noninteger/oversized declarations. The existing runtime already
draws atlas rectangles relative to pixels-per-tile and anchor, so no backend,
cache, gameplay, collision or picking changes are required.

Only these three manifest entries opt in. Pixels-per-tile 128, logical 1-by-1
footprint and the 0.5/0.85 anchor are preserved. Tests compare idle body height
with Sura/Kaya's scaled height, check foot contact and reject missing/invalid
frame declarations. A measured lossless PNG strategy saves 7,379 bytes with
identical decoded RGBA. Final units total 4,715,934 bytes, 2,658 bytes below the
4.5 MiB ceiling; other families remain unchanged.

This decision authorizes these three route corrections, not additional regions
or unrestricted unit growth. The existing atlas loader, cache and procedural
failure fallback remain in use. Local review checks real loading on both
backends; the production build and asset-budget check measure the shipped total.
Exact final family/precache bytes and visual evidence are recorded in the
Cutting character handoff before integration.
