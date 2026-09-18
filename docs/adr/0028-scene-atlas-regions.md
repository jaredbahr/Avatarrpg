# ADR 0028: Depth-owned scene atlas regions

Status: accepted technical contract; structural gate art awaits visual review.

The quarry gate needs continuous authored walls while retaining one independently
sorted slice per existing blocked cell. Thirty-two separate image files would
exceed the scene image cache; one whole-building sprite would sort incorrectly.

`SceneImage.sourceRect` optionally names `{ x, y, width, height }` in integer
source-image pixels. Origins are nonnegative and dimensions positive. The existing
`x/y/width/height` remain projected world-pixel destinations. Omitting the crop
draws the whole image exactly as before. Footprints, depth anchors, ground
projection, elevation, picking and rules do not change.

Atlas pages are at most 2048 pixels on either side. Each packed slice has a
two-pixel transparent gutter outside its source rectangle: gutters are neither
stretched into the world nor sampled for cutaway. Packing must verify separation
and exactly-once ownership of the continuous painting. Schema validation checks
rectangle shape; runtime checks loaded-image bounds and atlas dimensions. Invalid
or missing regions remain unavailable so both backends retain procedural terrain
and blocked-cell decoration. Existing uncropped images retain their size contract.

Canvas crops directly. Pixi owns one texture source per scene page and caches
non-owning rectangular views. Unused views are destroyed without their source;
image replacement, scene departure and teardown destroy all views before the
owned page. The cache follows the active scene, uses no global Pixi cache, and
does not increase the existing 16-image scene cache or 32-scenery-instance limit.

Cutaway crops before downsampling to a 128-square alpha-only mask. Weak image
keys release masks with their decoded page; a 32-region LRU per page bounds
reuse (16 KiB per mask). Neighboring packed artwork cannot make another slice
fade. Existing actor-depth, animated-position and nearby-NPC logic remains shared
between Canvas and Pixi.

The initial gate delivery keeps all 32 depth-owned slices: eight new western
cells plus 24 existing cells. Ground edge transitions may extend only within the
approved 12-world-pixel decorative band; they cannot invent collision or move
the legal boundary. These authoring invariants and the two-pixel gutters require
packing validation; the runtime rectangle schema cannot infer them from pixels.

Focused tests cover crop/schema rejection, Canvas source/destination separation,
independent slice alpha, mask reuse/eviction, shared Pixi source ownership,
replacement and disposal. Actual Canvas/WebGL traversal, target picking,
missing-atlas fallback and composition still require the structural milestone's
browser and visual review. No production build or budget acceptance is implied;
the next integration build must retain the existing 300 KiB main-JS budget and
art/precache limits.
