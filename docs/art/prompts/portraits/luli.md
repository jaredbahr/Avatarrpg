# Portrait: Luli, who keeps the public power lines at Emberwatch — `portrait.luli`

|              |                                                                                      |
| ------------ | ------------------------------------------------------------------------------------ |
| **Palette**  | `fire`                                                                               |
| **Deliver**  | `public/art/portraits/luli.png` (160×160 palette PNG, style B)                       |
| **Ships as** | `public/art/portraits/luli.png` (160×160)                                            |
| **Manifest** | `'portrait.luli': { kind: 'image', url: 'art/portraits/luli.png', palette: 'fire' }` |

## Who

Luli (NPC-12 in the story bible), she/her, forty-one, who maintains the public power lines; proud of power for ordinary homes, privately exhausted by quotas; laughs like a coughing engine. Her top-down sprite (`npc.luli`) wears the same rust-red tunic, leather apron and gloves. RG-02 (Saltstep and Emberwatch), 2026-11-15.

## Signature

The mid-laugh face with the soot smudge, the leather apron and the ring of brass keys.

## Prompt

Style B (ADR 0107) is made with `prototypes/topdown/tools/portraits_b.py --prefix rg02_`; the `luli` entry in its `CAST`
table is the prompt of record. There is no earlier portrait of this person, so the base is Dema's portrait
(a bust composition), resized to 160 px; the description makes a new person. The shipped portrait is seed 11.

```text
a sturdy woman in her early forties who keeps the public power lines; her strong build; she is a new person, with no hat: warm tan skin, a round cheerful tired face mid-laugh, short choppy black hair, a soot smudge on one cheek, a rust-red sleeveless work tunic over a dark grey long-sleeved shirt, a thick brown leather apron, black rubber work gloves tucked in her belt, a ring of brass keys
```

## Negative prompt

```text
blur, anti-aliasing, text, frame, weapons pointed at the viewer, gore
```

## Variations

Re-run `portraits_b.py --prefix rg02_ --seed N luli` and pick by the checklist.

## Check

Run `checklist.md` before committing, at 3x. For this portrait in particular: the soot smudge and the gloves.
