# Portrait: Tavi Ren, the Saltstep ferry pilot — `portrait.tavi`

|              |                                                                                         |
| ------------ | --------------------------------------------------------------------------------------- |
| **Palette**  | `neutral`                                                                               |
| **Deliver**  | `public/art/portraits/tavi.png` (160×160 palette PNG, style B)                          |
| **Ships as** | `public/art/portraits/tavi.png` (160×160)                                               |
| **Manifest** | `'portrait.tavi': { kind: 'image', url: 'art/portraits/tavi.png', palette: 'neutral' }` |

## Who

Tavi Ren (NPC-09 in the story bible), they/them, thirty-four, a ferry pilot with no element who knows every current. Androgynous, sun-browned, a wide straw hat pushed back, a sea-green sleeveless jacket over a white shirt, a coil of rope and the long ferry pole. Their top-down sprite (`npc.tavi`) wears the same hat, jacket, rope and pole. RG-02 (Saltstep and Emberwatch), 2026-11-15.

## Signature

The straw hat pushed back, the coil of rope and the plain wooden ferry pole.

## Prompt

Style B (ADR 0107) is made with `prototypes/topdown/tools/portraits_b.py --prefix rg02_`; the `tavi` entry in its `CAST`
table is the prompt of record. There is no earlier portrait of this person, so the base is Hanru's portrait
(a bust composition), resized to 160 px; the description makes a new person. The seed-11 take kept Hanru's spearhead on the pole; the shipped portrait is the `REDO` wording at seed 23.

```text
a ferry pilot in their thirties; the steady pose; this is a new person: an androgynous look, neither clearly a man nor a woman, sun-browned skin, short tousled black hair under a wide flat straw hat pushed back, weathered sea-green sleeveless jacket over a white shirt with rolled sleeves, a coil of rope over one shoulder, a long plain round wooden ferry pole held upright with a blunt rounded top end, no blade, no spearhead, no metal tip; easy-going, patient, a small knowing smile; no beard, no moustache
```

## Negative prompt

```text
blur, anti-aliasing, text, frame, weapons pointed at the viewer, gore
```

## Variations

Re-run `portraits_b.py --prefix rg02_ --seed N tavi` and pick by the checklist.

## Check

Run `checklist.md` before committing, at 3x. For this portrait in particular: the pole (plain wood, no blade).
