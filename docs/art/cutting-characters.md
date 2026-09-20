# Cutting character sheets

Captain Ruon, the ordinary blade mercenary and the ranked sergeant replace the
three procedural figures visible in the current route. Built-in OpenAI image
generation produced their original art on 2026-09-19. Ruon's approved portrait
supplies his older face, grey hair and beard, brown coat and guarded sabre.
The crossbow mercenary supplies faction material and line style only. The blade
mercenary retains plain iron headgear and broad rust armor; the sergeant retains
his crest and brass rank sash. These are original project characters.

Exact initial prompts are in `cutting-character-prompts.json`; the additional
sergeant gait instruction and subsequent prompts are in `cutting-walk-prompts.json`.
Accepted, byte-identical generator PNGs live in
`assets/reference/cutting-characters/`, outside the shipped `public` tree.
`cutting-character-sources.json` records their original filenames and SHA-256.
Rejected candidates remain local; their prompts are recorded, not silently
described as accepted animation.

## Processing and selected poses

Each combat source is a transparent 3-by-3 grid in row order:

```text
idle/0 idle/1 walk/0
walk/1 cast/0 cast/1
cast/2 hit/0  ko/0
```

The repeated wide walking contacts in these sheets were rejected. The existing
project pose guide, `assets/reference/pose-guides/side-walk.png`, guided separate
2-by-2 walking sources. Their two passing poses (top right, bottom right) supply
opposed planted legs. The mercenary required one further isolated near-leg passing
pose, using the top-right guide crop. Its other passing pose comes from the grid.
Only these two walking cels ship; the established 4 fps, two-frame loop remains.
This is a compact two-pose walk, not a claim of a continuous four-pose cycle.

The importer checks clear gutters and keeps source alpha. All three standing
bodies are 151 pixels high: Sura and Kaya have 121-pixel bodies with a 1.25 runtime
scale in the oblique view, making their equivalent height 151.25 pixels. The first
121/109-pixel drafts were visibly too short and are superseded. One source scale
applies to all combat poses, so KO remains shorter. Walk inputs match the standing
reference; paired grid poses share one scale.

Frame dimensions are the smallest bounds that preserve every scaled pose with
the existing eight-pixel clear margins and 0.5/0.85 anchor: Ruon 139 by 192,
mercenary 169 by 199, sergeant 147 by 203. The manifest declares these bounds
explicitly under ADR 0032. Pixels per tile remains 128 and logical footprint
remains one tile. No artistic retouching, limb transformations or renderer changes
are used. A single lossless PNG deflate strategy saves 7,379 bytes without changing
any decoded pixels; no color reduction or lossy image compression is used.

```sh
node --import tsx scripts/art/cutting-characters.ts ruon assets/reference/cutting-characters/ruon-combat.png assets/reference/cutting-characters/ruon-walk.png
node --import tsx scripts/art/cutting-characters.ts merc assets/reference/cutting-characters/merc-combat.png assets/reference/cutting-characters/merc-walk.png assets/reference/cutting-characters/merc-near-passing.png
node --import tsx scripts/art/cutting-characters.ts sergeant assets/reference/cutting-characters/sergeant-combat.png assets/reference/cutting-characters/sergeant-walk.png
npm run art:validate
```

The existing `melee` contract reuses cast wind-up/contact frames. All clip rates,
ability rules, effect timing and one-tile footprints remain unchanged. Loading
and failed requests retain the original mercenary painters and faction palettes.
No new portrait is introduced. Runtime sheets and atlas JSON total 540,375 bytes;
see ADR 0032 for the narrowly increased units budget.

The explicit local review is `e2e/cutting-character-art.review.ts`, run with
`npx playwright test -c playwright.cutting-art.config.ts`. It records natural
three-member Cutting views, the naturally available six-member sergeant
reinforcement, and separately labelled staged walking/attack frames. Staged
presentation events are not evidence of legal combat outcomes. Both rendering
backends and reduced motion are covered at the real camera's player zoom.
The server refuses port reuse and each test asserts the title screen's exact Git
build label. Normal-motion samples assert both distinct walking frames and the
brief melee release frame were captured for every subject.

Output terms follow the existing art intake convention:
<https://openai.com/policies/row-terms-of-use/>. No exclusive copyright in generated
output is claimed. The character-art credit covers the shipped sheets.
