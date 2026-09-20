# Western gate proof result

Status: bounded structural proof PASS on integrated production
`5d5952fed1ded5f3eb485c68fee6b4994c98787a`, 18 September 2026.
This is not completed-gate visual acceptance. Gameplay owns integration, PR and
release checks; the capture freeze on port 4190 was released after capture.

## Delivered scope

Art source commits `fbdb86c9e3a0828da8f56ff2ae284417ca3f424f` (atlas and shoulders)
and `19754f64794b83cbba4cf89797b06de22e687124` (eight scene entries and assertions)
are integrated in the tested head. Gameplay supplied sourceRect and shared
fadeGroup opacity. Exactly x4..9/y0 plus (4,1)/(9,1) use the connected painting.
Cell (8,0) alone is fully hidden and retains a transparent metadata entry.
Other 24 wall instances, blocked footprints, hazards and live props are retained.
See [draft provenance](quarry-west-draft.md) for generation and packing details.

## Reviewed result

- Canvas and WebGL show a connected long face with reinforced end piers. No
  obvious atlas seams or detached base edges appear in the reviewed stills.
- Behind the west pier, the whole mass fades coherently and Kaya remains visible.
  Returning through the open passage to (5,1) restores the opaque interior face.
  Four-frame-per-second contact sheets from both original recordings support
  the transition review; this is not an every-frame temporal artifact audit.
- The shoulder dust softens the road boundary, but a straight cream band and
  conspicuous flat stone patches remain. Large empty fields, the other repeated
  cubic walls, small cart and legacy guard still prevent gate-wide acceptance.
- Landscape hazard views and portrait high contrast were captured. Portrait
  target focus largely excludes the western structure, so it does not establish
  a western portrait composition pass.
- Both deliberately missing-atlas cases retained 32 blocked wall cells and
  reported no page errors. Procedural fallback is present, but screenshots are
  under the entry curtain: this establishes bounded fallback operation, not
  polished or fully reviewed fallback readability.

## Evidence and validation

Local evidence root:
`C:/Users/Jared/.codex/worktrees/71bd/Avatar RPG/gallery/scene-audit/quarry-west-proof/`.
For each backend: entry, wall-west-side, wall-east-side, hazards, highcontrast,
portrait-highcontrast and missing-atlas PNGs; route/missing WebM originals;
metadata JSON; route contact JPG. The ignored directory README indexes evidence.
Executed harness: `gallery/scene-audit/scripts/quarry-west-proof.executed.ts.txt`.

Four browser cases passed in 23.7 seconds. Both main metadata files have empty
error arrays, null service-worker controllers and matching served/disk SHA-256
for all seven map assets. Captures used staged solo Kaya, seed
`gate-registration`, normal motion, oblique projection, 96px camera,
1672x941 landscape and 820x1180 portrait in desktop Chromium with touch enabled.
The first move to (3,2) used UI Move/tile/Confirm; subsequent traversal used legal
commands through (3,1), then (3,2)/(4,2)/(5,2)/(5,1). Runtime recorded 32 walls,
six ground layers, 12 oil cells and five live props. HEAD was unchanged after capture.

Art source `npm run verify`: 627 tests in 70 files plus typecheck/lint/format pass.
Gameplay reports integrated verify: 748 tests in 81 files, build and asset checks
pass; maps 3.26 MiB, precache 16.09 MiB. Gate artifacts total 419,672 bytes,
within the 650 KiB planning target. These are local results, not current PR CI.

No normal campaign-route, physical Surface/iPad, WebKit, audio listening,
reduced-motion, destruction, shove or oil-chain acceptance is claimed here.
No new assets, clusters, cutting/floor work or agents were added during review.
The next integration owner can retain this western proof while keeping broader
composition and the continuous village-to-quarry-and-back acceptance open.
