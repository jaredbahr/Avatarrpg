# Art lessons: what failed, and what worked

The owner, 2026-11-05: "Remember to write failures in the project so we learn from them." Read this before any art,
animation or presentation work. Add to it when something fails.

## Failures

### Style and pipeline

- **Painting the world and redrawing characters to match it.** The isometric Ba Dan was one painting; the figures
  were AI-redrawn again and again to fit it. They never matched ("two different hands"), and each per-frame redraw
  made the frames boil and drift.
- **Repairing AI frames with automatic patches** (texture transfer, palette locks, per-part fixes). Each fix added a
  new artifact.
- **The cel-shaded test:** rejected.
- **3D-to-pixel** (a Blender model, code animation, a pixel shader). The motion was consistent, but the procedural
  model read as a doll. Charm comes from the model, and the renderer cannot add it.

### Animation

- **Judging animation by metrics.** #411's 8-cel walk met every number (a 1 px bob, cel timing) and looked worse to
  the owner; it was reverted in #425. Never ship motion that no one has watched on video at game zoom.
- **A code "motion layer" on posed sprites** (bob, stride offsets, coat springs): "overcompensating", "too fluid". It
  reads as puppetry. Keep the posed walk.
- **Rewording a walk prompt** barely changes `skeleton-v3` output. The gait comes from the base sprite's silhouette:
  a wide coat means a wide stance.
- **Slimming the base to fix the gait** changed her identity (it lost the long coat). The owner kept v2.
- **Asking for an "upright posture"** made her stiff ("something stuck up her butt").
- **An idle written as "breathing"** came out as gasping; the model also drew grey breath puffs. Keep idles barely
  visible.

### Grounding, angles and the scene

- **Houses on pasted grass islands**, props without shadows, and cobble as big rectangles: "floating", "stickers".
- **The agent's own shadow projection** (long silhouettes): dark smudges, invisible on cobble. The owner's
  Imagination `hardShadowMask` fixed it.
- **An agent reporting fixes that weren't visible** (v8: "grounding applied", nothing showed).
  - The orchestrator must render 3× crops and check them before forwarding.
  - Prefer measurable checks: shadow contrast at least 25%, zero halo pixels, no straight terrain edge longer than
    2 tiles.
- **Generating props one by one:** mixed angles (flat versus 3/4), mixed pixel density, thick black outlines, and
  PixelLab-baked grey ground plates under objects.
- **A code-composed bridge** read as a ladder seen from above. Generate structures with PixelLab, with an angle
  reference.
- **A grid overlay in combat** "pulls from the visuals".
- **Small misplacements:**
  - lamp glows offset from their lanterns;
  - a cat path over props;
  - trees rooted on the cliff edge;
  - a laundry line in a flower bed.

  Check the placement of every animated overlay and route.

- **The tutorial pass (2026-11-05):**
  - A flat floor tileset came back as cracked paving and tiled into a visible grid. Prompt "no cracks, no slabs, no
    pattern", and never swap per-tile variants on a flat floor.
  - Authored surface blocks (mud, rubble) stay square unless their edge noise is slow and wide. Draw ellipses, not
    rectangles, for anything that can show once the ground goes dark.
  - A fallback terrain class makes a halo; the strongest class must win. Noise alone opens specks.
  - The single shadow colour has a floor: on dark moss `#322125` cannot be 25% darker than the ground.
  - Evenly spaced small flames read as wallpaper; mixed-size clumps read as fire.
  - A side-wall strip sampled from the outline read as a thick outline. Sample the material.

- **The quarry polish (2026-11-05):**
  - One Wang tile sampled by modulo is wallpaper; the quarry rock showed a tuft in a grid. Quilt plain tiles in warped
    regions with flips, turns and offsets, and never leave one baked feature (a pebble) in a quilt source tile.
  - A `create-tiles-pro` set of 16 tiles held only 2–4 distinct looks. Don't count tiles as variants.
  - Cell-field blends leave straight edges. Union jittered round blobs and fade the noise inside so no holes open.
  - Measure straightness as the eye sees it (chains within 3 px), not exact pixel runs; the run check passed edges
    that looked ruler-straight.
  - A cell of another kind under a road (oil, a pool) cut the road straight. Class the terrain by the ground beneath.
  - A string replace on a repeated expression hit the wrong line and shrank a pool. Re-view every board after a
    shared edit.
  - The camera framed the midpoint of actor and target, so the boss was cut off. Big sprites need a fit-in-frame rule.

### Characters and objects

- **"No effects" in a `skeleton-v3` prompt is a hint, not a rule.** Fire and earth got painted into strike frames;
  check every strike heading. A custom strike clip can also drift identity in its middle frames.
- **Mirrored rows swap hands.** Use PixelLab's own headings.
- **The angle reference also fixes pixel size.** "88 px" came back 58 px wide. A boss needs a bigger canvas and a
  relative size ("more than twice as tall as a person"). For a vehicle, accept the south view and let PixelLab
  rotate it.

### Process

- **Codex drafts piled up** (24 at once, none ready). Reviewers skipped drafts; duplicate PRs and issues followed.
  - GitHub is the source of truth: one PR per issue.
  - "Ready" means only the AGENTS.md checks.
- **A sweep session drifted into art work** and spent the art budget without the owner. Scope standing sessions
  tightly.
- **A push before `ci:local` finished:** a chained shell command pushed on failure. Gate pushes on the exit code.
- **The PixelLab key is shared with other projects.** Account the credits from each job's own usage, not from the
  balance.
- **Committing evidence:** videos and screenshots in git history are permanent. Attach them to PRs instead.
- **Unsafe filenames:** the first scan looked for `:` only and found 1,536 files; spaces, commas and `@` made it
  3,794. Scan for every unsafe character, and prove the rebuild is byte-identical after a rename.
- **Object animation jobs return at once and log 0 credits.** Re-poll them to book the real usage.
- **Stills can lie:** a "before" and an "after" were shot at the same moment. Check timestamps, and watch the end of
  every video (an epilogue card once drew over the board).

## What worked

- **PixelLab's own character pipeline:** `create-character-v3`, then `skeleton-v3` posing, gives consistent faces
  and colours across frames and directions.
- **One style anchor and one angle reference image** in every object prompt, plus the size in pixels.
- **The owner's Imagination rules**, ported rather than reinvented: `grounding.js` and `ART_DIRECTION.md`.
- **Small, reviewable steps:** one video, one question, then iterate.
- **Read-only diagnostics before fixes**, and before/after crops of the exact spot the owner complained about.
- **Porting the real game rules into a prototype** instead of describing them again (the combat forecast runs the
  rule on a copy).
