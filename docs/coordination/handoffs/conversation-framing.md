# Conversation entry framing

Root found the problem in manual releasefc37c6a play: after panning/zooming in
Ba Dan, Talk Mira opened with Sura clipped above the map. Conversation locks map
gestures, leaving no way to repair that view without finishing the conversation.

On entry, ExploreScene now clears finished movement and reuses Follow party
before enabling conversation mode. It preserves tile size and lets the existing
viewport observer retain focus when the dock disappears. It does not reset zoom,
change positions, add a camera model, or affect already-open conversation lines.

Validation on the next-quality candidate based onf656cd7:

- npm run verify passes844 tests in102 files, typecheck, lint and formatting.
- Production build and unchanged300KiB JavaScript budget pass.
- Four installed Chrome production checks pass: Canvas/WebGL,1280x720 and
  834x1194 portrait with Huge text. They place the party beside Mira as a loaded
  checkpoint, pan the actual canvas until the adult body is clipped, then use
  Talk. The full body returns above the panel without changing position or zoom.
- Root reviewed landscape WebGL and portrait Huge Canvas frames. Evidence is
  ignored .shots/conversation-framing-f656cd7-modified; the source was uncommitted
  at capture. This is scoped camera evidence, not a full route or hardware test.

Reproduce with .shots/integration/framing.config.ts on strict4266. Its server
stopped after the run. Source/test files: ExploreScene.ts and
e2e/conversation-framing.spec.ts. No GitHub run was started for this change.
