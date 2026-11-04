# Three Ba Dan roof chimneys: scoped native evidence

The combined native run passed all 12 cases on the exact clean producer in
360.20 seconds: the original ten ambience phases and two dedicated chimney
cases. Each backend showed all three sources live, then frozen under reduced
motion, with the complete GameState unchanged. Source, harness and production
build hashes stayed stable. No capture retry or changed budget was used.

The media producer is source `38b212456e01fe0560cd5ff33a02bbed55984100`, tree
`c3f3a9b259cc3aca410fa251d90ade6d2e027128`. A later evidence/documentation
commit contains these files and must be identified separately; it did not produce
the captured game frames. Full native/build receipts, report counts, exact media
hashes, runtime observations and executed external config/wrapper snapshot are in
[provenance.json](provenance.json).

The change adds smoke at the southeast merchant house's existing painted wing
chimney. Its mouth is upright-local (279,92), page 0 (1341,94), scene world pixel
(1238,730). The original north and southwest dwelling anchors and their order
remain unchanged. This calibrates coverage of all three open painted roof-chimney
mouths; it adds no art or new ambience category.

| Backend | Full continuous native recording                   | Live native frame                   | Reduced-motion native frame            |
| ------- | -------------------------------------------------- | ----------------------------------- | -------------------------------------- |
| Canvas  | [Full startup/live/reduced video](canvas-full.mp4) | [All three mouths](canvas-live.png) | [All three frozen](canvas-reduced.png) |
| WebGL   | [Full startup/live/reduced video](webgl-full.mp4)  | [All three mouths](webgl-live.png)  | [All three frozen](webgl-reduced.png)  |

Each full video preserves the entire finalized native browser recording, including
startup, an eight-second live observation and a six-second reduced-motion
observation. H.264 CRF28/medium, two encoder threads and yuv420p make the media
reviewable; no trim, scale, retime, interpolation, splicing or audio is used.
The four 1368x912 PNGs are exact copies of native screenshots. Full raw browser
videos remain local at the paths and hashes recorded in provenance.

The dedicated fixture uses installed Chromium 154.0.8037.57, touch enabled,
1368x912, DPR1 and integer zoom1. One continuous context per backend observes
all three sources together. The renderer observer forwards each real MapView
unchanged before reading it. It checks six smoke-loop marks, two at each source,
changing inputs for every live chimney and identical frozen marks across reduced
motion. Full GameState remained equal before/after; only camera framing and
the reduced-motion setting change after seeded startup/enterNode.

The combined native run also re-executes the original ten ambience phases, five
per backend, for canal/market, evening lamps, reduced motion and night/morning
gating. Their original final provenance is preserved in the combined record.
The curator requires exactly 12 expected first-attempt passes, zero unexpected,
skipped or flaky cases, completed stable native/build receipts and both complete
five-phase records before writing evidence into the repository. The initial
scoped lint failure and subsequent corrected lint receipt remain separate in
provenance; a later successful result does not erase the failure.

Container cadence, including a reported 25fps recording cadence, is not game
FPS. Probe wall/render times establish their observation spans; they do not
establish an exact video-PTS-to-probe-phase origin. Software WebGL on this runner
does not establish native-GPU performance. No sustained Canvas60fps, owner
style/motion acceptance, physical Surface/iPad, pinned WebKit or Safari/PWA
acceptance follows. Service workers were blocked. Full #368 category coverage
remains open, and three-chimney coverage is not a fourth newly delivered category.

Root's final exact-head full verification and publication record must be linked
separately after completion; these producer receipts do not cover later source
edits or establish merge/deployment/readiness.

## Media checks and review

The full Canvas recording is 20.72 seconds / 2,351,721 bytes; software WebGL is
52.12 seconds / 3,857,231 bytes. Input/output decoded frame counts and cadence
match, duration differs by no more than container rounding, and both encoded
files passed complete error-strict decode. Each of the four native PNGs is
under 1.87 MB and was copied byte-for-byte. Every media file is below 8 MB.

Root viewed all four full-size native PNGs and sampled decoded video frames at
requested half-duration and nine-tenths-duration positions per backend. All
three mouth placements are visible in the same framing. The grey wisps remain
subtle over the painted roofs, using the unchanged existing recipe. These
samples do not constitute uninterrupted-motion or owner aesthetic acceptance.

The initial fixture lint failed `no-unsafe-finally` in video cleanup. Cleanup
now records finalization errors and fails afterward without replacing the
original runtime error; lint passed before capture. Independent review also
strengthened the comparison from selected fields to the complete GameState
before the first native attempt. The actual lint failure and corrected result
remain distinct in provenance.

The exact final-head full nine-stage result and the issue-required unchanged
`e2e/renderer.spec.ts` result must be recorded in PR #380 and the same ownership
claim after completion, using their own final source/build receipts. The later evidence-only
commit leaves all captured application, asset and review-fixture bytes intact.
