# Generator notes

The packs are written to work in any current image generator. These are the
features that matter, in order, and what to do without them.

## What matters

1. **A flat background you can name.** A portrait prompt asks for exactly
   `#f4e9d8`. Most generators get close but not exact; a near miss is fine for
   portraits, because the HUD crops to a circle and the parchment shows only
   as a rim. If a tool cannot hold a flat colour at all, generate on plain
   white and fill the background to `#f4e9d8` in any image editor before
   saving. A sheet pose asks for exactly `#00ff00`, which is keyed out; when
   the generator lands near it rather than on it, `art:normalise --key auto`
   reads the colour it actually produced from the corners.
2. **Image reference or "character consistency".** Essential for sprite
   sheets, where eleven poses of one character must match: every frame is
   generated with the character's reference figure
   (`art/raw/reference/<assetKey>.png`) as the image reference, one clip at a
   time. The ten heroes' portraits are generated from the same figure, so the
   sprite and the portrait are one character. The NPC speakers' portraits have
   no figure yet; for them consistency is per image.
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

Three per portrait, and as many as it takes per sheet frame. Pick with
`checklist.md` open. The most common reasons a good-looking candidate fails:
black outlines, a gradient in the background, a soft "painted" cheek, a tattoo
or emblem the prompt did not ask for. For a sheet frame, add: a ground shadow,
a swirl of the element round the body, and a face that has drifted from the
reference figure.

## Maps

A map painting is the one asset generated from a picture as much as from
words: the pack's layout image is the grid as flat colour blocks, and the
generator has to keep every edge in it where it is. Use image-to-image or a
structure control with the layout upscaled to the delivery size first, at a
strength high enough that the road, the pond and the ledges stay put and low
enough that the blocks become painted ground. The prompt carries the scene;
the layout carries the composition. Even light and no vignette are not
taste, they are the contract: the game shades the board's edges itself.

## Where things go

- Raw candidates: `art/raw/portraits/<name>-1.png`, `-2`, `-3` (git ignores `art/raw/`)
- The pick, downscaled: `public/art/portraits/<name>.png`
- Reference figures: `art/raw/reference/<assetKey>.png`
- Sheet poses: `art/raw/<assetKey>/<clip>/<index>.png`, then `npm run art:normalise`, `art:pack`, `art:validate`
- The manifest line: in the pack's header table
