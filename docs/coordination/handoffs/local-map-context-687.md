# Local map arrival context (#687 / draft #689)

- **Owner and scope:** root/local-map-context687; branch
  `codex/local-map-context-687`, same
  [claim 6836748703](https://github.com/jaredbahr/Avatarrpg/issues/687#issuecomment-6836748703).
  Only the Map closure/options in `ExploreScene.buildHud` (called by
  `renderHud`), unchanged `e2e/local-map-context.spec.ts`, and this handoff are
  authored here. No movement, loop, lifecycle, camera, pointer, LocalMap, style,
  asset, dependency, budget or original-test changes.
- **Behavior:** Map is unavailable while this scene still draws an outgoing
  area after the logical screen/map has changed. Activation rechecks the live
  state, then passes that current state, position and objective to LocalMapDialog.
  Ordinary same-area walking keeps Map available. The pointer owner's
  [integration instruction](https://github.com/jaredbahr/Avatarrpg/issues/629#issuecomment-6834618598)
  is retained: `worldObjectiveTargetId(this.app.content, current)`.
- **Current integration:** inherit merged main
  `e668b68927273869481b27032960bb80ce0abe5f`, tree
  `5da87736073898968b89100258fb585979facd81`, verbatim outside the owned Map
  hunk. This includes the merged framing/readiness/name/art inputs, music
  synchronization and Play again table-size changes. Main's Look around branch
  remains unchanged; this does not stack #690. The eventual same-branch
  fast-forward commit must retain published `9632152b` as first parent and E668
  as second parent. Canonical incoming metadata and blobs are preserved outside
  source; a local shallow boundary does not rewrite their parents.
- **Preserved evidence:** original qualified `9632152b` source, own CI output,
  native evidence, immutable qualification/review and all earlier failures remain
  separate. The failed F7 integrated candidate (tree `32428f34`, actual bundle
  419,872/419,840 B) is fully archived before this integration: source, all 447
  outputs, three authored copies, probes, patch and local archive bundle. Its
  failed gate is not waived or transferred to this source. The original pre-touch
  driver failure, subsequent strict-null compiler errors and interrupted CI are
  retained in the original task evidence.
- **Regression contract:** the existing two-case regression remains byte-identical
  (`6443b2eda9d1c73f34e1b4c9c880e267b3b6deff0834d19f5dc2b4d2e3a43719`).
  Controlled public startGame/enterNode setup precedes legal reducer-checked
  movement, normal animation and actual touchscreen Map taps; this is not an
  earned campaign. Preserve full unnormalized core/session, departure-window,
  current-area, route and same-area controls, 60 s cases and zero retries. No
  fake clock, state surgery, blanket walking disable or route-policy change.
- **Acceptance for this integration:** build/budget, exact clean final-head
  unchanged `npm run ci:local`, and fresh own-output native checks are UNRUN at
  this authoring freeze. Require Map 2, unchanged Map/curtain 3, original
  pointer/objective/dialogue 15 Chromium cases, music 2 and demo-ending 1 (23
  total), with unchanged assertions and deadlines. Bind source/probes and every
  output path/SHA/byte count to the actual producer; inspect raw state/media and
  obtain independent evidence review before updating the same DRAFT. No older
  head, owner or #690 pass qualifies this integration.
- **Open limits:** the existing approved installed toolchain differs from the
  updated lock at 20 patch versions; fresh locked-toolchain native reproduction
  remains open. No install or lock changes are authorized. Original WebKit
  pointer/dialogue cases and the owner's separate 820×700 Huge check are not
  replaced by Chromium controls. Physical input, Safari/iPadOS, PWA and device
  performance remain open; no broad visual or art acceptance is implied.
  No Ready, formal approval, PR merge, deployment, dispatch, new art, service or
  security/access action belongs to this task.
