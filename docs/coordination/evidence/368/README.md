# Ba Dan ambience: scoped runtime evidence

Continuous recordings captured on 2026-10-30 (America/Chicago), production source
`1d4b7ee53442f6e8569f97438c1271114141e93b`, complete tree
`a091f1be8f02cf3d995e8d93803121d5207e3d24`. System Chromium 154.0.8037.57,
1368 × 912, DPR 1, integer zoom 1, touch enabled. Application `src` tree
`4da9a8ac06cb060dff8433f074637dbb96d7740f` and unchanged `public` tree
`8e267fed53781d8d53546b888f0d48572b19682f` match the earlier native reviews.
This follow-up changes only review evidence and its handoff.

The uninterrupted recording review passed **8/8 phases**, four per backend,
actual exit 0 in 3.5 minutes. Both summaries are complete with no recorded
console/page errors or emitter violations. Source, external fixture/config and
complete built-asset hashes remained stable. Independent SOL review checked the
fixture, both summaries, terminal receipt, native video metadata and source hashes.

| Backend | Live                                           | Reduce motion                                                 |
| ------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Canvas  | [Canal/market, then lanterns](canvas-live.mp4) | [Fixed steam/lamps; water motion omitted](canvas-reduced.mp4) |
| WebGL   | [Canal/market, then lanterns](webgl-live.mp4)  | [Fixed steam/lamps; water motion omitted](webgl-reduced.mp4)  |

Each live MP4 joins **two roughly 15-second continuous shots**, west then east, with one
explicit hard cut. Each reduced-motion MP4 similarly joins two continuous
10-second shots (29.96s live / 19.96s reduced combined). They are excerpts from an uninterrupted native compositor
recording per backend, including the real Look around/table walk and Wait UI.
The observer forwards the real renderer view unchanged; the camera-only fixture
uses its normal zoom/centre APIs. No screenshot sequence, forced draw, altered
world clock or optical frame interpolation produces these clips.

The original uncut VP8 files are 66.64 seconds (Canvas) and 142.36 seconds
(WebGL). The MP4s retain 1368 × 912 at H.264 CRF18; their 25fps encoding cadence
is **not game FPS**. Recording overhead matters: Canvas live observations saw
roughly 27–29 game draws/s, software WebGL roughly 2.3–2.4 draws/s. These videos
are not a sustained-60fps, native-GPU, smoothness, physical-device or owner
acceptance claim. Service workers were blocked, so no offline/PWA proof follows.

[Machine-readable provenance](motion-provenance.json) records exact clip hashes,
raw-video hashes, shot offsets, source identity, external fixture/config hashes,
built-asset digest, and observed wall/render-time spans and draw counts. Original
uncut files, fixture, per-phase observations and receipts are retained under
`/workspace/avatarrpg-env/review-368-motion/`; those local paths are not
cross-machine links. Published source and these curated clips remain in Git.

## Earlier evidence and limits

The earlier dedicated review passed **10/10 phases** at `8f7dd4ab`, including
real Wait UI for evening/night/morning gating and frozen new inputs. The
unchanged `renderer.spec.ts` separately passed **12/12** at `07fe7d0e`.
Both application/public trees match the continuous recording source above.
The earlier sparse MP4s remain available at
[their published revision](https://github.com/jaredbahr/Avatarrpg/tree/1d4b7ee53442f6e8569f97438c1271114141e93b/docs/coordination/evidence/368).
They contain sampled screenshots, not continuous recordings; their claims are
not retroactively changed by this replacement.

The existing committed review reproduces the original phase checks and sparse
capture flow, rather than the new uninterrupted videos:

```sh
npx playwright test -c playwright.village-ambience.config.ts
```

Canvas retains the existing 60-second default. Forced WebGL uses the unchanged
`allowSoftwareWebgl` policy (360 seconds). One worker and zero retries were used.
No repository test, assertion, timeout, retry, backend or workflow was changed
for the continuous recording. Installed ffmpeg 7.1.5 encoded the native video
through a task-local executable symlink; no browser/tool installation or extra
launch arguments were added.

Observers prove changing/frozen inputs, phase gating and pixel-aligned centres;
unit tests cover complete water footprints and the particle cap. Native samples
were inspected for placement and conspicuous artifacts. The tiny effects still
need owner motion/aesthetic review. No effect-disabled pixel comparison,
sustained Canvas 60fps, pinned WebKit, physical iPad/Surface or Safari/PWA
acceptance is established. Full issue category coverage remains open.

Earlier failed harness runs remain failed:

- `07fe7d0e`: Canvas passed; WebGL exceeded the new capture harness's 60-second
  default during screenshots. Original trace/captures are preserved.
- `e876a3b2`: duplicate trace startup failed both setups; eight phases did not
  run. Duplicate calls were removed in favor of Playwright's trace lifecycle.
- `5491a448`: five Canvas phases passed; WebGL's first phase exhausted the
  60-second default; four WebGL phases did not run. The subsequent new review
  adopted the existing software-WebGL policy. No performance pass is inferred.

Raw earlier records remain at `/workspace/avatarrpg-env/368-browser-*.log`,
`/workspace/avatarrpg-env/evidence/368-browser-*`, and the original
`test-results/village-ambience-368/` output. The continuous recording review
passed on its first run; these earlier failures are separate preserved results.
