# NPC talk indicator clearance

Existing draft [PR #278](https://github.com/jaredbahr/Avatarrpg/pull/278),
[claim and current validation](https://github.com/jaredbahr/Avatarrpg/issues/277#issuecomment-6605165886).
This corrects the first bounded marker item in #277. NPC replacement, reported
ground rectangles, Riverside cohesion and TV-scale art acceptance remain separate.
Keep Refs #277 without closing the composite issue.

## Implementation

Main `34dc5f334daa1ae0f9fe8050d0a996cae4e3b03b` includes #375's snapped raster
cue and #410's house edges. Preserve its approved art and pipeline bytes.
Both backends retain the same four-world-pixel marker radius, colour, opacity
and layer. Cached visible-alpha bounds and shared geometry place it above the
actual frame, accounting for the planted anchor, facing, scale, pose scale,
lean and rounded lift, with a four-world-pixel gap. Unreadable or empty pixels
fall back conservatively to full-frame bounds. Foot anchors, picking, movement,
source art, cache budgets and texture sampling are unchanged.

## Validation and reproduction

`e2e/npc-talk-pip.spec.ts` uses real Look around/walk/Wait controls, normal clocks
and motion, and camera framing only. It measures actual atlas alpha and raster
pixels through forwarded Canvas draw calls or actual Pixi sprite transforms.
Culled emissions cannot shift WebGL pairing; intervening image draws invalidate
Canvas pairing. Each case requires four fully visible walking and four idle
frames, two walking cels, no capture overflow, unchanged passive campaign state,
and a real Dorin body click followed by normal approach to his conversation.

Current native producer `d3b092be3f2922f1bdabd205f2e2b8533e8fa15d` passed 2/2
Canvas/WebGL cases in 102.960s, one worker, zero retries/skips. Source, public,
fixture and dependency/config bytes match the final publication candidate;
subsequent changes concern handoff and publication packaging only. Focused
source validation was 108/108, with the final raster cases 7/7. Independent
source and fixture review found no remaining blockers. The exact clean final
publication head must pass all nine `npm run ci:local` steps before updating
the existing branch; its result and actual hosted job identities belong in
PR #278 and the claim after execution.

Original observer/setup failures and genuine current-renderer baseline failures
are retained outside Git and summarized in the claim. These include the first
tile-size assumption, culled-pip pairing timeout, Canvas pairing correction,
and actual negative walking/idle clearance after state/picking controls passed.
No assertion, required test, timeout or budget is weakened or skipped.

## Evidence and remaining acceptance

Follow [#348's evidence rule](https://github.com/jaredbahr/Avatarrpg/issues/348#issuecomment-6605458759):
review screenshots, videos and generated capture reports stay out of the
publication tree and its new branch ancestry. Keep source fixtures in Git;
attach review media to the PR when the available tools support it. Record any
attachment limitation plainly. Local raw media, traces and checksums are retained
outside the repository, never used as an excuse to commit media or change access.

Local coverage is installed Chromium, 1368×912, DPR1, integer zoom2, Canvas and
forced software WebGL. Observer frame intervals are limited observations, not
accelerated hardware FPS acceptance. Full hosted browser/gallery, WebKit,
Safari/PWA, physical input and owner aesthetic acceptance remain open. Keep the
PR draft under the current direct goal; no readiness, merge or deployment.
No new dependency, paid assistance or art generation is included.
