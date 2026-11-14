# The element effect cels at G1: sources (ADR 0086)

Everything `scripts/art/fx-g1.ts` reads, pinned by SHA-256 in `pins.json`. The painted bend effects page it also
packed went with the bends (ADR 0104 T7): its three sheets and layout are dropped here, and `ledger.json`,
`tools/inputs.py` and `review/` keep the history of how it was made.

| path                    | what                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inputs/<sheet>.png`    | the painted effects reduced 2:1 (bend cels to world px, element cels to the 96 px master), by `tools/inputs.py` from the shipped files this pass replaced (`main` at 5a41f98) |
| `generated/<sheet>.png` | the accepted PixelLab Pro Flash clean-up of each input sheet (output 0 of its job)                                                                                            |
| `layout.json`           | where each cel sits on its sheet                                                                                                                                              |
| `ledger.json`           | every PixelLab job: request (images named), job id, status, generations                                                                                                       |

**Generations:** 16 jobs, 144 generations (9 a job), all completed, one seed (11), none re-rolled. Every generated
sheet is used except the earth crack's five cels (`PAINTED_ONLY` in the packer: Pro Flash drew the fissure as pale
rays) and the flask's last three cels (the flask is one rigid vessel; cel 0 is repeated).

## Rebuild

```bash
python3 -I art/source/fx-g1/tools/inputs.py      # only to remake the inputs (needs the painted files from 5a41f98)
python3 -I art/source/fx-g1/tools/generate.py <sheet> ...   # PixelLab; cached by tag in the ledger
node --import tsx scripts/art/fx-g1.ts --pin     # after accepting a new sheet (run prettier on layout/ledger first)
node --import tsx scripts/art/fx-g1.ts           # write the five cel sheets
node --import tsx scripts/art/fx-g1.ts --check   # prove the shipped files are what the sources make
python3 -I art/source/fx-g1/tools/crops.py <before> <after> <out>   # review crops of the practice captures
```

`tools/pl.py` is the Route A client (`art/source/ba-dan-route-a/tools/pl.py`) with this folder's ledger; raw job
outputs go to `art/raw/fx-g1/` (ignored). It never prints the key.
