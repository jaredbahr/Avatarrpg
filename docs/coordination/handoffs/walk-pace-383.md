# Ba Dan exploration walking pace — #383

Root integrates `codex/ba-dan-walk-pace-383`; SOL High workers supplied the
bounded cadence implementation, coordinated test repair and independent review.
[Claim6563027231](https://github.com/jaredbahr/Avatarrpg/issues/383#issuecomment-6563027231)
retains historical checkpoints and current milestones.

## Scope and behavior

Jared's “Walking speed is a bit slow” feedback approves a modest exploration
pace change using existing walk cels. Exploration625 replaces750ms/tile;
`STROLL_REFERENCE_MS=750` preserves brisk calibration, combat720 and the
complete resident/Mira amble at750×8/3, including ramps, settling, fades and
reduced motion. The completion helper independently estimates amble with that
reference. Rules, RNG, paths, picking, artwork and default style retain their
existing contracts.

Scope: choreography, animator, residentMotion, resident-completion helper, two
dedicated regression files, existing residentMotion test, ADR0095, CLAUDE's walk
paragraph, native fixture/config and evidence. Preserved local candidate16b36ba7
and its bundle; merged main958ba98b as18a489c1; applied coordinated shared-test
repair as native producer5ac1e74b.

## Shared-test handoff resolved

Original source passed9new checks and native comparisons, but2old Mira
completion assertions failed because their horizon shrank with party pace.
Root requested a handoff instead of taking PR356's owned test file.
After356 merged, [release6596899788](https://github.com/jaredbahr/Avatarrpg/issues/383#issuecomment-6596899788)
authorized this integration. Its geometric deadline now uses amble's750ms
reference instead of live625 party pace, preserving geometry, fade allowance,
every assertion and50ms samples.

Current-main reproduction: **30pass/2fail** before repair; **187 focused checks
across10files pass** after it. Scoped lint/format/diff pass. Independent runtime
review found no defect or weakened test. Original184/2, new-test fixture
failures and early native nullability failure remain retained as failures.

## Native evidence and publication

Identical fixed-route fixture uses legal commands and forwards the actual
renderer view unchanged, ordinary time and natural camera following.
Current baseline67aa6c82 (src/public equal main958ba98b) passes4/4; candidate
5ac1e74b passes4/4, each Canvas/WebGL×default/world. Scheduled one-tile playback
changes about871→746ms; four tiles east about3123→2623ms. All cases retain3
distinct party seats, final leader positions, walk frames, no jog and no
browser errors. Eight complete recordings decode.
[Comparison, captures, exact identities and limitations](../evidence/383/README.md).

Full final-head `npm run ci:local` must pass before publication; the PR records
that exact published commit/tree and results. Native producer identities stay
explicit when later documentation changes the complete tree. Fresh open/closed
issue/topic searches found no competing383PR before resuming. Publish one
DRAFT with `Fixes #383`, then inspect actual hosted jobs/skips. Latest direct
user requires draft-only delivery: no ready-state, auto-merge, merge,
deployment, installation or security/access change.

Current raw evidence lives under
`/workspace/avatarrpg-env/pace-383/resume20261103/`; originals remain in the
preserved bundle and historical archive. The compact committed dossier keeps4
native captures and raw-file hashes instead of29MB old media. DeepSeek
executor/shared accounting remains unverified: no calls. No asset generation,
replacement art or portrait/default-style change occurred.

Physical iPad/Surface, accelerated-GPU performance, WebKit/Safari/PWA,
listening and owner motion/visual acceptance remain open. Chromium dimensions
and decoded software-WebGL footage do not close those gates. User tab/build
is unverified; no connected-browser/live-Pages access is claimed. Other art,
renderer and combat assignments retain their live owners.
