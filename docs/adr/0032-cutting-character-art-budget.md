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
existing atlas dimensions, required clips, alpha margins and art validation.
The nine-pose PNG/JSON packages add 356,681 bytes. Original high-resolution
sources stay outside `public` and therefore outside precache.

This decision authorizes these three route corrections, not additional regions
or unrestricted unit growth. The existing atlas loader, cache and procedural
failure fallback remain in use. Local review checks real loading on both
backends; the production build and asset-budget check measure the shipped total.
Exact final family/precache bytes and visual evidence are recorded in the
Cutting character handoff before integration.
