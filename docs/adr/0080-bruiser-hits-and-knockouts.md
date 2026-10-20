# ADR 0080: The bruiser's own hit reactions and knockouts

Status: accepted for the bruiser; the quarry bender is unchanged.

## Context

ADR 0078 and ADR 0079 gave the thug and the slinger drawn hit reactions (eight
headings) and knockouts (four diagonals) from their own approved rotations, on CMU
capture. The bruiser is the next enemy on a G sheet and still flinched and fell in the
old mirrored one-cel poses. His sheet is wider than the others (160 px cel, so the
heavy club clears the margin), and the club is the part of him the model loses most.

## Decision

The same recipe, with only the unit changed.

- **Hit** (`hit<Heading>`, eight headings): stance, H1, H2, H3, stance. Motion is
  CMU 79_73 (frames 48 to 72, amplitude 1.35), 70 ms plus an 80 ms hit-stop on H1.
- **Knockout** (`ko<Diagonal>`): CMU 90_18 (frames 64 to 170), retargeted onto the
  bruiser's own stance with the thug's per-diagonal heading turns and root travel 0.7.
  `design/sweep.py` shows every diagonal fits the 192 px canvas unshifted.
- **Camera**: `view: high top-down`, the bruiser's own `src_joints.json` stance skeleton
  as `first_frame_keypoints`, and his approved rotation URL for the facing as the first
  frame, under the literal direction names his walk used. No upload.
- **Registration**: frame 0 of every take is the bruiser's idle cel 0 (its hash is held
  to the idle pin), a hit ends on it, and the clip uses the idle's own placement. The
  packer trims each take to its ink, so the 160 px sheet needs nothing special; the
  clip's `frameSize` and anchor are measured from the take.
- **Tone**: every generated cel goes through `tone/tone_p1.py`: the frozen
  `params-v3.json` (the thug's file, SHA-256 `d6f5afc6...`) with the bruiser's own skin
  mask, exactly as his idle and walk were. Copied under `art/source/bruiser-actions-g/tone/`.
- **Pages**: `bruiser-g-2` (knockouts), `bruiser-g-3` (hits) and `bruiser-g-clips.json`,
  listed in the manifest for the bruiser as for the thug and the slinger.
  `scripts/art/bruiser-clips.ts` defines the unit over the shared enemy packer; the thug's
  and the slinger's output is unchanged.

## Budget

Units go from 6,551,459 B (6.25 MiB) to 6,728,256 B (6.42 MiB) against the 6.75 MiB
ceiling: 176,797 B for two pages and the clip data. This ADR does not raise any ceiling.
46 of the 75 PixelLab generations allowed were used (first pass 28, retakes 18); the
ledger is `art/source/bruiser-actions-g/ledger.json`.

## Consequences

- Credits: the two CMU entries in `credits.ts`, `credits.notice.ts` and `NOTICE.md`
  now also cover the bruiser's pages.
- Known flaws ship as they are, pending review. The north hit hides the club behind the
  body in H3, and the north-west idle and hit hide it throughout. The north-west and
  south-east hits still flare the rag tail, which fails the facing gate's head-width ratio
  (1.26 to 1.43); by eye no frame swings to profile. `gates.py` reports 12 failing
  frames, the largest pitch error 0.088. The full table is
  `.review/bruiser-actions/facing-pitch.md` until that folder is dropped.

## Amendment: retakes after an art review

- south-east knockout: seed 5201 (job `49ee734a-eaad-43a4-9cd7-7353eed96902`), the right
  wrist lowered onto the ground in the last two frames of the request. The club now lies
  across the thigh in the hand; nothing stands up.
- south-west knockout: seed 5201 (job `561a9e84-1eaa-4a2f-b4e4-d6b964a4bc4f`) and a seed 5202
  take (not used) also stood the club up, so the held frames carry **one pixel edit**
  (`lay_club.py`, raw frames 4 and 5 of the 5201 take, kept as `raw/ko-south-west-s5201e/`):
  the upright part of the club (every opaque pixel above the body's top edge inside the
  club's own columns) is cut out and put back rotated 90 degrees counter-clockwise,
  the generator's own pixels with nothing painted, behind the thigh on the far side, its
  handle end at the original handle column. Frame 3 of that take (the club leaning)
  and everything else is unedited.
- south-east and north-west hits: seed 5203 (jobs `19d64aab-cc3d-4102-8ced-89f8ef00d89f`,
  `eebb5265-2510-4393-b11e-8c404e656ea6`), with a description that ties the rag flat.
  The tails are shorter but still flare; `gates.py` still reports 12 failing frames.
