# Generator notes

The packs are written to work in any current image generator. These are the
features that matter, in order, and what to do without them.

## What matters

1. **A flat background you can name.** The prompt asks for exactly `#f4e9d8`.
   Most generators get close but not exact; a near miss is fine for portraits,
   because the HUD crops to a circle and the parchment shows only as a rim. If
   a tool cannot hold a flat colour at all, generate on plain white and fill
   the background to `#f4e9d8` in any image editor before saving.
2. **Image reference or "character consistency".** Not needed for portraits,
   where consistency is per image. Essential for sprite sheets later, where
   twelve to sixteen poses of one character must match: generate a reference
   sheet first and feed it back as the reference for every pose.
3. **Resolution.** Generate at 1024×1024 or larger and downscale to 512×512.
   Downscaling tightens ink lines and hides small generation noise; upscaling
   invents texture, which the checklist then fails.
4. **No "enhance" or upscaler passes.** They add gradients and sharpening
   halos. If the tool applies one by default, turn it off.
5. **Negative prompts.** Where the tool takes one, the pack's negative prompt
   removes the usual failures (black outlines, gradients, text). Where it does
   not, the positive prompt already states each rule, so nothing is lost.

## Steering without names

Do not add a series title, studio or character name to make the style land.
It is the one rule that cannot be bent: the packs describe the look in plain
visual terms, and `src/content/prompts.test.ts` fails on a list of names. If a
candidate drifts toward a recognisable character, change the signature element
(hair, garment cut, an object in hand) rather than the wording of the style.

## Picking a candidate

Three per portrait. Pick with `checklist.md` open. The most common reasons a
good-looking candidate fails: black outlines, a gradient in the background, a
soft "painted" cheek, a tattoo or emblem the prompt did not ask for.

## Where things go

- Raw candidates: `art/raw/portraits/<name>-1.png`, `-2`, `-3` (git ignores `art/raw/`)
- The pick, downscaled: `public/art/portraits/<name>.png`
- The manifest line: in the pack's header table
