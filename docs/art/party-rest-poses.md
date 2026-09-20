# Courtyard party rest poses

The accepted Nima pilot (ADR 0025) extends in small reviewed batches. Each hero
gets three optional exploration poses in unused cells of the existing atlas;
combat, walking, frame dimensions and feet anchors retain their prior contract.
The packer compares all twenty previous frames pixel-for-pixel before writing.
Riverside-specific outfit sheets do not inherit the normal-outfit rest clips.

## Batch one: Kaya and Sura

Original OpenAI image-tool artwork, 18 September 2026. Identity references were
the corresponding `assets/reference/character-poses/{name}.png` sheets, inspected
before generation. Same original-art licence/provenance as the existing units.

| Hero | Source                                          | Direction                                                                                                         |
| ---- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Kaya | `exec-237ea828-1268-48ff-bdce-4db2ecc6760f.png` | Preserve high ponytail, red/brown outfit, gold edging, charcoal trousers and wrapped boots.                       |
| Sura | `exec-6095b891-aca9-43e4-a58d-004d7b32fe33.png` | Preserve long dark hair, muted blue robe, cream crossing collar and patterned hem, sash, pouch and wrapped boots. |

Shared prompt requirements: three equal cells in one transparent horizontal row;
relaxed screen-right three-quarter, up-right rear and down-right front poses;
adult proportions, equal body height, natural hip-width stance with hands down;
elevated orthographic camera, fine brown ink, flat cel base and one shadow tone,
warm upper-left light; no effects, ground shadow, scenery, text or combat stance.

Packing uses `rest-poses.ts`, uniform shared pose scale per hero from the original
idle height, then the established foot baseline. All forty pre-existing frames
were unchanged. Unit family size after this batch: 3.92 MB of the 4 MB budget.
Integrated stop/turn/walk review is still required before accepting this batch.

Batch one was reviewed in runtime f142f72 on Canvas and WebGL at 1672×941 and
820×1180, including sampled walking, turns and fully resting groups. Identity,
body height and ground contact held in those views. This is bounded pose review,
not approval of the whole reference target or a physical-device claim.

## Batch two: Bo and Wen

Same image-tool workflow, date and provenance, using each character's canonical
pose reference. Bo source `exec-1f1d052b-608f-40df-9704-ae52561f7c3c.png` preserves
his clean-shaven face, sturdy build, olive tunic, ochre sleeves, cream trousers
and brown wraps. Wen source `exec-c4777a2c-f585-4bcf-bf1b-8dd6233310ce.png`
preserves blond hair, goggles, blue-grey work jacket, pale shirt, tool belt,
charcoal trousers and the mechanical gauntlet on his right arm in all views.

Both prompts use the same three relaxed directional poses and visual constraints
as batch one. Bo's hands stay low; Wen's heavy gauntlet rests beside his thigh.
Packing again confirmed all forty previous frames unchanged. Integrated actual
scale and transition review remains required for this second batch.
