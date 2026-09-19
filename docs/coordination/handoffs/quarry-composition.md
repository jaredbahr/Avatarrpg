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
