# Ba Dan walking pace comparison — #383

Exploration cruises at 625 ms/tile instead of 750 (20% greater cruising speed),
using existing walk poses. Combat stays at 720 ms/tile. The original
70-ms-at-750 brisk calibration, fitted phase per distance, resident amble at
750 × 8/3, ramps, settling and reduced-motion shape are preserved.

## Current-main native comparison, 2026-11-03

Local production game, Chromium 154, 1368 × 912 touch profile, DPR 1. Each case
starts Kaya/Sura/Bo in Ba Dan, walks four tiles east, returns west, walks one
tile south and returns north. Legal app commands choose the paths; the actual
renderer view is observed and forwarded unchanged. The ordinary game clock,
camera and collision rules remain in control.

| Producer                                   | Clean commit                               | Complete tree                              | Native result |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------- |
| Main958ba98b plus identical review fixture | `67aa6c82038ff6330850f7500491a6dead895578` | `993202958bf1a22d03d5cdc17b1bea8da5266c07` | 4/4, 122.05 s |
| Candidate with coordinated horizon repair  | `5ac1e74b144ceb4eea8f88ab209a00f2e95f749f` | `8e997e3a70724aa6c2616d53da70abfb5610ef53` | 4/4, 115.23 s |

Each producer covers Canvas/WebGL × default/opt-in world sheets, one worker,
zero retries and the original repository software-WebGL allowance. Baseline
`src`/`public` equal main958ba98b; harness hashes match before/after.
Later publication documentation does not change the tested runtime; final-head
tree identity and full validation belong in the PR.

| Scheduled leg, default sheets | Canvas before / after | WebGL before / after |
| ----------------------------- | --------------------- | -------------------- |
| Four tiles east               | 3123.6 / 2623.1 ms    | 3122.4 / 2622.3 ms   |
| One tile south                | 871.0 / 746.2 ms      | 870.9 / 746.6 ms     |

These include command overhead and unchanged ramps; return legs include
follower clearance. Every case reached requested logical tiles, settled the
leader, retained three distinct party seats, sent walking frames and no jog
frames to the native renderer, and reported no browser errors.

| Default-sheet settled capture | Before                               | After                              |
| ----------------------------- | ------------------------------------ | ---------------------------------- |
| Canvas                        | [Before](before-canvas-default.webp) | [After](after-canvas-default.webp) |
| WebGL                         | [Before](before-webgl-default.webp)  | [After](after-webgl-default.webp)  |

Captures are unretouched native PNGs converted to WebP quality90 without
resizing/cropping. Root inspected all four. Natural camera following means
these are not aligned art comparisons. All eight complete silent recordings
decode. Their container frame rate is not game FPS. Software-WebGL draw gaps
are substantial: these do not establish accelerated-GPU/60fps, perceptual
gait, physical-device, listening, Safari/PWA or owner aesthetic acceptance.

## Repair and retained evidence

PR356's path-derived resident deadline used party pace for Mira's unchanged
amble. A new-main pre-edit run reproduced **30 pass /2 fail**. The coordinated
repair supplies `STROLL_REFERENCE_MS` to that existing geometric calculation;
route length, fades,50ms samples and every assertion are unchanged.
**187 focused checks across ten files pass**, including pace, phase, trails,
residents, completion, animator and stroll. Independent SOL review found no
runtime defect or weakened assertion.

Earlier results are retained separately: original broader184pass/2fail, native
fixture nullability failure, two new-test fixture failures, and prior clean
baseline/candidate native4/4 each at781c9278/3461361c. These historical results
are not current-head validation. No assertion, timeout or check was relaxed.

`comparison.json` binds current raw-file hashes, moves, producers and draw
observations; `video-validation.json` records complete decoding and metadata.
The unpublished29MB historical media set is retained outside the published tree.
Local retention locations below are not public artifact links:

- Original bundle: `/workspace/avatarrpg-env/pace-383/local-candidate.bundle`.
- Historical dossier: `/workspace/avatarrpg-env/pace-383/resume20261103/historical-dossier/`.
- Current complete captures: `/workspace/avatarrpg-env/pace-383/resume20261103/native-media/`.
- Current receipts/logs: `/workspace/avatarrpg-env/pace-383/resume20261103/runs/`.
- Original failed logs remain under `/workspace/avatarrpg-env/pace-383/`.

Actual hosted jobs/skips belong in the PR. Physical iPad/Surface, WebKit,
Safari/PWA, listening and final motion acceptance remain open. No live
deployment or access to Jared's browser is claimed; no game-art/default-style
change or paid generation is part of this timing correction.
