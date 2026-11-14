# Portrait: Kuan, the tea keeper — `portrait.sen`

Kuan was the placeholder Sen until 2026-11-14; the key and file keep the old name.

|              |                                                                                       |
| ------------ | ------------------------------------------------------------------------------------- |
| **Palette**  | `neutral`                                                                             |
| **Deliver**  | `public/art/portraits/sen.png` (160×160 palette PNG, style B)                         |
| **Ships as** | `public/art/portraits/sen.png` (160×160)                                              |
| **Manifest** | `'portrait.sen': { kind: 'image', url: 'art/portraits/sen.png', palette: 'neutral' }` |

## Who

A tall lanky man in his thirties with a kind, slightly wry face, a grey headband, a slate-grey quilted vest over a brick-red shirt, a white towel on one shoulder and a tan sash, holding out a dented tin kettle and a chipped cup with a blue handle.

## Signature

The grey headband, the towel and the blue-handled cup.

## Prompt

Style B (ADR 0107) is made with `prototypes/topdown/tools/portraits_b.py`; the `sen` entry in its `CAST` table is the prompt of record.

```text
A tall lanky man in his thirties with a kind, slightly wry face, a grey headband, a slate-grey quilted vest over a brick-red shirt, a white towel on one shoulder and a tan sash, holding out a dented tin kettle and a chipped cup with a blue handle.
```

## Negative prompt

```text
blur, anti-aliasing, text, frame, weapons pointed at the viewer, gore
```

## Variations

Re-run `portraits_b.py --seed N` and pick by the checklist.

## Check

Run `checklist.md` before committing, at 3x. For this portrait in particular: The grey headband, the towel and the blue-handled cup.
