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
