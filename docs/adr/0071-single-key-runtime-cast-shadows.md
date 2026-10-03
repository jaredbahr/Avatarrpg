# ADR 0071: Single-key runtime cast shadows

## Status

Accepted.

## Context

The approved quarry view uses one warm upper-left key. Every upright figure,
prop and structure answers with a longer down-right cast, while feet and wall
bases retain a separate close contact shade. Existing runtime shadows were
terrain-dependent actor ellipses and a footprint fringe of fixed length, so
height, silhouette and overlap were lost. Generated assets also cannot safely
own cast shadows because actors move and reusable scenery changes context.

## Decision

`src/render/lighting.ts` owns the screen-space key, bible-ink shadow colour,
fixed alpha, reduced/fallen strengths and the foot-anchored affine projection.
The projection sends every source pixel down-right in proportion to its height
above the foot line. It applies unchanged to orthographic and oblique cameras:
both keep upright art vertical in screen space and only their ground mapping
differs.

Each backend builds one alpha-mask layer. Static scenery is cached by scene and
camera scale. Current actor frames, NPCs and props are added dynamically. The
mask is unioned before a single `#1b1410` tint at fixed alpha, so overlaps do not
double-darken. Water receives shadows like other ground; this keeps a bridge,
bank or figure from losing the light direction at a shoreline. Contact pools
remain separate and now appear under combat actors on every terrain, with grass
retaining its stronger density and fallen actors using a fainter cast.

`castShadow: false | 'reduced'` is presentation-only metadata. It suppresses
low/flat art or reduces the projected layer when a legacy source already has a
painted contact pool. It never changes footprint, sorting, picking or rules.

Renderer-drawn raised geometry follows the same key with warmer top planes,
darker away-facing planes and a short ink base band. These are flat bands, not
gradients.

The approved quarry reference was measured with paired 5×5 samples beside
three blocks and one crate. Rec.709 code-value luminance gave shadow/lit ratios
of 0.769, 0.816, 0.956 and 0.784: 0.831 overall, or 0.790 for the three clear
deep casts (the 0.956 sample is a weak noisy edge). Runtime therefore targets
about 0.80. A 0.24 bible-ink composite predicts 0.785 over pale quarry stone
(`#d8cbb0`) and 0.794 over forest dirt (`#b39064`).

Pixel inspection found no painted directional cast in the village tree,
dwelling, forest pine/alder/lodge, quarry wall, Driller, rubble, cart, planter,
merchant display or rear-loading pieces; their dark undersides/contact pools
are not casts, so all receive full strength. Only the low deadfall, old nest
and bank reeds opt out. No shipped piece currently uses reduced strength.

Raised tiers and blocked wall cells contribute projected south/east top-edge
bands to the same union mask. This covers renderer-drawn height that has no
sprite silhouette; authored upright quarry walls and platforms continue to
contribute their alpha silhouettes.

## Consequences

Canvas adds one viewport-sized temporary canvas and one cached static canvas.
WebGL adds one render texture for the union mask and one cached static texture;
the visible scene still receives one shadow composite. Static extraction occurs
only when the scene or scale changes. Per frame, cost is one silhouette draw per
actor and moving/burning prop plus one composite. Shadows are always enabled;
the project has motion and contrast settings but no quality/reduce-detail
setting, and neither existing setting warrants removing a stationary lighting
cue.
