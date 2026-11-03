# Thug hits and knockouts (art source)

> **History (ADR 0091).** This set no longer ships: the sheet is redrawn on the world's native G1 grid from
> `art/source/residents-g1/` and packed by `scripts/art/residents-g1.ts`. Its packer was retired; the files stay as the record.

What `scripts/art/thug-clips.ts` packs, and where each piece comes from. ADR 0078.

| Folder / file   | What                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `design/`       | The CMU-retargeted skeletons (see its README) and the candidate table.                            |
| `raw/`          | The PixelLab frames as downloaded, untoned, one folder per job (`<clip>-<dir>-s<seed>`).          |
| `assembly.json` | Which raw frames each take uses; superseded jobs stay in `raw/` and `ledger.json`, unused.        |
| `assemble.py`   | Tones the frames (`tone/tone_thug.py apply --params params-v3.json`), adds the stance, pins feet. |
| `cels/`         | The packer's source: `<clip>/NN.png` and `timing.json` per take, plus the tone manifest.          |
| `pins.json`     | SHA-256 of every cel, timing file and decoded atlas cel; written by `thug-clips.ts --pin`.        |
| `gates.py`      | The per-frame facing and pitch table.                                                             |
| `review.py`     | Contact sheets and GIFs from the built atlas.                                                     |
| `ledger.json`   | Every PixelLab job: id, seed, generations, verdict.                                               |

Rebuild: `py -I assemble.py assembly.json`, delete `pins.json`, `node --import tsx scripts/art/thug-clips.ts --pin`, then
`node --import tsx scripts/art/thug-clips.ts`. The first frame of every job is the thug's approved rotation under the literal
direction name his walk used, with the stance skeleton as `first_frame_keypoints`; the motion is CMU Graphics Lab mocap
(mocap.cs.cmu.edu, free for any use; credit line in `NOTICE.md`).
