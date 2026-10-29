# PR354 narrow portrait correction for review

- Validation owner: existing SOL Ultra cloud worker, separate from the #329
  implementation owner. Isolated branch `codex/354-narrow-objective-review` is
  based on exact public PR354 head `a87c2c760dbedd84045375a96173fd2e4c44dc47`.
  The author's branch remains untouched; this candidate is for owner review.
- Confirmed regression: the unchanged 390×844 Largest-text, six-member dock
  case passes on main `bc77ae2e` with a 367.45 px map but fails on PR354 with
  252.72 px against the existing >337.6 px assertion. The in-flow objective
  increases header height by 114.73 px while the dock remains 337.59 px high.
- Correction: only narrow portrait at Largest text arranges each roster card's
  portrait beside its name and health, retaining its touch minimum and horizontal
  scrolling. Maximum portrait dimensions constrain the inline canvas size without
  cropping. A measured badge offset keeps the element badge inside the compact
  card. The full expanded objective, header actions and original tests remain.
- Original PR354 validation: 16/17 dock cases passed; all six new objective
  matrix cases and conversation/reset passed. Eight supplemental Chromium probes
  passed for actual map/chip taps, keyboard focus, real bark/gate clearance,
  same-session Quit/Continue remount, changed objective and Riverside hiding.
- The correction requires measured narrow-screen visual review, the complete
  existing dock matrix and full exact-head `ci:local` before publication. Results
  belong in the review packet. This is not WebKit, physical-device or final
  visual acceptance; those gates remain pending. No merge or deployment here.
