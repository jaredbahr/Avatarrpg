# Western quarry structure draft checkpoint

Historical checkpoint: superseded by the [integrated proof result](quarry-west-proof.md).
The wiring and grouped-cutaway blocker below were resolved and reviewed there.
The remaining text records the original draft, not current instructions.

Original status: LOCAL DRAFT, not wired into QUARRY_GATE_SCENE, not ready for release or
visual acceptance. Stop at this checkpoint under the usage-conservation request.
Do not run another full capture or expand to other clusters this session.

## Current artifacts

- `public/art/maps/quarry-gate-scene/west-structure.webp`: continuous western
  gatehouse painting split into ground-depth-owned atlas regions,1024x1543,
  197,736bytes,2px transparent gutters.
- `src/content/scenes/quarryWestFrames.ts`: eight candidate entries with agreed
  image-pixel sourceRect and projected-world destination rectangles; exact
  footprints/depths for x4..9/y0 and(4,1)/(9,1). NOT referenced by scene content.
- `scripts/art/quarry-west-guide.ts`: exact technical volume/surface guide.
  Rise144worldpx along the long face,160left pier,208right pier. No open-cell
  structure or ground obstacle added. Technical diagrams are not shipped art.
- `scripts/art/quarry-west-pack.ts`: registers source alpha bounds, clips to the
  guide's projected solid surfaces and assigns each pixel to one visible depth
  owner; packs a single page. Source is normalized to1024x832 over world
  x896..1408/y-32..384. No new painted pixels or fabricated hidden faces.
- `scripts/art/quarry-ground-pack.ts`: optional third input adds authored flat
  shoulder dust only along the western x0..10 road edges y5/y7, within12worldpx
  perpendicular distance. Rule boundaries remain unchanged. The two draft ground
  files were regenerated with this input; these are not yet reviewed in runtime.

## Blocking cutaway finding

The tall near pier fully occludes some rear-cell surfaces in the source view.
A connected visible painting cannot provide unseen backfaces when its foreground
slice alone fades. The generated metadata marks fully hidden cells with a1x1
transparent atlas region while retaining the exact footprint/depth. Independent
slice fading would tear holes in the mass and must NOT ship.

Proposed next contract: optional fadeGroup identifying one connected mass;
compute the current overlap test per visible slice and apply the minimum opacity
to every slice in that group. Eight candidate entries already label
`quarry-west-structure`, but this field is NOT implemented or accepted by the
runtime. Gameplay sourceRect work is separate; grouped cutaway is deferred at
root's conservation request. Keep the scene unwired until the group contract,
alpha-mask tests, missing-atlas fallback and actual actor traversal pass.

## Original art and packing evidence

Built-in ImageGen source directory:
`C:/Users/Jared/.codex/generated_images/01a0b2ee-8d60-7643-be9b-340997ca4ae0/`.

- Structure: exec-632dba14-e6d0-46d0-ad72-18c2bdf27369.png,1374x1145.
  Prompt: paint the exact technical eight-cell guide as a continuous worn quarry
  retaining mass; uninterrupted bonded long faces, taller reinforced end piers,
  chipped warm limestone, flush timber and iron, no floor/shadow/door/extra props.
  Approved quarry image supplied for material language, not gameplay geometry.
- Shoulder: exec-c2a01ace-1707-4872-a46b-00f529a7c2bf.png. Prompt: one long narrow
  horizontal true-alpha strip of flat oatmeal/taupe dust, ragged brush edges,
  embedded chips/scuffs, no raised rocks/shadow/geometry. Existing final material
  sheet supplied as palette reference.
- Ground base remains exec-b65fb7e8-f4b0-4fbc-bdfe-11ff7b453c0d.png;
  cover remains exec-99f58bdf-66be-4d8b-886c-ca9d8967e096.png.

Registered source visually inspected before checkpoint. Cleanup removed3,402
saturated generator-fringe pixels; guide clipping removed4,178 of470,528 opaque
normalized pixels;4,674 guide-interior pixels have alpha below64. These small
silhouette insets/mismatches require actual in-game inspection, not a claim of
perfect registration. Visible draft has connected rough long faces and end-pier
identity; it has not established reference-like playable composition.

Ground+cover141,830bytes, western atlas197,736 and retained24wall modules80,106:
gate artifact total419,672bytes, below650KiB planning target. Three old module
files remain required by the other24walls. Shoulder affected32,106 native ground
pixels; cover is unchanged. Per-family and source checks recorded in handoff.
No integrated build/precache or new runtime capture is claimed for this draft.

Reproduction: run quarry-west-guide.ts, render its technical SVG toPNG for source
registration inspection; quarry-west-pack.ts takes the structure source path.
quarry-ground-pack.ts takes final material, timber and shoulder source paths.
Generated intermediates/ownership guides are in ignored art/raw/quarry-west.

Next session: finish grouped cutaway, wire exactly these eight entries, inspect
same-camera entry and front/behind/interior traversal on both backends, then
judge the single western cluster. Only after that review extend the language to
other gate clusters. Cutting/floor remain out of scope.
