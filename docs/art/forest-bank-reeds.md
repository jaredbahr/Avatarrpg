# Forest bank reeds — fine repaint (2026-10-06)

The Forest Road uses this four-piece bank-reed family for its pond and creek
fringes. The plant identities and registrations approved on 2026-09-30 remain;
the four sprites were repainted at the character art's finer grain and accepted
in route review on 2026-10-06.

## Source

- Original identity references: PixelLab `create_1_direction_object`, one
  four-candidate review pack at 128×128, view `top-down`, no style images.
  Terms: https://pixellab.ai/termsofservice
- Review object `af980e70-ce2e-468b-a33b-d476e3429e2a`; all four candidates kept by the
  supervisor (tag `forest-bank-reeds-v1`), objects `a1a3ed05-cd58-4ad7-aebe-7ae3a1d4c1c1`,
  `fe78c39e-25ec-433a-9d80-6e2239e81147`, `d63d02a1-4ea4-41a8-b499-efd542e0b394`,
  `3cd90a53-3938-4a58-ac6f-1874dc895035`.
- Description: "clump of green wet-bank reeds and sedge growing from a small muddy root mound
  at a pond edge, upright slender blades in grouped bunches, a few brown cattail seed heads,
  warm upper-left sunlight, soft painterly shading, brown selective outline, muted natural
  greens and ochre, viewed from a 2:1 isometric three-quarter top-down camera, transparent
  background".
- Per-item descriptions: 0 tall grouped reeds with two cattails, knee-high, on a small mud
  mound; 1 short sedge tuft, ankle-high; 2 bent water-edge leaves leaning right, low clump;
  3 worn low reed clump with a few broken dry stems.
- Fine repaint: built-in OpenAI image generation, using the original four
  plants as identity/composition references and the accepted route pieces as
  the fine-grain reference. Output terms:
  https://openai.com/policies/row-terms-of-use/. No outside character or world
  names were used. Reed 3 was corrected after review to retain the original
  sparse brown-and-olive cattail clump, five dark heads and mud foot.
- Tracked painted sources: `media/art-sources/forest-bank-reeds-fine-v1/reed-0..3.png`.

## Packing and placement

- `scripts/art/forest-bank-reeds.ts` validates each source's registered canvas,
  full opaque bounds and foot line, then alpha-trims without resampling into
  `public/art/maps/forest-scene/bank-reed-0..3.webp`, registered at the root mound.
- `src/content/scenes/forestRoad.ts` places five clumps on the same passable pond and creek
  cells as before, never mirrored. Display heights 27–54 world px (0.18–0.36 of a 151 px G
  adult). Depth is clamped to the cell centre so a unit in the reeds' cell draws in front.
- The forest route ground, south grass and exterior apron plates bake reed wear from these
  placements and were regenerated with their packers.
