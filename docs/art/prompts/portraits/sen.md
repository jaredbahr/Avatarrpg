# Portrait: Sen, the tea keeper — `portrait.sen`

|              |                                                                                       |
| ------------ | ------------------------------------------------------------------------------------- |
| **Palette**  | `neutral`                                                                             |
| **Deliver**  | `public/art/portraits/sen.png` (160×160 palette PNG, style B)                         |
| **Ships as** | `public/art/portraits/sen.png` (160×160)                                              |
| **Manifest** | `'portrait.sen': { kind: 'image', url: 'art/portraits/sen.png', palette: 'neutral' }` |

## Who

A gentle middle-aged man with laugh lines and short grey-brown hair, a brown apron over a rust-orange shirt, holding out a dented tin kettle and a chipped cup with a blue handle. Patient, offering company.

## Signature

The kettle and the blue-handled cup.

## Prompt

Style B (ADR 0107) is made with `prototypes/topdown/tools/portraits_b.py`; the `sen` entry in its `CAST` table is the prompt of record.

```text
A gentle middle-aged man with laugh lines and short grey-brown hair, a brown apron over a rust-orange shirt, holding out a dented tin kettle and a chipped cup with a blue handle. Patient, offering company.
```

## Negative prompt

```text
blur, anti-aliasing, text, frame, weapons pointed at the viewer, gore
```

## Variations

Re-run `portraits_b.py --seed N` and pick by the checklist.

## Check

Run `checklist.md` before committing, at 3x. For this portrait in particular: The kettle and the blue-handled cup.
