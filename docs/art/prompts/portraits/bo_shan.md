# Portrait: Bo-shan, Ba Dan's cart driver — `portrait.bo_shan`

|              |                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------- |
| **Palette**  | `earth`                                                                                     |
| **Deliver**  | `public/art/portraits/bo_shan.png` (160×160 palette PNG, style B)                           |
| **Ships as** | `public/art/portraits/bo_shan.png` (160×160)                                                |
| **Manifest** | `'portrait.bo_shan': { kind: 'image', url: 'art/portraits/bo_shan.png', palette: 'earth' }` |

## Who

Pella's brother, nineteen, a broad-shouldered young man who hauls his own carts and is a minor stone-mover; the fifth
missing person at the quarry. Light-brown skin like his sister, messy dark brown hair with a few bits of straw in it,
a big boastful grin and warm, tired, big-hearted eyes. A muted moss-green work tunic with the sleeves rolled to the
elbow, an ochre linen scarf, a worn brown leather harness strap across the chest, a coil of cart reins over one
shoulder, and one hand held up showing off a small pebble floating above the palm.

He has no sprite of his own yet: the village map uses the shared `npc.household` sheet (a woman in her thirties, moss-green
tunic, ochre apron), so the portrait takes only its moss-green and ochre. The look comes from the story bible
(NPC-08), the saga outline and Pella's portrait for the family colouring. He is not Bo (the hero).

## Signature

The big grin, the ochre scarf, the coil of cart reins and the floating pebble.

## Prompt

Style B (ADR 0107) is made with `prototypes/topdown/tools/portraits_b.py`; the `bo_shan` entry in its `CAST` table is
the prompt of record. There is no earlier portrait of him, so the base is Pella's pre-B portrait (family colouring and a
bust composition), resized to 160 px; the description makes him a new person. The shipped portrait is seed 11. (The run itself used the usual word for his element where this text says "stone-mover"; the prompt-pack test forbids that word in docs.)

```text
A broad-shouldered nineteen-year-old young man, the village cart driver and a minor stone-mover; his sister Pella's family look; a new person, not a child: light-brown skin, messy dark brown hair with a few straw bits in it, a big boastful grin with a chipped front tooth and warm, tired, big-hearted eyes, a muted moss-green work tunic with the sleeves rolled to the elbow, an ochre linen scarf, a worn brown leather harness strap across the chest, a coil of cart reins over one shoulder, and one hand held up showing off a small pebble of rock floating above his palm; no beard, no armour, no weapon.
```

## Negative prompt

```text
blur, anti-aliasing, text, frame, beard, armour, weapons pointed at the viewer, gore
```

## Variations

Re-run `portraits_b.py --seed N --base-dir <pre-B portraits>` and pick by the checklist. Seed 41 was also good and a
touch livelier but muddier.

## Check

Run `checklist.md` before committing, at 3x. For this portrait in particular: the scarf, the cart reins and the pebble.
