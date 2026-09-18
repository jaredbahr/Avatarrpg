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

Ground panels crop the same8px inset, then downsample to284x284 before reflected
sampling through unchanged exact map masks. Ground output remains864x960 per
chunk. Wall output remains256x352 per module; original prism clipping/fringe
cleanup is retained (933 clipped/633 keyed pixels). New --walls-only mode avoids
restoring the rejected wholeplate. Cover timber output is byte-identical.

Ground+cover141,376 bytes, walls80,106 bytes. Map family3.07MiB, props0.25MiB;
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
