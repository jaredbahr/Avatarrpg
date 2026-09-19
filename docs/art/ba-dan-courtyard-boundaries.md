# Ba Dan courtyard boundaries — composition candidate

Three deliberately placed low props frame the plaza: two limestone planted
beds and Gao's produce display. Gameplay reviewed all six proposed occupied
cells against NPC approaches, both exits, spawn and the five review destinations.
The shared scene exports `BA_DAN_COURTYARD_FOOTPRINTS`; integration applies these
as blocked movement but not blocked sight. The door approach at (9,4) stays open.

| Prop                          | Cells                        | Source image                                    |
| ----------------------------- | ---------------------------- | ----------------------------------------------- |
| West low planter              | (6,5), (7,5)                 | `exec-75df4dc5-d948-4227-bbaa-91387796f802.png` |
| East low planter              | (14,9), (15,9)               | Same planter                                    |
| Gao produce display           | (7,4), (8,4)                 | `exec-3718a459-3960-4e25-b83e-4854f6e0b048.png` |
| Quieter ground material atlas | Existing ground registration | `exec-636b0c65-63ae-4db6-bf4e-d46d070c9ed5.png` |

Original artwork generated with the built-in OpenAI image tool on 18 September 2026. Sources are retained in this task's generated-images directory. Same
licence/provenance as the existing original scene artwork; no external samples.

Generation direction: exact orthographic 2:1 projection for two-by-one props,
low limestone walls with compact olive/celadon shrubs and restrained yellow
flowers; warm oak trestle produce display with wicker trays of squash, pears
and apples, crates below and a single jar. Transparent background, no detached
scatter, people, text, roof or floor; broad matte shapes, brown ink, warm light.
The ground atlas requests four equal top-down quadrants: broad pale limestone
slabs, quiet desaturated meadow, calm teal water, honey-brown planks. It explicitly
avoids photographic detail, grain and noisy grass blades. This changes materials
while retaining exact logical pond and path registration.

Packing uses `scene-image.ts` with maximum width 512 for both props: alpha trim
and uniform downscale only. Source bounds were planter (104,92,1244,879) and
display (288,113,951,801). Packed dimensions are 512×362 and 512×431. Both use
192-world-pixel widths with their front ground corner registered at 63.5% width.
`ba-dan-ground.ts` packs the new atlas using the existing material mask.

These are composition candidates, not final visual acceptance. Review integrated
art together with collision geometry on both backends. Remaining straight
ground boundaries and worn door approaches still need assessment in that view.

## Height correction after integrated review

Runtime 30871ae showed oversized fruit and a counter near adult shoulder height.
The planter also read too high. Image-tool edits rebuilt shorter structures
instead of squashing images or shrinking collision footprints. The display uses
six shallow trays of smaller produce, shortened legs, low boxes and a smaller
jar; the planter uses one low masonry course and a flatter foliage mat.

Replacement sources: display `exec-0dfd3738-1b77-4df6-a30f-bb8ffbbce66a.png`,
planter `exec-24312925-8c29-4d28-aca0-797c356881b4.png`. Source alpha bounds are
(222,168,1094,704) and (93,199,1287,741), packed uniformly to 512×329 and 512×295.
World width stays 192; front-corner anchors are 69.5% and 67.5% respectively.
Frontage paints after houses on equal depth so the opaque shop does not bury
the display. All six logical occupied cells remain unchanged. Gameplay moves
Gao from the house interior to the visible door approach independently.

## Restrained northern ground edge

`north-grass-fringe.webp` is a flat grass/soil transition over the lawn bay's
existing seam, nominal logical bounds x10.05–11.95, y3.9–4.1. The projected
rectangle starts at (1404.8,446.4), width134.4 and height70.0875, preserving the
source aspect ratio. It adds no collision, scenery depth, obstacle or new path.
The neighboring door approaches at (9,4) and (12,4) remain clear. The main open
stone plaza keeps its quiet material; this is a single authored seam treatment.

## Additional garden and market edges

The composition reuses the calibrated low planter at (16,4)–(17,4) and produce
display at (13,4)–(14,4). These frame the northern house frontage, leaving its
(12,4) door approach, road rows 7–8 and named NPC approaches unchanged. The
existing shared footprint contract makes both solid to movement and transparent
to sight. No additional images or art bytes are introduced.

Root rejected the first display location at (17,9): tree canopies hid most of
it in normal play. The revised placement was reviewed on both forced Canvas
and WebGL in `19a9b46-modified` (the only source change was moving that display
to (13,4)). It remains visible alongside the house wall at the existing scale,
with clear paving in front. Normal walking from Gao to Pella and the homecoming
conversation still work; the shared reachability and content checks pass. This
accepts the bounded placement improvement, not full village activity or final
reference-target quality.

Original OpenAI image-tool source `exec-81e160ec-6de4-4313-9268-6031490d518e.png`,
18 September 2026. Generation requested a very thin, irregular transparent
olive/celadon grass and warm soil fringe in a 2:1 ground plane, long axis slope
+0.5; quiet hand-painted texture, no raised geometry, rocks, flowers, shadows,
characters or rectangular backing. Alpha bounds (49,209,1338,699), uniformly
packed to512×267. Existing original-scene art provenance applies.
