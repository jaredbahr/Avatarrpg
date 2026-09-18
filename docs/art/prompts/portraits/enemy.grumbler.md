# Portrait: Grumbler — `portrait.enemy.grumbler`

|              |                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **Palette**  | `enemy` — rust armor, charcoal iron, dull brass, amber cab, dark-brown ink, background `#f4e9d8`          |
| **Deliver**  | `art/raw/grumbler/portrait.png`, square PNG, 512 pixels or larger                                         |
| **Ships as** | `public/art/portraits/enemy.grumbler.png`, 512 x 512                                                      |
| **Manifest** | `'portrait.enemy.grumbler': { kind: 'image', url: 'art/portraits/enemy.grumbler.png', palette: 'enemy' }` |

## Who

The same original quarry crawler as `unit.enemy.grumbler`: riveted rust armor,
charcoal hull, dull brass bands, amber cab slit, one chimney, caterpillar tracks
and a stout conical steel drill. Use `art/raw/grumbler/reference.png` to preserve
the machine's identity and proportions. No operator appears.

## Signature

The amber windshield at upper left and the steel drill at lower right remain
recognizable inside the circular turn-order crop. The drill points screen-right.

## Prompt

The exact generation prompt is recorded in `../../grumbler-prompts.json` under
`portrait`. Preserve the reference machine in a close three-quarter crop of its
cab and front drill assembly. Use chunky dark-brown ink and flat cel shading,
with one shadow tone per material. Simplify rivets and scuffs for the small icon.
Use a plain parchment background and keep the principal features inside a
centered circular safe region with comfortable margin.

## Negative prompt

Human face, operator, additional weapons, scenery, gradients, photorealism,
smoke, glow, sparks, shadows, lettering, symbols, frames and watermarks.

## Variations

Keep the approved cab, tracks and drill proportions. A powered-down variant
may darken the amber cab without changing the design or adding damage.

## Check

Inspect the 512-pixel portrait, 40-pixel circular turn strip and enlarged
inspector. Cab, armor and drill must match the battlefield machine. Run
`npm run art:portrait -- --key enemy.grumbler --in art/raw/grumbler/portrait.png`
and `npm run art:validate` before shipping. Review the `36-grumbler-portrait`
gallery on both renderers and the portrait and landscape layouts.
