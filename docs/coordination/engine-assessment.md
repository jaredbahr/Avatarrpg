# Technology decision for the through-Driller release

Decision: continue the existing browser implementation for v0.2.0 and the next
bounded whole-run polish milestone. Do not start an engine migration now.
This is a delivery decision, not a claim that the current engine has proved
reference-quality completion. Revisit it if the triggers below are observed.

## Evidence and implications

- `src/core/rules/surfaces.ts` already resolves material combinations and fire
  spread from authoritative state. The story graph, save reconciliation and
  route regression evidence also exist. A different renderer/editor would not
  automatically port these systems or prove their new behavior.
- `src/render/renderer.ts` consumes a `MapView` rather than game state. It has
  shared camera measurement, accelerated WebGL and a Canvas fallback. The
  presentation boundary permits bounded renderer improvement without replacing
  combat, story or saves.
- The recorded art/walkability failure came from a generated painting whose
  semantic features did not follow the map guide. Deterministic registration
  corrected that class of defect. An editor would help authoring, but simply
  importing the same mismatched painting would preserve the defect.
- Recorded walking speed, effect origins and the blank resize frame had
  identifiable choreography/attachment/lifecycle causes, with targeted fixes
  and gameplay evidence. They have not demonstrated a fundamental inability
  of the current renderer to support the desired actions.
- The western connected-structure proof demonstrates one bounded scene with
  source rectangles and coherent cutaway. It does not demonstrate that all
  quarry environments are authored, attractive or performant on real devices.
- Remaining dull composition, reused guard/prop styles and weak perceived
  sound require content direction and actual experience review in any engine.
  Do not use a rewrite as a substitute for those decisions.
- Recent release failures involve stale fixtures/offscreen gallery targets
  and slow forced software-WebGL test interaction. Diagnose them as such;
  neither CI runtime nor local accelerated success alone establishes mobile
  runtime performance.

## Reasons to reopen the decision

Reopen if representative real-device evidence demonstrates sustained failure
to render or interact acceptably within the required scene, if authoring one
coherent scene repeatedly requires bespoke engine changes rather than reusable
content, or if necessary animation/audio workflows cannot be implemented
reliably within reasonable maintenance cost. Record the concrete failure and
measured cost before starting a comparison.

If triggered, use one existing map, one hero and one representative enemy in a
Godot proof. Require actual roaming, collision, a directed elemental action,
audio, portrait touch controls and a web deployment. Compare against the same
scene/assets on the current stack. Account explicitly for rules/content/save
porting, authoring time, build/download cost and supported devices. Decide
after this evidence; do not build two production games in parallel.

RPG Maker would be reconsidered only if conventional RPG presentation and
battles become the intended product. The present custom oblique tactical
target is unchanged. Neither alternative has been prototyped or benchmarked
for this project; no performance or savings claims are established.

This decision preserves the approved visual and gameplay target. It does not
lower that target to what the existing implementation currently does.
