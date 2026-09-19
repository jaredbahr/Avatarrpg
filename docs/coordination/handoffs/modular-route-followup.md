# Modular route follow-up

Root owns `codex/modular-route-followup`, the unpushed v0.2.2 development batch.
Current tested checkpoint is `5f80ba5`. Separate v0.2.1 release PR64 is at
`f5a4a87`; CI `35457611402` is active. The prior run
`35454608779` was terminal-cancelled after 116 E2E passes and a readback
failure. The screenshot readback repair `1fdae` and root follow-ups
`1dfbbc0`/`2bc5ba1` are integrated; a minor comment conflict was resolved while
retaining the elevation cases.

## Integrated result

- Village: the remaining local material regions are integrated across the
  approaches and courts, preserving the reviewed procedural perimeter and
  existing route behavior.
- Cutting and Driller: modular ground is integrated at `c676361` from five source commits
  through `dbcf8cd`, covering the remaining earth, road and limestone regions
  with the existing walls, cover, props, collision and saves preserved.
- Quarry Gate retains its earlier accepted local regions (`9a23852`, `69424f4`).
- Forest: the six raised shelf cells are integrated at `3003d8e` from source
  `a237258`; the playable exit remains clear. Independent root captures at
  96px on Canvas/WebGL with High Contrast are in
  `forest-raised-shelf/.shots/forest-shelf-review/a237258`.
- Short-landscape normal-text initiative: in-flow compact chips recover 31.70px
  of usable battlefield. See [HUD evidence](hud-compact-prototype.md).
- Partial elevation: `ae7cd53`, `01fba97` keep raised terrain below authored art
  and live surfaces, explicitly preserve layer order across scene changes and
  invalidate both decor caches on grid changes. Source `a092281`, `4f15d78`.
- Conversation settlement: `b5a5435` retains legal follower animation and runs
  NPC-aware dry-seat settlement under dialogue while map controls stay locked.
  Root reproduced the former water-standing bug through Visit Gao in normal UI.
  Source `8facaab`; browser regression covers the same interaction.
- Root verification, production build and asset budgets pass at `c676361`; 16
  browser cases passed in 1.9 minutes before the forest integration.
- The three focused forest tests pass. Final combined verification at `5f80ba5`
  passes 869 tests / 105 files, typecheck, lint, formatting, build, art validation
  and budgets. Entry `index-ZtfeYxSW.js` is 291.84 kB gzip; maps 3.54 MiB / 4,
  precache 17.18 MiB / 25.

## Combined evidence

At `c676361`, root verification, production build and asset budgets pass; 16
browser cases passed in 1.9 minutes before the forest integration. After forest
integration, Luna independently ran eight partial-ground/elevation cases plus
both complete quarry-return routes at `5f80ba5`: 10/10 passed in 1.1 minutes,
with a passing `.last-run.json` and test-owned preview 4302 stopped.

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

At built `a3c8d49`, root manually continued the existing Sura/Kaya save in
WebGL at 1280x720 on local port 4304. A normal reload showed the updated build
within v0.2.2. Look around → Visit Mira walked from Gao through the village;
the party settled on dry road/bridge and all four briefing lines were readable.
The objective changed to the east road. Map → East road reached forest roaming
normally. Visit Turtle-duck nest delivered all three environmental-story lines;
Slot 2 save, reload and explicit load preserved party/health, forest location,
objective and the journal's remembered nest/silt discovery. Slot 1 was preserved.
The remaining icon-style turtle-duck differs visibly from the illustrated world.
No combat, audible listening or physical-device acceptance is claimed by this
manual segment. Tab 13 and preview 4304 stopped. Build and budget pass:
entry `index-B0DD_k-4.js`, gzip 291.72 kB, maps 3.53 MiB, precache 17.17 MiB.

## Live assignments and open gaps

- There are no active art or village workers. Root owns integration, delivery,
  the current combined verification and release coordination.
- Source quality gaps, continuous reference and motion review, audible
  listening, and physical Surface/iPad verification remain open.
- Next visible art gap: the forest nest's world/dialogue cartoon icon does not
  match the illustrated scene. Root owns the next bounded correction; attempts
  to reactivate the completed art worker hit the agent thread limit, so that
  task has not been dispatched. Luna handled routine review/docs/validation.

The old root preview on 4270 and the v0.2.2 version-check tab and owned preview
4304 were stopped after review. Preserve the manual `a3c8d49` save/reload/nest
review and its route evidence. The full goal, audio listening and physical
device gaps remain open; no final aesthetic acceptance is claimed and no wider
world expansion is authorized by this slice.
