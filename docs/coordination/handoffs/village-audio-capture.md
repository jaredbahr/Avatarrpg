# Integrated village audio capture

Updated 19 September 2026. Root review evidence; not audible or device acceptance.

## Source and method

The isolated `codex/audio-route-capture` worktree is based on combined `b1216b7`
at `C:/Users/Jared/.codex/worktrees/audio-route-capture`. No product source changed.
Installed Chrome at 1280×720 imported the lead's unmodified level-4 normal-play
return save through Load game → Import from file. The loaded state is Ba Dan,
solo Sura, with volume 0.7, normal text, motion enabled, no grid/hatch/contrast
overrides. The original route and export are documented in route-presentation-review.

A local Playwright capture attached a MediaStream destination and analyser to
the existing AudioBus master, recording that output and the actual map canvas
in one VP8/Opus WebM. It did not replace or drive the audio engine, mutate game
state, change rules, teleport, or synthesize an unrelated soundtrack. Normal
Look around / Visit controls walked from Gao to Mira and back; dialogue advanced
through the normal buttons. The retained world canvas continued across dialogue.
Each take includes more than one 47-second courtyard loop and both bird phrases.

## Results

| Backend | Take length | File bytes | Maximum sampled peak | Cues / scheduled | Page errors |
| ------- | ----------- | ---------- | -------------------- | ---------------- | ----------- |
| Canvas  | 67.022 s    | 4,552,909  | 0.2439               | 14 / 10          | 0           |
| WebGL   | 67.029 s    | 4,587,393  | 0.2931               | 14 / 11          | 0           |

Both final capture checks passed: minimum duration, nonzero signal, sampled
peaks below full scale, no page errors. Both file headers contain VP8 and Opus
tracks. These are sampled graph measurements, not a claim of decoded true-peak
analysis or proof that every cue sounded correct.

Canvas used the isolated development server. The first WebGL development take
hit a shared Vite dependency-cache collision and produced an invalid recording;
it is not acceptance evidence. A clean production build of the same source
passed, and the final WebGL take used its static preview. Earlier takes narrowly
missed 65 seconds; the script now waits for an explicit 67-second recording
deadline. Those setup failures were corrected without changing product code.

## Preserved artifacts and limits

Files are under
`C:/Users/Jared/.codex/visualizations/2026/09/19/01a0b79f-a1e6-7fd0-a4d5-76e7944406f6/village-audio-review/`:

- `canvas-village.webm` and `webgl-village.webm` are final synchronized takes.
- Matching `*-evidence.json` records settings, positions, 100 ms analyser samples,
  cue counters, duration and errors.
- `route-audio.spec.ts` and `playwright.config.ts` preserve the local reproduction
  harness; they are evidence artifacts, not added to the required CI suite.

The test-owned port 4224 stops with Playwright. Automatic approval review blocked
cleanup of the temporary `.capture` folder; original local artifacts remain
preserved as well. No capture artifacts were added to production or pushed.

## Lifecycle follow-up

The `lifecycle/` artifact subdirectory contains synchronized Canvas/WebGL takes,
JSON events and analyser samples, screenshots, an executable local harness and
its reproduction README. Source is `b1216b7`; the audio implementation is
unchanged in accepted combined `cda0925`. Playwright started an exclusive static
preview with `reuseExistingServer: false` and a strict port, then stopped it.

Actual UI import, Sound Off/Normal, Quit to title and save re-import exercise
retirement and recreation of the real AudioBus output. A capture-only mixer
retains both successive masters in one recording without replacing the game
graph. Each renderer recorded two masters, 13 cues seen, 10 scheduled and no page
errors. JSON take durations are 18.427 and 18.536 seconds. Off becomes unready
with zero environment layers and zero measured RMS. Exit/re-entry changes two
layers to zero and back to two; re-entry is ready/running in Ba Dan. Root checked
the saved event transitions and quiet intervals independently.

The visibility portion uses a labelled synthetic `document.hidden` hook because
the available Chrome automation did not produce an actual hidden page. Its
handler reaches near-silence and resumes; this does not prove browser or OS
backgrounding. No stale or doubled environment graph was observed in this take.

Still open: subjective timbre/mix listening, actual Surface/iPad speakers and
unlock/interruption behavior, and real browser backgrounding. The measurements
and synchronized recordings do not establish audible or physical-device quality.
