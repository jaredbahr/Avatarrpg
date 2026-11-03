# ADR 0078: The thug's own hit reactions and knockouts

Status: accepted for the thug; ADR 0079 (slinger) and ADR 0080 (bruiser) extend the same recipe.

## Context

ADR 0059 and ADR 0063 gave the party their own knockouts (four diagonals) and
hit reactions (eight headings), drawn per character and played from the
sheet's `clipData`. The thug, the first enemy on a G sheet, still flinched and
fell in the old mirrored one-cel poses. His idle and walk are PixelLab cels
drawn from his approved rotations, so a drawn flinch and fall had to come from
the same rotations without changing his identity, palette, scale or feet.

An earlier attempt retargeted a swing and a flinch onto the thug's own skeleton
and every south-east frame came back facing the viewer's left. The cause was
the design, not the model: the skeleton's face points were re-derived from the
shoulders, so any torso twist turned the face. The party's recipe holds: the
head rides the neck with the approved cel's own orientation, and the first frame
is that facing's approved cel under the literal direction name its walk used.

## Decision

- **Hit** (`hit<Heading>`, eight headings): stance, H1, H2, H3, stance, as the
  party's. Motion is CMU 79_73 (frames 48 to 72, amplitude 1.35), the same
  capture Kaya's flinch uses. 70 ms contact plus an 80 ms hit-stop on H1, as hers.
- **Knockout** (`ko<Diagonal>`, the four diagonals the runtime falls on): CMU 90_18
  (frames 64 to 170), the capture Kaya falls to, retargeted bone by bone onto the
  thug's own lifted stance with the party's absolute-direction blend, a per-diagonal
  heading turn that lays the body along a screen diagonal, and a root travel of 0.7
  so the fall fits the 192 px canvas without shifting the first frame.
- **Registration**: every cel goes through the G build's 75% map with the idle's
  own placement (`headingDx`, `idleDy`), frame 0 of every take is the idle's cel 0
  (its hash is held to the idle pin), and a hit ends on it. The clip's anchor is the
  sheet's foot point, so the thug stands on the same feet at the same size.
- **Tone**: every generated cel is toned by `tone_thug.py` with the frozen
  `params-v3.json` his idle and walk were; the tool and parameters are copied under
  `art/source/thug-actions-g/tone/`.
- **Pages**: `thug-g-2` (knockouts), `thug-g-3` (hits) and `thug-g-clips.json`, listed
  in the manifest for the thug only. `scripts/art/enemy-clips.ts` is the enemy twin
  of `g-clips.ts`; `thug-clips.ts` defines the thug. `art:validate` accepts an
  enemy's idle cel 0 as the stance a clip registers on, since an enemy has no
  fighting stance.
- **Out of scope**: a directional attack. The runtime's melee is a two-frame clip
  with screen-up and screen-down variants and has no heading contract to draw into.

## Budget

Units go from 6,253,289 B (5.96 MiB) to 6,405,200 B (6.11 MiB) against the 6.75 MiB
ceiling: 151,911 B for two pages and the clip data. This ADR does not raise any
ceiling.

## Consequences

- The thug flinches and falls in his own drawing in every heading, with the
  party's timing. `hasSingleCelHit` no longer holds for him, so his hit plays the
  authored span like the party's.
- Credits: the two CMU entries in `credits.ts` and `NOTICE.md` now also cover the
  thug's pages, carrying CMU's requested acknowledgement.
- Provenance and the ledger of every generation are in `art/source/thug-actions-g/`
  (`ledger.json`, `design/`, `assemble.py`, `gates.py`, `review.py`).
- Known flaws ship as they are, pending review. The flinch is small and hunches the
  figure below what its skeleton predicts: 14 of the 24 hit H-frames (south-east,
  south-west and west on all three, south and north on two, east on one) and 4 early
  falling frames fail the party's 0.03 size gate (largest 0.075). Two frames fail the
  facing gate: south H2 (the rag flares and widens the head 22%) and north-east K1,
  which is falling. No frame swings to profile. The full table is `art/source/thug-actions-g/facing-pitch.md`
  until that folder is dropped, and `gates.py` regenerates it.

## Amendment: retakes after an art review

An independent review found the south-east and south-west knockouts held on a lying
frame with the club standing straight up out of the chest. Retaken, same design
skeletons (CMU 90_18, the per-diagonal turns), the right wrist lowered onto the ground in
the last frames of the request (`design/kp` is unchanged; the lowered wrist is a request
edit recorded in `ledger.json`):

- south-east knockout: seed 4202 (job `f32225fe-5227-41cb-967c-725270432768`), frames
  0 to 5 of 7. The club ends under the body with its handle in the hand and a faint
  knob over the thigh in the last cel; it never stands up.
- south-west knockout: seed 4203 (job `187cb916-87ac-44e7-bc8c-98e3573c5deb`), frames
  0 to 5. The club leaves the hand early; a small stub shows behind the belt in the last
  cels and nothing stands up.
- north-east knockout: not retaken. Its last cel still loses the club (a take that
  dropped it to hold frame 4 failed the packer's no-duplicate-cel rule, which is kept).
- south hit: seed 4102 (job `8af328f5-654b-4da0-baca-d2704986e02c`).
- A north hit retake (seed 4102) came back worse (no club in H2 and H3, fragmented H1)
  and is not used. The north-west knockout was not retaken.

Nothing was pixel-edited. Every other cel, including the stances, is byte-identical.
`facing-pitch.md` is regenerated and `gates.py` now reports 18 failing frames.
