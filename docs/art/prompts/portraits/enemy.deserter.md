# Portrait: Fire deserter — `portrait.enemy.deserter`

- **Palette**: `fire`, warm red cloth, brown strap and parchment `#f4e9d8`.
- **Deliver**: `assets/reference/fire-deserter/portrait-source.png`, original square PNG.
- **Ships as**: `public/art/portraits/enemy.deserter.webp`, 512 × 512.
- **Manifest**: `'portrait.enemy.deserter': { kind: 'image', url: 'art/portraits/enemy.deserter.webp', palette: 'fire' }`.

## Who

The original mature adult man from `unit.enemy.deserter`: closely cropped dark
receding hair, warm brown skin, angular clean-shaven face and wary expression.
Use the approved combat sheet as the identity reference, not another character.

## Signature

Brick-red standing collar and plain brown diagonal strap. His face and costume
must agree with the existing full-body source. No prop or weapon in the portrait.

## Prompt

Exact built-in image generation prompt and reference provenance are preserved in
[fire-deserter-portrait-source.json](../../fire-deserter-portrait-source.json).
Square head-and-shoulders crop, three-quarter view facing screen right, full head
inside the frame, clear eyes and a simple parchment background. Restrained ink
and broad warm cel shading must remain readable at initiative size.

## Negative prompt

Known character likeness, facial hair, headgear, insignia, weapon, fire, extra
people, text, border, photorealism, 3D, noisy texture or cropped forehead.

## Variations

Keep the approved mature identity and red/brown clothing. No additional variant
is required for this bounded replacement.

## Check

Run `node --import tsx scripts/art/fire-deserter-portrait.ts` and
`npm run art:validate`. Inspect the decoded 512px result, actual initiative row
and acting-unit HUD. Preserve the portrait family's unchanged 4 MiB budget.
