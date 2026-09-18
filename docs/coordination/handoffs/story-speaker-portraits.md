# Visible dialogue portraits — local integration handoff

- Owner: narrative/UI task `01a0b2e3-170e-7bb1-b2ab-d9e45dd780a9`.
- Branch: `codex/story-speaker-portraits`, based on main `148843f`.
- Status: local source only, no push or separate PR/CI. Gameplay confirmed
  exclusive ownership of the changed portrait selectors; gameplay is sole integrator.
- Change: narrow (52rem) and short (34rem) layouts keep a compact 4rem canonical
  portrait beside the speaker name. Long names wrap within the available width.
  Desktop keeps the existing large portrait. Dialogue/choice panels retain scrolling.
- Scope: base.css size token, hud.css portrait/header rules, focused browser tests.
  No story, save, dialogue-advance, renderer, map, or asset changes.
- Existing identity behavior: DialogueScene resolves authored party variants before
  drawing the portrait; bitmap loading retains the existing painter fallback.
  Narrated interludes retain their authored scene illustrations.
- Validation: `npm run verify` passed (619 tests across 66 files), including
  typecheck, lint, and formatting.
- Evidence: production build and local Chrome touch tests cover 390x844 normal and
  largest text, 844x390 largest text, and 1368x912. Eleven browser tests pass: six
  portrait/layout/save cases plus the five existing click/tap/keyboard advance cases.
  Coverage includes Mira, long NPC names Gao/Dorin, Jinu party variant, Ruon choice,
  image-request failure with nonempty painter fallback, option scrolling, and
  exact save/reload state plus one-line advance. These are staged UI tests, not a
  fresh continuous campaign or physical-device/WebKit acceptance.
- Screenshots inspected locally under this worktree's ignored `.shots/`:
  `portrait-before-huge.png` and `portrait-after-huge.png` show actual 390x844 Gao
  home dialogue before/after at largest text. Also inspected
  `portrait-after-mobile.png` (Mira), `portrait-after-jinu.png`, and
  `portrait-after-short-scrolled.png` (Next accessible after panel scroll).
  Short landscape at largest text requires scrolling the dialogue panel to reach
  Next; the portrait remains visible outside that scroll area.
- Remaining art/identity gaps: Dema still uses authored Mira art, Sen uses Gao art.
  Distinct portraits are needed; this patch does not invent their appearance.
  Overall reference-quality presentation is not claimed.
- Integration: cherry-pick the source commit, preserve other HUD edits, verify
  the combined candidate and run required latest-head CI when the integrator pushes.

## Separate speaker-title follow-up

Gameplay confirmed ownership of the narrow DialogueScene.topBar expression.
The bar now uses the resolved dialogue speaker (including Jinu's party variant)
and authored choice speaker. Illustrated narration/endings retain placeLabel;
App.placeLabel and map/save/pause labels are unchanged. Added a browser check
for Jinu title/nameplate/portrait agreement through advance, Ruon's choice, and
Ba Dan narration fallback. No story content changed.

The prior mismatch is visible in `.shots/portrait-after-jinu.png`; the corrected
same-size view is `.shots/portrait-title-after-jinu.png` (390x844, largest text).
