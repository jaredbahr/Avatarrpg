# Combat threat overview — issue #328

## 2026-11-06: horizontal wheel must not cancel navigation (#444)

Continue the same draft PR357 and published branch, expected head `be913263`.
Root session `horizontal-wheel444-20261106T0958` recorded and verified #444
claim6682203355 and extended #328 claim6620986707 before edits. A native Canvas
probe on the exact published CI build reproduces a new edge case: horizontal
wheel input (`deltaX=160`, `deltaY=0`) clears overview ownership while camera,
full game/session state and selected Move remain unchanged. Its report, trace
and readback are retained outside Git. This is not a main-only Show enemies
reproduction or a repeat of the two existing portrait-WebGL timeout gates.

The correction belongs only in the zoom-only pointer adapter: keep existing
browser default prevention, then ignore raw zero vertical delta. Preserve all
nonzero vertical intent, including ctrl, line/page normalization and zoom clamps.
Do not infer no intent from an unchanged scale: that would break the accepted
manual cancellation of camera glides at a zoom limit. No scene, camera, core,
asset or configuration change belongs to this correction.

Acceptance combines unit red-to-green and unchanged pointer controls with a
dedicated native fixture. It selects a real pending Move, opens Show enemies,
uses horizontal wheel, proves navigation/state/camera preservation, then uses
the first real tap to return without spending or changing that selection. A
nonzero vertical wheel remains a real zoom positive control. Cover desktop
Canvas/WebGL at DPR1 and portrait Canvas at DPR2, normal clock and motion,
plus the existing gesture controls. Keep the original 60s/360s allowances,
zero retries/skips, full captures and real inputs. Review exact source, run
clean committed-head `ci:local` before push, and qualify the actual CI build.

Chromium uses native `mouse.wheel`. Mobile WebKit does not support that API;
its branch dispatches the same wheel point and deltas through the canvas
adapter after proving the canvas owns the hit point. No assertions are removed
and no WebKit cases are skipped. Readbacks label the actual browser and input
protocol. Local WebKit acceptance remains unrun. The vertical positive control
proves a real zoom increase, not native zoom-clamp coverage; the existing
scene/unit contract protects nonzero intent at clamps.

Final counts and producer identities belong to the PR and external receipts.
Both original #328 portrait-WebGL timeouts remain open; do not repeat them
unchanged or relabel old results as this head. Keep PR357 draft, with no merge,
deployment, installation or art action.

## 2026-11-06: qualification outcome and portrait focus precondition

Clean `967d471d` passed all nine local CI checks (285 files, 3,258 tests).
Its complete native matrix then finished with 17 passes and four failures,
without retries or skips, on the unchanged CI build. Both Grumbler targeting
cases passed. The two portrait-WebGL overview cases still exhausted their
original 360-second caps. Their stricter idle/96px camera/preference guards
passed, as did the Recentre geometry and capture; its final pending-target
check remained incomplete. The next-actor case reached real Ready and idle,
but its final settling and actor/frame assertions remained incomplete. Keep
these failures and stop protocol iterations without a new concrete finding.

The other two failures exposed an independent fixture error in the existing
portrait initiative test: Acting unit is inside the closed More menu. The
original Canvas case also fails on retained main `3afb1405`, whose runtime
and fixtures are byte-identical to current main `9225cd59`. This is baseline
evidence, not a newly attributed gameplay regression.

Claim6620986707 was extended and read back before editing
`e2e/combat-focus.spec.ts`. The correction opens More with a real click, proves
it expanded, preserves the original Acting unit click, and proves the menu
closed. Every original assertion, input, screenshot and deadline remains.
Production code, CSS, shared helpers, budgets and profiles are unchanged by
this separate correction. Root reviewed SOL High's bounded implementation.

Before pushing, run fresh clean committed-head `ci:local` and both corrected
portrait focus cases on that CI build. Compare runtime/build bytes and the
unchanged fixture bodies with the `967d471d` producer before reusing its
retained evidence. Report the two producer identities separately; never call
this a 21-case green run on the later head. The overview gates remain open,
and PR357 stays draft. Final counts and exact identities belong to the PR and
external receipts. No readiness, merge, deployment, installation or art action
follows from this fixture repair.

## 2026-11-06: adjacent observations and handoff-settle qualification

Continue the same draft PR357 and published branch
`codex/328-show-enemies-cloud`, whose expected remote head is `d32adb3d`.
Root session `overview-readback328-20261106T0740` verified claim6620986707
before editing the existing native fixture and this handoff. The own isolated
local branch remains `codex/enemy-overview-aim-gates`. Main `9225cd59` was
merged normally as `06eb9277`, with D32 as its first parent and no conflicts;
its accepted source and assets are inherited unchanged. Initial typecheck caught
the old overview's remaining `TILE` reference after main removed that import.
The separately claimed one-expression integration fix uses `camera.tile` for
the saved return zoom, as ADR0104 requires; the legacy 64px tile stays 64px. No
new artwork or game rule is authored by this correction. D32 captures and failures
retain their producer identity and are not relabelled as this integration.

The retained portrait WebGL traces quantify the remaining fixture cost. The
initial handoff camera settle costs 11.391s and 11.431s. Recentre also captures a
full DPR2 PNG in 16.834s; the next-turn case has no screenshot, so that capture
cannot explain its timeout. Both captures stay at their original stages and
resolution. Adjacent observations account for another 3.325s and 7.587s; these
measurements justify reducing duplication, not a promised timing improvement.

Coalesce the overview-active observation with the immediately adjacent menu
control snapshot, retaining the assertion before the next More input. Reuse
only the successful Move-position poll's accepted snapshot for the immediately
following Show enemies initial controls; refresh controls after actually opening
More. All role-based selectors and visibility/enabled, full state/session,
pending, navigation, painted-picking and frame assertions remain.

Only the two affected portrait-WebGL later legs may defer the initial
`takeTurn` camera probe through its existing `settleCamera` option. Actual Ready,
opening/party predicates and `waitForIdle` remain, followed by the existing
explicit Move-layout settle before any projected target. The first overview leg,
desktop/Canvas cases and phone keep their original setup. Qualify the deferred
fixture through the existing initial control observation: idle mode, 96px camera
and matching preferred frame, followed by 96px in the pending snapshot. These
stricter preconditions protect against locking a provisional idle frame; they do
not establish that qualification has passed before a rendered run.

Do not remove settles at projection boundaries, change clocks or motion, lower
DPR, bypass controls, split cases, remove screenshots or extend deadlines.
The original 25-second next-party, 60-second ordinary and 360-second forced-GL
caps remain. Root will run exact clean-head `ci:local`, then the complete 13-case
overview, six unchanged combat-focus and two Grumbler targeting cases on the
actual CI build, serialized with zero retries. New results belong to the final
PR and external `readback-deferral-20261106/` receipts. Keep every earlier failure.
WebKit, device, physical-input and accelerated-performance acceptance remain
separate. This correction authorizes no readiness, formal approval, merge,
deployment, dispatch, installation, asset generation or security change.

## 2026-11-04: current-main integration, browser legs and target acceptance

This continues existing draft PR357 on published branch
`codex/328-show-enemies-cloud`, expected head `64758076` before correction.
Claude's explicit handback6619057280 and the current #348 map release the earlier
landing hold. Root claim6620986707 (#328) and the updated conditional claim
6610205734 (#414) were verified before edits; fresh ten-PR scope checks found
only PR357 owns CombatScene. The original worker and #414 candidate worktrees
remain untouched; this isolated local branch is `codex/enemy-overview-aim-gates`.

Main `2ba71a01` was merged via `0fdf2d92`. All nine actual conflict regions were
reviewed against current main and the earlier `6fd27dde` merge resolution.
Current victory, defeat, opening, reduced-motion, preview, manual-camera,
glide-retarget and pending-move behavior survives alongside overview lifecycle,
turn expiry and first-tap return-only behavior. The reference merge was not
blindly cherry-picked or used to import another batch. Ordinary More fixture
patch `e953a101` and timer-stub-only patch `9eef5bdf` were carried with their
authors preserved. The timer methods supply real platform APIs to the test
double; no assertions were removed.

The original four viewport/backend/motion combinations are partitioned into
three independent legs each: overview/tap return; Recentre/picking; and genuine
Move followed by overview/end-turn/native-AI/next-party ownership. Every old
assertion, real Move/Confirm/Ready input, mapped motion/DPR profile, 25-second
next-party wait and 360-second software-WebGL allowance is preserved. The next
turn still uses the original reducer command; the phone/load lifecycle case is
unchanged. The portrait More correction opens the list before the click observer,
checks Recentre there, and closes it before the board tap.

Root's exact four-file test-only #414 candidate `12d373d7` was reused. Its
82-command earned checkpoint retains the same official reconciled save hash.
On the current merged source, the actual tap-handler regression failed once
for raw far-cell acceptance while 35 other cases passed. Calling the existing
core `resolveAim` after protected pointer/body resolution makes all 36 pass;
99 additional body-picking, camera, lifecycle, pause, victory and core-aim cases
also pass. No core targeting rule, renderer/body geometry or outcome is changed.
The carried native wheel setup now forwards the same delta through the canvas
listener, preserving all targeting assertions.

The first instrumented probe preserved a real 360-second portrait timeout before
its return tap; Canvas targeting passed all controls in 43.171 seconds. The
portrait trace measured a redundant Recentre menu open/close detour at 76.217
seconds. Its unchanged visibility and collapsed-menu assertions now live in the
actual Recentre leg, with folded-header visibility sampled before that click;
the following painted tile input also proves the menu clears the board. No
settle guarantee, assertion, profile or deadline was removed. The interrupted
probe's orphan browser was positively identified and stopped; its CPU contention
and the original failure remain recorded. Main's subsequent art-contract-only
change `a7a90caa` was merged via `c2e6b897` before final validation.

The complete matrices on `a0178751` and `16d65cf6` each passed 13 cases and
hit the two portrait WebGL 360-second caps. A separate no-video pair also timed
out. Continuous recording was not a sufficient cause. All reports, traces and
recordings remain separate in the external evidence directory; both Grumbler
backends passed every corner/state/cast control. A keyboard-precondition trial
also proved insufficient and is removed from the current source.

The final partition keeps the original initial More/menu inspection and pointer
Move setup once per profile in the first leg. Later legs select Move directly
with the original pointer input. They still open More and assert Show enemies
visible/enabled when invoking that functional action. This removes only the
split-introduced duplicate menu inspection, not any original assertion or input
coverage. Batched snapshots check Move visibility/enabled state, collapsed More,
and complete game/session equality through pending selection. All functional
Show enemies, Recentre, map taps, Confirm, Ready and end-turn inputs, settles,
profiles and deadlines remain. Independent semantic review is clear. Retained
traces measure about 30 seconds of redundant work in the previous later-leg
setup; sufficient savings are not assumed before native validation.

The direct-Move candidate passed typecheck and four preliminary Canvas cases
(desktop/portrait Recentre and next-turn) in 54.7 seconds. An initial TypeScript
union-narrowing error stopped before any browser case; explicit common baseline
shape corrected it without a cast, and both logs are retained. New exact-head
CI and full native results must come from `protocol-direct-move/`; earlier
commits' checks do not transfer to a changed source head.

Final exact-head CI/native results belong to the PR and external receipts under
`/workspace/avatarrpg-env/enemy-overview-gates328/`. Passing earlier revisions
does not transfer to a changed head. Keep this a draft; no new media or assets
are committed, and no WebKit install, hosted dispatch, physical-device/listening
or performance acceptance, merge, deployment or formal approval is claimed.

The sections below retain the original revision's source and acceptance record.

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
