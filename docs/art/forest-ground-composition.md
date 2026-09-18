# Forest ground composition pass

Approved envelope (gameplay and orchestration, 18 September 2026): one authored
plate, packed into the existing ground chunk URLs and world rectangles. Source
work stays local until the integrated checkpoint. Review at the current 96px
combat camera before any additional pass.

- Replace repeated fine grass texture with broad, quiet olive material masses.
- Wear road/grass margins only where road meets walkable grass, within 0.20
  logical tile on either side. Keep at least 0.60 tile of clear dirt across
  every one-cell lane. No intrusion into water, elevation, cover or tree cells.
- Two subtle worn tracks follow the existing route, without inventing paths.
- At cover (7,3) and (8,9), replace the rectangular limestone substrate with
  grass and an irregular dusty needle apron confined to that cell. Preserve
  rubble art, cover rules and live markers.
- Flat needle pooling uses existing tree footprints, with at most 0.20 tile
  spill into adjacent walkable grass. No new upright scenery or blockers.
- Keep exact eight-cell water and elevation masks, all pine placements/depth,
  Dema/discovery/exit/spawn access and the existing map-art budget.

The input is the exact `forest-ground-guide.svg`, rasterized as a technical
registration guide. The authored result must be checked against that guide;
image-generation instructions alone are not evidence of correct registration.

Before views: gameplay checkpoint fdce4c0, `.shots/forest-canvas-focus-actor.png`
and `.shots/forest-webgl-focus-enemy.png` in the integration worktree. These show
hard road seams, repeated mottling and rectangular cover underlay at play zoom.
The approved player-view references call for continuous paths, cohesive painted
materials and purposeful local detail; this pass addresses those ground issues.

Status: candidate packed locally; integrated acceptance is pending.

## Candidate provenance and technical registration

ImageGen source: `exec-be9eb245-18ce-4d27-b071-298861c82ee9.png`, under
`C:/Users/Jared/.codex/generated_images/01a0b2ee-8d60-7643-be9b-340997ca4ae0/`.
Input: exact ground registration guide. Prompt requested calm broad painterly
olive masses, narrow irregular road margins, subtle route wear, flat needle
pooling, grass-backed cover, and no new objects or geometry.

Native source is 1683 × 935. `scripts/art/forest-composition.ts` uniformly
reduces it to 1674 × 930 and splits it into two 837 × 930 WebP textures at
quality 88. World rectangles remain 1152 × 1280 at (-128,-192)/(1024,-192).
No packer upscaling, reframing or scene-registration change is involved.

The teal guide placeholder drifted up to 0.04813 logical cell beyond actual
water. The packer restores the original authored substrate throughout water
and elevation cells plus a 0.08-cell technical guard. Material selection uses
actual map rows, preserving the exact rule boundary. This copies pixels from
the prior authored atlas `exec-22de7f0e-aa14-4a25-babd-e401a920a86b.png`; it does
not paint substitute art. Existing detailed water and pine files are untouched.

An independent colour audit on the normalized plate detects 545 teal pixels
outside actual water before composition, and zero afterward; 35,301 pixels
use the protected substrate. The audit checks composed pixels with a separate
inverse-coordinate expression, rather than trusting the guard flag. It is a
pre-encoding audit, not a guarantee about lossy WebP boundary colours or the
visual softness of elevation/road edges. Those require integrated inspection.

The maps family is 2.86 MiB under the unchanged 4 MiB limit. Lower storage is
from replacing this batch's repeated swatches, not reducing other asset quality.
Candidate acceptance remains pending actual 96px gameplay review.

## Local elevation packing correction

The 0c7229b review found that the old atlas substituted across elevation created
an overly sharp/grainy stone patch and dark rim. The correction reuses the current
plate inside the existing elevation-plus-0.08-cell envelope. Exact map elevation
cells remain authoritative; source material is copied without changing rules,
scene registration or any water treatment.

Inside `^`, the current plate supplies the softer authored limestone. Outside,
the current plate supplies grass/road. A 0.02-cell exterior registration matte
copies the nearest same-terrain authored pixel at least 0.04 cell clear of the
stone boundary. This excludes the observed 0.01604-cell pale fringe without
inventing painted pixels. The colour diagnostic is not collision proof.

The pre-encoding before/after audit found 15,676 changed pixels, all inside the
previous elevation envelope, and 752 matte pixels. It throws if any change lies
outside that envelope. The separate water colour audit still reports zero spill;
water and its distant guard are outside the changed envelope. Source/packed sizes,
quality and world chunk placement remain unchanged. Lossy encoding can affect
nearby block pixels; this audit describes the uncompressed composition.

Before WebPs and pre-encoding before/after PNGs are preserved locally under
`gallery/scene-audit/elevation-packing/`. Directly inspected boundary crops show
the old grain/dark rim replaced by quieter warm stone. Final acceptance still
requires the combined actual-96px review with gameplay's permanent-rubble fix.
