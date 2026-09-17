# Playable hero art — 2026-09-17

The ten playable heroes now use generated portraits and six-pose combat
atlases through the existing manifest and renderer. No game rules changed.

| Heroes      | Portraits                               | Combat atlases                             |
| ----------- | --------------------------------------- | ------------------------------------------ |
| Kaya, Tenzo | `public/art/portraits/{kaya,tenzo}.png` | `public/art/units/{kaya,tenzo}.{png,json}` |
| Nilak, Sura | `public/art/portraits/{nilak,sura}.png` | `public/art/units/{nilak,sura}.{png,json}` |
| Bo, Linmei  | `public/art/portraits/{bo,linmei}.png`  | `public/art/units/{bo,linmei}.{png,json}`  |
| Nima, Jinu  | `public/art/portraits/{nima,jinu}.png`  | `public/art/units/{nima,jinu}.{png,json}`  |
| Riko, Wen   | `public/art/portraits/{riko,wen}.png`   | `public/art/units/{riko,wen}.{png,json}`   |

Each atlas has two idle poses, three cast poses and one kneeling KO pose.
Walking uses the existing idle-and-bob fallback, melee uses the cast fallback,
and hits use idle with flash/recoil. These are key-pose animations, not rigs
or 3D models. Optional dedicated walk, melee and hit frames remain future art.
Enemies, NPC speakers, props and maps retain their existing art.

## Source and processing

Created using the built-in OpenAI image generation tool from the owner's
existing full-body character references and `prompts/portraits/*.md` and
`prompts/sheets/*.md`. The generated images are project output, not downloaded
third-party character packs. [OpenAI's output terms](https://openai.com/policies/terms-of-use/)
were checked on 2026-09-17. Credits and NOTICE record the generation source;
this does not assert exclusive copyright in generated output.

Portraits were processed by `art:portrait` to 512×512. Sprite candidates were
generated as one transparent 3×2 sheet per character, using a common prompt:
the character's **Who** description, same face/costume in six right-facing
full-body poses, flat cel shading, brown ink, transparent background, no
labels or floor shadow. Pose order is idle A, idle B, wind-up, release,
recover, KO. The two air sheets were regenerated with wider clear gutters.
Exact final sheet prompts are in `hero-sheet-prompts.json`.

The new splitter finds clear gutters near the intended grid boundaries and
refuses a cut through visible art. It does not scale or redraw figures.
The normaliser's explicit `--key alpha` option preserves source transparency
and garment colours instead of passing them through green-screen despill.

```bash
node --import tsx scripts/art/split-sheet.ts art/raw/sheets/kaya.png unit.fire.kaya
node --import tsx scripts/art/normalise.ts --unit unit.fire.kaya --key alpha
node --import tsx scripts/art/pack.ts --unit unit.fire.kaya
node --import tsx scripts/art/validate.ts
```

Raw candidates stay in ignored `art/raw/`; only the processed PNGs and atlas
JSON ship in `public/art/`. Existing asset formats and budgets are unchanged.

## Review limits

Checked the generated figures and packed atlases for identity, pose order,
transparent gutters, intact silhouettes, frame margins and common baselines.
Automated asset validation checks every manifest path and frame. The artwork
is an initial integrated pass; it has not had a physical iPad/Surface review.
The generated shading is somewhat softer than the strict two-tone target in
the art bible. Further art-direction refinement should replace individual
files through the same manifest rather than change the renderer contract.
