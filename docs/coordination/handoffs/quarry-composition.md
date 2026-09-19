# Quarry composition checkpoint

- **Owner:** quarry composition subagent under orchestrator; integration owner is
  gameplay task `01a0b300-e321-7670-aab3-f0aeaf624dc0`.
- **Location:** `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-quarry-composition`,
  branch `codex/quarry-composition`, based on combined `b1216b7`. Local only;
  no PR or push per the orchestrator's CI-conservation instruction.
- **Outcome:** generated limestone tops replace bland terrace source regions;
  shallow faces match existing actor lift; repacked rims retain sloped contacts
  at 55% of prior height. No rules, camera, renderer or dynamic material edits.
- **Source and decisions:** [registration and prompts](../../art/quarry-terrace-composition.md).
  Six runtime WebPs, both existing art packers and rim crop metadata are changed.
- **Verification:** `npm run verify` passes 797 tests in 88 files, typecheck, lint
  and formatting; production build, art validation and asset budgets pass.
  A complete second pack reproduces all six hashes. Map family 3.66 MiB of 4;
  precache 16.52 MiB of 25. Existing build chunk-size warning remains.
- **Runtime evidence:** ignored `.shots/composition/terraces-fitted-{canvas,webgl}.png`
  uses UI import of the unchanged normal R3 save
  `C:/Users/Jared/Downloads/four-nations-tactics-lv3-2026-09-19.json`, then visible
  camera controls/wheel. `*-fixture-fitted-*` uses the repository's normal E2E
  `newGame` / `enterNode` fixture convention. `*-legal-raised-contact-*` then
  dispatches a legal two-step move from (1,3) to (1,1) and verifies the resulting
  position in both maps and both backends. No grid, actor or map mutation.
  All four contact runs report no page errors; images were inspected.
- **Limitations:** exterior spans still look detached, camera still clips the
  rear at board fit, and the full inhabited quarry target is not met. Physical
  devices are untested. The orchestrator reviewed this as a useful bounded
  correction and requested a further exterior-only composition pass.
- **Continuation:** retain this verified checkpoint; next work owns only authored
  exterior backdrop/scenery for these two maps, preserving the rear gap, west
  approach and playable floor. Coordinate camera work with gameplay. Local raw
  sources and evidence remain under `art/raw/terraces/` and `.shots/composition/`.
  Production preview uses port 4223; development port 4222 is not evidence after
  a shared dependency cache collision. Ownership remains with this task for the
  next exterior composition checkpoint.

## Exterior surround delivery

- **Updated:** 2026-09-19 06:15 UTC. Terrace checkpoint is `8e1326f`; this delivery
  is its next commit on the same branch. Root reviewed the mounted surround as a
  substantial improvement and authorized final verification and transfer.
- **Changes:** two shared exterior-only pages, exact playable exclusion,
  corresponding scene registration, and an encoded-alpha regression test. The
  Driller removes redundant rim cards; Cutting retains its continuous near wall.
  See [source registration and exact prompt](../../art/quarry-surround-composition.md).
- **Evidence:** `.shots/composition/terraces-fitted-{canvas,webgl}.png` now contains
  the final surround on the unchanged normal R3 import. The intermediate captures
  are `surround-r3-intermediate-{canvas,webgl}.png`, achieved only with wheel zoom
  (64.455px tile size; full-board fit is 37.188px). No camera code changed.
  `cutting-fixture-fitted-*`, `driller-fixture-fitted-*` and both maps'
  `*-legal-raised-contact-*` were recaptured against the production build.
  All four legal contact runs reach (1,1) with no page errors. Inspect the retained
  `capture.tmp.mjs` and `contact.tmp.mjs` probes in the same ignored evidence folder
  for exact reproduction; they use installed Chrome headlessly at 1368 x 912,
  service workers blocked, forced Canvas/WebGL, and production port 4223.
- **Assets:** both new WebP hashes reproduce identically; the encoded-alpha test
  confirms zero nontransparent pixels inside the playable polygon. Maps 3.84 MiB
  of 4 MiB, precache 16.70 MiB of 25 MiB. Source PNG, guide and pack reports remain
  in `art/raw/terraces/`, with source hashes recorded in the art document.
- **Transfer:** no push or PR. Integration owns cherry-picking the terrace and
  surround commits, version bump, combined checks and final delivery. This task
  relinquishes editing ownership after the surround commit. Keep the worktree/raw
  inputs for reproducible packing. Physical device checks and complete reference
  acceptance remain open; camera work remains with gameplay.

- **Reproduction details:** contact fixtures use single hero `sura`, player
  `Composition fixture`, seed `quarry-composition-contact`, reduce motion, and
  normal `enterNode` commands for `battle_ambush` / `battle_grumbler`. The only
  movement command has path `[{x:1,y:2},{x:1,y:1}]` for `p0`; position is asserted
  after resolution. Imported R3 file SHA-256 is
  `baf21a0bed2505e0ab699ef2e417eaf8f3ef26cb85c57996c243e4cf07a2cfe5`.
  Development server 4222 has been stopped; production preview 4223 remains.
- **Final checks:** the surround delivery passes `npm run verify` (799 tests in
  89 files plus typecheck/lint/format), production build, `npm run art:validate`
  and `npm run check:assets`. Credits and generated `NOTICE.md` include the new
  source and provenance. Both surround hashes also reproduce on a second pack.
  The final product tree is the one used for the captured scene checks; no runtime
  changes followed those captures except the required credits entry.
