# Portrait: Dema, road keeper — `portrait.dema`

|              |                                                                                         |
| ------------ | --------------------------------------------------------------------------------------- |
| **Palette**  | `neutral`                                                                               |
| **Deliver**  | `public/art/portraits/dema.png` (160×160 palette PNG, style B)                          |
| **Ships as** | `public/art/portraits/dema.png` (160×160)                                               |
| **Manifest** | `'portrait.dema': { kind: 'image', url: 'art/portraits/dema.png', palette: 'neutral' }` |

## Who

A middle-aged woman with tan skin and grey-streaked dark hair under a faded blue headscarf, a plain brown and green work tunic with the sleeves rolled, a damp washing cloth over one shoulder, one hand on her hip and a small turtle-duck behind her shoulder. Practical, slightly exasperated, kind.

## Signature

The headscarf, the washing cloth and the duck.

## Prompt

Style B (ADR 0107) is made with `prototypes/topdown/tools/portraits_b.py`; the `dema` entry in its `CAST` table is the prompt of record.

```text
A middle-aged woman with tan skin and grey-streaked dark hair under a faded blue headscarf, a plain brown and green work tunic with the sleeves rolled, a damp washing cloth over one shoulder, one hand on her hip and a small turtle-duck behind her shoulder. Practical, slightly exasperated, kind.
```

## Negative prompt

```text
blur, anti-aliasing, text, frame, weapons pointed at the viewer, gore
```

## Variations

Re-run `portraits_b.py --seed N` and pick by the checklist.

## Check

Run `checklist.md` before committing, at 3x. For this portrait in particular: The headscarf, the washing cloth and the duck.
