# Fire deserter runtime handoff

- **Updated:** 2026-09-19 10:33 UTC, quarry composition art owner → root integration.
- **Outcome:** Replace the procedural quarry-gate fire caster with original adult
  red/brown illustrated art, an opposed-leg/arm walking pair, unarmed casts and
  matching initiative/HUD portrait. No rules, FX, camera, geometry or timing change.
- **Location:** `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-fire-deserter-runtime`,
  branch `codex/fire-deserter-runtime`, base `8c91b74`. Root's two documentation
  fixes are carried as `18eb34f` (equivalent `100197b`) and `d284994` (equivalent
  `37210c6`); do not integrate those duplicates. Deserter source checkpoint was
  already in the base and must not be cherry-picked again.
- **Acceptance:** Root reviewed source and actual Canvas96/WebGL96 walking pair,
  matching face, material and ground contact. Simple two-contact mirrored motion
  is accepted for this bounded asset; no full directional or whole-route claim.
- **Implementation:** Manifest sheet and portrait keys, nine-slot atlas, matching
  portrait, original source/edit prompts, deterministic importers, fallback mapping,
  three focused tests, local-only Playwright review and credits. Detailed provenance
  and exact reproduction are in [the art review](../../art/fire-deserter-runtime.md).
- **Budget:** [ADR 0035](../../adr/0035-fire-deserter-art-budget.md) raises units only
  from 4.5 to 4.75 MiB. Units 4,835,087 B, remaining 145,649 B. Portraits 4,176,622 B,
  remaining 17,682 B under unchanged 4 MiB. Other family limits, 25 MiB precache
  and 300 KiB JS caps unchanged. Asset check 17.37 MiB; JavaScript 299.3 KiB.
- **Verification:** Full verify passes 834/98, art validation, build, asset and
  JS budget pass. Atlas and portrait repack byte-identically. The 8-case runtime
  matrix covers Canvas/WebGL × 64/96 × normal/reduced. Both backend failure cases
  at 96 pass with atlas and portrait requests aborted. No push, CI or version bump.
  No physical tablet review performed in this task.
- **Evidence:** Worktree-relative `.shots/deserter-counter-swing-runtime` contains
  all eight cases with build `8c91b74-modified`; `canvas-96-normal/motion-136ms.png`
  and `motion-272ms.png` show both contacts. Matching WebGL96 `motion-272ms.png`
  and `webgl-96-reduced/motion-81ms.png` show the corrected arm and reduced endpoint.
  `.shots/deserter-final-fallback` captures build `d284994-modified` on both backends.
  Every folder contains visible build evidence and exact commands/poses in
  `provenance.json`. This is an explicit legal reducer fixture on real gate terrain,
  not manual control of an enemy or a completed route. Earlier candidate evidence
  is preserved under `.shots/deserter` and `.shots/deserter-fallback`.
- **Known gaps:** Existing pale Oil Flask projectile and Fire Blast palm attachment
  remain separate FX work. Other bandit scale is not corrected here.
- **Transfer:** Root owns integration and current PR. No other worktree edited.
  Port 4265 server stops with the local review; no listener remains. Raw source art
  is committed outside public/precache. Ignored captures remain at the paths above.
  Outgoing owner relinquishes asset editing after final commit handoff.

## Next-pass FX and bandit-scale audit (read-only, 2026-09-19)

Root integrated the asset as `c66f0f9`. This audit does not hold the present
coherent release. No FX implementation, generation, build or server was started.
The clean `1f6fc72` source and actual captures remain valid for these unchanged
contracts; `git show c66f0f9:src/app/anim/choreography.ts` confirms the same
attachment allowlist at root's integration revision.

### Observed defects and exact causes

- **Fire Blast launches from ground space.** In
  `src/app/anim/choreography.ts:315`, only `fire_jab`, `water_whip` and `air_blast`
  opt into `attached`. Fire Blast therefore receives neither cast-gather nor
  cast-release attachment; the travel emitter retains the logical caster centre.
  `src/render/geometry/actorAttachments.ts:18` also lacks a measured deserter palm
  pair in `CAST_HANDS`. Merely enabling attachment would otherwise use the generic
  procedural rig, which does not match the new illustrated release palm.
  Evidence: `.shots/deserter-final-1f6fc72/webgl-96-normal/motion-1898ms.png`.
- **Oil Flask is literally the boulder effect.** `src/content/fx.ts:1195` maps
  `fx.enemy.oil` to `stone()` plus dark droplets. `stone()` at line 715 is the
  authored `boulder` cel at 0.85 tiles, fixed stone material, no spin. This produces
  a pale slab almost as wide as the actor, not a thrown flask. Its launch also
  lacks a hand attachment. Evidence:
  `.shots/deserter-final-1f6fc72/canvas-96-normal/motion-1000ms.png`.
- **The other gate bandit is undersized.** Decoded idle alpha (threshold 8) is
  121px tall in both `public/art/units/thug.png` idle frames: 90.75px at 96 zoom,
  60.5px at 64. The deserter is 151px: 113.25px / 75.5px respectively. That is
  19.9% less height, or a 1.248 correction factor to adult scale. Bruiser idle is
  also 121/120px, despite `src/content/enemies.ts` describing a large adult.
  The normalizer's historic default, `scripts/art/normalise.ts:152`, computes
  `round((163 - 8) * 0.78) = 121`. This is normalization history, not authored
  short stature: the thug prompt calls him a rangy man and his story describes
  quarry labour. Actual comparison:
  `.shots/deserter-final-1f6fc72/webgl-96-normal/actual-gate.png` (or the 64px
  view in `.shots/deserter-counter-swing-runtime/webgl-64-normal/actual-gate.png`).

### Smallest coherent candidate, not yet implemented

1. Add a measured gather/release palm pair for `unit.enemy.deserter` in
   `actorAttachments.ts`, using the shipped 128 × 192 cast frames. Existing
   sockets already account for mirroring, pose offsets/scales, elevation and
   frozen launch snapshots on both backends. Keep its procedural fallback.
2. In `choreography.ts`, opt Fire Blast and Oil Flask into **source attachment
   only**, with the directed release facing. Fire Blast gather may use the
   measured gather palm. **Do not simply add them to `attached`**: that also
   selects a victim torso at line 366 and translates impact emitters at line 577.
   Both abilities target `blast(1)`; Fire Blast's explosion/area and Oil Flask's
   spill must still land on the selected ground tile. Keep their range, real
   reducer results, flight speed/arc, sound/impact clocks, pose recovery and
   reduced-motion suppression unchanged. Empty target tiles must still work.
3. Reuse `public/art/props/flask.png` (15,713 B) as the original terracotta vessel.
   Pack a small four-cell FX strip through the existing `FX_CELS` /
   `FX_CEL_SHEETS` contract in `src/content/fxCels.ts`, using deterministic reuse
   and downsampling only. A single rigid vessel may repeat in those four slots;
   existing seeded projectile rotation supplies its tumble. Replace only the
   oil recipe's boulder head with this flask, target roughly 12–18px visible body
   at 96px zoom, and retain its dark droplets/shards and ground spill. Use a small
   dark drop fallback if its image fails. This needs no image generation, new
   emitter fields, backend shader or texture-size change. The shared atlas has
   9 primitive cells + 48 authored cels = 57/64 slots; this adds four, reaching
   61/64. Verify the source's bottom edge does not carry an airborne ground shadow.

Do not fold the bandit scale correction into this FX change. A subsequent scale
decision must account for the existing 1.25 Forest Road marker presentation and
avoid enlarging it twice. Adult normalization or a scoped combat scale could both
solve the mismatch, but raw-source availability, pose margins, attachment scale,
fallback and all usages must be checked before choosing. No archetype/gameplay
stats or logical footprint should change.

### Required evidence and budget constraints

- Extend `src/app/anim/choreography.test.ts`: deserter Fire Blast/Oil Flask have
  source attachments and unchanged ground destinations/impacts, including empty
  tiles; verify release facing, captured pose scale/offset, timing and reduced
  motion. Extend `src/render/geometry/actorAttachments.test.ts` for measured palms,
  both facings/projections/elevations and placeholder fallback.
- Extend `src/content/fx.test.ts` for a single bounded flask projectile, no boulder
  cel in oil, unchanged speed/arc, and atlas capacity. Test deterministic repack
  plus failed FX-image fallback. Existing particle sampling/backends share the
  same geometry, so avoid introducing a separate renderer path.
- Reuse the legal-action fixture in `e2e/deserter.review.ts`; compare release,
  mid-flight and impact at 64/96 in Canvas/WebGL, both facings, normal/reduced.
  Include a bare-ground target. Show fire leaving the actual palm and a small
  terracotta vessel landing on the selected tile; surface cells and AP must match.
- JavaScript currently measures 299.3 KiB / 300 KiB; only about 0.7 KiB remains.
  Data registration plus the existing source-attachment path should be much
  smaller than a new particle primitive/loader, but no compiled byte delta is
  claimed without a candidate build. Measure exact `check-bundle-size.mjs` output
  before acceptance. Keep JS 300 KiB, every family limit and total precache 25 MiB
  unchanged. FX currently uses about 1.40 MiB / 4 MiB; measure the derived strip's
  actual bytes. No unit art regeneration or units-budget change is needed for FX.

This is next-pass planning. Existing movement repair and release delivery remain
root's priority. Source worktree stays clean after this documentation commit,
and port 4265 remains stopped.
