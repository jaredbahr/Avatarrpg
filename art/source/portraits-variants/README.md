# Portrait variants: a sample for the owner to pick a route

Nothing here ships. It is a comparison so Jared can choose how the dialogue portraits get variety ("so it's not the same
portrait every time"). The shipped 512 px painted portraits stay the standard: on 28 October 2026 the owner approved
their softness (recorded in `docs/art-bible.md`) and stopped the pixel-portrait rebuild. No rollout until a route is
picked. ADR 0092 is reserved for the chosen route's runtime and budget change.

Test cast: Kaya, Mira and the bandit thug (`portrait.enemy.thug`).

## What the sample holds

| route                        | what it is                                                                 | Kaya           | Mira | Thug |
| ---------------------------- | -------------------------------------------------------------------------- | -------------- | ---- | ---- |
| neutral                      | the shipped portrait, unchanged                                            | yes            | yes  | yes  |
| **A** expressions            | the shipped bust with only the face repainted (inpaint inside a face mask) | angry, worried | warm | none |
| **B** pose and framing       | a different gesture, head turn or prop                                     | none           | none | none |
| **C** pixel bust (reference) | a 128 px bust; here a **scripted reduction**, not a redraw                 | yes            | yes  | yes  |

The gaps are the credit cap (about 60 generations for this sample), not failures; the costs are below.

## Review files (`review/`)

| file                                     | what                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `sheet.png`                              | one row per character; columns neutral, A, B, C (512s at half size, C at 2x nearest)            |
| `faces-2x.png`                           | each A face crop beside the shipped one at 2x nearest: the seam and line weight are judged here |
| `dialogue-kaya-neutral.webp`             | the real dialogue scene, 1368x912 at 2 device px per CSS px, shipped portrait                   |
| `dialogue-kaya-a-angry.webp`, `-worried` | route A in the scene (the shipped file swapped on the network; no game code changed)            |
| `dialogue-mira-neutral.webp`, `-a-warm`  | Mira, `mira_intro`                                                                              |
| `dialogue-kaya-c-pixel.webp`             | route C in the scene; drawn through today's smoothing (see faults)                              |

Captures: `npx playwright test -c playwright.portrait-variants.config.ts` (`e2e/portrait-variants.review.ts`), then the
PNGs re-encoded as WebP at quality 90.

## Recipe (route A)

Only PixelLab is available in this environment (the originals came from an OpenAI image tool). Every call goes through
`tools/pl.py`, a copy of party-g1's client writing to this folder's `ledger.json`. Run from this folder with
`python3 -I`; `PIXELLAB_API_KEY` must be set and is never printed.

1. **Mask** (`tools/mask.py`): a white oval over the brows, eyes and mouth (or the whole face) on a black 512 canvas.
   Committed in `masks/`.
2. **Inpaint** (`tools/gen_expr.py CHAR MOOD SEED`): `/inpaint-v3` on a square **crop** of the shipped portrait around
   the face (`cast.json` `crop`: x, y, size), the same crop of the mask, and a prompt that names the expression, the
   character (`who`) and the shipped style (`_style`: flat cel-shaded anime, dark brown ink, one shadow tone, upper-left
   light, "not pixel art"). Pixels outside the mask come back byte-identical (measured: 0 changed).
3. **Compose** (`tools/compose.py`, `picks.json`): paste the chosen crop back into the 512 portrait: `out/<char>.<mood>.png`.
4. **Review** (`tools/sheet.py`, the capture spec).

Route C here is `tools/reduce_c.py` (box 4x down to 128, a 40-colour median cut, no dither, darkest colour forced to
`#1b1410`, salt removal). It only shows the size and register of a pixel bust; a real route C would be redrawn at 128
and hand-cleaned.

## Cost

| call                         | generations | note                                                        |
| ---------------------------- | ----------: | ----------------------------------------------------------- |
| `inpaint-v3` on the full 512 |          25 | first test (Kaya angry); not picked, stair-stepped redraw   |
| `inpaint-v3` on a 192 crop   |          10 | Kaya angry, Mira warm                                       |
| `inpaint-v3` on a 128 crop   |          10 | Kaya worried: 10 is the floor, a smaller crop saves nothing |
| **total**                    |      **55** | of the 60 allowed; balance stayed far above 500             |

Each job returns two candidates, and in every job here they were byte-identical, so a job is one pick. Allow a reroll
on about one in three, so **route A costs about 13 generations per expression**. A full route A over the 26 portraits
at 3 moods each is about 1,000 generations. **Route B** needs most of the bust redrawn, so it is a 512 edit (estimated
25+ a try, not measured here) and the face is redrawn too, which is where identity drifts: expect two or three tries a
pose, so 50 to 75 per variant. **Route C** at 128 is a pro-flash create or edit (about 5 a job at party-g1's rates) plus
hand cleaning, but it changes the art standard the owner just approved.

## Budget (the portraits family, 4 MiB)

- Today: 4,176,622 bytes (3.98 MiB). **Headroom is 17.7 KB: not one variant fits.**
- A variant as a 256-colour PNG (median cut, no dither): 87–108 KB (Kaya angry 108,448; worried 107,989; Mira warm
  86,514). Full colour they are 192–241 KB.
- Twelve shipped portraits are still full colour (Kaya, Sura, Bo, Linmei, Nima, Jinu, Riko and five bandits). Re-encoded
  to 256 colours they would free **1.31 MiB**: room for about 12 variants with no raise. That re-encode changes shipped
  bytes, so it needs its own visual check for banding.
- Route A at 3 moods for all 26 is about 78 x 100 KB = 7.6 MiB more: the family would need about **12 MiB** (ADR 0092).
  A narrower first wave, say the party and Mira at 2 moods each, is about 1.2 MiB and fits after the re-encode.
- Precache: each 100 KB variant adds 100 KB to the 25 MB precache too, unless variants are left out of the precache and
  fetched on first use, with the neutral portrait as the fallback while they load.

## Design note: choosing a variant in game (proposal, not built)

- **Where the field goes.** A dialogue node has one speaker and one portrait, and its `lines` are plain strings, so a
  per-line field means changing `lines` to `string | { text, expression }`. Propose instead an optional `expression`
  on the dialogue and choice nodes and on `dialogueVariant` (`src/content/schemas.ts`): `z.enum(EXPRESSIONS).optional()`
  with `EXPRESSIONS = ['neutral', 'angry', 'worried', 'warm', 'surprised']`, a closed list so a typo fails validation.
  A node that needs two moods is split into two nodes.
- **Resolution.** `resolveDialogue` passes `expression` through (variant first, then the node). The app turns it into a
  key: `portrait.kaya` + `angry` -> `portrait.kaya.angry`. `src/core` never sees asset keys beyond the string it already
  carries.
- **Fallback to neutral.** The manifest answers any unknown `portrait.*` key with the placeholder painter
  (`manifest.ts`, the `startsWith('portrait.')` branch), so the fallback must test `key in ASSETS` explicitly and use the
  base key when the variant is missing. Never lean on the painter fallback, or a missing variant draws a blank medallion.
- **Validation.** `validateContent` warns (not fails) when an `expression` names a variant the manifest lacks, so writers
  can tag lines ahead of the art; a test lists the tags that still fall back.
- **Manifest.** One key per variant, `portrait.<id>.<expression>`, same palette as the base entry; the `art:portrait`
  script writes it. Everything that is not dialogue (turn strip, inspector, roster, level-up) keeps the neutral key.
- **Route B** needs no schema field: a pose variant can be picked the same way (`expression: 'pose2'`) or rotated by
  scene; pick it in the data, never at random, so a reloaded save shows the same face.

## Fault list

- **Kaya worried:** a stray dark dot under her left eye (inside the mask). A reroll or a 1 px hand fix removes it.
- **Mira warm:** the redrawn wrinkle lines are a little lighter and fewer than the originals around the eyes.
- **The full 512 inpaint** (`raw/a-kaya-angry-s9201`, not picked) redrew with stair-stepped, unsmoothed edges on the jaw
  and hair; the crop jobs did not. Prefer crops.
- **Route C capture is soft:** the stage portrait is 11rem, 352 device px here, 2.75x a 128 bust, so today's smoothing
  blurs it. Shipping C would need the integer-snap wiring first. This is one more cost of C, not a fault of the art.
- **Route B and the thug** are not sampled (credit cap).
