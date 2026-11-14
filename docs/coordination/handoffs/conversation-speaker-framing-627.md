# Keep pinned speakers above dialogue — partial #627

Session `root/speaker-frame627-20261111`; branch
`codex/conversation-speaker-framing-627`.
[Claim](https://github.com/jaredbahr/Avatarrpg/issues/627#issuecomment-6792424420).
Base main `e6ee5db136d17968adad34611fe625f2ba830e38`, complete tree
`7c48d63a247ae9d47314667def62487d20dde56e`.

At Largest text, speaking to Dorin from the northern path left his world sprite
behind the dialogue panel. Next, resize and reload/Continue retained the problem.
The camera now frames the canonical talk pin's actual NPC marker above the actual
panel. It uses the existing sheet frame, anchor, footprint, scale, directional
facing, lean and snapped bob to bound the whole drawn body. Only camera offsets
change, through the existing clamped `panBy` API. Integer zoom, centre margins,
paint extents, art, actors, domain state and legal animation tracks stay intact.

This private ExploreScene helper runs after current NPC markers are built, ahead
of walk/practice camera following, and during refit before the synchronous repaint.
It covers loaded conversations and changing panel geometry without relying on an
entry transition. Top-down only; absent/invalid/unrendered targets and other
projections retain existing camera behavior. Oversized bodies receive a stable
best-effort alignment within existing clamps; no new zoom or bounds policy.

This is a camera-only partial. ConversationPanel, DialogueScene, panel sizing,
nameplates, App, renderer/backend/Camera code, core/content, styles and assets are
excluded. #547's separately published journal callback is not duplicated. #627
remains open for its other requests. Prior ExploreScene ownership ended with
PR450's actual merge; the claim and live ownership checks precede these edits.
PR640's completed suggested-party change was adopted before fresh baselines.

The independently authored native spec has eight cases: four retained Pella
default-text controls and four ordinary Dorin Largest-text cases, Canvas/WebGL at
1180x820 and1366x1024. The sprite oracle reads actual Canvas drawImage destination
corners through its transform or actual Pixi Sprite.getBounds, never the new
helper or a footpoint/portrait proxy. The entire sprite quad must remain inside
the canvas and strictly above the panel, with zero overlap allowance.

Pella covers a real core-created pin and legal in-flight party tracks through the
documented public resync hook: explicitly an early presentation stress fixture,
not ordinary approach timing. Cloned state/session/moves/deadline and renderer
identity remain exact across reconciliation. Ordinary Next/resize, public saveTo,
real reload/Continue and a different repeat conversation are also exercised.
Dorin uses supported party-position setup at a real bench, the real wait command
to afternoon, his real northern adjacent path and actual Look around/Visit. No
resync, fabricated actor, phase, story flag, pin or outcome. Next/resize preserve
full state/session/RNG, moves and applicable timing contracts; saving/loading
legitimately resets presentation tracks. These are scoped fixtures, not an
earned campaign or physical-input proof.

Default Pella baseline:4/4 passed. Ordinary Dorin baseline:4 failed/0 passed,
each exactly four soft geometry failures, with every hard control complete;
log SHA256 `0378f0b5d3329d18dfc1451a45e91055c3950e51378b31f53cc439d6449ec20e`.
Observed overlap was105–207 CSS pixels across both backends and sizes. Frozen
final test SHA256 `bc3d612883df7960479cb04823e11fd7a694d0808e63225301698487404d483f`.
Earlier type, queued/deferred-presentation and invalid idle-deadline fixture
expectations are preserved separately, not labeled camera regressions. The idle
Next check now requires the exact existing command-time horizon plus no playback;
Pella's active-route deadline equality and every geometry gate remain intact.

Before public ref: exact clean canonical-head full `npm run ci:local`, fresh
native on that head's own outputs, unchanged legacy framing checks, real-clock
render-cadence diagnostics, complete source/output identity, actual PNG review
and independent review. Final identities and actual passed/failed/skipped jobs
belong in the draft PR/publication receipt; this checkpoint does not claim unrun
gates passed. Raw evidence/media live outside Git under
`/workspace/avatarrpg-env/speaker-frame627/`.

Keep DRAFT. Physical iPad/input, WebKit/Safari/PWA, browser floors, device FPS and
owner acceptance remain open. Linux Chromium/SwiftShader cadence is diagnostic,
not device performance acceptance. No merge/Ready/deploy/dispatch/formal approval,
install/purchase, art generation/replacement or security/credential/access change.
Expensive game checks run serially. DeepSeek remains unused: executor/shared
accounting unverified, uncertain reservation retained.
