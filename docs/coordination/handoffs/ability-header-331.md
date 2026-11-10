# Ability header: two-line description (#331)

## 2026-11-04: restore the board floor and partition browser coverage

This continues the same draft PR364 and published branch
`codex/fix-331-ability-header-standalone`. Claude's explicit handback
6618217725 and the current #348 map supersede the earlier landing hold.
Codex root claim6620466279 was recorded and verified before edits. The isolated
local branch `codex/ability-header-gates-331` starts at published `898ed146` and
merges main `2ba71a01` through merge commit `75ef8166`; no history is rebased or
force-pushed, and the original worker's worktree stays untouched.

The unchanged `hud-large-text.spec.ts` reproduced the failure on that clean
merged parent: the board measured 316.8125 px against its required 333.6 px at
1194×834. The native failure, screenshot, trace, recording and source/build
identity remain outside Git in `/workspace/avatarrpg-env/ability-header-gates331/`.
The original hosted failures and four historical review images remain separate.

The correction keeps the dock's preferred 40dvh height for stable ability
selection, lets it shrink and scroll when chrome needs space, and reserves the
board's 40dvh minimum in the same Huge/short-landscape media query, plus the
existing hairline token so CSS subpixel rounding cannot undershoot the floor.
The first candidate measured 333.59375 px and still failed the unchanged 333.6 px
assertion; that failure is retained rather than adding tolerance to the test. The two-line
clamp, fixed rem header and Normal oil-hint layout remain unchanged. Native
measurement must verify the resulting board and stable canvas; the CSS formula
alone is not acceptance.

Per the handback, the original per-profile readability/picking checks and the
four-ability geometry checks are partitioned into independent cases. Both legal
level-three kits, both viewports, both text settings and all selectable actions
remain covered. Every original geometry, clamp, oil-hint, control and painted
flask-picking assertion remains; each case keeps the 60-second cap. The existing
Largest-text guarantee is read-only. No assertion, budget, timeout or retry is
relaxed to make the suite pass.

Exact final-head `ci:local` and native results belong to the PR and external
receipts. No new media or game assets are committed by this correction; the
existing evidence is preserved. WebKit cannot run locally without a prohibited
install, and the current user has not authorized a hosted dispatch. Keep this
a draft, with WebKit/device/physical-input acceptance explicit rather than
claiming it from Chromium. No merge, deployment, formal approval, paid service,
art generation, dependency, renderer, combat-rule or security change.

The record below preserves the original revision's delivery and evidence.

- **Updated:** 2026-10-30 UTC; source owner Codex, integration owner root.
- **Source:** `/workspace/avatarrpg-331-standalone`, branch `codex/fix-331-ability-header-standalone`, based directly on live `main` at `bc77ae2e`. Only the #331 commits `e42b661a` and `8bf15b3d` were cherry-picked from the original combined descendant. The original `/workspace/avatarrpg-331` at `8bf15b3d` remains untouched. No #322, #323, #332, release, renderer, or unrelated combat change is included.
- **Product behavior:** The ability header reserves two description lines at a fixed height. At Normal landscape size, the aim instruction and its visible Cancel button sit beside the existing action buttons; choosing an ability therefore adds no dock row and does not change the canvas box. The target-confirmation preview keeps its existing flow and controls. At Huge text on short landscape displays, the HUD reserves its existing 40dvh scroll cap so its height does not change when aim guidance appears.
- **Acceptance coverage:** Eight browser cases cross 1280×800 and iPad landscape 1194×834 with Normal and Huge text and both legal level-three Kaya choices (Fire Blast or Fire Step). Each compares header and canvas geometry against the idle frame for short and authored Fire Jab descriptions and every selectable ability in that legal kit: Fire Jab, Flame Arc, the chosen level-three action and universal Shove. Each size uses the visible Focus Kaya control and a real painted-tile tap on the staged flask, then requires the Oil Flask preview and enabled Confirm. The test stages Kaya's position and legal level-three grant, never a preview result. It saves exact-profile idle and selected viewport captures under ignored `.shots/ability-header/`.
- **Readability proof:** At Normal text the authored oil clause must be in the header DOM and its description must occupy at most two visible lines without scroll overflow. Chromium's `Range` line boxes extend outside the glyph ink and produced a false clipping failure even when the sentence was visibly complete. The four selected captures were removed from the repo (evidence stays out of the repo per CLAUDE.md); they are on PR #364. Root reviewed every Normal profile and read the **entire** clause through “stands in.” DOM-only text presence is not accepted as visual proof.
- **Verification state:** Source commit `d393a081` passed all **8/8** focused production-build Chromium cases, zero retries, across both sizes, both text settings and both legal level-three kits. Exact-source `ci:local` passed all **9/9** steps, including 256 unit files / 2,998 tests and the production build; external logs and receipts are `/tmp/331-focused-d393.log` and `/tmp/331-ci-d393.receipt`. The new evidence-only commit still needs its own exact-head nine-step run before push. Remote branch CI and physical iPad review remain pending. No product version bump is needed for this unshipped source.
- **Delivery:** Root owns the one landing PR and exact committed-head CI gate. Do not push or open a separate PR for this task.
