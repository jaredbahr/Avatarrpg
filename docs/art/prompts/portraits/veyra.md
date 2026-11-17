# Portrait: Veyra, the director of a public-works cooperative — `portrait.veyra`

|              |                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------- |
| **Palette**  | `neutral`                                                                                 |
| **Deliver**  | `public/art/portraits/veyra.png` (160×160 palette PNG, style B)                           |
| **Ships as** | `public/art/portraits/veyra.png` (160×160)                                                |
| **Manifest** | `'portrait.veyra': { kind: 'image', url: 'art/portraits/veyra.png', palette: 'neutral' }` |

## Who

Director Veyra Sen (AN-01 in the story bible): a woman of forty-six, an engineer with no element who built pumps, baths and lighting. A practical dark-blue work coat with repaired cuffs, a silver-threaded black braid, and a carved wooden measuring rule from her mother. The party meets her hauling a hand pump on the Saltstep freight pontoon (Act II, Scene 2.4). Her top-down sprite (`unit.ally.veyra`, `tools/rg02chars.py`) wears the same coat, braid and tool belt. RG-02 (Saltstep and Emberwatch), 2026-11-15.

## Signature

The silver-threaded braid over her left shoulder, the mended cuffs and the wooden measuring rule.

## Prompt

Style B (ADR 0107) is made with `prototypes/topdown/tools/portraits_b.py --prefix rg02_`; the `veyra` entry in its `CAST`
table is the prompt of record. There is no earlier portrait of this person, so the base is Jin's portrait
(a bust composition), resized to 160 px; the description makes a new person. The shipped portrait is seed 11.

```text
a woman engineer in her mid-forties, the director of a public-works cooperative; the calm upright pose; she is a new person: light brown skin, a calm direct face with fine lines at the eyes and a faint wry half-smile, a long black braid threaded with silver-grey strands hanging over her left shoulder, a practical dark-blue work coat with lighter blue mended cuffs and the sleeves pushed up, a brown leather tool belt strap, a small carved wooden measuring rule held in one hand; no jewellery, no fur, no armour
```

## Negative prompt

```text
blur, anti-aliasing, text, frame, weapons pointed at the viewer, gore
```

## Variations

Re-run `portraits_b.py --prefix rg02_ --seed N veyra` and pick by the checklist.

## Check

Run `checklist.md` before committing, at 3x. For this portrait in particular: the braid and the rule.
