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

Each backend builds one viewport-sized alpha-mask layer every frame. Scenery
silhouettes are redrawn into it each frame, together with still props, current
actor frames and NPCs; nothing is cached across frames. The mask is unioned before a single `#1b1410` tint at fixed alpha, so overlaps do not
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

Canvas adds one viewport-sized temporary canvas. WebGL adds one half-resolution
render texture for the union mask; the visible scene still receives one shadow
composite.

Scenery shadows are a per-frame pass, not a cache. An earlier design extracted
static scenery into a cached world-space mask, rebuilt only when the scene or
scale changed. It was dropped for two reasons: it was frozen before streamed
scene art had finished loading, so pieces that arrived later never cast, and it
only covered the viewport it was built for, so panning lost pieces. Redrawing
each frame needs no size, offset or invalidation bookkeeping and always matches
the art currently on screen.

The cost is one affine-projected silhouette draw per scenery piece per frame, on
top of one per actor and moving/burning prop plus the composite. The largest
shipped scene, Ba Dan, has 69 scenery pieces (the quarry gate has 54, the forest
road 52 of which 45 cast, the quarry scenes 5 and 6). Off-screen pieces are
**not** culled: Canvas and WebGL both skip only pieces whose image or texture has
not loaded, or that set `castShadow: false`, and leave clipping to the
viewport-sized mask target. That is tens of cheap draws per frame, which was
judged acceptable; viewport culling can be added later if a scene grows to
hundreds of pieces. Shadows are always enabled;
the project has motion and contrast settings but no quality/reduce-detail
setting, and neither existing setting warrants removing a stationary lighting
cue.
