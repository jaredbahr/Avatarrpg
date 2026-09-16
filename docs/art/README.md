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

## Reference figures (have them first)

A full-body figure per character, three-quarter view, on parchment, is the
single source of truth every pose is generated from: feed it back as the image
reference (character consistency) for every frame. Keep the originals as
`art/raw/reference/<assetKey>.png` (git ignores `art/raw/`); the key is the
unit's manifest key, `unit.fire.kaya` and so on. The ten heroes' references
exist as of 2026-09-16; enemies and NPC speakers still need theirs.

## Sprite sheets (available now)

A unit's animated art is a sheet of key poses (`../adr/0003-asset-contract.md`):
two idle poses and three cast poses at least; walk, melee, hit and KO when
the character has them. Every pose is one image, generated on a flat
`#00ff00` background with the reference figure as the image reference.

1. Generate each pose at 4x (512×768 for a one-tile unit) and save it as
   `art/raw/<assetKey>/<clip>/<index>.png`, for example
   `art/raw/unit.fire.kaya/cast/1.png`. Indices start at 0 with no gaps.
2. `npm run art:normalise -- --unit unit.fire.kaya` keys the background out,
   trims, scales the whole unit by one factor (the idle pose's height sets it,
   so a crouch never comes out taller than a stand), stands the feet on the
   baseline and pads to 128×192. Frames land in `art/normalised/<assetKey>/`.
   `--key auto` reads the background from the corners when the generator
   could not hold the exact hex; `--px 256` makes a sharper sheet.
3. `npm run art:pack -- --unit unit.fire.kaya` writes
   `public/art/units/kaya.png` and `kaya.json` and prints the manifest entry
   to paste into `src/content/assets/manifest.ts`. Set its `palette`.
4. `npm run art:validate` checks every sheet the manifest names against the
   files: frames present, sizes right, the clear margin kept. CI runs it.
5. `npm run verify`, then look at it in the game: the unit idles, walks,
   casts and takes a hit through the same runtime the placeholders use, so
   the only thing that changes is the art.

`npm run check:assets` (also in CI) holds each family of art under 4 MB and
everything precached under 25 MB.

## Layout

```
docs/art/
  README.md                 this file
  prompts/_style.md         the shared style block, spelled out
  prompts/checklist.md      pass/fail lines before anything is committed
  prompts/generator-notes.md  which generator features matter and why
  prompts/portraits/*.md    one pack per portrait key
  prompts/sheets/*.md       one pack per sprite sheet
art/raw/reference/          the reference figures, ignored by git
art/raw/<assetKey>/         generated poses, ignored by git
art/normalised/<assetKey>/  what normalise writes, ignored by git
public/art/portraits/       portraits that ship
public/art/units/           sheets that ship (PNG + JSON)
public/art/test/            the probe atlas the e2e suite draws
scripts/art/                normalise, pack, validate
```
