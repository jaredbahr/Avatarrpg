# Modular route follow-up

Root owns `codex/modular-route-followup`, based on release candidate `b809b04`.
PR64 now contains the separately verified conversation test repair `e5bfcf8`;
CI run `35452987638` is its current merge gate. Do not push this follow-up to
that release branch. The visible release version remains unshipped v0.2.1.

## Integrated for local review

- Forest ground and pond bank: local material regions, feathered shoulders,
  independent pines/rubble and runtime water. Unused full-map forest ground
  pages were removed after consumer checks; source provenance remains.
- Material source `6dfe3b0` and composition `0f9ca0b`, with registration repair
  `db0ba6c`, are integrated through `fc3eb7d`. Separate north/south grass packs
  cover eligible cells without painting over water, road or raised terrain.
  Map art remains within the existing 4 MiB budget at 3.99 MiB.
- Compact initiative `bd5b853`: normal-text short landscape only, in-flow
  portrait/label chips. Same-state playable captures show 31.70 pixels more
  battlefield height with the action dock present and 50.39px chip heights.
  See [HUD handoff](hud-compact-prototype.md).
- Root verification on `fc3eb7d`: 862 tests / 104 files, typecheck, lint and
  formatting pass. Earlier combined gesture/viewport coverage passed 13 cases;
  that browser build predates the final grass composition.
  Fresh production build at `054d530` (same product as `fc3eb7d`), art validation
  and asset budgets pass. Both complete Canvas trade/escort route checks pass
  at 1280x720, including Driller victory, quarry and village save/reload,
  custody-specific homecoming, and revisit without repeated battle or XP.
  These automated legal-route checks do not prove visual or audible quality.

## Ownership and remaining review

Terra completed staged 96px east-edge captures on `db0ba6c` in Canvas/WebGL,
including high contrast and blocked-grass fallback. Exit (19,4) remains an
unblocked road. These are staged inspection captures, not continuous gameplay.
Root rejected the flat charcoal elevation shapes aesthetically: they read as
missing ground. Terra owns a bounded material/height-cue correction in the
forest tree, preserving the authoritative elevation and road geometry.

A second Terra assignment owns a separate quarry-gate modular ground proof;
Luna completed its read-only asset/consumer inventory. Existing walls, props,
cover and collision remain authoritative. Root integrates only reviewed work.
The art material assignment is complete; no further image generation is queued.

Full route composition, motion, listening and physical-device review remain
open. Passing functional tests does not establish the approved visual target.

## Opening and village UI review, 19 September

Root used the actual UI on production build `054d530` at 1280x720, forced
WebGL, with a new two-person Sura/Kaya party. Character setup, all three
opening passages, a normal path click, Look around → Visit Gao, all four Gao
lines, return to exploration, Slot 1 save, page reload and explicit Slot 1 load
completed. The loaded scene retained Sura/Kaya at level 1 with full health and
Gao available nearby. This is bounded manual browser evidence, not a complete
manual campaign, physical touch test or listening review. The review tab and
owned preview on port 4304 were closed afterwards; the local slot is preserved.

The first playable view still exposes a sharp visual transition from the
procedural western road/grass to the authored courtyard. Extend the composed
material treatment along this approach before claiming Ba Dan finished. A
follower also appeared standing on canal water during Gao's conversation;
regrouping after load placed her on the dry bank. Check intended shallow-water
movement and wading/ground-contact presentation before treating this as a
collision defect. Captures were reviewed inline in the task, not saved as
standalone evidence files.

Review of proposed elevation commit `a092281` found opaque top paint occurring
after live surfaces; it has not been integrated. Its owner is correcting layer
order and adding elevated-surface visibility coverage. Quarry gate prototype
`95cdb17` is also pending seam correction and decoded asset coverage before
integration. These source checks do not establish final aesthetic acceptance.

## Integrated quarry gate checkpoint

Root reviewed the corrected Canvas/WebGL gate captures and integrated source
`95cdb17` plus `e2d2b55` as `9a23852` and `69424f4`. Local earth, road and
limestone material regions replace the two opaque pages; two-pixel edge bleed
removes filtered gray joins. Decoded runtime-asset tests cover authoritative
cell centers and material boundaries. Root `npm run verify` on `69424f4`
passes 864 tests / 104 files plus typecheck, lint and formatting. Combined
browser verification must follow the pending renderer correction; this source
checkpoint is not a claim of completed quarry presentation.

The gate worker now owns the follower conversation settlement fix in a fresh
isolated tree, after root traced the normal-UI water-standing observation to
`setConversationMode` cancelling `needsSettle`. The terrain worker retains the
layer-order correction. Neither changes the PR64 release branch.
