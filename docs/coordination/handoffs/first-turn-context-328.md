# #328 Show enemies view

## Result

Implemented issue option (b): the combat header's **Show enemies** control frames
all living enemy footprints and live props. The compact phone header puts it in
More. Camera framing uses the normal `fit`, `raiseToFit`, `zoomAt` and `panBy`
operations, with the visible enemy bodies and health bars included in the
framing bounds.

The view is temporary. A battlefield tap returns to the acting unit without
spending an action; Recentre does the same. A user zoom or pan takes ownership
of the camera and clears the temporary-view state. A turn change clears that
state and restores the existing follow behavior. Existing pinch and pan paths
remain otherwise unchanged.

## Ownership and integration

This branch starts at `049e160e04e87619d5379481e1414b0abd3b2878` and does not
include #327's unmerged camera glide. Its `CombatScene.ts` edits are confined to
the view control, target framing, and the small state transitions needed for
tap, Recentre, gestures and turn changes. `combatEnemyView.ts` owns the bounded
camera framing calculation; the opening and camera lifecycle stay with #327.

#327 is a soft dependency in the live issue, so this view can land first.
Whichever branch lands second must preserve both owners' `CombatScene` changes
when reconciling; do not replace the file from either branch. In
particular, once #327's glide API is present, `showEnemies()` must cancel an
active glide before it starts framing, following the existing manual view
actions. This branch intentionally does not add a private compatibility hook
for that API.

## Evidence

`e2e/combat-enemy-view.spec.ts` starts the forest road fight with the demo
party, waits for the first party turn, and asserts the live oil flask at `(13,6)`
and every living enemy/prop tile center are inside the actual canvas at
1280×800 and 834×1194. It also checks the tap and Recentre return paths, that a
return tap leaves actor position/AP unchanged, default and Huge-text phone
button heights, and user zoom takeover. A separate mobile case keeps the
temporary enemy view active through a real turn change and checks that the new
acting unit is framed; the first case separately checks that user-owned zoom
survives a turn change.

The current-code run passed in `/usr/bin/chromium` using port 4346. Screenshots
captured for review at `/tmp/avatarrpg-328-show-enemies-1280x800.png` and
`/tmp/avatarrpg-328-show-enemies-834x1194.png` show the northernmost enemy's
complete silhouette and health bar. The portrait run is Chromium viewport
coverage; physical iPad testing is not claimed.

Focused verification passed: the three `combatEnemyView` unit cases, TypeScript
typecheck, targeted ESLint and Prettier checks. Full CI remains with the
integration owner.
