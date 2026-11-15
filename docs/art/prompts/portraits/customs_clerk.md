# Portrait: the Saltstep customs clerk — `portrait.customs_clerk`

|              |                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **Palette**  | `neutral`                                                                                                 |
| **Deliver**  | `public/art/portraits/customs_clerk.png` (160×160 palette PNG, style B)                                   |
| **Ships as** | `public/art/portraits/customs_clerk.png` (160×160)                                                        |
| **Manifest** | `'portrait.customs_clerk': { kind: 'image', url: 'art/portraits/customs_clerk.png', palette: 'neutral' }` |

## Who

The harbour customs clerk who carries most of MQ-02: a fussy, earnest man in his fifties who counts every crate, keeps a stool and a brass seal on a chain, and ends up in the harbour. His top-down sprite (`npc.customsclerk`) wears the same cap, spectacles, jacket and seal. RG-02 (Saltstep and Emberwatch), 2026-11-15.

## Signature

The round spectacles, the flat official cap and the brass seal on its chain.

## Prompt

Style B (ADR 0107) is made with `prototypes/topdown/tools/portraits_b.py --prefix rg02_`; the `customs_clerk` entry in its `CAST`
table is the prompt of record. There is no earlier portrait of this person, so the base is Sen's portrait
(a bust composition), resized to 160 px; the description makes a new person. The shipped portrait is seed 11.

```text
a fussy thin harbour customs clerk in his fifties; the upright pose; he is a new person: light skin, round wire spectacles, a neat grey moustache, a flat dark blue official cap, a buttoned slate-blue clerk jacket with brass buttons, a big brass seal hanging on a chain round his neck, a sheaf of papers held to his chest; earnest and indignant; no kettle, no cup, no towel
```

## Negative prompt

```text
blur, anti-aliasing, text, frame, weapons pointed at the viewer, gore
```

## Variations

Re-run `portraits_b.py --prefix rg02_ --seed N customs_clerk` and pick by the checklist.

## Check

Run `checklist.md` before committing, at 3x. For this portrait in particular: the seal and the spectacles.
