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
