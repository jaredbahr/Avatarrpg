# Modular route follow-up

Root owns `codex/modular-route-followup`; this v0.2.2 development batch is
separate from PR64. Current built checkpoint `b247685` visibly shows v0.2.2
after a normal reload, retaining the prior local save. Its production build
passes; the latest full combined gameplay evidence is below. No follow-up push.

PR64 remains v0.2.1 at `749fe3d`, auto-merge configured with current-head CI
`35454608779` active. The previous water-test timeout was repaired by reusing
verified screenshot samples, retaining every visual assertion; root verification
passed 860 tests and six focused browser cases before that one checked push.

## Integrated result

- Forest: local road, dry pond banks and separate north/south grass packs from
  the reviewed material source. Independent pines/rubble and runtime water;
  inactive complete-map ground pages removed after consumer checks.
- Quarry gate: local earth/road/limestone regions (`9a23852`, `69424f4`), with
  two-pixel edge bleed removing filtered gray joins. Existing walls, timber
  cover, props, collision and saves remain unchanged. Runtime WebP tests check
  cell centers and material boundaries. Source: `95cdb17`, `e2d2b55`.
- Short-landscape normal-text initiative: in-flow compact chips recover 31.70px
  of usable battlefield. See [HUD evidence](hud-compact-prototype.md).
- Partial elevation: `ae7cd53`, `01fba97` keep raised terrain below authored art
  and live surfaces, explicitly preserve layer order across scene changes and
  invalidate both decor caches on grid changes. Source `a092281`, `4f15d78`.
- Conversation settlement: `b5a5435` retains legal follower animation and runs
  NPC-aware dry-seat settlement under dialogue while map controls stay locked.
  Root reproduced the former water-standing bug through Visit Gao in normal UI.
  Source `8facaab`; browser regression covers the same interaction.

## Combined evidence

At `b5a5435`, root `npm run verify` passed 864 tests / 104 files plus typecheck,
lint and formatting. Production build, art validation and asset budgets pass:
maps 3.97 MiB / 4, precache 17.61 MiB / 25; entry `index-YySPFXhi.js`.

Sixteen installed-Chrome checks passed on that production build at 1280x720:
eight partial-ground/elevated-water cases across Canvas/WebGL, six shopfront
cases including follower settlement, and both complete trade/escort routes.
Route coverage includes Driller victory, quarry and village save/reload,
custody-specific homecoming, and revisit without repeated battle or XP.
This does not establish aesthetic, audible or physical-device acceptance.

Root also used the actual UI on prior build `054d530`, forced WebGL at
1280x720: new Sura/Kaya setup, all opening passages, path movement, Visit Gao,
four dialogue lines, Slot 1 save, reload and explicit load. Health/party and
nearby Gao restored. Tab and owned port 4304 stopped; the local slot remains.
Inline screenshots were reviewed but not saved as standalone artifacts.

## Live assignments and open gaps

- Terra `partial_ground_validation`: local material regions for Cutting and
  Driller, with existing surroundings, walls, props and grid preserved. The
  earlier new-elevation input test correction is integrated as `b247685`.
- Terra `conversation_ci_repair`: western Ba Dan approach. Draft `9a53e13` and
  `9e8b307` remain unintegrated: root identified an incorrect historical atlas,
  then grass sampling from stone cells and compounded feather opacity. Correct
  material classification, fractional overlap coverage and actual capture review
  are required before integration. Preserve the accepted courtyard asset.
- Art `world_conversations`: isolated forest raised-shelf material/scenery pass;
  keep exact eight elevated cells and exit (19,4) clear. No renderer/rules edits.
- Root: integration, visual review, versioned releases, required CI and deployment.

The old root preview on 4270 was positively identified and stopped. The v0.2.2
version-check tab and owned preview 4304 were also closed after review.
Forest raised tops now read as procedural stone slabs, still inconsistent with
painted grass; this is functional relief, not final art acceptance. Ba Dan's
western approach is visibly unfinished. Cutting and Driller modular composition,
continuous reference/motion review, audible listening and physical Surface/iPad
verification remain open. No wider world expansion is authorized by this slice.
