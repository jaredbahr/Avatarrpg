# Gao queued-talk failure trace (#323)

This is a local reproduction of the failure on unmodified `main` commit
`bc77ae2eceb6740dd4c143cae61595a1f4884bc2`, captured on 2026-10-30 in an
isolated, detached worktree with system Chromium. It is baseline diagnostic
evidence, not a passing result for the #323 fix.

The single `surface-touch` case failed at the original
`e2e/resident-motion.spec.ts:459` `expect(opened).toBe(true)` assertion (19.2 s,
process exit 1). The trace records Gao home at `(9,4)` and the party still in
exploration before the fixed 10,000 ms clock jump. Ten subsequent 100 ms rendered
polls kept `screen === 'explore'`. The failure snapshot shows `Next: Gao the
Shopkeeper` and the disabled `Talk Walking` button: the queued destination and
real tap worked, but the party was still walking when the test stopped waiting.
This supports the short test-window diagnosis. The matching main CI failures are
[Chromium](https://github.com/jaredbahr/Avatarrpg/actions/runs/40783877978/job/123156481635)
and [WebKit](https://github.com/jaredbahr/Avatarrpg/actions/runs/40783877978/job/123156481597).
Their one-day report artifacts had expired, so this ZIP is a new local trace.

The reproduction used `/workspace/avatarrpg-env/playwright-323-baseline.config.ts`
to point Playwright at the detached baseline and `/usr/bin/chromium` without
changing baseline source. From that worktree:

```bash
FNT_E2E_PORT=4324 npm run e2e -- \
  --config /workspace/avatarrpg-env/playwright-323-baseline.config.ts \
  --project=surface-touch e2e/resident-motion.spec.ts \
  --grep 'Gao at his crates'
```

Open [the trace](gao-baseline-bc77ae2e-trace.zip) with:

```bash
npx playwright show-trace docs/coordination/evidence/ci-323/gao-baseline-bc77ae2e-trace.zip
```

The ZIP is 8,270,259 bytes (SHA-256
`b356215954f3f9cbc217e13fab2fa67be867e98dfdc4335957723e14444b1947`).
It retains Playwright actions, DOM snapshots, network metadata, test sources,
and the failure screenshot attachment. WebP response bodies and OGA audio were
omitted to keep this diagnostic artifact small; scene images may be blank in
trace DOM snapshots, while the failure screenshot remains available. The archive
integrity check passed. All 398 recorded network requests target
`127.0.0.1:4324`; no authorization or cookie headers or credential fields were
recorded in the trace metadata. No video is included.
