# Save import lifecycle evidence — #388

Actual local production browser UI, Chromium154/touch profile,1368×912/DPR1.
Tests use App-written valid save bytes, actual file choosers and FileReaders;
only original readAsText I/O starts are queued. Real loadend is awaited. No fake
load results, fabricated game states, clock changes or parser bypass.

- **Unchanged baseline:** three new cases fail (exit1). A valid file completing
  after Close/Resume replaces the full current state/session; olderA completing
  after B was requested also adopts/closes the menu; stale invalid file emits a
  toast. Original failure log is retained, including immediate warning count1.
- **Initial candidate producer:** clean `0f161fca8faccaf8511230d410fb75324b8ec000`, full
  tree `94ccddc5de889b8069cc0ad9339ae931e7a2497b`: entire saves.spec.ts **11/11
  pass**, exit0/stable source/tree/harness,58.57s, retries0. Eight prior full/
  blocked-storage, erasure, loadability, Largest-text and toast cases unchanged.
- **Final formatted fixture:** clean `5ccb1dd932a774d417b5adc4ec09d68c6fdda5a3`,
  tree `d24337dfaa6910c1ffcd20661f42ac0c726404bd`: complete suite **11/11 pass**,
  exit0/stable,60.24s, after the formatting correction below. This fixture is
  byte-identical to the final published e2e subtree apart from evidence-only changes.
- **Positive import:** select A then B, release A while B remains pending: full
  current state/session and menu persist. Release B: its full state/session is
  imported normally, menu closes and the real Game loaded toast appears.
- **Independent actual UI probe:** baseline currentseed2500703268 changed to old
  72779210 after a closed read; candidate seed/state stay unchanged, errors[].
  Candidate Current Bo before/after stills were inspected. These are separate
  controlled runs, not matched art/performance comparisons. The state/session
  assertions establish integrity; screenshots alone do not.
- Negative toast checks are immediate snapshots after real load completion;
  they cannot pass by waiting for expiry. Independent source review found no
  actionable defect in invalidation, ordering or ordinary import semantics.

The first full ci:local on ac614a5c failed at format:check before its unit suite.
Only the releaseImportRead helper call formatting was corrected; all assertions,
arguments and deadlines are unchanged. The formatted full native suite above
was replayed under a unique output label; original evidence was retained.

Final hashes are in provenance.json. Later evidence/handoff changes preserve
the formatted producer's src/public/e2e. The original UI probe has identical
runtime/public bytes; its test fixture predates formatting. Required exact clean final-head ci:local9/9 must pass before push;
its actual result belongs in the draft PR, not inferred from this native suite.

Controlled browser I/O/file selection is not physical device/file-picker,
WebKit, Safari/PWA or OS slow-storage acceptance. Those remain open, as do actual
hosted browser/gallery jobs where skipped. No incidence estimate, art/style/FPS
approval, merge, deployment, install, security or save-format change is claimed.
