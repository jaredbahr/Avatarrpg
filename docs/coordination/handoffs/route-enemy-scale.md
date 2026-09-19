# Live-route adult enemy scale

Owner: quarry composition agent; integration belongs to root. Branch
`codex/route-enemy-scale`, isolated from next-quality `d0d13c7` at
`C:/Users/Jared/Documents/ChatGPT/Avatar RPG-route-enemy-scale`.
No push, CI dispatch, version change or edits to the integration checkout.

## Finding and correction

The five older route sheets have 121-pixel idle silhouettes in their original
128×192 frames, normalized with the old 0.78-height setting. At 96-pixel tiles
they stood 90.75 pixels tall. Sura's corresponding 121-pixel sheet uses the
existing 1.25 party scale and stands 113.44 pixels tall; newer enemy art has
151-pixel bodies and stands 113.25 pixels tall. The ordinary bandit and especially
the broad bruiser therefore looked unusually small beside adults.

Use the existing `RenderUnit.scale` contract, including animation squash, with
one shared per-key calibration in `src/app/anim/actorScale.ts`:

| Existing sheet | Multiplier | Standing height at 64 | Standing height at 96 |
| -------------- | ---------: | --------------------: | --------------------: |
| thug           |       1.23 |                 74.42 |                111.62 |
| bruiser        |       1.28 |                 77.44 |                116.16 |
| slinger        |       1.21 |                 73.21 |                109.81 |
| quarrybender   |       1.23 |                 74.42 |                111.62 |
| crossbow       |       1.23 |                 74.42 |                111.62 |

These are projected alpha-body heights, not frame heights. The broad bruiser
remains taller and wider, and the lean slinger slightly shorter. Source pose
silhouettes and their variation are retained. Every cel still ends at the
same source baseline (exclusive row163), and the 0.5/0.85 anchor stays fixed.
Matched actual96 bruiser captures show the feet at the same ground position
while the head rises from approximately372 to346 screen pixels.

`CombatScene.poseFields` applies the multiplier to the rendered body;
`choreography.ts` applies the same multiplier to attachment snapshots. Existing
pose scale still multiplies both, while logical positions and ground impact
coordinates are unchanged. `exploreMarkerScale.ts` uses that helper once:
the Forest Road thug marker changes from1.25 to1.23 rather than multiplying
two corrections. Its combat and exploration versions now share the same scale.
The helper keeps its existing call signature to avoid unrelated scene edits.

Grumbler, Ruon, mercenary, sergeant, deserter and party scales are unchanged.
All PNG/JSON art, manifest entries, timing, footsteps, abilities, map geometry,
footprint, collision and schema are unchanged. No generation or repacking.
An initially considered pixels-per-tile calibration was rejected before edits:
the schema intentionally accepts only128 or256. No ADR is needed for reuse of
the existing presentation-scale contract.

## Evidence and limits

The local harness is `e2e/enemy-scale.review.ts`, configured by
`playwright.enemy-scale.config.ts`. It fails closed on build label, backend,
tile size, missing actors and illegal commands. Optional browser channel
comes from `FNT_REVIEW_BROWSER_CHANNEL`; default is bundled Chromium. Local
review used `msedge`. Port4265 is strict and the Playwright server auto-stops.

Each case first captures the original Forest Road exploration entry, then
compares five authored enemies with Sura on the actual gate/Cutting maps.
The quarry worker uses the authored gate `bluffed` roster. The comparison
explicitly stages two actors and their active turn in a clear lane; the unchanged
reducer then accepts a two-cell move followed by the actor's real first ability:
Club Swing, Sling Stone, Rock Throw or Mercenary Crossbow. The renderer and
animator consume the resulting events. This is an art fixture, not evidence
of a normally played full encounter or its intermediate HUD timing: final
rule state is assigned before the presentation batch begins.

Evidence under this worktree's `.shots`:

- `enemy-scale-before/{canvas,webgl}-{64,96}-normal`: four passing baseline
  cases, build `d0d13c7`.
- `enemy-scale-after/{canvas,webgl}-{64,96}-{normal,reduced}`: eight passing
  candidate cases, build `d0d13c7-modified`.
- `enemy-scale-fallback/{canvas,webgl}-96-normal`: two passing cases with all
  five PNG requests deliberately aborted. Existing painter dispatch remains.

Every folder contains `source-build.png`, `forest-marker.png`, each enemy's
`*-idle.png`, motion samples and `provenance.json` with accepted commands,
events, actor identities, camera and sampled poses. Normal samples90/300ms
show walking contacts;550/730ms and the recorded ending show attack/recovery.
Reduced samples16ms/end retain the existing short motion and suppression of
particle emitters. No blank actors or page errors occurred in the matrix.

Root reviewed matched Canvas96 `bruiser-idle.png` and the candidate Forest
marker, accepting this bounded scale correction. Local review also inspected
WebGL96 thug walking and Canvas64 quarry worker attack. Atlas cels themselves
were not retouched; this does not claim improved gait or complete route art.
The fallback painters remain visibly procedural and their older body geometry
is larger than the illustrated art after the same multiplier (bruiser roughly
140px at96 versus illustrated116px). Fallback checks establish functional
visibility, equipment and contact, not matched artistic stature.

Reproduce the candidate matrix in PowerShell:

```powershell
$env:FNT_REVIEW_BROWSER_CHANNEL = 'msedge'
$env:FNT_SCALE_REVIEW_DIR = '.shots/enemy-scale-after'
npx playwright test -c playwright.enemy-scale.config.ts
```

Set `FNT_SCALE_FALLBACK=1` and use `--grep '96 normal'` for the failure-path
review; clear that variable for ordinary captures. `.review.ts` stays outside
the required CI suite. Do not start this port if another owner has reserved it.

## Checks

- `npm run verify`:843 tests in102 files pass, including typecheck/lint/format.
- Focused bounds tests decode every pose, retain the baseline/contract and
  compare adult heights; choreography tests cover matching torso scale with
  unchanged logical impact and reduced-motion emitter suppression.
- `npm run build`, `npm run art:validate`, `npm run check:assets` and
  `node scripts/check-bundle-size.mjs` pass.
- Candidate production JS306,884 bytes gzip: +73 bytes versus306,811-byte
  base,316 bytes under the unchanged300KiB cap. Art bytes unchanged;
  precache17.43MiB under25MiB; units remain within4.75MiB.

No general scale framework, asset-schema change, additional art allocation or
renderer branch was introduced. Root owns integration and subsequent combined
release checks; the currently running release revision remains untouched.
