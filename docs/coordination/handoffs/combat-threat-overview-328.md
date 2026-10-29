# Combat threat overview — issue #328

- **Updated:** 2026-10-29, final source freeze. Cloud source owner
  `/root/issue328_source_scope`; browser acceptance owner
  `/root/issue328_dependency_audit`; integration and validation owner `/root`.
- **Outcome:** implement issue #328 option (b): an explicit **Show enemies** view
  action frames living enemies and props. A battlefield tap or Recentre returns
  to the acting unit, preserving the selected action and pending target. Later
  turns retain their ordinary framing. This is an isolated local source
  checkpoint, not a delivered playable release.
- **Location:** `/workspace/avatar-328-show-enemies`, branch
  `codex/328-show-enemies-local`, based on
  `bc77ae2eceb6740dd4c143cae61595a1f4884bc2`. Check the actual branch head and
  root's exact-source validation receipt before promotion. There is no #328
  publication or merge claim in this handoff.
- **Dependencies and coordination:** #328 says, “Soft: #327 (combat-camera
  glide). If the glide lands first, use it for this move.” Root checked the live
  issue, comments, branches and open PRs and found no visible competing #328
  claim; that alone does not prove absence of every owner. Root then checked
  the actual PR352 scene changes and PR355 CSS/test boundary and assigned this
  bounded implementation. Root retains shared-camera integration ownership.
  No #327/#333 source is copied into this branch. The private combined
  `9e7bbd67` candidate remains compatibility evidence, not a landing branch.
- **Source scope:** `CombatScene.ts` owns the explicit view action and ephemeral
  overview lifecycle. `combatEnemyFrame.ts` composes existing Camera APIs to
  select legal framing. It includes complete enemy silhouettes, terrain lift,
  prop image squares and footprint corners. Whole device-pixel stops take
  priority; a narrow view can use the Camera's existing overview exception. An
  impossible fit retains the widest permitted frame and returns false; no
  camera limit is relaxed. Its focused tests and `combatEnemyOverview.test.ts`
  belong to the source owner. No renderer/collision, browser installation,
  credential/security, asset or save-schema changes belong to this task.
- **Browser acceptance:** `e2e/combat-threat-overview.spec.ts` defines five
  cases. Four complete flows cover 1280×800 DPR1 and 820×1180 DPR2 on Canvas and
  forced WebGL. Desktop Canvas and portrait WebGL use normal motion; desktop
  WebGL and portrait Canvas use reduced motion. This is a bounded matrix, not
  every combination of device, engine, text size and motion. A fifth Canvas
  case covers phone More, keyboard focus, the minimum tap target, genuine save
  adoption and a detached control from the unmounted scene.
- **Fixture and assertions:** the explicit new seed is
  `avatar-328-threat-overview`, with Kaya/Sura/Bo. The fixture enters the authored
  forest battle through `App.dispatch`; it never relocates actors or injects
  camera/terminal state. Before any real movement, it checks all live enemy
  footprint cells and all four live props, including the oil flask at `(13,6)`,
  against the actual canvas and backing-store scaling. It also checks legal
  device scale, complete state/RNG preservation, pending Move preservation,
  tap consumption, Recentre return, a subsequent genuine tile tap and confirmed
  move, and turn-change expiration while overview is still active. Same-event
  click observations verify reduced-motion framing without waiting for a timer
  or animation frame. The earlier demo review did not pin this seed and is not
  reused as seeded acceptance evidence.
- **Validation procedure and preserved findings:** root owns serialized checks
  and the exact-source receipt. Untouched main failed at the missing Show
  enemies button. The first implementation's browser run passed four cases;
  portrait WebGL with normal motion exhausted the existing software-renderer
  cap near the final next-player handoff. Its trace and all captures are kept.
  Independent review also reproduced cropped dispersed enemy heads, a missed
  narrow DPR1 overview stop and a clipped Quarry Floor prop. The corrected
  helper includes their geometry and legal-stop regressions. Menu focus skips
  the new disabled terminal control. Final validation must use the resulting
  source, preserving all assertions, motion coverage, real taps and the existing
  browser budget. Captures use `FNT_REVIEW_DIR`; geometry is attached to the
  Playwright report. Root's receipt and task result record final counts and
  inspected evidence, superseding these implementation checkpoints.
- **Promotion gates:** run `npm run ci:local` on the actual source head before
  any push, check focused browser behavior and real captures, and reconcile
  shared camera source on a private combined tree. Existing green #327/#333
  results do not validate a new #328 head. Keep one source PR and revalidate any
  recomposed landing head. The issue does not require #327/#333 to land first,
  and the repository does not impose an extra per-PR owner approval gate.
  Current delegated work is local; this handoff authorizes no public mutation.
  WebKit, hosted browser/gallery and physical iPad/Surface acceptance remain
  unverified. Keep the specifically denied #333 draft creation and PR353
  description operations stopped. No retry, formal approval or merge follows
  from local green results.
- **Transfer:** browser spec and this handoff are ready for root's serialized
  validation; the browser acceptance owner remains available for concrete
  failures. Root must recheck the live head, worktree and owner state before
  promotion and preserve one landing PR per source change.
