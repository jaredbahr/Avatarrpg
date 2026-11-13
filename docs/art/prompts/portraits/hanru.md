# Portrait: Hanru, Ba Dan's watch keeper — `portrait.hanru`

|              |                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------- |
| **Palette**  | `nonbender`                                                                                 |
| **Deliver**  | `public/art/portraits/hanru.png` (160×160 palette PNG, style B)                             |
| **Ships as** | `public/art/portraits/hanru.png` (160×160)                                                  |
| **Manifest** | `'portrait.hanru': { kind: 'image', url: 'art/portraits/hanru.png', palette: 'nonbender' }` |

## Who

Ba Dan's dawn watch: a sturdy middle-aged keeper of the gate with a plain weathered face, steady patient eyes and a
faint kind half-smile, short dark hair greying at the temples under a soft brown cloth cap, a knee-length muted
olive-green padded coat with a plain leather belt, and a plain wooden spear held upright. Few words, practical, kind
without saying so. Hanru uses they/them, so the face reads as neither clearly a man nor a woman; no beard or
moustache. The look matches their top-down sprite (`prototypes/topdown/tools/v7chars.py`).

## Signature

The brown cloth cap, the olive padded coat and the upright spear.

## Prompt

Style B (ADR 0107) is made with `prototypes/topdown/tools/portraits_b.py`; the `hanru` entry in its `CAST` table is the
prompt of record. The shipped portrait is seed 31, from Dorin's pre-B portrait as the base.

```text
A sturdy middle-aged village watch keeper; a new person: a plain weathered face with steady patient eyes and a faint kind half-smile, short dark hair greying at the temples under a soft brown cloth cap, a knee-length muted olive-green padded coat with a plain leather belt, holding a plain wooden spear upright; practical, few words, kind without saying so; an androgynous look, neither clearly a man nor a woman, no moustache or beard.
```

## Negative prompt

```text
blur, anti-aliasing, text, frame, beard, moustache, helmet, armour, weapons pointed at the viewer, gore
```

## Variations

Re-run `portraits_b.py --seed N --base-dir <pre-B portraits>` and pick by the checklist.

## Check

Run `checklist.md` before committing, at 3x. For this portrait in particular: the cap, the olive coat and the upright
spear, matching the sprite.
