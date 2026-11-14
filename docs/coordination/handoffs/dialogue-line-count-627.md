# Short landscape dialogue: keep the line counter visible (#627)

Owner: `root/dialogue-count627-20261112`, branch `codex/dialogue-line-count-627`.
Claim: https://github.com/jaredbahr/Avatarrpg/issues/627#issuecomment-6827645491.
Base: `055bfefe48977aec57ad6bd6b29a9a66eed3e680`.

Natural Talk to Pella or Gao at 1180×820 with Huge text clipped the line counter
below the panel although Next was visible. The current panel is content-sized;
ADR 0107's approved 15rem portrait determines its minimum height. This correction
uses existing spacing tokens for vertical padding and the portrait/name gap on
short landscape tablets. Portraits, type, touch targets, grid, scroll behavior,
height cap and horizontal padding retain their existing contracts.

Exactly one new CSS media block applies at width ≥60rem, height 35–55rem and
landscape, explicitly excluding `.choice-panel` (choices also have the
`dialogue-panel` class). No vote styling, ConversationPanel/DialogueScene DOM,
camera, renderer, rules, saves, content, assets, package or budget change.
The separate completed #627 speaker-framing work and draft #664 vote layout
remain with their existing claims.

Preserved reproduction: two DPR2 rendered failures solely on counter bottom
809.0625 exceeding panel bottom minus border (795). Normal portrait/name wrapping
and complete state/session checks passed before that assertion. Original four
natural-conversation discovery controls passed. An earlier missing-import-path
harness enumeration failure is retained separately and is not a gameplay result.
The producer's relevant CSS/panel/content/camera/helper blobs equal main's.

New regression coverage uses real canonical adjacent Talk, Normal/Large/Huge text,
Pella and Gao at both tablet sizes, supported public initial-position setup,
unchanged state/session and reducer-equivalent Next. Phone/upright controls retain
their smaller portrait and scrolling contracts. Existing natural speaker-framing
checks continue to require zero actual rendered NPC-body overlap on Canvas/WebGL.

Run the unchanged full `npm run ci:local` on the exact clean final head before any
public branch. Native evidence must use that head's own complete output. Exact
results, source/output manifests, original failures, review and remaining gates
are recorded in the issue claim and draft PR; local evidence lives at
`/workspace/avatarrpg-env/dialogue-count627/` and
`/workspace/avatarrpg-env/dialogue-layout-discovery627-20261112/`.

Keep the PR draft. Physical input/device, Safari/WebKit/PWA, browser floors, FPS,
owner acceptance and broader merged runtime remain separate gates. No merge,
deployment, dispatch, dependency installation, security or art changes.
