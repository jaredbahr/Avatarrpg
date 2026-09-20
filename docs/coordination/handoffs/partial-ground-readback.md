# Partial-ground software WebGL readback

Root integrates this test-only repair into PR64, v0.2.1. Product code and the
frozen release build are unchanged.

CI run `35454608779` passed verification and 116 browser cases, then failed
the initial authored-colour poll in the forced-WebGL water test. Both raw
`test.trace` files show the 10-second poll ending before its first screenshot
completed: screenshots took 24,747.8 and 24,815.6 ms. Bounding-box reads took
about 8,553 ms. Colour assertions were not reached. Root cancelled the remaining
gallery and confirmed the run terminal; this is not evidence of bad colours.

All three forced-WebGL cases in this file use the existing 60-second screenshot
operation budget for readiness and 180-second slow-test total. Canvas retains
10-second readiness. Successful composited samples are reused rather than
immediately recaptured. Water tint, underlying-art retention/restoration,
missing-piece fallback, accessible decor and all bounds/colour assertions remain.

Root validation: `npm run verify` passed 860 tests / 103 files, typecheck, lint
and formatting. Six installed-Chrome SwiftShader cases passed in 40.4 seconds
against the unchanged production artifact, with no retries. Luna independently
reviewed the refactor and found no weakened assertions or stale sample use.
Required current-head Linux Chromium/WebKit and gallery CI remain the merge gate.

Local evidence: `.shots/ci-35454608779/`, trace reader
`.shots/integration/read-trace.py`, and focused reproduction config
`.shots/integration/release-swiftshader.config.ts`. Test-owned preview 4266 stopped.
