# Bruiser hits and knockouts (art source)

> **History (ADR 0091).** This set no longer ships: the sheet is redrawn on the world's native G1 grid from
> `art/source/residents-g1/` and packed by `scripts/art/residents-g1.ts`. Its packer was retired; the files stay as the record.

What `scripts/art/bruiser-clips.ts` packs, and where each piece comes from. ADR 0080; the same layout and recipe as
`../thug-actions-g/` (ADR 0078) and `../slinger-actions-g/` (ADR 0079), with the bruiser's own stance skeleton, approved rotations, idle cels and skin mask.

| Folder / file   | What                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design/`       | The CMU-retargeted skeletons (`design.py` hits, `ko.py` knockouts, `clips.json`, `kp/`).                                                                   |
| `raw/`          | PixelLab frames as downloaded, untoned, one folder per job (`<clip>-<dir>-s<seed>`); superseded kept.                                                      |
| `assembly.json` | Which raw take each facing uses.                                                                                                                           |
| `assemble.py`   | Tones the frames (`tone/tone_p1.py`: frozen params-v3 + the bruiser's skin mask), adds the stance.                                                         |
| `cels/`         | The packer's source: `<clip>/NN.png`, `timing.json`, tone manifest.                                                                                        |
| `pins.json`     | SHA-256 of every cel, timing file and decoded atlas cel; written by `bruiser-clips.ts --pin`.                                                              |
| `gates.py`      | Per-frame facing and pitch table. `review.py` makes contact sheets and GIFs from the built atlas.                                                          |
| `fetch.sh`      | Downloads a job's frames from the tool's own download URLs. `rawsheet.py` contact-sheets the raw takes.                                                    |
| `ledger.json`   | Every PixelLab job: id, seed, generations, verdict.                                                                                                        |
| `lay_club.py`   | The one pixel edit (ADR 0080 amendment): lays the upright club down in held frames 4 and 5 of the south-west knockout; output `raw/ko-south-west-s5201e/`. |

Rebuild: `py -I assemble.py assembly.json`, delete `pins.json`, `node --import tsx scripts/art/bruiser-clips.ts --pin`, then
`node --import tsx scripts/art/bruiser-clips.ts`. The design scripts read the hand-off's `models-p1-bandits/bruiser/` (stance
joints, rotations) and the CMU files under `models-p0p1/work/` (read only). The first frame of every job is the bruiser's
approved rotation under the literal direction name his walk used; the motion is CMU Graphics Lab mocap
(mocap.cs.cmu.edu, free for any use; credit in `NOTICE.md`).

**Inputs outside this repository.** `design/design.py` reads the CMU mocap copies and the rotation skeleton from the art
hand-off folders on the authoring machine (`D:/AvatarRPG-tools/models-p0p1/`, `models-p1-bandits/`, `bend-style-source/work`),
which are not tracked. They only regenerate the committed `design/kp/` skeletons; the shipped clips rebuild from tracked files alone.
