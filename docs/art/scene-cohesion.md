# Scene cohesion: Ba Dan first

## Direct visual audit, 18 September 2026

All three approved `assets/reference/player-view-2026-09-17` images were viewed
directly. Baseline captures were taken from main `c486457` at 1672 by 941,
matching their landscape proportions. Five heroes, Canvas backend, motion enabled;
story nodes were entered directly for scene inspection. This is not evidence of
a complete campaign playthrough. Local captures are under
`gallery/scene-audit/current/` (village, forest, quarry return, quarry gate battle).

The three largest gaps, in priority order:

1. **Composition and scale.** Current scenes fit the whole axis-aligned board
   between blank side margins. Adults are approximately 45–55 screen pixels tall,
   compared with roughly 110–140 in the village reference. The reference crops
   into a place; the current camera exhibits a board. Merely tilting the existing
   painting cannot fix this.
2. **Environmental depth.** Four empty overhead house interiors, repeated grass,
   square pools and dark pit squares dominate the current maps. The reference
   has full roofs, visible facades, planted edges and foreground overlap, with
   continuous paths between useful places. Scenery needs separate upright layers
   with ground registration and occlusion, rather than additional baked objects.
3. **Figure integration.** Painted adults share the scene with thick cartoon
   markers, a toy-sized machine and weak contact shadows. Sideways party rows
   flatten their relationship to the space. Adult scale, camera angle, lighting,
   foot anchors, facing and occlusion must agree across scene components.

The city reference supplies architectural density, material consistency and
foreground framing only. This milestone adds no city content. Reference faces,
costumes and interface text do not override the game's authored characters/state.

## Shared production contract

Gameplay owns the projection, picking, camera, both backends, map geometry and
the architectural decision record. Art owns painted sources, packing and
`src/content/scenes/baDan.ts`. The agreed starting ground basis is X=(64,32),
Y=(-64,32), origin=(1024,0) for the 24 by 16 logical map. Tile-center foot anchors
are `((x-y)*64+1024, (x+y+1)*32)`. This basis is a calibration, not visual
acceptance. The camera must still be compared with the approved composition.

Normalized ground bounds are 2560 by 1280. Optional padding is 128 left/right,
192 top and 64 bottom, yielding 2816 by 1536. No individual texture may exceed
2048 in either dimension: split ground images and retain upright scenery as
separate transparent textures. Scene image rectangles are in projected world
pixels; they are not skewed again. Scenery includes logical footprint and a
foremost ground depth anchor. Roofs fade when they obscure the party or path.

The first coherent scene unit is the merchant/Mira courtyard. Preserve access
to speakers and exits; existing empty-box geometry may change with gameplay's
save reconciliation and navigation checks. Paintings must not promise blocked
paths or hide water/cover that changes rules. Do not bake people, interactive
objects, labels, shadows belonging to moving actors, or interface into ground.

Warm upper-left light, desaturated jade roof tiles, cream plaster, worn timber,
ochre stone and restrained brown linework establish the environment palette.
Adults keep existing identities and plausible proportions; no childlike heads
or oversized tools. Ground shadows stay close under planted feet, with the
cast direction consistent with walls. Foreground roofs and foliage must overlap
figures in both backends, while fading preserves target/path readability.

## Motion and listening acceptance

Static screenshots cannot establish motion or sound quality. Capture an actual
walk into the courtyard, around a wall, behind a roof/canopy and back into view,
including all screen-direction changes. Inspect contact/passing poses, sliding,
follower spacing, foot registration and occlusion transitions at regular frames.
Then capture a quarry move and material attack with anticipation, release,
impact and recovery. Aiming, projectile path and victim reaction must agree.

For listening QA, record an audible gameplay sequence with footsteps, interface
confirmation, one sling shot, a heavy strike and the machine under ambience.
Listen at Normal and Quiet for recognizable material, hit alignment, masking,
repetition and abrupt scene changes. Scheduling tests and waveform analysis
can establish ordering/clipping only; neither proves sound is coordinated or
pleasant. Physical Surface/iPad speakers and Safari sound unlock remain manual
acceptance. No listening acceptance is claimed by this audit.
