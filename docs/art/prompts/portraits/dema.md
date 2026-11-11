# Portrait: Dema, road keeper — `portrait.dema`

|              |                                                                                         |
| ------------ | --------------------------------------------------------------------------------------- |
| **Palette**  | `neutral`                                                                               |
| **Deliver**  | `public/art/portraits/dema.png` (160×160 palette PNG, style B)                          |
| **Ships as** | `public/art/portraits/dema.png` (160×160)                                               |
| **Manifest** | `'portrait.dema': { kind: 'image', url: 'art/portraits/dema.png', palette: 'neutral' }` |

## Who

A weathered woman in her forties with tan skin, a wide conical straw hat, an oatmeal tunic with the sleeves rolled to the elbow and a rust-orange sash. Warm, practical, a small knowing smile.

## Signature

The straw hat and the rust-orange sash.

## Prompt

Style B (ADR 0107) is made with `prototypes/topdown/tools/portraits_b.py`; the `dema` entry in its `CAST` table is the prompt of record.

```text
A weathered woman in her forties with tan skin, a wide conical straw hat, an oatmeal tunic with the sleeves rolled to the elbow and a rust-orange sash. Warm, practical, a small knowing smile.
```

## Negative prompt

```text
blur, anti-aliasing, text, frame, weapons pointed at the viewer, gore
```

## Variations

Re-run `portraits_b.py --seed N` and pick by the checklist.

## Check

Run `checklist.md` before committing, at 3x. For this portrait in particular: The straw hat and the rust-orange sash.
