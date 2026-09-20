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

## Follow-up from split-browser CI

Run [35484667639](https://github.com/jaredbahr/Avatarrpg/actions/runs/35484667639)
passed verification but its WebKit job failed at `e2e/playthrough.spec.ts:278`:
the Rock Throw preview test waited for a hostile chip that never appeared. Its
first attempt and retry both showed `Nobody there.` The failure trace recorded
an iPad canvas CSS box of 1194×541 while its DPR-2 backing store still represented
1194×663 logical pixels. The aim hint had reflowed the HUD before ResizeObserver
refit the camera; the test projected and clicked a target during that mismatch.
The WebKit job reported 122 passed, one skipped and 71 not run.

After selecting Rock Throw, the test now waits for the existing camera-stability
helper and polls until canvas CSS and backing dimensions agree before projecting
the tap. It keeps the hostile preview and outcome assertions. Installed WebKit
iPad landscape focused test passed 1/1, `npm run verify` passed 873 tests in
105 files, and `git diff --check` passed. This is a test timing repair; immediate
player taps and physical-iPad behavior have not been assessed by this change.

The same run's Chromium job failed its forced-WebGL exploration marker case
after 72 passes, leaving 108 not run. Both attempts fetched the intercepted
`thug.json` and `thug.png` successfully. Trace timing showed one full-canvas
element screenshot per attempt taking 34.9 seconds, longer than the 30-second
pixel poll; the red predicate had no chance to finish. The software WebGL log
also reported a `ReadPixels` GPU stall. Local Chrome with forced SwiftShader
rendered the expected red RGB (214, 58, 52) at the projected point.

The marker test now captures a 16×16 CSS-pixel clip around that same point with
the existing page-level clip helper. Its strict red predicate and timeout stay
unchanged. The focused Canvas test passed locally in 1.2 seconds, and forced
SwiftShader WebGL passed in 5.8 seconds. A temporary green-only atlas negative
control failed the red predicate, then was removed. `npm run verify` passed
873 tests in 105 files.
This removes the full-canvas readback bottleneck while retaining a pixel check
of the actual marker. The next pushed head still needs the required exact-head
CI and gallery; local results do not establish Linux software-WebGL success.
