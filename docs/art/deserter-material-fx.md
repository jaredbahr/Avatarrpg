# Deserter material effects

Base `b036c59`, branch `codex/deserter-material-fx`. This bounded follow-up makes
the existing fire attack and oil flask leave the illustrated actor's hand while
preserving their ground-targeted impacts. It does not change the actor art,
bandit scale, rules, targeting, surface cells, sound or attack timing.

The shipped 128 × 192 cast frames give the deserter gather palm at (69,64) and
release palm at (115,54), facing right. `actorAttachments.ts` applies the existing
mirror, pose scale/offset and elevation geometry; the original procedural rig
remains the fallback. In choreography these abilities opt into source attachment
only. Victim torso attachment remains reserved for the existing direct techniques.
Ground impact and area tracks are byte-for-byte equivalent to the prior recipe's
tracks in the focused test; empty target tiles remain valid presentation targets.
Gather particles finish before release as in the existing hand-attached path.

Oil Flask previously reused the pale 0.85-tile boulder cel. Its replacement reuses
`public/art/props/flask.png`. Since 2026-09-30 that is the PixelLab prop-family flask
([prop-family-v1.md](prop-family-v1.md), SHA256
`f5472617eb03a70e2ce4f01ec9dbb82c59d217dd8e459ba98a3afdf41e27d215`); the cels were
repacked from it with the same script.
No new image generation, repainting, keying or upscaling occurred. Exact source
pixels and alpha are cropped at nonzero alpha and centred into four 192px cells;
the vessel's alpha bounds are 69 × 102px (from 2026-09-30; 86 × 118px before). There is no detached
ground shadow. The four cells intentionally repeat one rigid object; the existing
seeded projectile spin supplies tumble rather than morphing the bottle.

Reproduce with `node --import tsx scripts/art/flask-cels.ts`. The resulting
`public/art/fx/flask-cels.png` is 768 × 192 and 27,597 B (58,423 B before 2026-09-30). The 0.3-tile head makes
the vessel about 17.7px tall at 96px zoom and 11.8px at 64px before rotation.
The existing lob arc 0.7, speed 16, dark droplets/shards and ground oil spill stay
unchanged. A small dark droplet is the existing primitive fallback when the FX
image cannot load. The palette and geometry do not depend on image availability.

ADR 0021 supplies the existing four-cell FX contract. This adds one registered
clip and sheet without new fields, texture
dimensions, backend code or timers. Nine primitives plus thirteen four-cell clips
occupy 61 of 64 slots in the same shared 1024px texture. Both renderers use that
texture; reduced motion continues to suppress the emitters. All budgets remain.

See the [handoff](../coordination/handoffs/deserter-material-fx.md) for actual
stationary-cast evidence, final validation, and the exact integrated-budget caveat.
Existing generated-project-art credits cover the reused prop; no additional
generation or exclusive copyright claim is made.
