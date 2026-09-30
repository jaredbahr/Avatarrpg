# ADR 0063: G hit reactions from licence-safe motion

**Status:** accepted, 2026-09-29

## Context

ADR 0059 shipped the G party's knockouts and held back their hit reactions:
the first hand-off's hits were retargeted from mocapdata.com capture under CC
BY-SA, which `src/content/credits.ts` does not accept. A struck G party member
kept drawing the legacy hit, one mirrored cel from the old sheet.

Round 3 of the hand-off redid the hits from CMU Graphics Lab capture, whose
terms `credits.ts` already accepts (ADR 0059): Kaya from 79_73 ("scared",
frames 48 to 72), Sura from 76_03 ("avoid attacker", 256 to 288) and Bo from
77_09 ("duck to avoid flying object", 212 to 234). There are 24 takes, one for
each character in each of the eight literal headings, named
`<name>-hit-<dir>-lic`. Each is five frames: the stance, H1 (contact), H2
(extreme), H3 (recovery) and the stance again. Every take is drawn on its
heading's approved stance with one camera. Timing is per character: Kaya
400 ms with an 80 ms hit-stop, Sura 470 + 70, Bo 540 + 110. Sura's and Bo's
cels arrive toned and are never re-toned; Kaya's are never toned. The
round-1 hits and the round-3 rejected seeds (`*-s4101-rejected`) are not used.

## Decision

1. **Clip names.** A G sheet may author `hitEast`, `hitSouthEast`, `hitSouth`,
   `hitSouthWest`, `hitWest`, `hitNorthWest`, `hitNorth` and `hitNorthEast`
   (`hitClip`). A sheet that authors any of them authors all eight, timed cel
   by cel, and declares eight-way locomotion (`sheetClipProblems`). East is
   suffixed too, because the bare `hit` stays the legacy cel. The hit clips
   are never mirrored (`authoredForBothSides`). A heading hits in its own
   drawing: unlike a knockout, there is no diagonal to fold it onto.
2. **Packing.** `scripts/art/g-clips.ts` packs clip sets: the knockouts, then
   the hits. Each set has its own pin file (`art/source/<name>-clips`,
   `art/source/<name>-hits`) and its own pages. The hits go on
   `<name>-g-4.webp`, so the knockout page is re-encoded byte for byte and its
   pins do not move. Registration, sampling and the stance tolerance are the
   knockouts' (ADR 0059). Each take registers once, on its frame 0, and every
   frame of the take is sampled through that one registration, which is what
   keeps one camera per take. A hit's frame 4 must repeat its frame 0: it is
   packed once, named twice, and the build stops otherwise. The contact
   frame's time includes the take's hit-stop. The clips ride in the same
   `<name>-g-clips.json` as the knockouts.
3. **Licence gate.** Every take is a `-lic` folder. A hit timing file whose
   `attribution` does not credit mocap.cs.cmu.edu, or which mentions
   mocapdata anywhere, stops the build. `art:validate` holds each hit's
   frame 0 to its own heading's shipped stance cel with exact alpha, and its
   last frame to that same cel.
4. **Playback.** On a sheet that carries G hits, a struck party member plays
   the hit for the heading it faces, once, from the moment of contact, for the
   clip's own length (at the motion rate). The game's hit flash is unchanged.
   Nothing shoves the sprite: the takes' feet are pinned, and the legacy
   recoil offset would slide them over the ground. A push that lands during a
   G hit does not restart it. A push on its own plays one hit through, past the
   end of the slide. Sheets without hits, and a G sheet whose clip data has
   not loaded, keep the legacy hit, hold and recoil (`resolveClip` falls
   `hit<Heading>` back to `hit`).

## Budget

| file       | page WebP | page JSON | clip JSON growth |
| ---------- | --------: | --------: | ---------------: |
| `kaya-g-4` |  63,482 B |   5,952 B |          2,382 B |
| `sura-g-4` |  62,408 B |   5,985 B |          2,427 B |
| `bo-g-4`   |  63,450 B |   5,917 B |          2,349 B |

Units go from 5,890,807 B to 6,105,159 B (5.82 MiB), against the 6.75 MiB
ceiling. The runtime cost is the clip names, their fallback rows and the
choreography branch. This ADR does not raise any ceiling.

## Timing

G hit reactions pre-roll their stance cel by the clip's first-frame time so
contact lands on the flash. A lethal G hit extends the turn by at most
`hit length - hit-stop`, about 420 ms for Kaya. When that pre-roll is clamped
at the batch start, the stance cel shows during the flash.

## Consequences

- A G party member flinches in its own drawing, in every heading, and the
  mirrored legacy cel is gone from G play. A hit reaction on a G sheet lasts
  480 to 650 ms, up from about 210 ms. It runs beside the next event, so it
  does not lengthen a turn.
- Credits: a CMU entry for the hit pages in `credits.ts` and `NOTICE.md`,
  carrying CMU's requested acknowledgement and the three clip ids.
- Known flaws from the hand-off ship as they are, pending Jared's review
  (REPORT-3 §7): the reactions are smaller than round 1's; Sura's fold is
  subtle in E, N and NW; Kaya W has a grey smear at the fists on H1–H3; Bo SW
  has a sash smear; and Bo's r10-seeded facings change arm pose between the
  stance and H1.
