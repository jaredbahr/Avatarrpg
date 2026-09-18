# Courtyard art and audio checkpoint

Updated 2026-09-18 13:47 UTC. Art/audio owner transfers the bounded courtyard
batch to the integration owner. The full approved player-view target is **not**
complete; connected-road and tactical presentation remain separate work.

## Source and landing

Art worktree: `C:/Users/Jared/.codex/worktrees/71bd/Avatar RPG`, branch
`codex/cohesive-village-art`, last asset commit
`94d5ead6e32c0ac3f01fbb2732e47daca0373e87`. Source PR61 remains a draft reference;
PR62 is the sole art/gameplay landing path. Source commits after a902d6f are local
only under the instruction to batch CI costs; integration preserves them by
cherry-pick. Do not push or merge PR61 independently. Close it as incorporated
only after the integration PR actually merges. No merge is claimed here.

| Source commit | Bounded result                                                                            |
| ------------- | ----------------------------------------------------------------------------------------- |
| f009565       | Projected ground chunks, low houses, trees and exact three-cell pond; alpha preservation. |
| a902d6f       | Optional Nima rest clips, pixel-preserving packer and ADR0025.                            |
| 6e7b52f       | Quiet ground materials, two planted boundaries and merchant display.                      |
| 70da74b       | Corrected low fixture proportions and equal-depth frontage ordering.                      |
| 30111b3       | Kaya/Sura rest poses, normal-outfit manifest scope.                                       |
| e0b79ec       | One restrained northern lawn fringe with clear door approaches.                           |
| 94d5ead       | Bo/Wen rest poses, completing the five-person review party.                               |
| a3d2337       | Original courtyard environmental audio, delegated source; integrated as959f8bb.           |

All previous twenty frames per hero remain pixel-identical. Exploration chooses
optional rest poses; combat keeps its original clips. Riverside outfit sheets
keep their own art. Unit family is4,175,559bytes, only18,745bytes below4MiB;
future work must respect this remaining budget. No budget, format or combat
quality was relaxed. Final source asset validation and `npm run verify` passed
(622 tests). Maps are2.43MiB; integration owns its production build/CI checks.

## Visual evidence and limits

Latest inspected combined runtime:491c74d, containing final art94d5ead. Installed
Chrome automation, normal motion, Canvas and WebGL, landscape1672×941 and
portrait820×1180. This is not physical Surface/iPad evidence.

Evidence root:
`C:/Users/Jared/.codex/worktrees/71bd/Avatar RPG/gallery/scene-audit/`.
Final folder `composition-491c74d/` includes renderer metadata, paired
`canvas-rest-1.png`/`webgl-rest-1.png`, `webgl-walk-1.png`,
`webgl-rest-2.png` and `webgl-portrait.png`, with other sampled states. Reviewed
stop/turn/rest states hold character identity, height and foot contact. Earlier
folders `composition-f142f72/` and `composition-fcfecf4/` record the accepted
first pose batch and corrected shopfront proportions respectively.

Gameplay owns matching blocked-but-not-sight-blocking boundaries, Gao's move to
(9,4), the ring-under-actors fix, closest-speaker tie breaking, movement cadence,
roof occlusion, projection, picking and HUD. Corrected prop heights, opaque shop,
visible Gao, restrained fringe and first pose batch received bounded review.
Final Bo/Wen sampled frames received bounded approval after direct review; integration owns checkpoint
acceptance. These views do not establish every-time spacing or a complete route.

The village still differs from the richer reference in composition and connected
world scope. Do not turn this bounded checkpoint into a full-target completion
claim, or begin another courtyard decoration loop.

## Audio evidence

Both recordings are local review artifacts, not shipped files. Audio worktree:
`C:/Users/Jared/Documents/ChatGPT/Avatar RPG-courtyard-audio`.

Lifecycle directory:
`gallery/courtyard-audio/30871ae6-canvas-1789737769806/`.
Files: `README.md`, `capture-report.json`, `technical-summary.json`,
`synchronized-world-master.webm`. Runtime30871ae, art6e7b52f,99.36seconds,
Canvas1368×912, volume0.7. A52second near-pond hold spans the47second air loop;
far/near pond mix follows the actual water cells. Off, simulated hidden-page
state and dialogue departure reach silence; On/reentry resume two layers without
stacking. Peak0.168735, no clipped samples or page errors. Simulated visibility
is not actual OS interruption evidence.

Targeted cue directory:
`gallery/targeted-cues/644766ef-canvas-1789738279218/`.
Files: `README.md`, `capture-report.json`, `timing-summary.json`,
`synchronized-world-master.webm`, `video-frame-8.82s.png`. Runtimefcfecf4,
source644766e (documentation-only successor),12.06seconds. Actual native Talk
emits one tap; four native Next/Continue buttons emit four confirms. The outer
tap-anywhere dialogue panel is intentionally silent and explains the earlier
capture's absent UI cue. A legal Fire Jab deals7damage: launch sound coincides
with the travel emitter, hit with target flash,196.116ms flight and0ms impact
sample delay. Initial cold UI decoding adds8ms; later confirms match deadlines.
Peak0.331235, no clipped samples or page errors. The saved impact frame was
decoded and visually inspected.

These are synchronized actual world-canvas/AudioBus-master recordings with staged
setup and encounter entry, actual conversation controls and legal planner-chosen
combat commands. They are not a continuous manual route playthrough, subjective
listening approval, or physical-device audio acceptance. Numerical signal and
clock alignment do not establish timbre or perceived speaker latency.

## Next owner actions

1. Review the final five-person party capture and finish the single integrated
   checkpoint after exact-head required CI, using the standing merge-commit policy.
2. Preserve the local evidence paths above; retain listening/device limitations.
3. Move broader reference work to the connected route/tactical presentation.
   Forest projection planning was reviewed only; no forest artwork was generated.

Art worktree has no outstanding asset changes or running capture. Generated raw
sources remain under the task's generated-images directory; packed project
assets, source provenance and registration are committed. Editing ownership for
this bounded courtyard batch is relinquished after handoff.
