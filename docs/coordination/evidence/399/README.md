# Walk around people — #399

Ground walking discarded the visible-person occupancy that NPC approach selection
already used. From Ba Dan8,4, a ground command10,4 crossed Gao9,4. A real mouse
click selecting Mira11,5 recomputed its approach through the same occupied tile.
Both path searches now share the resolved visible NPC/background-role positions.
Existing approach ranking, dialogue, terrain rules and battle return are intact.

## Reproduction and source

Start a fresh solo Kaya game with normal motion, enter `village_explore`, pan
with the mouse, walk to8,4, then click the projected ground10,4 point. Mira's
upright covers that point: the observed command is **Mira11,5**, not a ground
command10,4. Core regressions separately exercise the ordinary ground command.
The actual approach opens `mira_intro` once and stops at10,5.

| Native producer                             | Commit                                     | Complete tree                              | Result                      |
| ------------------------------------------- | ------------------------------------------ | ------------------------------------------ | --------------------------- |
| Baseline, runtime identical main e96f1341   | `49619082368577ae056195179f88a0ae6c0596f4` | `899e9d99a26fe9a4b9590c66a52034ea0dec9b77` | 2 expected failures,84.475s |
| Minimal occupancy correction                | `4cb56b7086fde27394ea59a5f53a03e0b361ce8b` | `bf6d19864e05e84486d48f95aec02c8706b66332` | 2 passed,80.859s            |
| Current main90f872a3 merged with correction | `2e6af0193fefb96aa514cf6d89f7349a8168b6d9` | `ce829700437e21712a309b79cea3ced096d12a40` | 2 passed,79.961s            |

The first two producers differ in the reducer occupancy patch only. Main then
landed #375's pixel overlays: that main was merged locally, without rebasing,
and both native cases repeated against its changed backends. No core/content
change came from that merge. These are collision/motion comparisons, not matched
pixel-diff evidence for the inherited overlay change. Later evidence-only edits
change the complete tree; runtime, tests and native config must equal the final
producer. Exact published identity and final clean `ci:local` are in the PR.

## Checks and observations

- New core coverage: **4 expected failures /3 passing controls before**, **7/7
  pass after**. Ground and recursive approaches, background roles, inactive night
  occupants, authoritative preview equality, valid diagonal/terrain paths,
  immutable input/RNG, single conversation entry/pin, deterministic replay and
  full save reconciliation. Seeded unit-test positions/phases are explicit
  fixtures, not native or earned campaign evidence.
- Existing focused walking/world/settle/background/battle-return coverage plus
  the new tests: **68/68 pass**. Main's #374 battle-resolution code and imports
  are unchanged by the occupancy patch. Full repository checks additionally
  cover triggers, exits, canonical campaign checkpoints and balance.
- Native Chromium at1368×912,DPR1: actual mouse controls and ordinary motion on
  Canvas/WebGL. The observer forwards all input and renderer calls unchanged.
  It records the view delivered to the real backend, including intermediate
  walk clips and Gao's drawn9,4 position. Baseline path9,4→10,5 crosses Gao;
  drawn minimum separation is0.112312/0.172264tile. The correction takes
  8,5→9,5→10,5 and draws at least1tile from Gao. Both route and half-cell
  rendered-clearance assertions stay unchanged. No page errors.
- Baseline had113/6 moving frames; initial candidate134/7. No clock, NPC,
  location, animation duration or game outcome is substituted in native play.
  Native case durations and sample counts are diagnostic, not FPS/hardware
  performance measurements. Solo Kaya isolates this leader-routing correction;
  it does not establish a new follower or moving-resident avoidance policy.
- One worker, zero retries, normal repository60s Canvas case deadline and
  existing360s software-WebGL allowance. Canonical failure tracing retained.
  Initial new-test MapDef narrowing errors blocked the first webserver build;
  the checked fixture lookup fixed them. The failed setup report and raw actual
  red/green runs remain separate. No test expectation or budget was relaxed.

`verification.json` retains exact paths, observations and raw artifact hashes.
The final stills show arrival and conversation, not an in-flight collision test;
the captured renderer frames supply that evidence. Source PNGs/traces and all
original failures are preserved in the session evidence directory.

Physical Surface/iPad input, WebKit/Safari/PWA, GPU FPS, moving-resident/follower
clearance, and final owner visual acceptance remain open. Draft delivery does
not claim those checks or deployed gameplay acceptance.
