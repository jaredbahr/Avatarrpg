# ADR 0103: Top-down PixelLab art direction

**Status:** accepted for the tutorial prototype, 2026-11-05. The owner reviewed every step in motion and said: "This
is great. Write all this work to GitHub."

**Supersedes:** the oblique/isometric presentation of ADR 0065 and ADR 0102's choice of world, for new work.
ADR 0102's principle stands: one crisp pixel style, held by rules. The shipped game is unchanged until the port is
planned.

## Context

Three attempts to make the isometric, painted Ba Dan and its characters look like one game failed, and so did one
3D attempt. The record is in `docs/art-lessons.md`.

The owner paused the game on 2026-11-04 (#348), asked for a simple demo in a traditional top-down style made with
PixelLab, and iterated on it in motion until he approved it.

## Decision

- **View:** traditional top-down, front-facing 3/4 (low top-down). Houses show their front facades; every prop shows
  its front face and a shallow slanted top. There are no isometric diamonds and no plan views.
  - References: a front-facing cobbled harbour town and the game _Fountains_; Sea of Stars for the richness.
- **Everything is made with PixelLab, one family:**
  - **Characters:** `create-character-v3` at a 48 px canvas, 8 rotations.
    - Clips use `animations` in `skeleton-v3` mode, which poses the same sprite. Template and redraw modes drift.
    - **Kaya is v2:** her base, her walk and her idle and look-around. Bends are posed the same way.
    - Bandits, Sura and Bo are made the same way.
  - **Terrain:** 32 px Wang tilesets with scattered variants. Edges are drawn per pixel, so no boundary follows the
    tile grid.
  - **Objects:** `create-object-pro-flash` with `view: "low top-down"`, ONE angle reference image (the front-on
    oven) in every prompt, and the size stated in pixels against Kaya. Strip the grey ground plates PixelLab bakes
    under objects.
  - **Effects:** `/vfx`.
- **Grounding** is the owner's own system from his Imagination game, ported verbatim: `hardShadowMask` from
  `imagination/src/game/grounding.js`, with its per-kind options.
  - One shadow colour, `#322125`, with a hard edge and light from the upper left.
  - Every object gets an occlusion seam, a contact band and a short lower-right cast (12–24 px); a notch darker on
    paving.
  - Houses get plinths, wall-foot bands, doorsteps, eave shadows, and dirt and grass over the plinth edge.
  - Outlines are 1 px, in a darker tone of the material, never thick black.
- **The map edge:** the playable ground ends in a soil and rock cliff over a dark void (the owner's favourite part
  of the old Ba Dan). Trees root inside the lip, exits run off the rim, and the canal falls off it as a waterfall.
- **Combat:**
  - No grid overlay. Reach is a soft tinted area with an organic edge, with a footstep path and a destination ring.
    Targets get rings and area washes.
  - The real elemental rules (surfaces, reactions, statuses, effect order, forecast) are kept: the prototype ports
    them from `src/core/rules/`.
- **Review gate:** art is judged by the owner, by eye, in motion. The orchestrator first checks 3× crops against the
  rules above, before anything reaches him.

## Where it lives

`prototypes/topdown/`: a standalone build with its own tools, outside the game bundle, lint and format (see its
`README.md`).

- `badan-topdown.html` is the village; `forest-combat.html` is the ambush.
- `assets/` holds the PixelLab sources.
- `style.json` holds the style settings, and `ledger.json` every PixelLab job and its credits.

## Consequences

- **Port:** porting into `src/` is its own planned phase, with its own ADR covering the camera, tile size,
  renderers and the save format. The oblique-board rules in CLAUDE.md stay authoritative for the shipped game until
  then.
- **Next step:** the next prototype step is the whole tutorial, Ba Dan → Forest Road → quarry → the Driller, in this
  style.
