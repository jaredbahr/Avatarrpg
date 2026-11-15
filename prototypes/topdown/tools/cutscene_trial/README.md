# Cutscene trial: "the fifth bowl"

One trial cutscene made on 2026-11-15 to see whether animated pixel-art cutscenes suit this game (owner: "maybe").
The clips and frames are not in the repo (evidence stays out); the owner has both passes. These scripts are the
recipe, so the work can be picked up.

## Recipe that worked

1. **First frame of each shot:** `/create-image-pro-flash` at 192 x 108, `no_background: false`, with a style image
   (a crop of `public/art/portraits/mira.png` for the first shot, then the previous shot's frame). 6 credits a call.
2. **Motion:** `/animate-pixminimax`, 12 frames, 1 credit a call. Say what moves and what stays still.
   `/animate-with-text-v3` (3 credits) drifted the whole frame and was rejected.
3. **Assemble** at 4x nearest-neighbour, 8 fps, hard cuts (`assemble.py`, `assemble2.py`).

Run every job through `pl.run(..., region='cutscene_trial')` so the cost lands in the ledger.

## Cost

Pass 1: 32 credits (3 shots). Pass 2: 18 credits (2 shots redone, 1 added). A six-shot cutscene is about 40 to 60.

## What is still wrong

- **No real face shot.** Pass 2 animated Pella's existing portrait: on-model, but grinning with a cabbage on a
  blank card while saying "Five" about her missing brother. A cutscene needs a new close-up drawn for the moment
  (right expression, the square behind her) that still matches the portrait. This is the untested hard part.
- Orange streaks appear on the wall late in the last shot.
- Generated frames are slightly softer than each shot's first frame.

## Files

`common.py` (shared helpers), `s1.py`, `s2.py`, `s3.py` (pass 1 shots), `s2b.py`, `s3b.py` (pass 2), `anim.py`,
`anim2.py` (motion), `assemble.py`, `assemble2.py`, `strip.py` (strips and contact sheets). They write to a scratch
folder, never into the repo.
