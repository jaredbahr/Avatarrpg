# Occlusion reveal review (ADR 0096)

Before (left) and after (right), from two runs of `e2e/occlusion-reveal.review.ts` at the same seed and framing:
before on `dd76430` (main, figure scale 1.0 from #303), after on `claude/occlusion-reveal` merged with it. 1368x912 viewport, dpr 1, 128 px tiles (integer zoom
N = 2). `canvas-*` and `webgl-*` are the two backends (WebGL on the container's software rasteriser, forced with
`?renderer=webgl`).

- `*-southwest-house.webp`: the party behind the south-west (woodcutter's) house, the leader on (7, 9).
- `*-gao-shop.webp`: the party behind Gao's shop, the leader on (7, 0).
- `*-4x.webp`: the leader, nearest 4x.

Before, the house fades to 0.28 over the same roof painted on the ground plate, so the leader is drawn whole, in
colour, with the selection ring, standing on the roof. After, the house keeps its paint and the hidden part of each
party member is a translucent silhouette with a 1 world px rim, on the world-pixel grid.
