# Music sources

Masters as delivered from Suno (owner's paid plan, 2026-11-08, 2026-11-09 and 2026-11-12). They are **not shipped**:
nothing under `audio/source/` is copied to `public/` or precached. Wiring music into the game,
cutting seamless loops and choosing a streamed encode is tracked in the music issue.

| File                           | Where it plays                        | Length | Loudness                   | Notes                                                     |
| ------------------------------ | ------------------------------------- | ------ | -------------------------- | --------------------------------------------------------- |
| `ba-dan-morning-market.mp3`    | Ba Dan village                        | 3:08   | -15.8 LUFS, peak -3.6 dBFS | Ends on a fade; needs a loop cut                          |
| `forest-road-forest-watch.mp3` | Forest Road, out to the quarry        | 3:17   | -15.5 LUFS, peak -3.9 dBFS | Ends on a fade; needs a loop cut                          |
| `main-menu-hollow-fanfare.mp3` | Title screen / main menu              | 1:37   | -16.4 LUFS, peak -2.5 dBFS | Ends quietly (last 3 s about -26 dB); check the loop seam |
| `quarry-stone-and-steam.mp3`   | Quarry gate, the Cutting, the Driller | 2:29   | -16.0 LUFS, peak -3.8 dBFS | Ends on a fade; needs a loop cut                          |

Prompts: guzheng, dizi, erhu and pipa with light hand percussion. The village theme is in D major
pentatonic at 85 BPM; the road theme is its darker D minor sibling at 96 BPM. The quarry theme
("Quarry - Stone and Steam") adds taiko, a low frame drum and woodblock and anvil clinks, D minor
pentatonic at 100 BPM; its style text is "instrumental video game exploration music, ancient Chinese
instruments, guzheng, dizi, erhu, pipa, taiko and hand percussion, low frame drum, D minor pentatonic,
100 BPM, tense but adventurous, warm not grim, rhythmic stone-like woodblock and anvil clinks, steady
driving pulse, loopable, no vocals". The Suno style and
structure text is kept in each file's `lyrics-eng` tag; the main menu theme has none recorded.

Do not edit these files. Derived loops are made from them by a script, so they can be regenerated.
