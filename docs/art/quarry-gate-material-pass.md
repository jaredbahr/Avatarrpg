# Quarry gate material and cart pass

This is a bounded material improvement, not approval of the finished quarry.
The source changes preserve all registered masks and wall anchors. Gameplay
owns integration and the single checkpoint PR.

## Delivered appearance

- Ground shifts from orange dust/cool gray stone to a related taupe, oatmeal
  and warm putty palette. Small flat brush marks replace cloudy broad fields.
  Generated raised chips were rejected after the first runtime preview because
  they read as obstacles. Final ground has no discrete raised stones.
- Wall faces have chipped corners, tool wear and dusty irregular surfaces.
  The same three modules retain their exact prism silhouettes and anchors.
- The live cabbage cart uses gray-brown worn timber, iron straps and olive
  produce. Its square-frame limits increase from80%/72% to94%/81% width/height;
  actual source aspect determines final size. Wheels move down23px in its256px
  frame to meet the runtime shadow; forward shafts use the lower clear margin.
  Sprite key, collision, cover, pushability, damage and destruction are unchanged.
  It still reads small; gameplay will evaluate a bounded presentation scale.

## Sources and reproduction

Built-in ImageGen only. Source directory:
`C:/Users/Jared/.codex/generated_images/01a0b2ee-8d60-7643-be9b-340997ca4ae0/`.

| Source                                        | Use                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| exec-5365df75-2a64-49aa-93b6-eab7f538d77d.png | Three wall modules edited from prior registered wall source with approved quarry screenshot as material reference |
| exec-b65fb7e8-f4b0-4fbc-bdfe-11ff7b453c0d.png | Final three equal material panels,2172x724                                                                        |
| exec-6b301c99-d305-49af-b6a4-1706cb832800.png | Worn produce cart edited from existing cart with quarry style reference                                           |

Wall prompt: retain exact three-prism composition/camera/outer silhouette;
replace pristine masonry with chipped warm limestone, bonded irregular courses,
tool marks and dusty joints; same palette/light, no outside rubble/props/shadow.
Ground prompt sequence: three equal square full-bleed fields of compacted taupe
quarry earth, oatmeal road dust and putty flat limestone; no layout or props.
Simplify granular detail, then remove all raised stones/shadows and reduce crack
contrast. Cart prompt: same two-wheel cabbage hauler and forward shafts, worn
large wheels, iron straps, gray-brown planks and olive produce, true alpha,
no people, floor or shadow. Original character/prop identities preserved.

Rejected intermediate materials: exec-6f7ec7c2-6748-4197-a586-dc17deb31a2d.png
was too granular and exceeded the240KiB ground allowance; simplified
exec-064b5ddd-df74-4bfa-833d-e087907e58b6.png still had raised-looking stones and
obvious repeated marks in runtime. Neither is shipped.

Commands from repository root (SOURCE means the directory above):

```powershell
node --import tsx scripts/art/quarry-pack.ts --walls-only SOURCE/exec-5365df75-2a64-49aa-93b6-eab7f538d77d.png
node --import tsx scripts/art/quarry-ground-pack.ts SOURCE/exec-b65fb7e8-f4b0-4fbc-bdfe-11ff7b453c0d.png SOURCE/exec-99f58bdf-66be-4d8b-886c-ca9d8967e096.png
npm run art:prop -- cart SOURCE/exec-6b301c99-d305-49af-b6a4-1706cb832800.png
```

Ground panels crop the same8px inset, then downsample to128x128 before reflected
sampling through unchanged exact map masks. One repeated field is now one ground
diamond wide at the registered plate scale, so the flat limestone reads under an
actor rather than as a multi-tile slab. Ground output remains864x960 per chunk;
the registered1152x1280 page coordinates, masks, wall anchors and timber anchors
are unchanged. Wall output remains256x352 per module; original prism
clipping/fringe cleanup is retained (933 clipped/633 keyed pixels). New
--walls-only mode avoids restoring the rejected wholeplate. Cover timber output
is byte-identical.

Ground+cover143,374 bytes, walls80,106 bytes. Maps family3.86MiB, props0.25MiB;
all4MiB family budgets unchanged and passing. No other asset is degraded.

## Actual runtime review

Ignored evidence: `gallery/scene-audit/quarry-gate-weathered-preview/`.
An isolated detached runtime worktree at ebcaa8e served4196 with only these six
asset replacements. This is explicitly a preview overlay, not a clean integrated
commit. Gameplay4190 was untouched. Both staged Canvas/WebGL cases passed14.2s:
SW blocked/null, six map asset SHA256 values match preview disk,32walls/6ground
entries/12oil tiles/5live props,96px camera. Real Move/tile/Confirm reached3,2;
subsequent legal commands traverse3,1 then5,1 for opposite wall-side captures.
Entry, both wall sides, hazard region, high contrast and portrait screenshots
plus original silent route recordings and metadata are retained.

Visual review confirms a quieter shared palette, rougher wall faces, grounded
cart wheels and retained live hazards. Sharp semantic field edges, visible
wall-module repetition, shallow elevation, undersized cart and the legacy
procedural guard remain gaps against the reference. No hazard-chain/destruction,
normal-route, physical device or overall scene-quality approval is claimed.
Gate remains the scope; cutting/floor expansion is not included.

## Paving-scale follow-up

The same source panels are packed at a128px repeat instead of284px. A projected
ground diamond is128px wide, so this makes individual flat limestone pavers read
under a standing actor rather than as a few multi-tile slabs. The exact map mask,
864x960 source pages, registered1152x1280 destinations, wall anchors and timber
cover anchors are unchanged. Re-running the pack from the recorded source is
deterministic; the repaired pages are68,868 bytes west and68,436 bytes east.

Ignored comparison evidence is at
`gallery/scene-audit/quarry-gate-paving-scale/assembled-before/` and
`gallery/scene-audit/quarry-gate-paving-scale/assembled-after/`. A disposable
detached preview based on5d5952f overlaid the current gate scene, west and
southwest frame registrations, and gate assets; it did not alter the gameplay
worktree or port4200. Staged solo Kaya at `battle_quarry_gate` passed in Canvas
and WebGL at1368x912 with normal motion and no page errors. The before/after
frames hold the same actor, camera and map position. The repaired field keeps
the paved-area boundary while replacing actor-sized slabs with smaller pavers;
no obvious repeat grid was found at the review camera.

The quarry watch and Workers' tea station remain procedural painter fallbacks.
Sen intentionally shares Gao's person and portrait art in the current slice;
dedicated watch, Sen and tea-rest assets remain a later quality gap rather than
an identity reuse patch.

## Edge-treatment candidate provenance

Source: `C:/Users/Jared/.codex/generated_images/01a0b2ee-8d60-7643-be9b-340997ca4ae0/exec-8dcfcdb5-eeb3-485c-a1c7-5cfd6279580d.png`, SHA-256
`d15b808ab498c4521d73892d887ce2fedc54243008e0c92f9750c976e67a64f9`.
Repack with `node --import tsx scripts/art/quarry-ground-pack.ts art/raw/quarry-gate/floor-treatment-source-v1.png SOURCE/exec-99f58bdf-66be-4d8b-886c-ca9d8967e096.png`.
The source is a 1536 by 1024 six-panel sheet. The packer crops a 24px panel
frame, samples dirt/road/shelf at 256/128/192px repeats, and selects every
base/transition pixel only from the authoritative rows. Material transitions
remain within 12 world pixels; wall contact is independently limited to 6 world
pixels, with unchanged wall footprints, cover anchors, pages and destinations.

The isolated Canvas/WebGL actor review accepts the road and shelf transition
direction, but does not claim final world-target acceptance: broad mirrored dirt
chevrons remain a minor open quality issue. Repack deterministically before
integration and retain the existing c0918c8 pages as fallback.
