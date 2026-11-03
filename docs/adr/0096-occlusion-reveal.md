# ADR 0096: A hidden party member shows as a silhouette; the building keeps its paint

**Status:** proposed, 2026-10-28 (draft PR for the coordinator's review)

Changes a rendering contract on both backends (what a piece in front of a figure draws), so it is recorded here.
Replaces Ba Dan's house fade (`docs/art/ba-dan-scene.md`, ADR 0076). Follows ADR 0088 and ADR 0093 (integer zoom, pixel art on the
world-pixel grid).

## Context

Jared wants Ba Dan to read as polished, and flagged figures that look "off" and "not actually there". The worst case
is the see-through veil: when a party member stands behind a Ba Dan house, `sceneryOpacity` faded the whole house to
0.28. Ba Dan's ground plates hold the same painted house (ADR 0076), so the faded upright shows the same roof under it,
and the figure seen through the veil reads as standing on the roof (`art/source/ba-dan-route-a/review/one-px/veil-chimney.webp`,
the PR #297 notes; grounding fault 25). The veil was also gated by a probe at the head (foot minus 56 world px, tested
on a 128 x 128 alpha mask): it toggled when Bo's head crossed one pixel of the chimney's top edge, and it hard-coded
a figure height that the figure-scale change (1.25 to 1.0) moves.

## Options

- **(a) A silhouette.** Keep the building fully opaque and draw the covered part of the figure over it, flat and
  tinted, as many isometric games do.
- **(b) A local cut-out.** Fade only the building's pixels in a window around the figure. Rejected without a build:
  under the cut-out the plates show the same painted roof, so the figure in the window stands on the roof exactly as
  it did under the whole-house veil. It would also cut a hole in the art at a hard edge that the painting has no
  reason for.
- **(a) for the party, residents hidden.** Chosen: the party has to be findable; a resident behind a house is not
  the player's concern, and a crowd of silhouettes would make the village read as x-ray.

Two tints were tried at game zoom (`e2e/occlusion-reveal.review.ts`). A dark 1 px rim with a near-opaque pale fill
read as a sticker pasted on the roof. A pale 1 px rim at full strength with a translucent fill (alpha 120) lets the
roof show through the figure, so it reads as behind it. The second shipped.

## Decision

1. **A piece can reveal instead of fading.** `SceneScenery.revealOccluded` (replacing `fadeWhenHeadHidden`): the
   piece is never faded (`sceneryOpacity` returns 1). Every Ba Dan upright that hid a figure sets it; every other
   scene keeps its fade (the forest's signpost and lantern, the quarry's frames), where the ground under the piece
   does not hold the same art.
2. **The party is revealed as a silhouette of its covered part** (`src/render/reveal.ts`). For each party member
   (`revealsUnit`: faction `party`, not fallen) the pieces that reveal, stand in front of its foot by the depth rule
   both backends sort by, and overlap its frame are found. The figure's frame and the union of those pieces are
   rasterised on the world-pixel grid at 1 texel per world px, nearest; a figure pixel that a piece covers is drawn,
   a 1 world px rim (a 4-neighbour outside the figure) at full strength and the rest translucent. Nothing outside the
   figure, and nothing of the figure that is not covered, is drawn, so the building's own pixels outside the reveal are
   untouched.
3. **The decision is coverage, not a probe.** A figure is revealed once `REVEAL_MIN` (a quarter) of its own opaque
   pixels is covered. One pixel of a chimney's edge moves that fraction by a fraction of a percent, not from hidden to
   shown, and no figure height is written down anywhere: it reads the frame at whatever scale it is drawn.
4. **Both backends draw it** (board readability). Canvas 2D draws the one canvas after the depth-sorted occupants,
   nearest at integer zoom (`drawArt`). WebGL draws it as a sprite at the top of the unit layer, the canvas's texture
   owned by the backend (never Pixi's cache) and updated in place each frame. The silhouette is built once per figure
   per frame and only when a revealing piece overlaps the figure's frame, so a board with none costs nothing.

## Consequences

- A hidden leader's selection ring, on the ground behind the house, stays hidden; the silhouette is the marker.
  The silhouettes share one tint; a per-member tint is a follow-up if the table asks who is who.
- Residents and enemies behind a revealing piece are hidden outright.
- `baDanDepth.test.ts`'s veil sweep is now empty for Ba Dan by construction (no Ba Dan piece fades); it still holds
  any piece that fades.
- `src/render/reveal.test.ts`: a figure wholly behind a piece is drawn whole, and only its covered part when partly
  behind; under a quarter covered nothing is drawn; the party is revealed and an enemy or a fallen member is not; a
  revealing house stays opaque with a party member or a resident behind it, where the same piece without the flag
  fades; every Ba Dan piece that hid a figure reveals instead; the south-west house and Gao's shop are found in front of
  a figure behind them and not in front of one on the lane before them.
- Captures (both backends, 128 px tiles, N = 2): `art/source/occlusion-reveal/review/`.
