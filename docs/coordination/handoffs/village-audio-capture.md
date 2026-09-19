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

Still open: subjective timbre/mix listening, actual Surface/iPad speakers and
unlock/interruption behavior, synchronized Off/On and hide/show capture, and
leaving/re-entering exploration in the same take. Existing lifecycle tests are
separate evidence and do not close those listening requirements. Final release
must reconcile this source checkpoint with the delivered audio implementation.
