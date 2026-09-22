# HUD at Large text: the board keeps its screen

- **Updated:** 2026-09-22T04:10Z; outgoing owner: Claude integration session
  (`claude/hud-large-text`); incoming owner: unassigned.
- **Outcome:** exploration and battle keep the world as the majority of the
  screen at Large and Largest text on a landscape tablet, and the frame-time
  readout stops covering the encounter plate. Excludes portrait, which already
  stacks and scrolls, and excludes the riverside scene, which owns its own dock.
- **Acceptance:** at 1194x834 with `largeText: 'huge'` — the exploration dock is
  at most two fifths of the viewport, every action button is inside the
  viewport, and no roster card carries empty parchment below its health bar; the
  battle header is one row with Pause beside the plate, the initiative strip is
  one row of full-tap chips, and the board holds at least two fifths of the
  height; with `?stats=1` the readout overlaps neither the combat bar nor the
  title plate.
- **Location:** `jaredbahr/Avatarrpg`, worktree
  `C:/Users/Jared/.codex/worktrees/hud-large-text`, branch
  `claude/hud-large-text`, base `7c0b82a` (origin/main). No PR opened.
- **Worktree state:** clean and committed, not pushed. The local screenshots
  described under Verification were throwaway and have been deleted; the spec
  that captured them was not kept. No processes left running.

## Completed

- `src/styles/hud.css`
  - `.title-plate` takes `min-width: 0` and its own name ellipses, so the plate
    yields before the header does.
  - A new `(min-width: 53rem) and (orientation: landscape)` block at Large and
    Largest text: the combat bar stops wrapping and its buttons stop shrinking;
    the turn chip becomes the compact row chip that a short landscape already
    used, still a full `--tap` target.
  - A second block for exploration: the roster stops stretching cards to the
    action column's height (`align-items: flex-start`), is capped at 45% width,
    and still scrolls sideways with six members; the action bar may shrink and
    its row may wrap; action buttons drop from `5.5rem` to one `--tap`; the hint
    moves onto its own line above the actions, where there is width to read it.
  - The dock's `max-height` goes from 42% to 40% in both the base rule and the
    Large-text portrait rule.
  - `.stats` moves from the top-left corner to the left edge at mid height.
- `e2e/hud-large-text.spec.ts` (new): the battle header/strip geometry, and the
  readout's clearance from the plate.
- `e2e/exploration-dock.spec.ts`: the layout matrix gains Large and Largest text
  at Surface and iPad landscape, and asserts dock height, on-screen actions, and
  card slack against each card's own declared padding.

## Decisions

- **The `Grumbler` "dark rounded blob" is not a `.title-plate` defect.** The
  brief asked me to look for the cause in `.title-plate`; the plate is correct.
  I pulled the iPad-WebGL gallery shard from run 35674037047 and cropped the
  header: on `36-grumbler-portrait-floor` the plate is clean parchment, and the
  blob only appears on `14-boss-blast-floor`, the beat that runs with
  `?stats=1`. It is the frame-time readout — `rgb(0 0 0 / 65%)`, `border-radius`,
  `z-index: 70`, pinned to the same top-left corner the encounter plate uses.
  Every scene puts a title in that corner, so I moved the readout to the middle
  of the left edge, which is over the board in both scenes at any text size and
  in either orientation, and which this milestone's own promise keeps clear. It
  stays visible, which is what the beat that turns it on is for.
- The hint stands above the actions rather than beside them because at 1.5x type
  there is no width left for it on the row — it ellipsed to a word and a half.
- The action bar hugs its buttons and centres rather than stretching the column,
  because stretched it left its gilt corner ornament out in empty parchment
  where it read as a stray mark.

## Verification

Tested at the branch head, on Windows, Playwright 1.63 / chromium-1243.

| Check                                                                         | Result                                         |
| ----------------------------------------------------------------------------- | ---------------------------------------------- |
| `npm run typecheck`                                                           | pass                                           |
| `npm run lint`                                                                | pass                                           |
| `npx prettier --check` on the three changed files                             | pass                                           |
| `npx playwright test e2e/hud-large-text.spec.ts e2e/exploration-dock.spec.ts` | 12 passed                                      |
| `npm test` (vitest)                                                           | 922 passed, 1 failed — pre-existing, see below |
| `npm run format:check` (repo-wide)                                            | fails on 794 files — pre-existing, see below   |

Two failures are environmental and **not** caused by this branch; both should be
confirmed against a clean checkout before anyone treats them as regressions:

- `src/app/ui/icons.test.ts > the committed sprite > is what the icon table
generates`. It compares a committed SVG read with `readFileSync` against a
  generated LF string. Neither `src/app/ui/icons.ts`, `icons.test.ts`,
  `scripts/art/icons.ts` nor the sprite is in this branch's diff, and CSS cannot
  affect an SVG string comparison.
- `npm run format:check` flags 794 files including ones this branch never
  touched (e.g. `src/render/view.ts`, diff empty). Same root cause: a CRLF
  working copy.

Visual evidence was captured locally at 1194x834 with the canvas renderer and
then discarded; it was read, not kept. Exploration at Largest text now reads as
the approved reference's shape — one compact row of portrait cards with name and health, a centred hint,
and the three actions with `Party / 6 strong` fully on screen, dock at roughly
26% of the viewport. Combat at Largest text: header on one row, strip about
80 px instead of 120 px, board about 53%. Quarry floor with `?stats=1`: the
plate reads `Grumbler` cleanly.

**Not run:** the gallery capture (`npm run gallery`), WebKit, and any real
device. CI has not run this branch, and the iPad-WebGL gallery is the surface
the original defects were found on — it is the check that matters most here.

## Coordination

Owns `src/styles/hud.css` (the `.title-plate`, `.stats`, and the two new
landscape Large-text blocks), `e2e/hud-large-text.spec.ts`, and the layout
matrix in `e2e/exploration-dock.spec.ts`. No other open PR is known to touch
them. No merge-order constraint beyond rebasing on `main`.

## Next actions

1. Push `claude/hud-large-text` and open a PR against `main`; let the required
   typecheck/unit, e2e and screenshot checks run.
2. Review the iPad-WebGL gallery from that run against
   `assets/reference/player-view-2026-09-17/ba-dan-exploration.png`, and confirm
   `14-boss-blast-floor` no longer has the readout over the plate.
3. Confirm the two failures above reproduce on a clean `7c0b82a` checkout; if
   they do, they are separate work, not this branch's.
4. Judgement call left open for the owner: with six members at Largest text the
   roster cannot fit and the fourth card is clipped at the scroll container's
   edge. That matches the existing documented behaviour ("Six-member rosters
   still scroll horizontally") and the dock stays inside its budget, but nothing
   signals the overflow. A fade or a chevron would, and is not in this branch.

## Completion/transfer

Pending — committed locally, not pushed, no PR, no CI. The outgoing owner
relinquishes editing ownership of the branch.
