# Oil edges and liquid cue — remaining #598

Session `root/oil-edge-liquid598-20261111`; branch `codex/oil-edge-liquid-598`.
[Claim](https://github.com/jaredbahr/Avatarrpg/issues/598#issuecomment-6780383826).
Base is canonical main `252817e06559e2741e70c0ead0866fc922a49c19`, tree
`e6adc923016eade87c9c9b337ed4fc64c53b9be0`. Merged #606 is inherited once,
with the current #500 pacing and #618 demo direction. Twenty exact upstream
paths were adopted before production changes; the oil source and new test
were unchanged at adoption.
[New owner request](https://github.com/jaredbahr/Avatarrpg/issues/598#issuecomment-6787013045)
asks for organic per-pixel spill edges and a darker core with a thin, still
lighter sheen. It is presentation only, both backends, top-down only.

Only `src/render/topdown/surfaces.ts` oil painting and a temporary oil-only
paint silhouette/distance helper may change. Trimming at most three world
pixels inward is explicitly part of this claim; describing it as palette-only
would be inaccurate. The canonical cached mask, shared `organic.ts`/`maskInto`,
seeds, EDGE values, rules coverage, update/cache/version contracts, existing
nine-pixel repaint dependency reach, and all other materials stay unchanged.
No backend, animator, App, core, content, schema, asset, package, workflow or
budget edit belongs here. No generation, replacement art file or new animation.

The existing readability, surfaces/layers/wash and native surface-readability
files remain byte-identical. Preserve their pit-separation, opaque warm RGB,
one-pixel upper-left rim, <=2% interior highlight density, <=30 contrast and
500ms recompute gates. New tests use public output and independent contour,
connectivity, containment, core/sheens and incremental/fresh relationships.
No private export, copied palette golden or threshold weakening.

The painter uses three snapshot rounds of topology-preserving boundary trims.
Only world-coordinate priority maxima in each eight-neighbourhood are eligible;
equal priorities use one coordinate ordering. No eligible pixels are adjacent,
so simultaneous deletions cannot invalidate their local connection witnesses.
The predicate retains the final component pixel, requires existing adjacent
background and preserves every four-connected foreground path in its 3x3 ring.
Priorities do not depend on neighbouring mask or boundary eligibility.
Halos shrink from own+8 to own+7 to own+6, followed by distance capped at six:
three local reads plus six preserve the existing nine-pixel dependency bound.
The core is darker but remains above the pit floor. A still contour crossing
provides sparse sheen; it cannot fill vertically adjacent pixels or 2x2 blocks.

The original new-test RED was 7 fail / 5 pass. Two graph premises were wrong:
the canonical gate already disconnects adjacent centres (11,4)/(11,5), and the
Driller has two pre-existing detached fragments, each with depth-four pixels.
Removing them would contradict containment and the three-pixel trim limit.
Before production changes, the independent test was corrected to preserve full
pairwise canonical centre connectivity, one actual component per canonical
identity, and no newly enclosed background components. Original test SHA
`69244ad971ff77fc3f04ee1590f048a1cccda34f222386ae24212d959974d77c`
and original failures remain in external evidence. The corrected test SHA is
`9f3616b89d4b2084b31a5e0901ec4fdba48d977c151a08e77962f5a1a2e66915`.
Its unchanged numerical gates are max flat run 13 world pixels, shoulder/core
luminance difference >=4, inward trim <=3, sheen length >=4 and zero filled
2x2 interior highlight blocks. Corrected RED is 5 fail / 7 pass: four long
contours (18/22/17/43 pixels) and no darker core (difference zero).

Focused candidate validation: 50/50 pass across the new test and unchanged
readability, surfaces, surfaceLayer and wash suites, including the old 500ms
recompute gate. Log SHA256:
`5022936d4cf1a8318706be8c50bcaa05687c04615139e38d7e39e73e0b3512b8`.
The first painter had no interior sheen; its 2 fail / 40 pass result is retained.
The next passed 50 unit and seven native cases but was rejected at actual 3x
review for regular comb-like notches. Its source, images and rejection remain
preserved; numerical green was not treated as visual acceptance.

Fresh current-main overview baseline and accepted candidate native probes each
passed all seven cases: Canvas/WebGL quarry gate and Driller oil, actual legal
Fire Step and Move controls on both backends, plus the Canvas DPR2 control.
Candidate log SHA256:
`9bf5fd785788ed0327360cc66d8f36768719f619e9628c15f2473c978a993545`.
The new approved follow camera starts at zoom 2. The unchanged original native
suite produced four offscreen-sampling failures / three passes on the unchanged
main; these remain preserved. A separate external copy uses the actual Recentre
control before capture when needed, asserting fitted camera and unchanged full
game state. All original visibility, sample, stillness, reducer/event/RNG and
legal-command assertions remain intact. The repository E2E file is unchanged.
Earlier missing existing ffmpeg path and external-module resolution setup
failures are retained separately, not called gameplay passes. No install.

Actual normal-scale and nearest-neighbour 3x captures were reviewed on both
backends. The accepted candidate has irregular pixel contours, a darker core
and quiet thin sheen without the repeated comb. Broad terrace clipping still
follows the inherited canonical mask; this does not claim wholly new pool
silhouettes or owner aesthetic acceptance. Oil sample means are 51.5755/52.9230
versus baseline 63.9302/64.1619, still above the unchanged 44.2704 pit floor.
The older #606 complete runtime/assets differ from this main; no old native
acceptance was transferred. Each new run records actual source/producer hashes.

White quarry margins still await the explicit renderer #278 handoff; that
subtask and #590's Earth Wall are excluded. The new owner request does not
implicitly transfer protected backend files. The issue remains open for those
remaining requirements after this partial oil delivery.

The independent SOL High Standard author released the new test lease before
root's production edits and reviewed source, harness and rendered evidence.
Root owns integration and this handoff. Expensive jobs run serially.
Publication requires exact clean final-head `npm run ci:local`, a fresh native
pass on that CI output, complete output paths/SHA256/bytes identity and final
independent review before creating a public branch. The final exact commit/tree,
actual results and hosted jobs/skips belong in the draft PR and publication
receipt. Evidence is outside Git at
`/workspace/avatarrpg-env/oil-edge-liquid598/`; media have not been uploaded to
GitHub. This source checkpoint does not claim the publication gate has run.

Keep DRAFT. Real iPad/physical input, WebKit/Safari/PWA, browser floors,
physical/device performance and owner visual acceptance remain open wherever
unrun. Automated pixel metrics alone do not establish art acceptance. Source
checkpoints do not bump a deployed release version. No merge/Ready/deploy,
dispatch, install, paid request or credentials/permissions/security change.
