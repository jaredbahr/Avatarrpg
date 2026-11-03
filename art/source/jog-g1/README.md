# The jog (ADR 0095)

Every native-G1 figure (Kaya, Sura, Bo; the household adult, the relief watch, Mira, Gao, Pella, Dorin; the thug, the
slinger, the bruiser) jogs at the brisk 500 ms a tile, so its planted foot holds the ground; a resident's routine errand
walks at 2 s a tile. The takes, designs, cels and pins live in each family's own folder (`art/source/party-g1/`,
`art/source/residents-g1/`), made by their recipe; this folder holds the review and the two tools that are the jog's own.

## How it was made

| step     | where                                                    | what                                                                                                                                                                      |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| take     | `motion.json` `_shared.jog` (both families)              | CMU 09_01 (run), frames 40-129, ten cels; `stride` 1.6 (knees' and ankles' fore-aft swing), `arms` 1.2, `bob` 1.5, track 0.35, scaled by 09_01's own torso (`scale_clip`) |
| design   | `motion.py NAME jog`                                     | the retarget, writes `design/<name>/jog-<dir>.json`                                                                                                                       |
| cels     | `gen_clip.py 9901 NAME:jog:DIR`                          | `animate-with-skeleton-v3`, 3 generations a heading; the thug's east is s9902 (`assembly.json` `_why`)                                                                    |
| assembly | `assemble.py`                                            | crop as the walk; contact cels' soles on idle's in every heading; upper body centred; ink inside the clear margin cleared (`jogClampedPx` in `pack.json`)                 |
| pack     | `scripts/art/party-g1.ts`, `scripts/art/residents-g1.ts` | page 1 of each sheet, pinned                                                                                                                                              |
| timing   | `walk_stride.py --manifest`                              | each heading's loop fitted on the drawn cels; the manifest stores the shared shape `G1_HEADING` and one east loop a family `G1_JOG` (ADR 0095 has the table)              |

## Review (`review/`)

| file                                      | what                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stride-before.json`, `stride-after.json` | `walk_stride.py`'s rows: the shipped walks at ADR 0067's timing, and the jog (and the residents' errand walk) as shipped, at figure scale 1.0 and 1.25 |
| `strips/<name>-walk-jog.png`              | the walk over the jog, all eight headings, 3x, foot line in red                                                                                        |
| `strips/<name>-jog.gif`                   | the jog in every heading at its east cadence at 500 ms a tile                                                                                          |
| `ingame/ba-dan-after.gif`                 | the party jogging through the Ba Dan demo slice, every 40 ms on a stepped clock (one GIF px a world px)                                                |
| `ingame/ba-dan-frame40-before-after.png`  | the same frame of that run on main (walk) and here (jog)                                                                                               |
| `ingame/forest-{before,after}.gif`        | Kaya's four-tile move in the forest fight, main and here, every 40 ms                                                                                  |

Rebuild the review: `python3 -I art/source/jog-g1/tools/strips.py`, then
`FNT_JOG_LABEL=after npx playwright test -c playwright.jog.config.ts` (and `before` on a checkout of main) and
`sh art/source/jog-g1/tools/gifs.sh .shots/jog art/source/jog-g1/review/ingame`. Canvas backend only: WebGL on this
container's software rasteriser is too slow to film.
