# ADR 0015: Scenic pacing and grounded animation

The second riverside pass still read as figures on a painting. Walking was
110 ms per tile with a cubic ease across the entire route, causing a fast
middle sprint. The village's drawings advanced on a separate ambient clock.

Exploration now uses 280 ms per tile with short acceleration and braking ramps
and an even cruising speed. Leader and followers use the same `partyWalked`
presentation track; followers do not duplicate the leader's footstep sounds.
The village consumes the animator's distance-based clip time through RenderUnit,
so held walk drawings slow with the feet. Combat movement retains its pace.
Reduced motion still collapses playback, and rule events, routes and saves do
not change.

The riverside layer projects each illustrated pose's alpha silhouette onto the
ground. Foot anchors stay shared by the drawing and shadow. One reusable,
frame-sized canvas composites shadows, warm ambient colour, cooler painted-tree
shade and bending light; there is no growing frame cache or pixel readback.
Additional planter, bridge-edge and reed masks use the existing art-space depth
contract. Party labels appear for actions and concealed figures; their names
remain available in the HUD. This remains manually registered 2D scenery.

One form clock now drives the drawing, weight transfer, light and effects. Water
wraps behind and in front of the torso before flowing outward. Fire has a shorter
release, a pointed warm silhouette and a bright core. Both settle and shed a
finite trail. Combat gains longer anticipation and recovery with less scaling.
The release pose is held throughout projectile flight and hit-stop, fixing an
idle gap before recovery. Melee's cast fallback now respects compatible named
wind-up/strike frames instead of showing only the last cast drawing.

To retain the 300 KB JavaScript budget, PixiBackend creates WebGLRenderer directly.
The facade already chooses WebGL or the game's Canvas backend; Pixi's Application
was adding a redundant backend chooser, unused engines and a second ticker.
The backend owns a Container stage and explicitly destroys stage then renderer.
The rendering contract and the Canvas fallback are unchanged. Both backends and
scene destruction are covered by the required browser and screenshot checks.

Validation targets uniform cruise speed, slower exploration with synchronized
followers, continuous attack poses, compatible melee fallbacks, form settlement,
shade registration, the actual composed scene and both browser backends. Longer
riverside browser waits account for the deliberately longer routes.
