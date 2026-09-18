# Quarry material audio handoff

- Owner: audio subagent; integration owner gameplay via art owner.
- Branch: `codex/quarry-material-audio`, based on integrated `ebcaa8e`.
- Files: `src/content/sounds.ts`, `src/app/audio/bus.ts`, bus tests, ADR 0027.
- Change: named Fire Jab ignition/body and Rock Throw weight/grit release
  recipes, bounded to two synchronous voices. Optional body envelope point;
  unchanged family defaults and hit/miss scheduling. No runtime asset bytes.
- Source finding: legacy full exponential decays concentrate energy at release;
  lowpassed earth body supplies little upper material detail beyond generic crack.
  These are source/signal findings, not listening claims.
- Evidence: local ignored `gallery/quarry-material-audio/` contains Chromium
  OfflineAudioContext A/B WAVs, render script and metrics using actual AudioBus,
  48 kHz, unity user volume, existing 0.6 master, isolated cue at 100 ms.
  Jab peak 0.252→0.178 and body RMS 0.0171→0.0322; rock peak 0.461→0.218
  and body RMS 0.0245→0.0433. Body window is 60–180 ms after release.
  Neither isolated candidate clips. These values do not prove a good crowded mix.
- Acceptance still pending: integrated actual-cast capture/listening, tablet
  speakers, and grouped art/audio qualitative review. Prior courtyard lifecycle
  and timing evidence is technical coverage only. No new ambience/music claim.
- Verification: `npm run verify` passes 721 tests in 79 files, typecheck, lint and
  formatting. Build passes (287.21 kB main gzip, 4.88 kB worker); asset check
  passes (audio 0.09 MB; precache 15.89/25 MB). Source commit goes to integration
  owner for cherry-pick, without competing push/PR.
