# Handoff — the art bible as one visual contract

Owner: Claude Sonnet 5 docs worker under the OpenClaw avatar-supervisor,
21 September 2026. Branch `claude/design-contract`, worktree
`C:/Users/Jared/.codex/worktrees/design-contract`, base `e4c317e` (`origin/main`).
Documentation only: no source, test, CI or asset change.

## Why

Jared reports that models working on this game keep losing the design language.
One structural cause was in the docs themselves. `docs/art-bible.md` opened with a
camera table whose View row reads "three-quarter top-down, about 30° above
horizontal", while `docs/player-view-target.md` and ADR 0039 define the shipped
renderer as an axis-aligned grid with oblique painted references and forbid
rotating or skewing finished art to reconcile projections. A generator that read
only the art bible could produce a different perspective from one that read the
reference PNGs, and nothing in the art bible said which rule governed the world.

## What changed

- `docs/art-bible.md` gains a **Visual contract (read first)** section: checkable
  bullets for the modular illustrated world model, the projection rule, uniform
  `#1b1410` outlines, two tones plus rim light, no gradients or photo texture,
  the palette lock to `src/render/palettes.ts` and `src/styles/base.css`, the 85 %
  baseline, readability at 40 px, hidden grid seams, and the compact-dock HUD rule.
  Each bullet links to the document that decides it.
- The camera and frame table keeps every number (128×192 frame, 4× generation,
  85 % feet line, margins, mirroring) and gains a note that the View row is the
  **character-sprite generation camera only**, not the world projection, and must
  not be used to justify rotating or skewing world art.
- No approved direction changed. Nothing in the references, ADR 0039 or the
  player-view target was edited.

## What the validator enforces

`scripts/art/validate.ts` (the art bible's step 5 still names it `validate.mjs`;
the module is TypeScript) checks: every required clip and frame name exists in
its atlas at the declared size, atlas dimensions stay inside 2048 px, every
`image` entry's file exists with the declared format, and no opaque pixel sits on
a frame's outer margin rows and columns (`hasOpaqueBorder`, lines 44-60).

It does **not** check the palette lock, the outline colour, the two-tone rule, the
rim light, or the feet baseline. Those remain review-only rules. A palette
spot-check against `src/render/palettes.ts` would be the cheapest addition; it
is not in this change.

## Contradictions left open

- The art bible's figure section still describes placeholder painters
  (`src/render/painters/figure.ts`, `cast.ts`) as stand-ins. Real character sheets
  are a product decision, not a docs fix.
- `finish-through-driller.md` and `player-view-target.md` carry two different
  milestone tables (six delivery steps versus six presentation milestones). They
  do not conflict on the route, but a reader has to know which one is current.

## CI cost

One branch push and one pull request. Docs only; the required checks run once
on this head. No re-run, no dispatch.
