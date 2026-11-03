# Returning-worker objective — #404

Approaching a rescued worker on Forest Road used to silently enter the outbound
`forest_explore` hub. Its quarry objective replaced the return-home cue and was
preserved by save/load. All five forest worker definitions now use the existing
`forest_return_explore` hub. Dialogue, placements, profiles, arrival triggers and
the outbound hub remain intact.

## Reproduction and source identity

The fixture uses `generateQuarryCheckpoints(custody).afterDriller`, which earns
its state against unmodified enemies with legal public commands. Trade's
149-command save has pinned SHA256
`aeee6bd55046a40755ddb60da7d808c7f240fc65c0baa6b4c9d0be742ce058b3`.
Eight further legal commands take the west exits, finish Dema's existing lines
and approach the road south of Bo-shan. No flags, HP, outcomes or positions are
fabricated. The full transcript replays to the exact checkpoint and survives
official load reconciliation on both custody routes.

| Native producer                                           | Commit                                     | Complete tree                              | Result             |
| --------------------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ------------------ |
| Main45747455 plus regression fixtures; old worker targets | `0095a625d84bb46e53297c0ce6306f3e1797e479` | `5fbd872ff59f22b92f423cf663d5aa577221d94e` | 4 failed, 188.23 s |
| Five target corrections; identical harness                | `ec5688641b8ba5e0b9e8aa12392980f47919236c` | `156ac8f7073e0f8fa523859937388fd517ad3773` | 4 passed, 211.79 s |

The only baseline/candidate runtime difference is five node-target strings in
`src/content/maps/world.ts`. Later evidence documentation changes the complete
tree; the PR records final published identity and full local checks.

## Actual checks

- Core: **10 expected failures /4 passing controls before**, **14/14 pass after**.
  All five workers, both custody routes, exact save/load, unchanged returning
  profiles, real west-arrival completion to resting, and outbound controls.
- Existing focused content/story/save/checkpoint coverage: **242/242 pass**.
  This includes unchanged canonical quarry save/transcript pins.
- Native Chromium: desktop Canvas/mouse1280×800 and portrait WebGL/touch834×1194,
  each trade/escort, DPR1. The real Load UI adopts the exact earned save; actual
  input at Bo-shan's tile is observed through a forward-only dispatch wrapper.
  Baseline load/state/session/input preconditions pass, then all four fail on
  the wrong objective label. Candidate runs retain the correct label, use the
  actual Save UI, reload, and compare the entire state. No browser errors.
- One worker, zero retries; unchanged10s expectations, repository60s Canvas
  case cap and existing360s software-WebGL allowance. Canonical failure tracing
  remains enabled. Neither an assertion nor a budget was loosened after failure.

Baseline native cases stop at their wrong-label assertion; their UI reload phase
does not complete. The baseline persistence defect was separately reproduced
through core serialization and official reconciliation. Candidate native cases
all complete UI save/reload. Their extra work means these durations are not a
before/after performance benchmark.

| Actual trade interaction capture | Before                                         | After                                         |
| -------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| Desktop Canvas                   | [Wrong quarry cue](before-canvas.webp)         | [Correct home cue](after-canvas.webp)         |
| Portrait WebGL                   | [Wrong quarry cue](before-portrait-webgl.webp) | [Correct home cue](after-portrait-webgl.webp) |

Native PNGs were converted to WebP quality90 without resizing, cropping or
retouching. Root inspected the current captions. `verification.json` binds
receipts, source/helper hashes, all four outcomes per build and raw-artifact
hashes. Complete reports, PNGs, attachments and failed traces are retained at
`/workspace/avatarrpg-env/forest-return-404/runs/` (a local retention path, not a
public artifact link). Initial Senn south-approach fixture diagnostics were
retained separately; its corrected test uses the legal north approach before
the final red/green comparison. No placement or reducer workaround was made.

Independent SOL review found no hidden phase/arrival/save defect or weakened
test. No personal dialogue or story/lore was added; silent worker interactions
keep the existing return phase. No game art, schema, renderer, workflow or
security change occurred. Physical iPad/Surface, Safari/WebKit/PWA and final
owner visual acceptance remain unverified. No live deployment or access to
Jared's browser is claimed.
