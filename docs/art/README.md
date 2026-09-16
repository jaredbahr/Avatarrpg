# Art intake

How generated art gets from an image generator into the game. The look itself
is specified in [`../art-bible.md`](../art-bible.md); the technical shape of
every asset in [`../adr/0003-asset-contract.md`](../adr/0003-asset-contract.md).
This folder is the working end: prompt packs to copy out, a checklist to run,
and the exact places files go.

Before generating anything that will be committed, check that the generator's
output licence permits non-commercial use. This is a private fan project; keep
every prompt free of franchise and character names (the packs already are, and
`src/content/prompts.test.ts` fails the build if one creeps in).

## Portraits (available now)

The 17 portraits are the first real art. Consistency is per image, so they are
the cheapest way to find out whether the style works before a single sprite
sheet is attempted.

1. Open `prompts/portraits/<name>.md`. Each pack is self-contained: the prompt
   paragraph already carries the style block, the frame rules and the palette.
   `prompts/_style.md` is the same block written out for reference, and
   `prompts/generator-notes.md` says which generator features matter.
2. Generate three candidates per portrait at 1024×1024 or larger, PNG, on the
   flat parchment background the prompt names.
3. Pick one with `prompts/checklist.md`. Anything that fails a line is
   regenerated, never retouched.
4. Downscale to 512×512 and save it as `public/art/portraits/<name>.png`
   (keep the raw candidate under `art/raw/portraits/`, which git ignores).
5. Point the manifest at it in `src/content/assets/manifest.ts`:

   ```ts
   'portrait.kaya': { kind: 'image', url: 'art/portraits/kaya.png', palette: 'fire' },
   ```

   Keep the `palette`: it tints the dialogue backdrop and the HUD chrome.

6. `npm run verify`, then look at it in the game: the dialogue stage, party
   setup, the unit inspector and the turn strip all draw the same file at
   different sizes. Until the file loads, or if it fails to load, the painter
   draws in its place, so a typo in the path shows as the old drawn portrait
   rather than as nothing.

## Sprite sheets (after the asset contract lands)

Unit sheets need the `sheet` manifest kind and the `scripts/art/` normalise,
pack and validate tools from roadmap phase A2. The prompt packs for the pilot
sheets (Kaya and the bandit thug) arrive with them under `prompts/sheets/`,
along with the intake convention `art/raw/<assetKey>/<clip>/<index>.png`. The
reference sheet for a character, one 2048×2048 image per the art bible, can be
made any time; it is the single source of truth every pose is generated from.

## Layout

```
docs/art/
  README.md                 this file
  prompts/_style.md         the shared style block, spelled out
  prompts/checklist.md      pass/fail lines before anything is committed
  prompts/generator-notes.md  which generator features matter and why
  prompts/portraits/*.md    one pack per portrait key
  prompts/sheets/*.md       one pack per pilot sprite sheet (A2)
art/raw/                    generator output, ignored by git
public/art/portraits/       what ships
```
