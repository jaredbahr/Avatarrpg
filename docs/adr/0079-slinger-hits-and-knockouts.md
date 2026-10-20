# ADR 0079: The slinger's own hit reactions and knockouts

Status: accepted for the slinger; the bruiser and the quarry bender are unchanged.

## Context

ADR 0078 gave the thug drawn hit reactions (eight headings) and knockouts (four
diagonals) from his own approved rotations, on CMU capture, and recorded the
design that made it work: the head rides the neck with the approved cel's own
orientation, and the first frame is that facing's approved cel under the literal
direction name the walk used. The slinger is the next enemy on a G sheet and
still flinched and fell in the old mirrored one-cel poses.

## Decision

The same recipe, with only the unit changed.

- **Hit** (`hit<Heading>`, eight headings): stance, H1, H2, H3, stance. Motion is
  CMU 79_73 (frames 48 to 72, amplitude 1.35), timing 70 ms plus an 80 ms hit-stop on
  H1, as the thug's and Kaya's.
- **Knockout** (`ko<Diagonal>`): CMU 90_18 (frames 64 to 170), retargeted onto the
  slinger's own stance with the thug's per-diagonal heading turns and root travel 0.7.
  Every diagonal fits the 192 px canvas (`design/`).
- **Camera**: `view: high top-down`, the slinger's own `src_joints.json` stance skeleton
  as `first_frame_keypoints`, and his approved rotation URL for the facing as the first
  frame, with the literal direction names his walk used.
- **Registration**: frame 0 of every take is the slinger's idle cel 0 (its hash is held
  to the idle pin), a hit ends on it, and the clip uses the idle's own placement.
- **Tone**: every generated cel goes through `tone/tone_p1.py`, the frozen
  `params-v3.json` with the slinger's own skin mask, exactly as his idle and walk were.
  The tool, parameters and mask are copied under `art/source/slinger-actions-g/tone/`.
- **Pages**: `slinger-g-2` (knockouts), `slinger-g-3` (hits) and `slinger-g-clips.json`,
  listed in the manifest for the slinger as for the thug. `scripts/art/slinger-clips.ts`
  defines the unit over the shared enemy packer; the thug's output is unchanged.

## Budget

Units go from 6,405,200 B (6.11 MiB) to 6,551,459 B (6.25 MiB) against the 6.75 MiB
ceiling: 146,259 B for two pages and the clip data. This ADR does not raise any ceiling.
53 of the 70 PixelLab generations allowed were used; the ledger is
`art/source/slinger-actions-g/ledger.json`.

## Consequences

- Credits: the two CMU entries in `credits.ts`, `credits.notice.ts` and `NOTICE.md`
  now also cover the slinger's pages.
- Known flaws ship as they are, pending review. The sling is absent from every
  north-west hit frame (three takes, all without it; the rope is hidden behind the
  figure and the model drops it), and thin in the north hit. A small hood flap
  shows above the north-west hit's head. `gates.py` reports 24 frames failing the
  thug's facing or pitch gates (pitch error at most 0.062; the facing failures are
  head-width ratios from the hood, 1.2 to 1.65), and by eye no frame swings to
  profile. The north-west hit was retaken once more (seed 5104, job `be23832a-e04a-49e9-8f6d-aad9cd4e3454`, a description that insists on a long visible sling): still no sling, so the shipped take is unchanged after four attempts.
  The full table is `.review/slinger-actions/facing-pitch.md` until that folder is
  dropped.

## Amendment: retakes after an art review

The north-west hit's sling and the south-west and south-east knockouts' last-cel blobs are
not fixed: dropping the last frame to hold the one before is refused by the packer (a
duplicate cel must be a declared hold) and the takes have no spare frame to use instead.
`tone/params-v3.json` is restored byte-exact from the thug's copy (SHA-256
`d6f5afc6...1494`, the hash `tone_p1.py` checks; prettier had rewritten it) and
`.prettierignore` now lists the slinger's `tone/`, `design/kp/` and `cels/**/*.json` as
the thug's and bruiser's are. `assemble.py` was run against the restored file and rebuilds
every cel PNG byte-identical; only the `timing.json` files changed (they are no longer
prettier-formatted), so `pins.json` was re-pinned.
