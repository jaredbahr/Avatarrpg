# ADR 0029: Faded scenery footprint cue

- Status: Proposed prototype only
- Scope: Oblique scene rendering when a depth-owned scenery group fades

When a `MapScene.scenery` group has opacity below 1, a renderer may draw a
subtle ground-plane cue from the exact `SceneScenery.footprint` cells. The cue
uses the existing footprint and `fadeGroup`; it adds no texture bytes, collision
rules, picking changes or new world geometry. It is drawn before upright scenery
and actors so the cue remains a ground reference while the occluder is fading.

The Canvas implementation must use the actual scenery camera when reading group
opacity and the ground camera when projecting the footprint. Pixi/WebGL must
use the same shared opacity values and a ground-root graphics layer. Both paths
must keep the cue derived from the existing footprint rather than a guessed
rectangle.

This remains a review-gated prototype. The southwest preview passed Canvas and
WebGL at fade 0.28, but the current dark outline reads too gridlike for release.
Evidence is in `gallery/scene-audit/quarry-southwest-proof/` under
`canvas-footprint-route-2-fade-028.png` and
`webgl-footprint-route-2-fade-028.png`. The former generic `*-route-2-fade-028`
paths were overwritten during this prototype and are not immutable comparison
evidence. Do not promote the prototype to production until the visual contract
accepts the cue or a better authored depth solution replaces it.
