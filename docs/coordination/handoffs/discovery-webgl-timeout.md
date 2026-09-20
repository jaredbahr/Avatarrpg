# Discovery WebGL timeout handoff

- **Updated:** 2026-09-20 UTC; `/root/release_local_regression`; incoming owner `/root`.
- **Outcome:** The roadside discovery flow has a scoped slow allowance for its forced WebGL case. All discovery, story, dialogue, and page-error assertions remain unchanged.
- **Location:** `C:\Users\Jared\.codex\worktrees\ci-discovery-repair`, branch `codex/ci-discovery-repair`, repair commit `00326fd` based on CI head `a04753f`; integrated by `/root` as `0eee88c`.
- **CI evidence:** Run `35476562981` failed both WebGL attempts at the base 60s test budget: 63 passed and 380 did not run. The artifact is preserved at `C:\Users\Jared\.codex\worktrees\ci-discovery-artifact-35476562981`. Each attempt spent roughly 10–11s in setup/readiness, 22.2–22.3s on the first Inspect click, and 20.8–21.3s on the second click. The story state advanced; line 30 was only where the exhausted budget surfaced.
- **Repair:** `e2e/discoveries.spec.ts` calls `test.slow()` only when `renderer === 'webgl'`, raising this forced software-GL case to the existing slow-test allowance. No shared timeout, assertion, interaction, or coverage changes were made.
- **Cross-suite audit:** Other renderer loops were left unchanged: long suites already have explicit per-test allowances or controlled clocks; no blanket timeout increase was justified.
- **Verification:** Focused installed WebKit (`FNT_E2E_WEBKIT=1 --project=ipad-landscape`) passed Canvas and WebGL, **2/2**. The pre-integration `npm run verify` passed **105 files and 873 tests**. No CI rerun or push was performed by this owner.
- **Transfer:** Root owns final release verification and push. Documentation is the only pending commit in this handoff tree.
