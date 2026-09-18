# Portrait: Bandit — `portrait.enemy.thug`

|              |                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------- |
| **Palette**  | `enemy` — base `#8a4b3c`, shadow `#4d241b`, light `#b8705c`, ink `#1b1410`, background `#f4e9d8`  |
| **Deliver**  | `art/raw/portraits/enemy.thug.png`, square PNG, 1024 pixels or larger                             |
| **Ships as** | `public/art/portraits/enemy.thug.png`, 512 x 512                                                  |
| **Manifest** | `'portrait.enemy.thug': { kind: 'image', url: 'art/portraits/enemy.thug.png', palette: 'enemy' }` |

## Who

The same rangy adult quarry bandit as `unit.enemy.thug`: sun-darkened skin,
black tied-back hair, knotted rust head-rag, stubble, a crooked grin,
rust neck scarf and ragged sleeveless vest. Use the full-body reference at
`art/raw/reference/unit.enemy.thug.png` to preserve identity.

## Signature

The knotted head-rag, angular face, dark stubble and rust neck scarf.
No hands or weapon enter this head-and-upper-chest crop.

## Prompt

The exact generation prompt is recorded in `../../bandit-prompts.json` under
`portrait`. Preserve the established face and costume. Three-quarter bust
facing slightly screen-right, eyes toward the viewer. Uniform dark-brown
ink and two flat tones per material. Plain parchment background, no framing.
Keep the complete head inside the circular turn-order crop and recognizable
at 40 pixels. No text, known character likeness or skin markings.

## Negative prompt

Gradients, photorealism, scenery, textures, hatching, soft shading, frames,
labels, letters, watermarks, cropped forehead, hands, visible weapon.

## Variations

Retain the approved identity when changing expressions. A calmer mouth or
slightly tighter crop may be generated as separate siblings; no costume change.

## Check

Inspect the 512-pixel portrait, 40-pixel circular turn strip and enlarged
inspector. The head-rag and face must match the board sprite. Run
`npm run art:portrait -- --key enemy.thug --in art/raw/portraits/enemy.thug.png`
and `npm run art:validate` before shipping.
