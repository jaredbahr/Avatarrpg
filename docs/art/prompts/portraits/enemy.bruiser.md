# Portrait: Broad bruiser — `portrait.enemy.bruiser`

**Palette**: `enemy`.

**Deliver**: `art/raw/portraits/enemy.bruiser.png`, square PNG at least 1024 pixels.

**Ships as**: `public/art/portraits/enemy.bruiser.png`, 512 square pixels.

**Manifest**: `'portrait.enemy.bruiser': { kind: 'image', url: 'art/portraits/enemy.bruiser.png', palette: 'enemy' }`

## Who

Bald crown, rust forehead rag, square stubbled jaw, thick neck and broad shoulders. Same original adult character as the corresponding sheet.

## Signature

Preserve the head silhouette and costume, recognizable inside a circular crop.

## Prompt

Exact prompt in `../../quarry-bandits-prompts.json` under `bruiser.portrait`.
Use the selected sheet as identity reference, with clean flat cel colors,
dark-brown ink and parchment background.

## Negative prompt

Text, logos, known characters, gradients, scenery, grain, cropped crown,
weapons or hands entering the bust.

## Variations

Preserve identity and costume; expression changes are separate siblings.

## Check

Run art:portrait, art:validate and inspect the turn strip and enlarged inspector
on both production renderers. Gallery beat `39-bruiser` records the result.
