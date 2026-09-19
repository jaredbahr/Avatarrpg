# Route quality review: integrated 0.2.1

Lead review, 19 September 2026. Normal UI on the local production server at
4210, forced WebGL, browser viewport 1280×720. Title visibly identified
`v0.2.1 · build 798bee8` after the existing service worker updated on reload.
PR64 head `82bcc78` differs only by documentation. This is not physical-device
or audible-listening evidence.

## Observed route

Continue loaded the completed homecoming save: solo Sura, level 4, 23/38 HP,
near Pella. Opened Map and chose River path; the party walked there normally.
At Riverside, chose Visit the shrine, walked there and read all three lines.
The conversation retained the painted world and reported 1/3 discoveries on
return. Walk to Ba Dan returned to the village with Sura's level and HP intact,
and the workers-home objective still present. Manual save slots were untouched.

## Findings and next ownership

- Village objective still asks for Mira, Pella and Gao after the recorded
  homecomings. Audit completion flags and make the cue reflect actual state.
- After shrine dialogue, Riverside's campaign return cue changes to the generic
  sandbox exploration objective. Return still works; determine the cause before
  treating this as state loss. `world_conversations` owns the read-only audit.
- At the village river exit, the dock says “Speak with Riverside path” and
  offers Talk. Route actions should describe walking/travel, not a person.
- Ba Dan's broad empty paving/lawn remains much less inhabited than the approved
  reference. The two courtyard props are a bounded improvement, not acceptance.
  `quarry_composition` is evaluating one coherent use of existing living-world
  behavior and art, with actual collision and occlusion constraints.
- Riverside has attractive continuous scenery, but its procedural residents
  visibly differ from the illustrated party. Its large two-row action panel
  also uses more screen space than the approved compact dock.
- Root reviewed source `dbd0808` adult Cutting captures: Ruon and the authored
  blade/sergeant figures now match party height better. Other variant figures
  remain smaller. The staged sword-release capture proves visible poses, not
  legal attack contact or a full animation-quality pass.
- `combat_preview` is auditing the prior Riko side-punch contact gap against
  the actual projection/choreography before proposing a correction.

These follow-ups are isolated from the active PR64 CI run `35430915536`; do not
restart its checks for an unverified experiment. The complete original quality
goal, deployment verification, listening and physical-device gaps remain open.
