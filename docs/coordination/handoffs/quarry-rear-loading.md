# Quarry rear loading art

Art owner: quarry composition. Gameplay scene/map registration owner:
combat preview. Root owns integration. Isolated branch `codex/quarry-rear-loading`
starts at `c8f8b06`, in
`C:/Users/Jared/Documents/ChatGPT/Avatar RPG-quarry-rear-loading`.

## Bounded result

One original shallow closed rail-loading strip, packed as an alpha WebP through
the existing scene-image contract. No additional machine, cart, hoist, opening,
stairs or interactive prop. No gameplay, collision, map, schema, manifest,
renderer, unit art, version or budget change. The source/provenance and deterministic
packer are committed with the public art. No push or CI dispatch.

See [art notes](../../art/quarry-loading.md) and
[exact source prompt](../../art/quarry-loading-source.json).
Existing quarry artwork supplied the visual palette but had no suitable rail
crop. Repeating its existing wall/hoist would not provide the intended loading
context, so root approved this single generation.

## Registration transfer

Public URL: `art/maps/driller-floor-scene/rear-loading.webp`, 512×344, 40,086 bytes.
Packed alpha bounds at threshold 8: x11, y15, width496, height308. Keep the image
padding in the registration rectangle. Source/output hashes are in the art note.
Root approved exterior logical x14..19, y[-1,0] and low approximately 48-pixel
relief. This avoids flattening the mixed heights of playable row 0. Gameplay
retains exact `SceneScenery` rectangle, depth, exterior footprint and registration.
An initial measured rectangle near x1652, y382, width370, height249 aligns the
front-bottom edge to the rear border; it remains subject to actual visual review.

Root accepted source direction in `.shots/quarry-loading/packed-on-grey.png`, which shows correct alpha
compositing and the closed buffers. `packing.json` records source/output hashes
and dimensions. These paths are local evidence beneath this owned worktree.
The tracked original PNG and prompt preserve reproducibility across machines.
No browser server has been started for this art-only checkpoint.

Actual scene composition, ground contact, rear-gap preservation, occlusion and
64/96 Canvas/WebGL acceptance belong to the combined registration review by
gameplay/root. This source checkpoint is not a claim of runtime acceptance.

## Validation

- Deterministic repack reproduced the same 40,086-byte output and SHA-256.
- `npm run verify`: 843 tests in 102 files pass, including typecheck/lint/format.
- `npm run art:validate`, `npm run build`, `npm run check:assets`, and
  `node scripts/check-bundle-size.mjs` pass.
- Map family: 4,058,450 bytes; 135,854 bytes remain under 4 MiB. No other art
  family changes. Precache: 17.47 MiB under 25 MiB.
- Production JS: 306,909 gzip bytes with the new precache entry, leaving 291
  bytes under 300 KiB before gameplay's registration. No product TypeScript
  was changed in this art task. Root must remeasure the combined revision.

The asset is ready to transfer for registration. No server was started and
port 4265 remains unused by this task. Runtime acceptance remains pending as
stated above; the source direction alone does not establish final composition.
