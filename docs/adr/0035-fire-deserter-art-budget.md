# ADR 0035: Units allocation for the fire deserter

Status: accepted for the existing village–quarry–return presentation correction.

The quarry gate still mixes a procedural fire caster with illustrated party and
bandit figures. He is a different person from Ruon: fire blast, oil flask and
torch attacks require empty-hand cast poses rather than Ruon's sabre animation.
The reviewed original adult red/brown deserter supplies two idle poses, two
opposed-leg walking poses, three casts, recoil and defeat within existing clips.

Increase only the units family from **4.5 MiB to 4.75 MiB**, exactly 256 KiB.
Every other art/audio family remains 4 MiB; total precache stays 25 MiB and total
JavaScript stays 300 KiB gzipped. This authorizes this missing enemy identity,
not further regions or arbitrary asset growth. All existing art validation,
alpha margins, atlas limits, loading/cache behavior and fallback remain intact.

Combined base `8c91b74` includes the final lossless Riko compression and has
4,702,738 bytes of units. The deserter adds **132,349 bytes** (128,940 PNG plus
3,409 JSON), making **4,835,087 bytes**. That is 116,495 bytes over the prior
4.5 MiB cap and 145,649 bytes below the new 4,980,736-byte cap. A single lossless
alternative PNG deflate strategy was larger and rejected. No other sheet is
recompressed or degraded to make room.

The atlas is 1152 × 192 with exactly nine occupied 128 × 192 slots and no empty
padding slots. The existing 128 pixels-per-tile, (0.5,0.85) anchor, one-cell
footprint and mirrored facing contract apply without schema/backend changes.
Original generator sources and prompts remain outside `public` and precache.
The original bandit/fire/bender painter remains the failure fallback.

The matching original 512px portrait adds 20,546 bytes through the existing WebP
image contract. Portraits total 4,176,622 bytes, leaving 17,682 bytes within their
unchanged 4 MiB cap. No renderer or portrait-family budget change is needed.

Runtime review must assess the two-frame gait with its restrained arms rather
than infer animation acceptance from source stills. Both backends, normal and
reduced motion, legal fire/oil actions and actual walking at 64/96 are checked
before handoff. Final build/precache and visual evidence belong to the bounded
runtime handoff; this budget decision alone does not establish those results.
