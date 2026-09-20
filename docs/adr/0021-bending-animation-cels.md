# ADR 0021: Hand-drawn bending animation cels

Status: accepted, 2026-09-18.

The bending recipes already describe casting, aimed travel, impact and affected
tiles. Procedural particles alone made too many techniques look alike, especially
ice, healing, shields and advanced earth techniques.

## Decision

Keep the event timeline, deterministic sampler and both rendering backends.
Particle emitters gain an optional `cel` clip id. Four transparent effect sheets
provide twelve clips of four drawings each. `src/content/bendingCels.ts` assigns
casting, projectile, impact and area silhouettes and sizes to all 43 current
bending techniques. The existing recipe keeps its aim, flight speed, hit timing,
cracks, whips, bolts, debris and sound. Cels replace generic glow clusters rather
than adding another full particle cloud.

The source sheets are 768 by 576 pixels, with 192-pixel square cels and nine-pixel
gutters. On load, their drawings are baked beside the existing nine particle shapes
in one 1024-pixel shared canvas atlas. Pixi uses the same source texture for its
particle containers, so the coloured artwork does not add a texture switch per
particle. It refreshes that source when decoding finishes and unregisters the
refresh listener when destroyed. Canvas reads the same atlas frames without
retinting the artwork.

One-shot effects sample four cels across their lifetime. Flame, wind, boulder,
metal and healing loops use twelve cels per second on the emitter clock. There
is no independent timer, so direct seeks, dropped frames and pauses stay stable.
Ice, water crests and stone eruptions keep a ground anchor; directional flames
and wind follow the aim. Air remains translucent. Reduced motion suppresses
these emitters through the existing choreography path.

The old `cell` remains the fallback until a sheet decodes, including on a failed
load. A missing or incorrectly sized sheet cannot interrupt combat. The asset
validator checks the grid, nonempty cels and clear gutters. Browser tests cover
all techniques on both backends and blocked image requests. The gallery captures
the four core releases plus lightning, waves, ice, healing, metal, walls, cyclone
and shield forms.

## Consequences

The runtime atlas grows from 288 to 1024 pixels per edge, a 4 MiB RGBA source;
art adds approximately 1.4 MiB to the existing offline precache. The existing
4 MiB art-family, 25 MiB precache and 300 KiB JavaScript budgets still apply.
Particle caps are unchanged. Rules, save files, ability balance and character
sheets are unchanged. New bending techniques must choose an authored effect in
the coverage table; the content test rejects an unassigned technique.
