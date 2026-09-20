# Quarry gate mask repair and moving-review handoff

The wholeplate on integrated runtime `4e7788b` is rejected. Its correct aspect
ratio and scenery metadata did not preserve semantic ground locations. The
replacement selects authored material texels through exact map-row masks and
places four separately packed low timber decals. Gameplay owns integration;
source work stays local for cherry-pick into the single integrated checkpoint.

## Source changes

- `scripts/art/quarry-ground-pack.ts`: inverse-projection material packing from
  authoritative `QUARRY_GATE` rows, with no wholeplate warp or invented geometry.
- Two replacement ground WebPs plus one transparent cover WebP; six ground
  entries total. All 32 wall assets/anchors remain unchanged.
- Cover registration test checks the map's actual four `c` cells. No map rows,
  props, hazards, exits, spawns or runtime movement rules change.
- Provenance and original rejection: `docs/art/quarry-gate-registration.md`.

Packed ground and cover total 168,142 bytes. Art-family budget check reports
maps 3.08 MiB, units 3.98 MiB, portraits 3.96 MiB. No budget increases or other
asset quality reductions. Source verification: typecheck, lint, formatting and
627 tests pass; art validation and asset budgets pass. A source budget read
against an existing dist directory is not a new integrated precache build.

## Visual evidence and limits

Local ignored evidence root:
`gallery/scene-audit/quarry-gate-mask-repair/`.
`semantic-overlay.png` composites the actual packed WebPs and outlines all
4 cover, 36 elevation, 12 oil and 36 road cells. It was visually inspected.
`packed-ground.png` and `mask-audit.json` preserve the unlabelled result and
coordinates. Material edges align; cover is inside each exact diamond.

This is alignment repair, not finished visual acceptance. Material-mask edges
are sharp, shallow elevation has no raised lip, and reflected material patterns
can repeat. Existing walls remain pristine relative to the quarry target.
Review actual 96px integrated play, high contrast and live oil/props on both
backends before any further map or cosmetic generation.

## Moving baseline: candidate before pacing fix

`gallery/scene-audit/moving-4e7788b/{canvas,webgl}/` contains full-page
`normal-route.webm`, separate `audio.webm`, `route-log.json` and desktop Mira
dialogue screenshots. Gameplay froze source `5aaf7e1` with runtime revision
`4e7788b`; service worker was blocked and controller null. Runtime script URLs
are recorded. No new per-module runtime hash audit was performed during this
capture, so the freeze owner's runtime identification is an explicit dependency.

The uninterrupted route uses actual New game and character setup, village taps
to (7,6) and (10,6), native Talk Mira, all dialogue buttons, the east village
exit, forest story/encounter crossings and two combat Move/tile/Confirm actions,
then End turn and the AI turn. No scripted `enterNode` or gameplay state edits
stage the route; the logged opening `enterNode` is dispatched internally by
normal game setup. Settings enable ordinary motion and Normal volume.

Both recordings stop after the harness fails to select a later Round 2 move
target. This is unresolved automation targeting, not proof of a game defect.
There is no successful player cast/impact/recovery capture in this baseline.
The JSON records command events and 40ms pose/position/camera samples. No page
errors were recorded. Desktop Mira's existing portrait is visible; mobile CSS
portrait correction belongs to writing/gameplay.

Direct frame inspection of the WebGL two-cell walk shows rapid travel through
wide stride and narrow passing poses into the wide combat stance. The motion
exists but its short duration limits readability. Gameplay's proposed slower
ordinary-combat walk is the bounded first correction; compare the same short
and longer turning path after it, then cast/recoil/recovery. Do not spend the
remaining unit budget on extra frames before this comparison.

Audio was captured from the game master through an added capture-only bridge.
It has not been listened to here. Recorded cues and signal presence establish
technical evidence only; timbre, balance and perceived impact remain open.
The browser video and audio have separate capture clocks and must not be used
for frame-exact audiovisual timing without explicit alignment.

The runtime freeze was released after these captures. No cutting/floor work,
wall regeneration, PR push, CI claim or merge is included in this source handoff.
