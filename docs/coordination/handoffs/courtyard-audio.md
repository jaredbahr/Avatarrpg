# Courtyard audio handoff

- **Updated:** 2026-09-18; art audio subagent; integration owner is gameplay.
- **Outcome:** restrained courtyard air, sparse bird detail and localized pond;
  music, voice, new areas and shared scene edits excluded.
- **Location:** `codex/courtyard-environment-audio`, isolated
  `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-courtyard-audio`; based on art
  `bc20880`. This source commit must be integrated with the art branch and
  gameplay's hook; no competing standalone feature merge is intended.
- **Completed:** `src/app/audio/environment.ts`, AudioBus ownership integration,
  lifecycle/signal/proximity tests, ADR 0023 and source/capture documentation.
- **Coordination:** gameplay accepted ExploreScene hook ownership. Import
  `courtyardEnvironment` from `../audio/environment`; call
  `app.audio.updateEnvironment(courtyardEnvironment(map.id, grid, walking ??
state.location.pos))` each visible frame; clear on hidden/unmount. No dt needed.
- **Verification:** full `npm run verify` passed (67 files, 626 tests), including the 11 focused audio tests, typecheck, lint and formatting. Browser integrated
  capture, subjective listening and physical devices are not yet verified.
- **Next actions:** integrate source commit; wire hook; run combined verify and
  browser checks; follow `docs/art/courtyard-audio.md` synchronized capture plan.
  Keep the visual/audio milestone draft until the integrated result is reviewed.
- **Transfer:** source implementation pending integration; no merge claimed.
