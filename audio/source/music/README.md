# Music sources

Masters as delivered from Suno (owner's paid plan, 2026-11-08). They are **not shipped**:
nothing under `audio/source/` is copied to `public/` or precached. Wiring music into the game,
cutting seamless loops and choosing a streamed encode is tracked in the music issue.

| File                           | Where it plays                 | Length | Loudness                   | Notes                            |
| ------------------------------ | ------------------------------ | ------ | -------------------------- | -------------------------------- |
| `ba-dan-morning-market.mp3`    | Ba Dan village                 | 3:08   | -15.8 LUFS, peak -3.6 dBFS | Ends on a fade; needs a loop cut |
| `forest-road-forest-watch.mp3` | Forest Road, out to the quarry | 3:17   | -15.5 LUFS, peak -3.9 dBFS | Ends on a fade; needs a loop cut |

Prompts: guzheng, dizi, erhu and pipa with light hand percussion. The village theme is in D major
pentatonic at 85 BPM; the road theme is its darker D minor sibling at 96 BPM. The Suno style and
structure text is kept in each file's `lyrics-eng` tag.

Do not edit these files. Derived loops are made from them by a script, so they can be regenerated.
