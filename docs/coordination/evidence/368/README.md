# Ba Dan ambience: scoped runtime evidence

Captured on 2026-10-30 (America/Chicago), production source
`8f7dd4abd98769f43c5ab2432b71f4e042aec31a`, system Chromium
154.0.8037.57, 1368 × 912, DPR 1, integer zoom 1, touch enabled.
The application `src` tree is `4da9a8ac06cb060dff8433f074637dbb96d7740f`;
the unchanged `public` tree is `8e267fed53781d8d53546b888f0d48572b19682f`.
Later evidence/handoff commits do not change those application inputs.

The dedicated review passed all ten phases, five per backend, with both final
provenance summaries complete and no runtime console/page errors. It uses the
real Look around, table walk and Wait controls to reach evening, night and
morning. The camera-only fixture frames the west canal/market and east lanterns.
The local observer forwards every actual renderer view unchanged.

| Backend | Live                                           | Reduce motion                                                 |
| ------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Canvas  | [Canal/market, then lanterns](canvas-live.mp4) | [Fixed steam/lamps; water motion omitted](canvas-reduced.mp4) |
| WebGL   | [Canal/market, then lanterns](webgl-live.mp4)  | [Fixed steam/lamps; water motion omitted](webgl-reduced.mp4)  |

These MP4s contain six **sampled game screenshots per view**, with a cut between
the west and east views. Encoding holds each sample for its recorded render-clock
interval. They are not continuous video, measured FPS, a performance benchmark,
or a physical-device/owner acceptance claim. Screenshot timing is not atomic
with the subsequently read observer metadata. The original PNGs and provenance
remain in the local test output; regenerate them with:

```sh
npx playwright test -c playwright.village-ambience.config.ts
```

Canvas cases retain the existing 60-second default. Forced WebGL uses the
repository's unchanged `allowSoftwareWebgl` policy (360 seconds) for software
rasterisation. No existing renderer case, timeout, retry or workflow changed.
The unchanged `renderer.spec.ts` separately passed 12/12 on production source
`07fe7d0e`, whose application/public trees match the capture source above.

The observer proves changing/frozen inputs, phase gating and pixel-aligned
centres. Unit tests cover the complete sampled water footprints and particle
cap. Representative native stills were inspected for placement and conspicuous
artifacts. Neither these checks nor the clips establish an effect-disabled
pixel comparison, sustained Canvas 60fps, physical iPad/Surface behavior or final
aesthetic acceptance. The effects are deliberately small at zoom 1.

Earlier failed harness runs remain failed:

- `07fe7d0e`: Canvas passed; WebGL exceeded the new capture harness's 60-second
  default during screenshots. The original trace/captures are preserved.
- `e876a3b2`: duplicate trace startup failed both setups; eight phases did not
  run. The duplicate calls were removed in favor of Playwright's existing trace
  lifecycle.
- `5491a448`: five Canvas phases passed; WebGL's first phase exhausted the
  60-second default; four WebGL phases did not run. The new review subsequently
  adopted the existing software-WebGL policy. No performance pass is inferred.

Raw records: `/workspace/avatarrpg-env/368-browser-*.log`,
`/workspace/avatarrpg-env/evidence/368-browser-*`, and the final
`test-results/village-ambience-368/` output. These local paths are retention
locations, not cross-machine links.

| Clip               | SHA-256                                                            |
| ------------------ | ------------------------------------------------------------------ |
| canvas-live.mp4    | `93ad3d0c2982e2b64ee3f813f92c325082596a624840e2b20ef758508c301094` |
| canvas-reduced.mp4 | `a13e8ffeec1d2007ee6fb50f25f3d2ff39cff04931d13d35e7b6a5a1ec5fdfb1` |
| webgl-live.mp4     | `318dfaf854e4b7c05e94494b3e987557d0945a1c23fb93d43c2c0c78760b3c0e` |
| webgl-reduced.mp4  | `350f6155a94f984867c2fd142dfbbfe8e0574c022943e83f69cff656ac36c2cf` |
