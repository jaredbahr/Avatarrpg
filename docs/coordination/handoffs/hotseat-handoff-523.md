# Named hot-seat ownership regression coverage (#523)

Codex root owns `codex/hotseat-handoff-523` at
`/workspace/avatarrpg-env/hotseat-handoff523/source`, based on main
`3dbe66103534137d0da40b2b7c15ef38cf746e33`.
[Claim 6731093473](https://github.com/jaredbahr/Avatarrpg/issues/523#issuecomment-6731093473)
was independently verified before edits. Only this file and the new
`e2e/hotseat-handoff.spec.ts` change; existing runtime, helpers, configuration,
content, budgets and other owners' files remain unchanged.

Eight browser cases cover named tables of one, two, four and six people. Names
and distinct existing characters are entered through actual setup controls;
the summary and created unit IDs establish the ownership oracle. Story checks
include exact current/next deciders, refusal without rotation, accepted choices
through a full wrap and save/load mid-rotation. Combat checks include each
configured human's actual owner card and character, Ready, exact HUD ownership,
save/load and confirmed End turn progress. Solo must omit unnecessary prompts.
No presentation or core mismatch was established; this is test-only coverage.

Public `enterNode` commands skip unrelated travel/narration between authored
choices and into the first fight. Gao's chair/dialogue/next-choice pair runs
naturally. No synthetic node or direct state/session/index assignment is used.
The locked fire choice is also dispatched through the public App to verify the
rules refusal behind the disabled control. Save, slot selection, full reload
and Load use actual UI; a conversation without a Pause button uses public
`App.openPause` only to open that same menu. Initiative is observed dynamically;
expected ownership comes from setup mappings, independently of `Session.playerFor`.

Independent SOL review caught and corrected two false-positive routes: a
correct card could hide a wrong HUD owner, and a no-op End turn could pass the
solo/final iteration. Both now have exact assertions; the first unused-AP tap
still must leave the full battle unchanged. Final read-only review found no
material issue. The incidental ground tap under a card checks card/state
stability only, not a particular canvas action or inspector guard.

Evidence is retained outside Git under `/workspace/avatarrpg-env/hotseat-handoff523/`:

- Preliminary production build passed in 29.255 s.
- Desktop two-/six-player story and combat cases: **4/4 passed**, 65.347 s
  wrapper, log SHA256 `b03914a057453ac59d22fec0695917ef366bea53cffdcfbb7874f0b730353a31`.
- Desktop solo/four-player cases: **4/4 passed**, 47.221 s wrapper, log SHA256
  `e47d31cca9c1b4cb0471dfde0e0a624e877419b648990e70848a5f602531cfb3`.
- Root reviewed six-player rendered story-load, owner-card and loaded-ready
  captures: Ben/next Cleo, Cleo playing Riko, and Dara controlling Nima.
- An initial root CLI grep selected no tests (exit 1); its log/receipt remain.
  Only the selection was corrected. No test assertion, budget or required case
  was removed, skipped or weakened.

Root freezes the clean final head before `npm run ci:local`, then runs all
**18** rendered checks on that exact CI production build: eight new cases at
each of desktop 1368×912 and tablet 1194×834, plus two unchanged hot-seat controls.
One worker, no retries, original 60 s test/10 s assertion budgets. Per-test JSON
and PNG capture owners, refusal, wrap and load, after curtains/animations settle.
The PR and same claim record final head/tree, check receipts, capture review and
actual hosted leaf jobs/skips. No combined or unrun acceptance is claimed here.

Normal Surface and iPad landscape projects discover this filename; the iPad
portrait project selects only `touch`/`gestures` specs. Local Chromium Canvas
with touch emulation and reduced motion does not establish WebKit, physical
input, full animation, hardware performance or PWA acceptance. Hosted E2E
acceptance remains open if its leaf job is skipped; no dispatch is authorized.

Publish as DRAFT only after local gates pass. No merge, Ready, deployment,
installation, art generation/replacement, security or credential change.
DeepSeek runner/shared accounting is unverified: no requests. Corrections stay
on this branch; preserve every failure and its evidence.
