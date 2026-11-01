# Forest Road #379 evidence

Producer: local `63626257654b90f81c6b3871e7575b9736e890df`, full tree
`9d4dd61705e1ad096001c223ebb558fc9d790a6e`, displayed build `6362625`.
Game source/public assets equal main `0d4c2b93`; the capture commit adds the
dedicated review fixture and build guards. Final publication identity and
exact-head local/hosted validation are recorded in the PR/handoff separately.

| Profile        | Viewport / DPR | Actual exit |   Runtime | Route / selected attempt                                                     |
| -------------- | -------------- | ----------: | --------: | ---------------------------------------------------------------------------- |
| desktop-canvas | 1280×800 /1    |           0 |  168.19 s | passed; run1-desktop-canvas; native stills and full-route video              |
| ipad-canvas    | 834×1194 /2    |           0 |  215.34 s | passed; run1-ipad-canvas; native stills and full-route video                 |
| desktop-webgl  | 1280×800 /1    |           0 |  959.40 s | passed; run1-desktop-webgl; native stills and full-route video               |
| ipad-webgl     | 834×1194 /2    |           1 | 1813.28 s | failed; run2-ipad-webgl-stills; native stills; extra full-route recorder off |

The corrected portrait WebGL attempt also failed: actual exit 1 / 1813.28 s,
unchanged 1,800,000 ms whole-case timeout during fourth-party-turn handoff settling.
It recorded 14 beats, including the first three completed party turns, and six
accepted commands; victory, aftermath and quarry arrival were not reached. The
page/context-closed error follows the case timeout. Runtime page/console errors
were empty, which does not make this a pass. No third attempt, larger budget,
source workaround or performance/device acceptance is claimed. The corrected
[failure record](corrected-portrait-failure.md) and
provenance retain the actual failure and trace/context hashes.

These are the selected actual attempts, not four first-attempt successes. The
original portrait WebGL attempt failed an unchanged 30-second Ready-click action
at the second handoff. [Its actual failure](original-portrait-failure.md), partial
beats and raw hashes are preserved in provenance. One bounded corrected attempt
disables only that context's continuous video recorder. Native stills, tracing,
DPR, assertions, timeouts and zero retries remain unchanged. The other three
profiles have full raw video; the corrected portrait WebGL profile has none.
This tests recorder overhead as a hypothesis; it proves neither sole cause nor
portrait motion/performance acceptance.

The executed snapshot includes the archived original and corrected configurations
and their single-field resolved-config comparison. A fresh guarded build preceded
the corrected run. Source/fixture/helper hashes match across builds; complete
dist hashes differ and each attempt retains its own stable build identity.

Each profile retains full state, camera, timestamps, real commands/events and
actual exits outside Git. [Capture provenance](capture-provenance.json) contains
their hashes, before/after source/build/harness identities, every beat and all
curated file identities. Native contexts run serially, one worker, Playwright retries: 0 per invocation.
The case/helper budgets are unchanged from the reused review protocol.

## Stills and clip

32 lossless WebP stills are included (desktop-canvas: 9, ipad-canvas: 9, desktop-webgl: 9, ipad-webgl: 5). Each is a full native backing-size screenshot, converted
losslessly from its original PNG. Curation compares dimensions and every decoded
RGBA byte; source PNG hash, output hash, decoded hash and byte count are recorded.
No scaling, retouching, generated content or palette replacement is used. Each
file is under 8,000,000 bytes. The original PNGs remain with the raw run.

`forest-road-to-ambush-desktop-canvas.mp4` is one 16-second continuous segment
from the requested desktop Canvas source-video interval 36–52 s. It has no splice, speed change, scaling
or frame interpolation. H264/yuv420p is lossy; use the lossless stills for pixel
review. The original complete WebM stays local. Exact encoder command, original
video hash/probe, encoded hash/probe/byte count and complete-decode exit are in
provenance. Native video PTS and the beat clock have different origins; the audit
table does not pretend they are frame-exact synchronized. Encoding cadence is
not game FPS. There is no recorded audio or listening claim.

Root inspected decoded frames requested at clip 0/4/8/12 s: Forest narration, real road walking, ambush opening and the first party action dock are visible. The encoder command preserves a continuous native source interval. This sampled review does not accept uninterrupted motion quality, later impact readability, game FPS, audio or physical-device behavior.

## Reproduction

The checked-in fixture is `e2e/forest-road-polish.review.ts`. It expects the
external config and sibling provenance helper used for this audit.
[protocol-snapshot.json](protocol-snapshot.json) preserves the exact executed
config, build/provenance scripts, runner and protocol as text, including the
capture-machine paths. It contains no credentials. These historical paths are
selectors to update for another checkout, not instructions to install a browser
or change security settings.

Use the repository's Node22 toolchain/locked dependencies, an existing Chromium
and existing Playwright ffmpeg cache. Extract the five files into a temporary
harness directory and replace only these path selectors in the extracted text:

- `/workspace/avatarrpg-379` → your review checkout;
- `/workspace/avatarrpg-env/review-379` → your temporary harness directory;
- `/usr/bin/chromium` → your already installed Chromium;
- `/workspace/avatarrpg-env/review-368-motion/pw-tools` → your existing Playwright
  tools/cache path containing ffmpeg.

From a clean committed checkout, run the extracted `prepare-build.mjs` with
Node22, require its actual exit 0/stable receipt, then run `run-capture.py` for
each project with a unique label:

```sh
node /path/to/harness/prepare-build.mjs
python3 /path/to/harness/run-capture.py desktop-canvas fresh-desktop-canvas
python3 /path/to/harness/run-capture.py ipad-canvas fresh-ipad-canvas
python3 /path/to/harness/run-capture.py desktop-webgl fresh-desktop-webgl
python3 /path/to/harness/run-capture.py ipad-webgl fresh-ipad-webgl
```

The runner binds source/helper/harness/build bytes, checks a successful stable
build, refuses reused output labels and retains actual exit/log/report. Source
and harness must stay unchanged until all captures finish. New checkouts get
fresh receipts/build stamps; do not copy an old receipt onto new bytes.

The capture skipped title/party setup through seeded `newGame` only. Walking and
story use real UI; combat uses production planner recommendations through normal
dispatch, preserving native enemy AI/playback. No HP, position, clock, terrain
or outcome staging occurred. Full fixed-seed command/event traces and the
retained 100-entry victory log are compared across profiles; this is not a claim
that the capped log contains the entire campaign history.

One initial command misspelled the runner directory and exited2 before any
browser started. Its original receipt is retained in the external run root.
No assertion, deadline or retry was relaxed to replace that launcher error.

Raw retention root: `/workspace/avatarrpg-env/review-379/`, with per-label
`runs/` and `artifacts/`, build receipt/log, source/visual reviews, original
videos/PNGs and encoder receipt/log. This path is not a cross-machine link;
the committed hashes, native stills, clip and executed-script snapshot provide
the durable handoff. Chromium iPad-sized/software-WebGL evidence is not physical
iPad/Surface, Safari/WebKit, native-GPU, sound or owner aesthetic acceptance.
