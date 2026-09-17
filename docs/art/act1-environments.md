# Act 1 environment asset pack

Five illustrated map backgrounds and all six existing prop types are integrated
through the game's asset manifest and map definitions. They extend the warm ink,
ochre paths and blue-grey stone of the riverside direction. No new encounters,
prop placements, collision rules or story nodes are introduced.

## Maps

| Place          | Game-ready file                       | Size                  | Story and gameplay role                                                                       |
| -------------- | ------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| Ba Dan Village | `public/art/maps/ba_dan_village.webp` | 1536×1024, 64 px/tile | Home hub, four cutaway houses, central water court, clear east exit and riverside approach.   |
| Forest Road    | `public/art/maps/forest_road.webp`    | 1600×960, 80 px/tile  | First roadside confrontation; wet-ground lesson, two cover stones and corner woodland.        |
| Quarry Gate    | `public/art/maps/quarry_gate.webp`    | 1600×960, 80 px/tile  | Checkpoint and fire-spread lesson; four gatehouses, cover stacks and separate pushable props. |
| The Cutting    | `public/art/maps/ambush_road.webp`    | 1600×960, 80 px/tile  | Ambush between stepped rock terraces, split lanes and four cover piles.                       |
| Quarry Floor   | `public/art/maps/quarry_floor.webp`   | 1600×960, 80 px/tile  | Open boss arena with terraced corners, six cover piles and room for changing hazards.         |

The existing `ba_dan_riverside.webp` and its registered foreground silhouettes
are preserved. These new paintings deliberately contain no live water, oil,
mud pools or fire. Their empty earth/stone patches are substrates for those
changing game layers. Static cover is separate from destructible rubble props.

## Reusable props

Every file below is a transparent 256×256 PNG under `public/art/props/`.
They retain their existing gameplay definitions in `src/content/props.ts`.
The art does not add new prop spawns or change balance.

| File          | Manifest key   | Recognition cue                                         |
| ------------- | -------------- | ------------------------------------------------------- |
| `barrel.png`  | `prop.barrel`  | Open wooden barrel with visible turquoise water.        |
| `flask.png`   | `prop.flask`   | Small stoppered terracotta oil vessel with a rope loop. |
| `brazier.png` | `prop.brazier` | Iron basket of hot coals on three legs.                 |
| `hay.png`     | `prop.hay`     | Golden straw block bound with two ropes.                |
| `rubble.png`  | `prop.rubble`  | Compact mound of angular quarry stone.                  |
| `cart.png`    | `prop.cart`    | Two-wheeled handcart overloaded with cabbages.          |

Prop proportions are authored in `scripts/art/prop.ts`; the flask is smaller
than the barrel, and broad props retain their aspect. All bases share the 85%
ground line. PNGs contain no floor or painted shadow. The shared sprite cache
adds ground contact in the game and retains the old prop drawings on load failure.

## Source and processing

Generated with the built-in OpenAI image tool from the project layout diagrams
and original descriptions. No third-party asset packs were downloaded. The
[output terms](https://openai.com/policies/row-terms-of-use/) were checked on
2026-09-17. Credits and NOTICE record provenance without claiming exclusive
copyright in generated output. Exact accepted prompts and correction prompts
are recorded in `act1-environment-prompts.json`.

Layout references were rendered directly from `ALL_MAPS` through `renderLayout`
at 80 pixels per tile. Full-size references and explicit landmark coordinates
replaced the initial forest composition that shifted terrain. The accepted
forest was corrected to include all four corner tree clusters; the quarry gate
was cleaned of inherited guide lines. Village floors remain exposed so an NPC
inside a house is not drawn over a roof.

```sh
# Repeat for each of the four combat map IDs.
npm run art:map -- --map forest_road --px 80 --quality 82
npm run art:map -- --map ba_dan_village --px 64 --quality 82
# Repeat for barrel, flask, brazier, hay, rubble and cart.
npm run art:prop -- barrel art/raw/props/barrel.png
npm run art:map-pack
npm run credits
npm run art:validate
npm run build
npm run check:assets
```

Raw candidates live in ignored `art/raw/`; shipped assets are under `public/art/`.
Map processing downsizes only, with no aspect crop for the accepted files.
The prop packer preserves alpha and colour, trims empty margins, fits uniformly,
then places the object on its ground line. It rejects empty and opaque sources.

## Review

Inspect with Show grid both off and on: tree trunks, cover centers, doorways,
ledges and exit lanes must agree with the authored cells. Existing high-contrast
decor remains available over the paintings. The gallery's Act 1 environment
views cover the three later battlefields on Canvas and WebGL, alongside its
existing village and forest views. Artwork was inspected at source and packed
sizes; automated validation covers dimensions, paths and budgets. Physical-device
touch/zoom review remains on the device checklist. Ground texture and material
shading are an illustrated first pass, not a claim of exact two-tone compliance.
