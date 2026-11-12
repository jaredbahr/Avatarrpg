# Music sources

Masters as delivered from Suno (owner's paid plan, 2026-11-08, 2026-11-09 and 2026-11-12). They are **not
shipped**: nothing under `audio/source/` is copied to `public/` or precached. The game streams seamless loops cut
from them (ADR 0108).

| File                           | Where it plays                                                     | Length | Loudness                   | Notes                                    |
| ------------------------------ | ------------------------------------------------------------------ | ------ | -------------------------- | ---------------------------------------- |
| `ba-dan-morning-market.mp3`    | Ba Dan village                                                     | 3:08   | -15.8 LUFS, peak -3.6 dBFS | Ends on a fade; looped 34.4 s to 124.7 s |
| `forest-road-forest-watch.mp3` | Forest Road, both ways                                             | 3:17   | -15.5 LUFS, peak -3.9 dBFS | Ends on a fade; looped 70.4 s to 140.7 s |
| `main-menu-hollow-fanfare.mp3` | Title screen / main menu                                           | 1:37   | -16.4 LUFS, peak -2.5 dBFS | Ends quietly; looped 34.3 s to 79.5 s    |
| `quarry-stone-and-steam.mp3`   | Quarry gate, the Cutting, the Driller, the walk home to the forest | 2:29   | -16.0 LUFS, peak -3.8 dBFS | Ends on a fade; looped 43.7 s to 110.7 s |

Prompts: guzheng, dizi, erhu and pipa with light hand percussion. The village theme is in D major
pentatonic at 85 BPM; the road theme is its darker D minor sibling at 96 BPM. The quarry theme
("Quarry - Stone and Steam") adds taiko, a low frame drum and woodblock and anvil clinks, D minor
pentatonic at 100 BPM; its style text is "instrumental video game exploration music, ancient Chinese
instruments, guzheng, dizi, erhu, pipa, taiko and hand percussion, low frame drum, D minor pentatonic,
100 BPM, tense but adventurous, warm not grim, rhythmic stone-like woodblock and anvil clinks, steady
driving pulse, loopable, no vocals". The Suno style and
structure text is kept in each file's `lyrics-eng` tag; the main menu theme has none recorded.

Do not edit these files. The loops in `public/audio/music/` are made from them by

```sh
node scripts/audio/music-loops.mjs          # regenerate every loop (needs ffmpeg)
node scripts/audio/music-loops.mjs --check  # prove the shipped loops are what these masters make
```

with the loop points in `loops.json` beside this file. To pick new points, `python3
scripts/audio/find-loop.py <master> --bpm <tempo>` lists candidate bar-aligned loops and `--refine
<start>` measures the master's true period from a chosen start (the masters drift off their prompts'
tempos: the road theme plays at about 95.5 BPM, the quarry at about 100.3). See ADR 0108.
