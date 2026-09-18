# Portrait: Crossbow mercenary — `portrait.enemy.crossbow`

**Palette**: `enemy`, rust armor, iron helmet, warm parchment.

**Deliver**: `art/raw/portraits/enemy.crossbow.png`, square PNG at least 1024 pixels.

**Ships as**: `public/art/portraits/enemy.crossbow.png`, 512 square pixels.

**Manifest**: `'portrait.enemy.crossbow': { kind: 'image', url: 'art/portraits/enemy.crossbow.png', palette: 'enemy' }`

## Who

The same lean adult mercenary as the crossbow sheet, serious angular face,
plain iron helmet, squared rust armor, cream sleeves and charcoal clothing.

## Signature

The squared helmet and shoulder plates, and the transverse crossbow at the
bottom of the bust. Keep the face clear inside the circular crop.

## Prompt

Use the selected crossbow sheet as identity reference. Exact prompt is recorded
under `portrait` in `../../crossbow-prompts.json`. Three-quarter bust facing
screen-right, dark-brown ink, flat cel colors and warm parchment background.

## Negative prompt

Text, logos, known character likeness, gradients, glow, scenery, cropped helmet,
extra fingers, fused wrists, rifle or sword replacing the crossbow.

## Variations

Keep the same identity and costume; expression changes are separate siblings.

## Check

Inspect the turn strip and enlarged inspector on both renderers. Run
`npm run art:portrait -- --key enemy.crossbow --in <generated-portrait.png>`
and `npm run art:validate`. Gallery beat `38-crossbow-portrait` records the crop.
