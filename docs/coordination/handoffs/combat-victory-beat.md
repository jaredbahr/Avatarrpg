# Combat victory beat (#333)

The integration owner is the delegated cloud root on branch
`codex/333-victory-beat-cloud`, based on main
`bc77ae2eceb6740dd4c143cae61595a1f4884bc2`. This checkpoint transfers the
implementation and independent source review to root for exact-revision CI and
draft publication. The PR's latest checks and root's validation receipt determine
publication state; this document does not authorize a merge or deployment.

A live victory waits for the final KO and floaters to finish, frames living party
silhouettes, then holds an undimmed beat before the unchanged result card. The
explicit map overlay skips only the hold. Ordinary board taps never skip
playback. Reduced motion waits for idle and shows the card without reframing.
Defeat and loaded terminal saves show their card immediately. Returning to a
retained scene settles an existing hold once. Result wording and initiative-strip
behavior stay intact.

`CombatScene.ts` owns waiting/holding/shown presentation, terminal focus protection,
resize ownership and cleanup without a delayed victory callback. Detached skip
callbacks check their exact presentation instance. `combatVictoryFrame.ts` uses
existing Camera APIs and silhouette geometry, measured headroom and elevation.
It selects the closest fitting legal integer stop. An impossible group fit keeps
the widest camera-legal frame and reports false; no camera limits are relaxed.
The legacy continuous-camera fallback widens in 0.9 steps. `hud.css` keeps the
skip surface transparent while hovered or pressed. `base.css` defines
`--dur-combat-victory: 1000ms`, sampled once per hold by the shared duration parser
also used by the title art.

Focused validation passed 44 tests in five files, TypeScript, targeted ESLint,
Prettier and whitespace checks. Independent source review found no remaining
P1/P2 findings and checked 180 integer-camera arrangements. The new
`e2e/combat-victory.spec.ts` passed six Chromium cases across Canvas/WebGL at
Surface DPR 1 and compact DPR 2: lawful finishing hit, final camera retention,
first-idle party frame, full hold, skip without resolving combat, terminal save,
reduced motion and immediate defeat. Root inspected ordinary screen captures of
all four party frames. Pixel difference checks are ink/geometry guards; visual
inspection establishes that party bodies appear. Two Canvas cases fail against
unchanged main at the intended immediate-result assertion. Initial probe-only
coordinate/type errors are preserved in root's evidence and corrected without
changing product code or weakening the assertions.

Before any push, root must run `npm run ci:local` on the committed revision and
verify the exact branch and claims again. WebKit, full gallery and physical-device
acceptance remain open. The pinned official WebKit download previously returned
HTTP 403; no browser-download, credential or security retry belongs to this task.
Keyboard focus after combat-action removal remains a scoped usability follow-up;
no autofocus change was introduced.

Renderer/collision owners (#322/#335) are untouched. The unmerged #327/PR353
implementation was not copied into this branch. No playable release or version
bump is included. All implementation workers have relinquished editing to root;
source and browser review records remain in `/workspace/pr333-evidence` for this
cloud session.
