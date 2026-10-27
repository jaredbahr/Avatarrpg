# The party at native G1 (ADR 0089)

Kaya, Sura and Bo on the world's own grid: 1 art px = 1 world px, 64 px a tile, a 64x96 cel, about 59 px tall. This
folder is the whole source of the three shipped sheets, and **the recipe the residents and the bandits follow next**.
Issue #284; the owner's decision (27 October 2026, "1. Rebuild.") chose #290's variant A, whose comparison is kept below
as history.

## The recipe, step by step

Every PixelLab call goes through `tools/pl.py`, which writes the job to `ledger.json` (id, settings with images replaced
by their input names, inputs, billed generations, balance, verdict) and returns a job the ledger already holds instead
of paying twice. Run everything from the repo root with `python3 -I`; `PIXELLAB_API_KEY` must be set (never printed).

| step | tool                                           | what it does                                                                                                                                                                                                                             | cost                            |
| ---- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 0    | `extract.py`, `reduce.py`                      | cut the shipped cels out of the shipped atlases into `ref/` (untracked) and reduce them 2x into `b/` (`b/<char>/palette.png` is each character's shipped palette)                                                                        | 0                               |
| 1    | `gen_root.py SEED idle\|stance char:dir ...`   | redraw **each heading's own shipped cel** natively at 64x96 (`edit-image-pro-flash`, text). The prompt is the objects' style plus `chars.json` `root_description`; back views add a facing sentence and the character's `root_back` note | 5 a job (2 distinct candidates) |
| 2    | `curate.json`, `curate.py`                     | pick one candidate per character, kind and heading, with the reason for every non-default pick; the pick is palette-locked (`palette_lock.py`, OKLab nearest shipped colour, binary alpha) into `roots/`                                 | 0                               |
| 3    | `skeletons_g1.py char:root:canvas ...`         | `estimate-skeleton` on each root padded onto each canvas it is animated on (96: walk and hits; 128: bends and knockouts)                                                                                                                 | 0.1 a call                      |
| 4    | `motion.json`, `motion.py char cand [dir ...]` | retarget the CMU take onto the root's skeleton (see below); writes `design/<char>/<cand>-<dir>.json` and a preview strip                                                                                                                 | 0                               |
| 5    | `gen_clip.py SEED char:cand:dir ...`           | `animate-with-skeleton-v3`, first frame the padded root with its skeleton, one CMU skeleton per frame                                                                                                                                    | 2-4 a job                       |
| 6    | `breath.py`                                    | the idle (4 cels) and the fighting stance (8 cels) from one root each: no generation (below)                                                                                                                                             | 0                               |
| 7    | `assembly.json`, `assemble.py`                 | which take each clip uses; palette lock, island clean, registration, trimming, sockets; writes `cels/<char>/` and `pack.json`                                                                                                            | 0                               |
| 8    | `node --import tsx scripts/art/party-g1.ts`    | lay out, encode lossless WebP, write the atlas, clip and bend JSON and `src/content/assets/partyG1.ts`, pin every decoded cel in `pins/` (run `npx prettier --write src/content/assets/partyG1.ts` after)                                | 0                               |
| 9    | `review_g1.py`                                 | `review/rollout/`: walk strips and GIFs, bends, hits, knockouts, faces, idle and stance, `metrics.json`                                                                                                                                  | 0                               |

`shipped/` freezes the shipped clip data, bend sets and riverside page as of main `cc715e7`: the timing, frame lists,
holds, key frames and attacks this rebuild keeps exactly. `tools/cmu/` is downloaded by `fetch-cmu.sh` (untracked; add
any new take there).

### What to copy for another character

1. **Roots from the character's own drawing in every heading**, never a rotation model's back view: redraw each
   heading's cel (here the shipped G cel reduced 2x) at the target size, then palette-lock to the character's palette.
   Check the back views for a turned face, invented ornaments and front details moved to the back.
2. **One retarget scale per character** (`char_scale`: the median over its eight headings).
3. **Walk legs from the root's leg midpoints** set apart by the performer's own mean pose; gait `track` 0.35 and pelvis
   `bob` x2. Without it the two steps land rows apart (the standing root has one foot ahead).
4. **Idle and stance are not generated** at this size: `breath.py`.
5. **Action text names an empty-hand form**, never an element ("fire bending" painted flames into the cels).
6. **Registration** (`assemble.py`): ADR 0050's rules with art:validate's bounds scaled to the grid.

## Motion (all CMU Graphics Lab, mocap.cs.cmu.edu; credited in `NOTICE.md`)

| clip                      | take                                                                                               | notes                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| walk, 12 cels, 8 headings | 08_01 walk                                                                                         | one gait cycle from a left-foot contact, root-locked; track 0.35, bob x2               |
| idle, 4 cels              | 77_02 standing                                                                                     | one breath cycle (frames 377-592) on one root, 1 px chest lift (`breath.py`)           |
| stance, 8 cels            | 77_03 ready stance                                                                                 | one breath cycle (514-745), as the idle                                                |
| rest, 1 cel               | the walk                                                                                           | the passing cel (3 or 9) that best overlaps idle cel 0, set on its sole                |
| hit, 8 headings           | Kaya 79_73 (48-72), Sura 76_03 (256-288), Bo 77_09 (212-234)                                       | as ADR 0063: stance, H1, H2, H3 (H2 at 0.4), stance; amplitude 1.35                    |
| knockout, 4 diagonals     | Kaya and Sura 90_18 (64-170), Bo 77_16 reversed (450-150)                                          | the thug's bone-rotation retarget (absolute blend, per-diagonal turn, root travel 0.7) |
| bend, 8 headings          | Kaya 143_23 (195-365), Sura 12_04 (5380-5700), Bo 135_04 (520-556, chamber and stamp) + 143_23 jab | frames, holds, timing, keys and attacks exactly as shipped (`shipped/`)                |
| cast (legacy, mirrored)   | the east bend                                                                                      | its stance, last wind-up and first strike                                              |

## Measurements (`review/rollout/metrics.json`, world grid)

|                                        | #290 A       | this rollout            |
| -------------------------------------- | ------------ | ----------------------- |
| idle boil (max pair, #290's measure)   | 36-54%       | 7-14%                   |
| stance boil                            | -            | 9-17%                   |
| walk contact rows (drawn cels 0 and 6) | 5-7 px apart | 0-3 px apart (most 0-1) |
| head bob                               | none         | about 2 px              |
| colours a cel                          | 30-49        | 19-33                   |

## Fault list (honest)

- **Sura's east stance and bend read grey.** Seen side-on her pale front panel covers most of her, as in the shipped east
  stance; three bend seeds (s9502, s9503, s9504 with a "stays slate blue" description) all kept it. s9502 ships.
- **Kaya's north stance** keeps a few small gold studs across the back (the first seed drew a gold Y ornament).
- **Sura's north-west walk** shows the skirt spiral on the back three-quarter view.
- **Bo's north idle** hair is a shade lighter brown than his black elsewhere.
- **Bends:** a few in-betweens smear a hand (Kaya north-west cel 6); Bo's stamp is a low forward stomp-kick in the east
  and west views, not a straight-down stamp; Sura's tai chi push rises over her head seen from the east.
- **Riverside wave and tea** are the shipped cels reduced 2x (#290's B rule), not redrawn: not in this rebuild's scope.
- **Sockets** are the requested skeleton's points (wrists snapped to the drawn hand), not measured from the drawing.
- Each `edit-image-pro-flash` job returned its first two candidates byte-identical, so a job is two picks, not three.

## History: the #290 comparison (route A chosen)

Issue #284. The world is being restyled at **G1, 1 art px = 1 world px** (draft #287), and the market objects match it (draft
#288). The party's G sheets are twice as fine: Kaya's idle is 118 sheet px tall and drawn at 59 world px. This folder asks
whether the party looks more consistent with the world when it is rebuilt **on the world's own grid**, and how.

At the time nothing here shipped. The owner chose variant A on 27 October 2026; the rollout above is what ships.

## The three versions

| Version     | What it is                                                                                                                                 | Generations |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------: |
| **current** | The shipped G cels (`public/art/units/<char>-g*.webp`), as the game draws them                                                             |           0 |
| **A**       | Regenerated natively on a 64x96 world-px canvas in PixelLab v2, with the shipped identity as the input                                     |        ~102 |
| **B**       | The shipped cels reduced 2x by a deterministic script (`tools/reduce.py`): one palette per character, 1 px `#1b1410` contour, no smoothing |           0 |

### A, step by step (`ledger.json` has every job)

1. **South root** (`tools/gen_a_south.py`). `edit-image-pro-flash`, method `text`, on B's south idle cel (64x96). B carries
   the shipped identity at the right size and foot baseline, and the edit redraws it as native pixel art. Prompt: the
   objects' rules (1 px dark brown outline, 3–4 flat tones per material, upper-left light, matte) plus the character's own
   PixelLab description (`tools/chars.json`, copied from the party's PixelLab characters). Two seeds per character; chosen
   Kaya s9102, Sura s9101, Bo s9101.
2. **Rotations** (`tools/gen_a_rot.py`). `create-character-pro-flash` with that south as `first_frame`, `view: high top-down`.
   The 64x96 is padded to a 96x96 canvas, 16 px each side, with the foot baseline unchanged.
3. **Skeletons** (`tools/skeletons.py`). `estimate-skeleton` on S, SE and E.
4. **Motion** (`tools/design.py`, `tools/gen_motion.py`). The residents' CMU retarget from draft #286 (`design.py` and
   `mocap.py` copied; only the paths and the 96 px canvas changed), driving `animate-with-skeleton-v3` with the rotation as
   first frame. Walk: CMU 08_01, one gait cycle from a left-foot contact, 12 cels (Kaya's shipped walk has 12), root-locked.
   Idle: CMU 77_02 standing, 4 cels. No hand-keyed pose and no PixelLab walk template.
5. **Assembly.** `assembly.json` names the takes, and `tools/select_a.py` copies them to `a/<char>/<clip>/<dir>/`.

### B

`tools/reduce.py`, run per character, works on 2x2 blocks:

- **Palette:** a 48-colour median cut of every opaque pixel of every cel, plus `#1b1410`, shared by all headings and frames.
- **Alpha:** a block is opaque when at least 2 of its 4 pixels are.
- **Colour:** the block's mean, snapped to the palette.
- **Contour:** a 1 px `#1b1410` edge.
- **Clean:** single-pixel salt removal.

Same input, same bytes. A vote mode, where the most frequent colour wins and dark pixels win ties, was tried first: it
smeared hair over Sura's eye and spotted the faces, so mean is the default.

## Review files (`review/`)

| File                               | What                                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mock-3way-ipad.webp`              | #287's Route A slice mock at game zoom (1368x714, 1.5 screen px per world px), stacked current, A, B. Same ground, tiles, headings, occlusion and shadow. |
| `mock-{current,a,b}-ipad.webp`     | The three panels one by one                                                                                                                               |
| `crops-4x.png`                     | 4x nearest crops of each figure in place: face, hands and feet against the bench, wall and stones. Rows: current, A, B.                                   |
| `faces-native-8x.png`              | S, SE and E heads on the world grid at 8x                                                                                                                 |
| `rotations-a-vs-b.png`             | All eight headings, A over B                                                                                                                              |
| `idle-sheet.png`                   | S, SE and E idles, 4 cels each: current, A, B                                                                                                             |
| `walk-strip-se.png`, `walk-se.gif` | The 12-cel south-east walk, current, A and B per character (GIF at 90 ms per cel)                                                                         |
| `metrics.json`                     | Boil, colour count, contour and foot rows                                                                                                                 |

Mock headings: Bo idle SE and Sura idle NW, as #287 placed them. Kaya walks SE at cel 3 instead of #287's SW, because A
has no SW walk. A's NW is its static native rotation.

The resample is the same for all three: A and B go through #287's `up15` (EPX x2, then a 0.75 Lanczos), the same path as
#287's ground. "Current" is the shipped cel at a 0.75 Lanczos, as #287 placed it.

## Measurements (`metrics.json`, world grid)

| per cel, S / SE / E          | current               | A                         | B                 |
| ---------------------------- | --------------------- | ------------------------- | ----------------- |
| distinct colours             | 725–1033              | 30–49                     | 44–49             |
| silhouette edge at `#1b1410` | 14–22 %               | 71–97 %                   | 100 %             |
| soft (semi-transparent) edge | 100 %                 | 0 %                       | 0 %               |
| idle boil (max pair)         | 14–26 %               | **36–54 %**               | 12–22 %           |
| walk foot rows (12 cels)     | 80–86, two even steps | 76–84, steps 5–7 px apart | 79–86, as current |

Boil uses the residents' measure: the share of the silhouette that changes after the best whole-body shift. At #286's sheet
scale the shift is 3 px; here it is 2 world px.

## Fault list (honest, against #284's questions)

**Same hand as the world? A yes, B partly, current no.**

- **A** matches #287 and #288 most closely: a crisp dark 1 px contour, flat 3–4 tone materials, 30–49 colours (the objects
  use 27–51), and no soft edge. Beside the bench, wall and stones (`crops-4x.png`), A is the one that reads as one hand.
- **B** has the right grain and contour, but its interior keeps the shipped painting's mottle: blotchy tone patches in
  Sura's skirt and Bo's trousers. It reads darker and muddier than the world. The contour also eats the thin parts:
  Kaya's face is mostly hair and outline in SE.
- **Current** is the only one with soft edges and about 900 colours per cel. It is visibly a finer, softer medium than
  #287's world.

**Identity drift (A only; B is exact by construction)**

- **Kaya A:**
  - Boots come out lighter orange-brown (shipped: dark brown). This starts in the south root, so every heading
    inherits it.
  - A gold hem appears on the coat tails, and the hip panel carries an "L"-shaped gold mark (gibberish detail).
  - The east coat tail reads as a flat board.
  - The ponytail hangs loose in the back views.
  - Her hair is a warmer, lighter brown.
- **Sura A, s9201 (used):** the braid is missing in NE, N and NW, where her hair reads as a short bob. My first prompt had
  dropped "visible down her back in back and side views". With the full prompt (s9202, probe), the braid returns from
  behind but sticks straight out sideways in SE, E and W, and her tunic becomes a skirt from behind. **Neither seed
  holds the braid in all eight headings.**
- **Bo A** holds best. The face is simplified and younger, and the shipped "broad grin" is gone.
- In the walk and the idles, A keeps the same face, costume and palette from cel to cel. The drift above is between
  headings, not between frames.

**Faces at 59 px**

- **A:** faces read. Eyes are 1 px, Sura's are blue, and Bo's face is clear (`faces-native-8x.png`).
- **B:** faces are muddy, as current is at this size. The reduction averages eyes into skin shadow.
- **Current:** faces are soft blurs at play size.

**Element colours**

- All three read as fire red, water blue and earth green.
- **A** pushes Kaya's sash to a brighter red with more gold; this is her most noticeable change.
- **B** keeps the shipped hues, slightly darker.

**Boiling between frames**

- **A idles boil at 36–54%**, about twice the shipped 14–26%. Most of this is real 1 px breathing: at 59 px, a shoulder
  rising one pixel changes a big share of the figure, and a deterministic de-boil (`tools/deboil.py`: palette lock, revert
  specks of 3 px or fewer) changed it by at most 1 point. Some is redraw: Kaya's bracer and sash shading shift between cels.
- The softer 0.6x idle (s9301) came back **frozen**: SE and E were four identical cels, and the south had one stray cel.
  So at this size the generator gives either a still figure or a visible redraw. Neither matches the shipped idle.
- **A's walk** shows no frame-to-frame redraw of costume or face.
- **B's walk and idles** boil exactly as the shipped ones do, because they are the shipped motion.

**Feet**

- A's walk follows the CMU skeleton faithfully. Seen from the SE, the far foot plants 5–7 px higher on screen than the
  near foot, and the head does not bob. The shipped walk is registered so both steps land on one row with a 2–3 px bob.
  In motion this may read as a limp or hitch. It needs the G pipeline's foot registration (`walkDy`, ADR 0050) applied to
  A before any judgement on planted feet.

**Scale**

- All three stand 59–64 world px.
- A's south root kept the shipped height exactly (bbox rows 21–80).

## Recommendation

**Rebuild the party on the world grid, by route A, but not as a straight rollout.** At game zoom, A is the only version
whose contour, tone groups and colour count match #287's world and #288's objects. It is also the only one whose faces read
at 59 px. B costs nothing and keeps identity and motion exactly. But it keeps the mismatch the owner flagged ("soft, many
colours") in a crisper form, and it loses the faces.

A needs three fixes before it ships:

1. **Per-heading identity curation.** Choose rotations per heading across seeds, or edit the bad ones (Sura's braid,
   Kaya's boots and hem). Pin the palette to the shipped one for the root. Expect 2–3 seeds per character for the
   far-side headings.
2. **Idle:** a better answer than frozen or boiling at this size. One option is fewer cels with a longer hold. Another is
   to generate the idle at 2x and reduce it with B's script, which locks the palette by construction. Untested.
3. **Foot registration** through the existing G placement rules (ADR 0050 `walkDy`), then a planted-feet check in motion.

## Rebuild

```sh
python3 -I art/source/party-g1/tools/extract.py      # ref/ from the shipped atlases (untracked)
python3 -I art/source/party-g1/tools/reduce.py       # b/
sh art/source/party-g1/tools/fetch-cmu.sh            # tools/cmu/ (untracked)
python3 -I art/source/party-g1/tools/select_a.py     # a/<char>/<clip>/ from raw/ per assembly.json
ROUTE_A_TREE=<checkout of claude/ba-dan-route-a with .review/regions built per its README> \
  python3 art/source/party-g1/tools/mock.py
python3 art/source/party-g1/tools/review.py
```

The generators (`gen_a_south.py`, `gen_a_rot.py`, `skeletons.py`, `gen_motion.py`) need `PIXELLAB_API_KEY`. They return a
job the ledger already holds instead of paying for it twice. Three rotation jobs crashed on the image download (the file
host refuses Python's default user agent) after billing; they were recovered by character id, so their job id and
reported generations are missing (see `ledger.json` `summary`).

Motion: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), takes 08_01 and 77_02, free for any use. If any of
this ships, the takes go in `NOTICE.md` and `src/content/credits.ts` beside the existing CMU lines.
