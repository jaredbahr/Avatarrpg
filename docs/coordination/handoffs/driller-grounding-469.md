# Driller top-down grounding (#469)

- **Outcome:** the top-down Driller has a tread-wide, centered contact blob and a cached static
  cast on Canvas and Pixi. Its legacy oblique art and rendering are unchanged. This does not add
  eight-heading action loading/playback or a playable top-down quarry map.
- **Location:** `codex/issue-469-01a1b3cc`, based on `538aa3af2bdb209d851fe311a73729ecb6b7bf24`.
  Implementation worktree: `D:/Codex/worktrees/avatar469-grounding-01a1b3cc`.
  Root owns publication, final visual judgment and checked merge; no PR at this checkpoint.
- **Completed:** the packer measures alpha >=128 in the static object's lowest 16 opaque rows,
  using its actual placement relative to the authored anchor. Generated metadata records span,
  center and baseline for all eight headings. Public atlas/source pixels are unchanged.
- **Runtime contract:** only top-down projection plus the top-down Driller atlas selects this
  path. Heading idle/walk/rest use the corresponding unflipped static view. Generic cast uses
  static EAST and mirrors the body, caster and tread offset together. Placeholder frames are
  excluded. The source-identity WeakMap has at most 32 variants per source; cache keys include
  rectangle, anchor, density, heading, mirror and projector direction. Attack pixels are never
  read by the grounding cache. Both backends use the existing maximum-alpha shadow union and
  bypass the ordinary figure pool and sole contact for this Driller.
- **Visual correction:** the initial implementation bottom-aligned the contact ellipse, hiding
  it beneath the body and leaving a visible gap to the cast. The prototype centers `feetBlob`
  vertically on the foot line. The implementation and independent backend expectations now do
  that. Initial failed captures remain outside Git for comparison.
- **Focused verification, uncommitted implementation:** pack regeneration wrote zero public
  files; `pack-sheets.ts --check` reported zero stale files. Typecheck passed after correcting
  the inherited Pixi bend/frame union. Focused lint, formatting and diff checks passed.
  New grounding tests plus adjacent scene/union/cache/actor tests: **5 files /128 tests passed**.
  Full `npm run ci:local` has not run at this checkpoint; no push is authorized by these subset
  checks alone.
- **Pixel evidence and limits:** the tests independently decode the packed idle cels and
  validate metadata, both backend emissions and shifted-placement negatives. All 104 packed
  slam cels preserve source-pixel registration relative to their authored anchors. Separately,
  visible dark tread fragments stand within one world pixel, with a real +2-pixel source-shift
  negative. The observer explicitly cannot establish north cel10 left/right, north cel11 right,
  or northEast cel11: dust/impact debris and fragmented/occluded supports confound the largest
  connected dark fragment. These are not claimed as independently observed foot baselines;
  source placement is still checked. No whole-cel anchor correction is justified by dust.
- **Browser evidence:** actual full `Canvas2DBackend.draw` and `PixiBackend.draw` on a diagnostic
  stone board, native Chromium, CSS scale2/DPR2 (four device pixels per world pixel). EAST idle
  and authored WEST idle; slam at876ms resolves legacy cast index8, mirrored for WEST. Canvas's
  actual union pixels contain only strengths0/102/153: overlap never exceeds contact0.6. Pixi
  emits `max` blend with cast2/3 and contact1, normalized by the0.6 ceiling. This is renderer
  evidence, not continuous gameplay, physical-device, accelerated-GPU or top-down-map acceptance.
- **Evidence location:** `D:/Codex/validation/avatar469-grounding-01a1b3cc/` holds the eight
  `backend-{canvas,webgl}-{east,west}-{idle,slam}-4x-crop.png` crops, full boards,
  `backend-capture-receipt.json`, focused logs and initial failed bottom-aligned captures.
  Root must review final crops and arrange attachments outside Git.
- **Attribution:** Codex implementation/review/validation. DeepSeek job133 supplied the scoped
  regression plan only; no source edits or further API calls were delegated in this takeover.
- **Remaining:** root review, final clean commit and exact-head full local CI, publication and
  the three required current-head PR contexts, merge commit and merge verification. No manual
  CI dispatch/rerun, budget change, art generation, replacement assets or action-loader expansion.
