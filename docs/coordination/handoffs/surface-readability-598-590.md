# Top-down material readability — partial #598 and #590

Owner: `root/surface-readability598-590-20261110`.
Branch: `codex/surface-readability-598-590`.
Base: canonical main `7078148ae9fb088e992d36e5d46c2dad0c1a22cb`.
Work started on main `95596b54296ba90c799a1794b17a1281140f18c4`; main advanced
through PR579 before freeze. The four-file candidate was preserved and carried
onto the exact signed merge/tree, with all four file hashes unchanged at that
step. Only the six merged core-performance guard paths changed in the base;
runtime painting, rules, content and assets did not. Final CI includes that guard.
Claims: [#598 oil](https://github.com/jaredbahr/Avatarrpg/issues/598#issuecomment-6780383826)
and [#590 char](https://github.com/jaredbahr/Avatarrpg/issues/590#issuecomment-6780384476).

## Bounded scope

The owner reports oil reading as pits and fire char reading as a translucent film
on paving. Correct only the existing procedural `oilPx` and `firePx` painters in
`src/render/topdown/surfaces.ts`, plus new material/browser regression coverage.
One integration owner holds both related changes; no competing painter branches.
This is a partial delivery: #598's white board margins and #590's Earth Wall rise
remain separate work and neither whole issue is closed by this material PR.

The newer issue #598 requests opaque dark brown-olive oil, a one-pixel lighter
upper-left rim and sparse still low-contrast streaks. The current prototype's
`oilPx` still contains the old warm-black palette, like the port; do not claim
its bytes already match the newer requested appearance. Preserve the approved
material approach: no translucent film, rainbow sticker or twinkling glints.
#590 requests opaque ash/soot char on every ground with its ember speckle and
organic edge retained.

Masks, geometry, terrain legality, incremental updates, caches, seeds, flame/glow/
steam timing, event log and RNG remain unchanged. The painter is already shared
by the top-down backends; no backend, App, animator, content, asset, schema,
package or workflow edit belongs here. No PixelLab generation, inpainting,
animation, retries or generated/replacement asset file is authorized.

## Acceptance and evidence

Write meaningful new RED tests on the unchanged painter before production edits.
Oil checks compare its interior luminance with the prototype's void/pit colours
and ground, verify a lighter upper-left rim and static low-contrast streaks, and
retain full opacity. Char must cover paving without ground bleed; its painted
pixels remain opaque while the organic mask and embers retain their roles.
Use public material outputs and independent material/compositing relationships,
not private-function exports or a golden copied from the implementation.
The unchanged painter was RED: **4 fail / 1 pass**, then the minimal correction
passed **38/38** focused cases including all 33 unchanged surface/layer/wash tests.
The unit source stayed identical; old 500ms, geometry and cache assertions remain.
RED log: `ab16264d1264380db6cb00d7d518dbd12cfc4f1c3ae5676bc7be2976269b9cb7`.
Focused green: `da180429e8b925d4d8cbd29ac371107e337c133fae46f7dfcbb7aa4052fe96d5`.

The final seven-case rendered counterfactual is **4 fail / 3 pass**, zero skips,
retries or flaky cases, stable 104.592s. Both backends' quarry/Driller oil samples
fail only the independent >44.2704 luminance threshold: gate 26.0508 and floor
26.43984. Static pixel equality, fresh draw timestamps, canvas containment and
unchanged state pass. The three legal Fire Step controls pass (Canvas/WebGL DPR1,
Canvas DPR2), with actual command/events/full-state/RNG comparisons. Those native
char-contrast checks complement the unit's opacity test; they do not themselves
prove alpha. Baseline log:
`77e7b4fa51e6a6aca0b99ed6dde241d7f01e23929714b05dca66fda65aff6412`.
The clean rendered producer is prior CI head `1a264b6da897a8357abec6682ebd73639ad266b5`,
tree `0e8bbb6105911e7adf636c52a43512baffe3a456`; its only runtime difference from
main is unrelated SaveMenu guidance. The renderer/material/content/assets match
this branch's base. The dirty test checkout and clean producer are recorded
separately; no candidate acceptance is inferred from the baseline.

The legal char setup uses a supported level-three Kaya slot with Fire Step chosen
at game creation, then real targeting/Confirm and Move controls on quarry-gate
paving. It does not claim that a level-one starting character already knows that
technique, nor that this focused setup is a complete campaign playthrough.
An initial test-only static run found four private-type/readonly event errors;
those logs remain. The corrected probe uses a passive plain-data view read and
readonly events, and forwards each actual UI dispatch once without changing it.
A prior single Canvas pilot established legality only; the stricter final probe
retains it separately and adds actual canvas/DOM bounds and DPR-aware sampling.

Run the existing surface, layer and organic coverage unchanged, including its
500ms recomputation budget, deterministic incremental/fresh equality and terrain
exclusions. Root captures actual quarry/Driller oil and legal fire-on-paving on
Canvas and WebGL at the owner's 1280×800 viewport, retaining each engine/project
DPR (CSS-scale screenshots and backing-store-aware projection), with before/after crops kept
outside Git, real controls/state/RNG and static reduced-motion coverage. Every
material sample must lie inside an unobscured canvas; each requested cell and the
whole sample set are nonempty, and the static comparison requires a newer actual
draw. A local DPR2 Canvas Fire Step control checks that projection as well. Source
checks complement rendered gameplay; neither establishes final owner art approval
or physical-device performance. Preserve every original failure and source/probe/
configuration/build identity.

Freeze reviewed exact clean source before required `npm run ci:local`; all gates
must pass before any public branch/push or DRAFT PR. Native validation binds to
that exact production build. If done before CI, transfer only when every fresh
CI output path, byte count and SHA256 and all head/tree identities are identical;
otherwise rerun native on the fresh CI build. The PR records actual results and
actual hosted leaf jobs, including skips.

Evidence and receipts live at `/workspace/avatarrpg-env/surface-readability598/`.
Physical input, WebKit/Safari/PWA, device FPS and owner aesthetic acceptance stay
explicitly open. Keep DRAFT: no Ready/formal approval, merge, deployment, dispatch,
software install, paid request or security/credential change.
