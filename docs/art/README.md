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

## Where files land

Generated pictures reach the repository on a branch, never on `main`: copy
the folder into the repo as `art/incoming/` on a branch named `art-intake`
and push it (a zip inside is fine; the GitHub web upload works too). From
there:

1. `git fetch origin art-intake` and
   `git archive origin/art-intake art/incoming | tar -x -C art/raw/` puts the
   files under `art/raw/incoming/`, which git ignores. The branch is never
   merged: `npm run check:assets` fails a checkout that carries
   `art/incoming/`, and `git ls-files art/` must print nothing before a push.
2. `npm run art:inventory` lists every picture with its size and what the
   game takes it for from its name and shape (a portrait, a sheet frame, a
   reference figure, a map), the verdict (ok, needs a crop, too small, a JPEG
   frame) and the command that takes it in. Its last lines say which
   portraits, clips and maps are present and what it could not place: those
   are the questions to settle before anything is processed.
3. Run the command each line names. Raw candidates stay in `art/raw/`;
   only what lands under `public/art/` is committed, one family per commit,
   after the licence line of the checklist is confirmed.

PNG is the delivery format. The scripts read a JPEG too (portraits and
paintings through a pure-JS decoder), but a sheet frame must be a PNG: a
lossy edge on the key colour fringes after keying, so `art:normalise` names
a JPEG and passes it over.

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
4. `npm run art:portrait -- --key kaya --in art/raw/incoming/<file>` cuts
   the centre square if the candidate is not square (and says how much),
   composites anything clear onto the parchment, downsizes with the box
   filter to 512×512 (never up: a candidate under 512 is refused), writes
   `public/art/portraits/kaya.png` and prints the manifest line with the
   palette the manifest already carries. It warns when the corners are not
   the parchment, because the medallion's rim will show them.
5. Paste the printed line over the painter's in
   `src/content/assets/manifest.ts`:

   ```ts
   'portrait.kaya': { kind: 'image', url: 'art/portraits/kaya.png', palette: 'fire' },
   ```

   Keep the `palette`: it tints the dialogue backdrop and the HUD chrome.

6. `npm run art:validate` checks the file is there, is a PNG, measures
   512×512 and is not heavy (CI runs it: a typo in the path would otherwise
   ship as the drawn placeholder). `npm run verify`, then look at it in the
   game: the dialogue stage, party setup, the unit inspector, the roster and
   the turn strip all draw the same file at different sizes. Until the file
   loads, or if it fails to load, the painter draws in its place.

## Reference figures (have them first)

A full-body figure per character, three-quarter view, on parchment, is the
single source of truth every pose is generated from: feed it back as the image
reference (character consistency) for every frame. Keep the originals as
`art/raw/reference/<assetKey>.png` (git ignores `art/raw/`); the key is the
unit's manifest key, `unit.fire.kaya` and so on. All ten heroes' references
exist as of 2026-09-16; the bandit's sheet pack generates its own first, and
the other enemies and the NPC speakers still need theirs.

## Sprite sheets (available now)

A unit's animated art is a sheet of key poses (`../adr/0003-asset-contract.md`):
two idle poses and three cast poses at least; walk, melee, hit and KO when
the character has them. Every pose is one image, generated on a flat
`#00ff00` background with the reference figure as the image reference.

1. Open `prompts/sheets/<assetKey>.md`. Each pack is self-contained: a pose
   table with one prompt line per frame, the prompt paragraph that carries
   the style block and the frame rules, the negative prompt and the exact
   commands. The ten heroes' packs are written from their reference figures;
   the bandit's generates its reference first.
2. Generate each pose at 4x (512×768 for a one-tile unit) and save it as
   `art/raw/<assetKey>/<clip>/<index>.png`, for example
   `art/raw/unit.fire.kaya/cast/1.png`. Indices start at 0 with no gaps.
3. `npm run art:normalise -- --unit unit.fire.kaya` keys the background out,
   trims, scales the whole unit by one factor (the idle pose's height sets it,
   so a crouch never comes out taller than a stand), stands the feet on the
   baseline and pads to 128×192. Frames land in `art/normalised/<assetKey>/`.
   It stops when the corners are not the key colour (pass `--key auto`, which
   reads the background from the corners, or the colour itself), reports an
   idle figure too small to stand its height in the frame (the filter never
   scales up: generate at 4x), and names any file it passed over (a loose
   name, a JPEG). `--px 256` makes a sharper sheet.
4. `npm run art:pack -- --unit unit.fire.kaya` writes
   `public/art/units/kaya.png` and `kaya.json` and prints the manifest entry
   to paste into `src/content/assets/manifest.ts`, with the unit's palette.
5. `npm run art:validate` checks every sheet the manifest names against the
   files: frames present, sizes right, the clear margin kept. CI runs it.
6. `npm run verify`, then look at it in the game: the unit idles, walks,
   casts and takes a hit through the same runtime the placeholders use, so
   the only thing that changes is the art.

`npm run check:assets` (also in CI) holds each family of art under 4 MB and
everything precached under 25 MB.

## Map paintings (available now)

A painting per map is drawn under the rules grid in place of the procedural
ground (`../adr/0009-map-paintings.md`): the game keeps drawing the live
surfaces, the grid lines, the units, the props and the effects over it, so
the painting is the ground and what stands on it, nothing else.

1. Open `prompts/maps/<mapId>.md`. Each pack is written from the map's own
   rows: where the road, the pond, the trees and the ledges are, to the
   tile, beside the scene in words, the prompt, the negative prompt and the
   commands. `prompts/maps/<mapId>-layout.png` beside it is the same grid as
   flat colour blocks with the grid drawn, 32 px a tile: hand it to the
   generator as the composition reference (image-to-image or a structure
   control) at a strength that keeps every edge where it is.
2. Generate at the delivery size or a whole multiple of it (the pack names
   both), landscape, evenly lit, with no vignette, no characters, no props,
   no text and no border. Save it as `art/raw/maps/<mapId>.png`.
3. `npm run art:map -- --map forest_road` (or `--in <file>` for a PNG or
   JPEG named loosely) checks the aspect, cutting a centred band off a near
   miss of up to a tenth and saying how many tiles it cut, refusing anything
   further off (the layout was not kept: regenerate from the layout image),
   downsizes with a box filter (never up) to the map's
   `width × pixelsPerTile`, writes `public/art/maps/forest_road.webp` and
   prints the `backdrop` line.
4. Put that line on the map in `src/content/maps/`. `npm run art:validate`
   checks the file measures the grid times its pixels a tile;
   `npm run check:assets` keeps the family under 4 MB (five paintings at
   1920 wide land near 3 MB; if one will not fit, `--quality 75`).
5. `npm run verify`, then look at it in the game with Show grid on: every
   edge that matters to the rules sits on a tile line. Under High contrast
   the drawn tree, wall, ledge and cover marks return over the painting so
   the rules still read without it.

The packs and layout images are generated (`npm run art:map-pack`, then
`npx prettier --write docs/art/prompts/maps`); a test regenerates them from
the content and fails if a map changed without them.

## Layout

```
docs/art/
  README.md                 this file
  prompts/_style.md         the shared style block, spelled out
  prompts/checklist.md      pass/fail lines before anything is committed
  prompts/generator-notes.md  which generator features matter and why
  prompts/portraits/*.md    one pack per portrait key
  prompts/sheets/*.md       one pack per sprite sheet, named by asset key
  prompts/maps/*.md         one pack per map painting, with its layout PNG
art/raw/incoming/           what the art-intake branch delivered, ignored by git
art/raw/reference/          the reference figures, ignored by git
art/raw/<assetKey>/         generated poses, ignored by git
art/raw/maps/<mapId>.png    generated paintings, ignored by git
art/normalised/<assetKey>/  what normalise writes, ignored by git
public/art/portraits/       portraits that ship
public/art/units/           sheets that ship (PNG + JSON)
public/art/maps/            paintings that ship (WebP)
public/art/test/            the probe atlas and probe painting the e2e suite draws
scripts/art/                normalise, pack, validate, map, map-pack, probe-backdrop
```
