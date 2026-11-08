# Reducer input immutability oracle follow-up (#502)

- **Updated:** 2026-11-08; Codex source work; root owns review and validation.
- **Outcome:** Keeps the #482 legal-command property corpus and replaces its Vitest structural input comparison with Node `deepStrictEqual`, including independent Map and Set intrinsic-bypass checks. Adds an explicit elapsed-time assertion while retaining the existing 20-second test timeout.
- **Location:** `jaredbahr/Avatarrpg`, worktree `D:/Codex/worktrees/avatar482-immutability-01a1b3cc`, branch `codex/issue-502-01a1b3cc`, based on `1c273d2a004456679d3cdb5949773b5e864eaeff`. No PR yet.
- **Scope:** Test and handoff only. All 204 sequences, the minimum of 50 accepted commands per sequence, party sizes 1–6, generated legal commands, mutation checks, and existing acceptance assertions remain unchanged. No production changes.
- **Prior timing evidence:** Before this follow-up, the property measured 20,542 ms in hosted CI and 15,354 ms locally. These are baseline measurements, not results for #502.
- **Verification:** Codex reviewed the full diff. All five focused tests pass on Node 24.19.0; the full property takes 10,154 ms with its explicit elapsed assertion passing. Source hashes and Git status stayed unchanged. Formatting passes. This is local evidence; hosted timing and the full local gate remain pending.
- **Next:** Run `npm run ci:local` on the committed final head, then publish one coherent revision and verify its hosted property timing before closing the remaining #482 criterion.
