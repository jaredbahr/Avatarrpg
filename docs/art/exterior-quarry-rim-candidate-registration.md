# Exterior quarry rim candidate registration

This is a measured, source-only candidate checkpoint. It does not add final
WebP files, register either combat scene, or change runtime rendering. Run:

```text
node --import tsx scripts/art/exterior-rim-pack.ts ambush_road art/raw/cutting/exterior-rim-source-v1.png
node --import tsx scripts/art/exterior-rim-pack.ts quarry_floor art/raw/driller/exterior-rim-source-v1.png
```

The commands write ignored candidate atlas PNGs, full ground-plus-rim assembly
PNGs, and a registration JSON beside each source. The 2304×1408 assembly uses
the actual registered `ground-west.webp` and `ground-east.webp` pages, not the
raw ground generation source, and extends world coordinates from `y=-320` to
`y=1088` so the rear cliff top is never mistaken for a camera crop. The
assemblies are for visual review only. They are not scene evidence or a runtime
fallback.

## Input measurement

Both generated transparent sources are 1254×1254, while the technical atlas is
2048×2048. Their limestone/timber material is usable, but a uniform upscale
would miss the source-guide baselines. The packer therefore applies the listed
per-piece affine scale from a measured lower edge to the guide anchor. It does
not crop a component to make it appear aligned.

| Map           | Source SHA-256                                                     | Pieces | X scale       | Y scale       |
| ------------- | ------------------------------------------------------------------ | -----: | ------------- | ------------- |
| Cutting       | `e7d060a171f88a5b7ebe377b29998f85c1e95c9c8ba7dcb90c117a67582ef97a` |      3 | 1.6000–1.6552 | 1.5521–1.5976 |
| Driller floor | `f5999c382c70c07559bbe87720273259462931e6725fe163112906382ad9cf11` |      4 | 1.6162–1.6410 | 1.5359–1.5478 |

The guide originally used the far edge of the exterior `y=-1`/`x=-1` cells as
its visible base, which made the first assembly leave a one-tile black moat.
The corrected guide keeps the exterior footprint and depth anchor but uses the
map-facing `y=0`/`x=0` edge as the art base. This is a guide correction, not a
source repositioning.

## Explicit alpha cleanup

Generated source pixels below alpha 16 are discarded before resampling. This
removes the red/yellow fringe instead of blending it into a runtime scene:
22,962 low-alpha samples on Cutting and 11,847 on Driller floor.

The sources also feather below their measured base. The packer applies the exact
playable-diamond mask to the candidate atlas and records every removed sample:
4,171 Cutting samples and 2,632 Driller-floor samples. That is roughly a
2–4-pixel anti-aliased base edge across the declared spans. The packer then
asserts that no surviving atlas alpha lands inside the diamond. These counts
must remain explicit in any final import record; do not call this an invisible
crop or use a source that needs material-face removal.

## Candidate crop registration and budget probe

The candidate JSON records the final non-overlapping source rectangles and the
runtime `x`, `y`, `width`, and `height` derived from each unchanged base anchor.
All seven generated rectangles fit the 2048-pixel atlas edge. A transparent
WebP probe of the full candidate atlas at quality 74 measured 111,528 bytes for
Cutting and 77,192 bytes for Driller floor: 188,720 bytes total, under the
219,666-byte two-map allowance. This leaves 30,946 bytes of variance, while
respecting the individual 120 KiB and 80 KiB allocations.

The full assembly previews show the only intended tall mass outside the
playable diamond. Cutting keeps its west-side approach; Driller keeps both the
central rear gap and west-side approach. No art is accepted for production until
the lead reviews those ignored assemblies and the exact cleanup counts.

## Final source assets

The lead approved the measured registration for runtime integration review. The
packer writes the final transparent atlases only when invoked with `--final`:
`public/art/maps/cutting-scene/exterior-rim.webp` at quality 80 (122,288 bytes)
and `public/art/maps/driller-floor-scene/exterior-rim.webp` at quality 78
(80,736 bytes). Their 203,024-byte total leaves 16,642 bytes of the two-map
allowance. Cutting's only extra cleanup is 1,533 semi-transparent amber pixels
within 1.25 pixels of its rear base; the targeted rule leaves opaque limestone,
timber, and all other foreground detail alone.

The final SHA-256 values are
`c1bbc1448da1808be962f23d8c2fc58c417397a0f1984d7324bde33c9d803e58`
(Cutting) and
`d6c087c037b212aea0e3d675c010538bcf4dd6bd7e441220aaffc911357a090e`
(Driller floor). The packer decodes each final WebP and asserts that every
declared source rectangle remains alpha-free inside the exact playable diamond.

[`quarryExteriorRims.ts`](../../src/content/scenes/quarryExteriorRims.ts)
contains the reviewed `SceneScenery` source metadata, including every runtime
crop, anchor, exterior footprint, and depth. It is deliberately unreferenced by
the scene definitions: gameplay owns opt-in and must provide a combined
Canvas/WebGL view with live props and actors before aesthetic acceptance.
