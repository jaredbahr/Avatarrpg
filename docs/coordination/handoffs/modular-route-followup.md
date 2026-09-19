# Modular route follow-up

Root owns `codex/modular-route-followup`; this batch is separate from PR64.
Current tested product checkpoint: `b5a5435`. No push or follow-up PR yet.
The release branch remains `e5bfcf8`, with visible unshipped version v0.2.1.
Its CI run `35452987638` passed verification and 116 browser cases, then timed
out during forced-WebGL water restoration. The remaining gallery was cancelled;
the run is terminal. A separate test-only release repair is assigned below.

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

- Terra `partial_ground_validation`: isolated **release-only** sampling repair
  based on `e5bfcf8`; preserve screenshot/color assertions, reuse successful
  readiness samples. Trace showed roughly ten seconds per screenshot, duplicate
  sampling, underwater assertions passing, restoration starting at 59.15s of
  the 60s limit. Do not mix future renderer changes into PR64.
- Terra `conversation_ci_repair`: fresh western Ba Dan approach material tree
  based on `b5a5435`. Match existing atlas sampling, preserve runtime water,
  keep a bounded transparent local patch and review spawn/join at actual scale.
- Root: integration review and next release, including propagating any release
  test repair into this branch and reviewing combined transitions.

Forest raised tops now read as procedural stone slabs, still inconsistent with
painted grass; this is functional relief, not final art acceptance. Ba Dan's
western approach is visibly unfinished. Cutting and Driller modular composition,
continuous reference/motion review, audible listening and physical Surface/iPad
verification remain open. No wider world expansion is authorized by this slice.
