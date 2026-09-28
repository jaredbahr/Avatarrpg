# ADR 0055: One bend a character, painted effects a layer set

**Status:** accepted, 2026-09-27 (contract only; packer, data and wiring follow)

## Context

Jared has approved the SE bend set for the G party. Each character gets one
whole-body bending animation, generated in PixelLab `party-combat-se` from its
stance on the same 192 px root and `high top-down` camera as the idles, walks
and stances (ADR 0050, ADR 0052), cut into cels, gated for root lock, one body
a cel and facing, and toned for Sura and Bo with the frozen party-consistency
parameters (ADR 0052). This is the redo ADR 0052 left pending. The cels are
trimmed to their ink, carry a foot anchor like every other unit cel (ADR 0003),
and pack as alpha WebP at quality 90.

Each element moves in its own martial style: Kaya's fire is a jab and a cross,
Bo's earth a stomp and a drive, Sura's water a circling palm that releases once.
What the cels cannot carry is the element itself. It has to leave the drawn hand
or foot, cross the board and land on a target tile the battle only resolves at
Confirm, possibly a tile no animation frame ever covered. So the effects are
separate painted layer sets the game draws and aims, anchored to per-frame
sockets, not pixels baked into the character. The pose vocabulary, the
celebration cels and the effect recipes already work this way (ADR 0021, ADR
0026); this ADR gives the bends their own contract instead of overloading them.

The approved r9 takes set the shape the contract has to hold: fire is 13 cels
with a jab released from the left wrist on frame 2 (60 ms hit-stop) and a cross
from the right wrist on frame 6 (100 ms); earth is 12 cels with a stomp from the
left ankle on frame 4 (50 ms) and a drive from the left wrist on frame 6
(110 ms); water is 11 cels with one release from the left wrist on frame 5
(80 ms). `bends.fixture.ts` carries those numbers and the tests validate them.

The budgets are measured:

- **Units:** 5,426,243 B (5.18 MiB) of the 7,077,888 B (6.75 MiB) ceiling after
  ADR 0053, leaving 1.58 MiB. An eight-heading bend of trimmed WebP pages and
  atlas JSON projects to roughly 0.24-0.3 MiB a character. The three approved
  characters fit in the headroom. The roster is heading for about ten
  characters, which is roughly 2.4-3 MiB and does not fit: before the bends go
  past what the headroom holds, a units-budget ADR measures the real pages and
  either raises the ceiling or cuts the art. This ADR does not raise it.
- **Effects:** the `fx` family is 1,527,899 B (1.46 MiB) of its 4 MiB ceiling,
  so painted bend sequences for four elements fit inside the remaining 2.5 MiB.
- **Precache:** 19,090,146 B (18.2 MiB) after ADR 0053, of the 25 MiB ceiling.
  The same units-budget ADR re-measures it.
- **JavaScript, gzip:** 313.4 KB of the 320 KB gate (ADR 0048). The bend data
  is JSON the packer writes, not a TypeScript table, so it does not enter the
  bundle. The zod schemas in `bends.ts` are for the packer's output and CI and
  must stay out of the runtime bundle too: runtime code imports the types with
  `import type`, never a value from this module.

## Decision

- **The contract is `src/content/bends.ts`.** `BendSetDef` is a character's
  whole bend: one `HeadingBendDef` per `Heading` in `HEADINGS`. A heading
  carries its `frames` and `frameMs`, the untrimmed `sourceSize` and `root`,
  the trimmed cel's foot `anchor`, `keyFrames`, an optional `smearFrame`, the
  rules-level `attacks`, and `socketsPerFrame` - the wrist and ankle positions
  an effect attaches to, one entry per cel. `BendEffectDef` is an element's
  painted effect: `layers` by `phase`, a `trajectory`, an `impact` and an
  optional visual `residue`. Zod schemas export every shape, each object
  `.strict()` so a stray packer key fails rather than being dropped, and
  `validateBendSets` returns human-readable cross-reference errors for CI.
- **One clip a character, never shared across elements.** `unitAsset` names the
  sheet that draws the clip, and `validateBendSets` rejects a second set on the
  same unit asset. Every bending ability the character has plays this one clip.
  A clip belongs to its character and its element's style; no two characters,
  and no two elements, share one.
- **One rules attack, one damage, however many visual hits.** A
  `BendAttackCue` is one rules-level attack with one `effectId` and one or more
  `releases`, in play order. A release is one visual hit: its contact `frame`,
  the `launchFrame` the effect leaves on (never after `frame`), the `socket` it
  leaves from, `launchHoldMs` and `impactHoldMs`, and optional `flash` and
  `shakeTiles`. `damageRelease` names the release whose impact applies the
  attack's single damage, and the validator requires it to be the last one, so
  hit points never drop before the final hit is drawn. Fire's jab and cross
  are two releases of one attack with the damage on the cross; earth's is on
  the drive.
- **Every heading plays the same attacks.** The ids, their order, the effect,
  the release count and the damage release agree across all eight headings;
  only frames, sockets and holds follow each heading's art. Attack ids are
  unique within a heading, and set ids and effect ids are unique.
- **Sockets are checked on the frames that use them.** Each release's socket
  must be recorded on both its launch frame and its contact frame, and every
  socket lies inside the source page.
- **Key frames have free names and shared roles.** A key frame is
  `{ frame, role }` under whatever name the take uses (`F1`, `E3`), and `role`
  is one of `anticipation`, `release`, `contact` or `recovery`, so the
  choreography can find "the contact" without knowing each clip's names.
- **Flash, hit-stop and shake land on contact.** At a release's contact frame
  the character and the effect freeze together for `launchHoldMs` (0-300 ms),
  a flash frame draws at `flash` - the peak opacity of an additive white flash,
  0-1 - and the board shakes by `shakeTiles` of amplitude, 0-0.5 tiles. When the
  effect reaches the target, `impactHoldMs` freezes again and `impact` carries
  its own `flash` and `shakeTiles` on the same scales. All of it is clamped in
  the data rather than hard-coded in the runtime.
- **Effects are per element and travel to the real target.** A layer names its
  `phase`, its depth (`z`), its painted `sequence`, its cel timing (16-1000 ms,
  like a bend cel), where it starts (`origin`) and how it blends. `trajectory`
  is `straight`, `arc` (0-4 tiles high, -8..8 whole turns of spin) or `whipBolt`
  (a whip of at most 16 tiles); every speed is above 0 and at most 64 tiles a
  second, and nothing accepts an infinity. Because the effect is drawn to the
  resolved target rather than painted into the frame, an off-frame, moving or
  2-tile target is still hit in the right place.
- **Residue is a drawing, never a surface.** `residue.gameplaySurface` is the
  literal `false`, so earth cracks and water puddles cannot paint a rules
  surface. A designer who wants a surface authors it on the ability, as today.
  `residue` lingers 0-3000 ms and names the sequence of one of the effect's
  `residue`-phase layers; an effect with a `residue` layer must carry `residue`,
  and one without must not.
- **Hold durations are presentation.** The holds belong to the bend data, but
  the reducer's timing stays authoritative (ADR 0026); the choreography applies
  them on the presentation clock.
- **Trimmed pages with a foot anchor.** Each heading packs its trimmed cels
  under the same foot-anchor rule as the rest of the unit art (ADR 0003), and
  the packer records the sockets it measures. A bend page is a sheet page
  beside locomotion and stance (ADR 0052).
- **JSON timing and sockets, not TypeScript tables.** Frame names, per-cel
  timing, key frames, sockets and attack cues are written into the atlas JSON
  by the packer and read at load; `bends.ts` holds the shapes and the rules,
  not a second copy of the data. `src/content/index.ts` and the manifest stay
  untouched in this PR.
- **Which ability plays which attack is not decided here.** The contract names
  a set's attacks and their effects; mapping abilities onto them is the combat
  handoff's job (step 7 below) and gets its field then.

## Planned PR sequence

1. **This PR: the contract.** `src/content/bends.ts`, its tests, the r9
   fixture and this ADR. Types, schemas and `validateBendSets`; no real data
   and no wiring.
2. **The packer.** Trim the approved SE cels, write the per-character pages and
   the atlas JSON (frame names, timing, key frames, sockets, cues), and pin the
   sources.
3. **Units budget.** Measure the packed pages and settle the units and precache
   ceilings for about ten characters in their own ADR.
4. **Manifest plumbing.** Register the bend pages on the character sheets and
   surface the bend sets through content so CI validates them.
5. **Effect data.** The painted `BendEffectDef`s and sequences for the four
   elements.
6. **Trajectories.** Straight, arc and whipBolt travel on the presentation
   clock, aimed at the resolved target.
7. **Choreography and combat handoff.** Attach to sockets; flash, hold and
   shake at each contact and impact; follow the real target; map abilities to
   attacks; apply the one damage on the damage release. No rules, AP, damage or
   save change.
8. **Gallery.** Capture the four elements for review against the visual target.

## Consequences

- The bend data is content, validated like the rest of it: a dangling effect,
  a misplaced socket, a heading that disagrees with the others or a second set
  on one character fails in CI rather than mid-fight.
- One clip a character bounds the review surface: there are as many bends as
  benders, not as many as abilities. It does not bound the units budget by
  itself; ten characters need the units-budget ADR above.
- Motion stays with the character and material with the effect, but each
  element keeps its own motion: a new element or style is a new clip, never a
  reused one.
- Two visual hits never mean two damage events: the rules see one attack, and
  the damage lands with the last hit drawn.
- Aiming effects at the resolved target keeps hit placement honest on the
  oblique board and for the 2-tile boss, at the cost of the packer measuring and
  storing sockets per cel.
- Residue cannot become an accidental rules surface; the type forbids it.
- Nothing in this PR changes gameplay. It is types, schemas, tests, a test
  fixture and this record, and every later step is spelled out above.
