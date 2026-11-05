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

## What worked

- **PixelLab's own character pipeline:** `create-character-v3`, then `skeleton-v3` posing, gives consistent faces
  and colours across frames and directions.
- **One style anchor and one angle reference image** in every object prompt, plus the size in pixels.
- **The owner's Imagination rules**, ported rather than reinvented: `grounding.js` and `ART_DIRECTION.md`.
- **Small, reviewable steps:** one video, one question, then iterate.
- **Read-only diagnostics before fixes**, and before/after crops of the exact spot the owner complained about.
- **Porting the real game rules into a prototype** instead of describing them again (the combat forecast runs the
  rule on a copy).
