# Changelog

## 0.2.3 — unshipped

- Paint water on the Canvas 2D backend as a film with a soft shore, quiet drift
  and a flow line instead of one flat opaque fill, and drop the bright rim that
  made a pond, canal or puddle read as a filled polygon. WebGL already looked
  like this; the two backends now agree about the same water.
- Read quarry oil as a slate-green film rather than a hole: a lighter body and a
  stronger sage sheen on both backends, with the surface outline that marks the
  hazard cells unchanged.

## 0.2.2 — release candidate

- Compose Forest Road from local road, grass and dry-bank regions while preserving live water, scenery and gameplay geometry.
- Replace Quarry Gate's complete ground pages with registered material regions and remove visible seams between them.
- Give the battlefield more room with compact initiative chips on short landscape screens at normal text size.
- Let followers finish walking to dry, unoccupied places during village conversations instead of stopping on canal water.
- Preserve elevated terrain and live-surface layering across scene changes and High Contrast toggles.
- Extend the village with the remaining integrated local material regions across its approaches and courts.
- Build modular ground for the Cutting and Driller routes, including the quarry's connected material composition.
- Add the reviewed six-cell forest raised shelves with preserved playable exit space and procedural fallback.
- Replace the forest nest icon with a small illustrated family and borrowed sock, keeping the discovery and its story intact.
- Time battlefield health bars and fallen states to hit, healing and knockout feedback rather than revealing damage while an attack is still travelling.
- Show the abandoned nest, flattened reeds and dried silt beside the forest pond as an environmental clue.

Combined local route and browser checks pass on their recorded checkpoints.
This consolidated candidate is prepared for PR64; exact-head checks and Pages
deployment remain pending. This does not establish final visual, audio or device
acceptance.

## 0.2.1 — unshipped changes included in 0.2.2

- Match Ruon, blade mercenaries and sergeants to the party's adult scale with illustrated poses and distinct walking contacts.
- Build Ba Dan's courtyard from local ground and scenery, with a crossable bridge, runtime canal water, and actor occlusion through the bridge; both renderers retain procedural fallback when scene art is unavailable.
- Omit unused development validation and Pixi atlas initialization to retain the 300 KiB JavaScript budget.
- Give the Cutting and Driller floor connected stone surroundings, grounded terraces, quarry cover and save-compatible wall art, while keeping mud, oil, ice and props live.
- Make water whips flow as ribbons with restrained droplets and a clearer waterskin draw, preserving attack contact and timing.
- Keep nearby combatants readable on short screens, preserve manual camera framing, and make surface confirmations more compact without hiding costs or chances.
- Forecast actual healing, surface contact, prop reactions and displacement. Healing Stream now works on its caster and previews only the health that can be restored.
- Preserve support AP granted before an ally's turn, show possible enemy attack reach during movement planning, and disable player action buttons during enemy turns.
- Keep the explored world visible during conversations, return keyboard focus to local actions, and remove unnecessary exploration-dock scrollbars.
- Add the Riverside dock and seated tea interaction, including the sip activity and return to walking.
- Clarify route guidance, quarry discoveries and the village homecoming; show the rescue scene's matching illustration.

Local verification includes both trade and escort campaign returns with save/reload.
The normal solo route has also been played through the Driller and homecoming.
Current-head remote checks and deployment remain pending. Listening quality and
physical Surface/iPad behavior remain unverified; this is not full-target signoff.

## 0.2.0 — unshipped changes included in 0.2.1

- Add registered oblique Forest Road and Quarry Gate scenes, including a connected western gatehouse with shared cutaway and missing-art fallback.
- Keep combat targets readable through unit focus, retained manual pan and resize redraw; align health bars and elemental effects with visible actors.
- Refine elemental release/contact timing and bounded fire/earth audio recipes while preserving combat rules, saves, credits and renderer fallbacks.
- Keep dialogue portraits visible on mobile and short screens, with headers naming the resolved speaker.
- Slow ordinary combat walking and align its steps to distance traveled.
- Preserve the title's commit build identifier alongside the version for reports.

These changes are included in the combined 0.2.1 candidate above. The later
quarry composition and water motion corrections supersede those earlier gaps;
listening review, physical Surface/iPad validation and full reference-target
acceptance remain open.

## 0.1.0

Existing live baseline at build `44ed3f6`: playable village–quarry–return route and calibrated Ba Dan courtyard.
