# PR64 end-to-end timeout repair

- **Source:** PR #64 head `930d406e873819de2436621de874ff0df44d4ef9`.
  Its [required CI run](https://github.com/jaredbahr/Avatarrpg/actions/runs/35481410752)
  passed verification, then canceled the browser job at its 60-minute limit;
  the gallery was skipped. The retained browser log reported no assertion
  failure before cancellation.
- **Diagnosis:** The job ran all projects serially with one worker. CI discovery
  listed 444 cases: 181 Chromium touch, 247 iPad landscape and 16 iPad
  portrait. The iPad landscape project replaced the global gallery ignore with
  its offline ignore, admitting 68 gallery cases into the end-to-end suite.
  Browser setup took under a minute; Playwright consumed nearly the full hour.
- **Repair:** Keep the dedicated gallery job and exclude its cases from the
  iPad landscape project. Run all 181 Chromium cases on one runner and all 195
  WebKit cases on another, each installing only its own browser. The existing
  required `End-to-end (Chromium touch, WebKit iPad)` check strictly depends on
  both runners succeeding; the gallery continues to wait for that check.
- **Cost:** Parallel runners shorten wall time but add one npm install/build
  and a small aggregate job to total billed minutes. Excluding duplicate
  gallery cases saves work; this is not a claim that parallelism halves usage.
- **Local evidence:** CI-mode discovery now lists 376 cases and zero gallery
  cases. Each `npm run e2e -- --list --project=...` selection resolves to 181
  Chromium or 195 WebKit cases. Workflow YAML shape, `git diff --check`, and
  `npm run verify` (105 files, 873 tests) pass. No replacement CI has run yet;
  the pushed PR head and its checks must be rechecked after integration.
