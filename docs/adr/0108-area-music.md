# ADR 0108: Area music

**Status:** accepted, 2026-11-12. Implements the demo goal "area music (Ba Dan, the road, the
quarry)" in `CLAUDE.md`; builds on the sound bus of ADR 0012.

## Context

The owner commissioned four Suno masters (`audio/source/music/`): the title theme, Ba Dan's
morning market (85 BPM), the Forest Road (prompted at 96, plays at about 95.5) and the quarry
(prompted at 100, plays at about 100.3). Each is a 1½ to 3½ minute song that fades out, at
about -16 LUFS. The demo is played on an iPad by three or four people at a table.

## Decision

**Format.** Each track ships as one seamless loop, AAC-LC in `.m4a`, 96 kbps stereo at 48 kHz,
`moov` first so it streams. AAC in MP4 is the format every iOS Safari plays natively and decodes in
hardware; Opus in WebM or Ogg is newer than some iPads in families' hands. 96 kbps is the lowest
rate where the native ffmpeg encoder keeps the guzheng and dizi clean on tablet speakers, and four
loops at that rate (3.3 MB) fit inside the existing 4 MB audio family with the sound effects.

| Track    | Master                         | Loop (s of master) | Length | Size    |
| -------- | ------------------------------ | ------------------ | ------ | ------- |
| `title`  | `main-menu-hollow-fanfare.mp3` | 34.302 to 79.479   | 45.2 s | 0.55 MB |
| `ba-dan` | `ba-dan-morning-market.mp3`    | 34.391 to 124.749  | 90.4 s | 1.11 MB |
| `road`   | `forest-road-forest-watch.mp3` | 70.412 to 140.719  | 70.3 s | 0.86 MB |
| `quarry` | `quarry-stone-and-steam.mp3`   | 43.674 to 110.672  | 67.0 s | 0.82 MB |

**The loop script.** `node scripts/audio/music-loops.mjs [--check]` makes every file in
`public/audio/music/` from the masters and `audio/source/music/loops.json`; nobody edits a loop
or a master by hand. A loop is `master[start, end)`, with its last 150 ms crossfaded into the
150 ms that really lead into `start`, so the end runs on into the beginning as the master does.
`start` is a bar start (`scripts/audio/find-loop.py`, from an onset envelope); `end - start` is the
period at which the master really repeats there (`find-loop.py --refine`), because a Suno master
drifts off its prompt's tempo and a grid a fraction of a BPM out slips a few hundred ms over a
minute. The length is rounded to whole 1024-sample AAC frames (at most 10.7 ms), because a partial
last frame is padded with silence that a looping player plays as a gap. Loudness is a plain gain to
-16 LUFS (two-pass `loudnorm` measurement), never a dynamic normaliser. The encode is bit-exact, so
`--check` proves the shipped files are what the masters make, on the same ffmpeg.

**Seam measurements** (the seam rendered as the last 5 s then the first 5 s): no click (the sample
step at the seam is under the window's own 99.9th percentile), no level step (50 ms RMS either side
within the window's median change; Ba Dan's 2 dB phrase drop over the following second is the
master's own, identical at the master's `start`), and the beats in the 3 s after the seam land
within 12 ms of where the master's own continuation puts them (the frame rounding's limit).

**Streaming, not precaching.** The loops are never in the service worker's precache
(`globPatterns` takes no `m4a`; `STREAMED` in `scripts/precache.mjs` leaves them out of the 25 MB
total) and never in the JS bundle. Each is an `<audio>` element streamed as it plays, routed
through a `MediaElementAudioSourceNode` and a gain node, because iOS ignores
`HTMLMediaElement.volume` and a crossfade needs a gain. A decoded buffer would loop more tightly
but costs about 23 MB of floats per minute of 48 kHz stereo, twice during a crossfade, which iOS will not
give a page.

**Its own context.** The music is not on ADR 0012's bus: the bus closes its context when a game
loads and when Sound goes Off, and the music must play on through both. It has its own
`AudioContext`, opened by the first gesture (the title's first tap) like the bus's, suspended
with every element paused while the tab is hidden, and closed when Music goes Off.

**Volume.** Settings gains a **Music** row beside Sound, with the same four steps (Off, Quiet,
Normal, Loud), stored as `music` in `fnt.settings`. The default is Quiet (0.35), under Sound's
Normal (0.7), so the music sits behind the table's talk. A fight dips it to 70% (about -3 dB)
rather than switching. Reduce motion has nothing to do with music.

**Area mapping, as data.** `src/content/music.ts` maps each map id to a track; the title and party
setup play `title`. The player takes the battlefield's map in a fight and the party's map
otherwise, so Ba Dan and the riverside (exploration, their conversations and the welcome-home
ending) play `ba-dan`; the Forest Road, both ways and its fights, plays `road`; the quarry gate,
the Cutting and the Driller's floor play `quarry`, out and on the walk home, until the Forest Road
takes over. A map with no row keeps what is playing. `App.showScene` asks for the area's track on
every scene change; a change crossfades over 1.5 s, and asking for the track that is playing does
nothing, so moving between scenes of one area never restarts it.

## Consequences

- A new area is a row in `MAP_MUSIC` and, for a new tune, a master, a `loops.json` row and a run
  of the script. Nothing in `src/core/` knows music exists.
- `<audio loop>` restarts on the browser's own schedule; on Chromium and Safari the gap is a few
  ms at most, and the 150 ms crossfade means it lands inside the same note. If the owner hears it,
  the next step is a decoded `AudioBufferSourceNode` loop for the current track only.
- Playwright's Chromium has no AAC decoder, so `e2e/music.spec.ts` proves the player asks the real
  element for the right file at the right moment and lets go of it on Off; audibility stays the
  owner's call on the iPad (ADR 0012).
- Another ffmpeg build may encode different, equally good bytes; then `--check` fails and the loops
  are regenerated and committed, noting the ffmpeg version.
