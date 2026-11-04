# #407 — clear a blocked companion before the Mira approach

A follow-up native check of #399's NPC-safe detour found a party collision on
published PR406 head `d4e3bcdaa77133135dd9d1540e5a8cf6903c67c2`. With Kaya,
Sura and Bo seated at8,4 /8,5 /9,5, the leader's unchanged authoritative route
8,5→9,5→10,5 passes through Bo when the presentation planner returns no plan.
The actual renderer recorded party separation0.001528tile; a six-member party
also reproduced the collision. NPC separation remained at least1tile.

The planner tried Sura first, although Bo occupied her only exit. Clearance now
recovers from that boxed initial walker by moving a reachable blocking companion
first. A six-member formation can also move the bridge companion out before Bo.
This uses the existing pathfinder, candidate filters, temporal validation and
64 candidate-placement bound. It preserves the core leader route and the
existing failed-plan fallback. Ordinary search and both existing null fixtures
remain unchanged; this is a bounded recovery for the observed formations,
not a claim that every impossible crowd can be scheduled.

## Source and protocol

| Producer                                       | Commit                                     | Complete tree                              | Evidence                                             |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ---------------------------------------------------- |
| Published NPC correction; follower failure     | `d4e3bcdaa77133135dd9d1540e5a8cf6903c67c2` | `02ddf475b4eba397e9ed81642e5f9bfd102807d8` | actual3/6-party discovery; corrected baseline4 cases |
| Clearance correction + expanded native fixture | `64d8415adceff5c9bd3fa33a6d61c3f3627ce13e` | `50df387457728607eae6448c8f33ee780718f907` | 7/7 native pass,271.484s                             |

Baseline uses the preserved production build made by exact d4 `ci:local`.
All312 dist-file hashes match before/after; it was served without rebuilding
while source/test edits were prepared. That frozen build is retained separately.
The candidate builds its own clean producer. The corrected NPC fixture is
identical on both: real mouse pan/taps, standard fresh game and village entry,
normal render clock and motion, Canvas/WebGL1368×912,DPR1, observed Mira11,5
input (her upright covers projected10,4), same node/endpoint and all real backend
views forwarded unchanged. No native location, flags, seats, clock or outcomes
are fabricated. Unit-test seats are explicitly seeded real-content fixtures.

The fixture records every party pair and person through movement, waits and
final gathering. It waits for both animator idle and completed settlement, so
an idle gap does not finish the observation. A20,000-frame resource cap marks
truncation and fails explicitly. The20s settlement deadline, default60s Canvas
case limit and existing360s software-WebGL allowance are unchanged; zero retries.
The unchanged five-person courtyard control keeps its own existing120s budget.

## Results and preserved failures

- New observed-seat unit regressions: **2 fail before,2 pass after**. Same leader
  path, deterministic replay, legal terrain/NPC/diagonal paths and5ms trajectory
  samples require the existing0.8tile separation throughout each batch/wait/hold.
  All23 unchanged trail tests also pass, including both null cases, the exact
  canal seating expectation, temporal clearance and cadence budget.
- Initial expanded native matrix: **2 solo controls pass;2 three-person pair
  assertions fail;2 six-person20s settling deadlines fail** (243.678s total).
  Its600-frame recording limit was caught in independent review. Those early
  collision measurements remain valid; it is not full late-gathering coverage.
- Corrected-recorder baseline: **4 affected cases fail,193.945s**. Three-person
  party minima0.002861Canvas/0.039939WebGL fail the unchanged0.78native floor
  from `party-spacing.spec.ts`. Six-person cases retain their20s deadline
  failures; attached in-flight views also show overlap0.003795/.161539tile,
  with3687/1859ms of playback still scheduled. No recording truncation.
- The original standalone six-member observer failure remains separate. Its
  diagnostic, with the same deadline, completed with finite fallback/gathering;
  it did not establish a hang. No failed run is relabeled as passing or fixed
  merely by allowing more time.
- Candidate: **7/7 native pass**: solo/three/six members on both backends, plus
  the unchanged five-member courtyard-turn control. All six expanded Mira
  recordings are complete/untruncated, preserve node/endpoint, show NPC
  separation at least1tile and report no page errors. The four three/six-member
  Mira cases have party separation at least0.833070tile. The unchanged five-party
  control separately measures per-leg pair separation (minimum0.829677tile),
  samples, timing and final seats; it does not record NPC minima or truncation.

`verification.json` binds measurements to producer/harness and raw artifact
hashes. Arrival stills show the completed conversation, not an in-flight
clearance test; the actual renderer frames provide that measurement. Full raw
frames, source PNGs, traces and original logs remain in session retention.

Case durations and sample counts are diagnostic, not hardware-FPS or statistical
performance claims. Physical Surface/iPad, WebKit/Safari/PWA and owner visual
acceptance remain open. Correction stays on the same draft PR406, with no new
PR, merge, deployment, manual dispatch, art or paid request.
