# ADR 0054: One bend a character, painted effects a layer set

**Status:** Accepted
**Date:** 2026-09-27

## Context

Jared has approved the SE bend set for the G party. Each character gets one
whole-body bending animation, generated in PixelLab `party-combat-se` from its
stance on the same 192 px root and `high top-down` camera as the idles, walks
and stances (ADR 0050, ADR 0052), cut into cels, gated for root lock, one body
a cel and facing, and toned for Sura and Bo with the frozen party-consistency
parameters (ADR 0052). This is the redo ADR 0052 left pending. The cels are
trimmed to their ink, carry a foot anchor like every other unit cel (ADR 0003),
and pack as alpha WebP at quality 90.

What the cels cannot carry is the bending itself. A fire punch, a water whip and
an earth throw are the same body motion with a different element in the hand,
and that element has to leave the drawn hand, cross the board and land on a
target tile the battle only resolves at Confirm, possibly a tile no animation
frame ever covered. So the effects are separate painted layer sets the game
draws and aims, not pixels baked into the character. The pose vocabulary, the
celebration cels and the effect recipes already work this way (ADR 0021, ADR
0026); this ADR gives the bends their own contract instead of overloading them.

The budgets are measured, and this contract fits inside them:

- **Units:** 5,426,243 B (5.18 MiB) of the 7,077,888 B (6.75 MiB) ceiling after
  ADR 0053. The approved SE bends project to about 0.7-0.9 MiB of trimmed WebP
  pages and atlas JSON, which leaves roughly 0.7-0.9 MiB of the 1.58 MiB
  headroom; the ceiling does not move.
- **Effects:** the `fx` family is 1,527,899 B (1.46 MiB) of its 4 MiB ceiling,
  so painted bend sequences for four elements fit inside the remaining 2.5 MiB.
- **Precache:** 19,090,146 B (18.2 MiB) after ADR 0053; the bends and their
  effects project to about 20.3-20.8 MiB of the 25 MiB ceiling.
- **JavaScript, gzip:** 313.4 KB of the 320 KB gate (ADR 0048). The bend data
  is JSON the packer writes, not a TypeScript table, so it does not enter the
  bundle; this contract adds types and one validator, not data.

No budget is raised. If a later measurement needs one, it gets its own ADR,
measured before the raise.

## Decision

- **The contract is `src/content/bends.ts`.** `BendSetDef` is a character's
  whole bend: one `HeadingBendDef` per `Heading` in `HEADINGS`. A heading
  carries its `frames` and `frameMs`, the untrimmed `sourceSize` and `root`,
  the trimmed cel's foot `anchor`, named `keyFrames`, an optional `smearFrame`,
  the rules-level `attacks`, and `socketsPerFrame` - the wrist and ankle
  positions an effect attaches to, one entry per cel. `BendEffectDef` is an
  element's painted effect: `layers` by `phase`, a `trajectory`, an `impact`
  and an optional visual `residue`. Zod schemas export every shape, and
  `validateBendSets` returns human-readable cross-reference errors for CI.
- **One bend a character, for all of its bending abilities.** `unitAsset` names
  the sheet that draws the clip, and `validateBendSets` rejects a second set on
  the same unit asset. Every bending ability the character has plays this one
  clip; the ability changes only which effect it names. Alternates, reskins and
  story forms are the same character and share its one bend - there is no
  exception and no second set.
- **One rules attack, however many visual hits.** A `BendAttackCue` is one
  rules-level attack: one `launchFrame`, one `socket`, one `effectId`. The SE
  bend draws two punches; that stays one attack, and the second hit is drawing
  plus effect, not a second damage event. `launchHoldMs` freezes the
  presentation at launch/contact, and `impactHoldMs` freezes it again when the
  effect lands on the target.
- **Effects are per element and travel to the real target.** A layer names its
  `phase`, its depth (`z`), its painted `sequence`, its cel timing, where it
  starts (`origin`) and how it blends. `trajectory` is `straight`, `arc` or
  `whipBolt`; `impact` carries the landing sequence, flash and shake. Because
  the effect is drawn to the resolved target rather than painted into the
  frame, an off-frame, moving or 2-tile target is still hit in the right place.
- **Residue is a drawing, never a surface.** `residue.gameplaySurface` is the
  literal `false`, so earth cracks and water puddles cannot paint a rules
  surface. A designer who wants a surface authors it on the ability, as today.
- **Hold durations are presentation.** `launchHoldMs` and `impactHoldMs` are
  bounded to 0-300 ms and belong to the bend data, but the reducer's timing
  stays authoritative (ADR 0026); the choreography applies the holds on the
  presentation clock.
- **Trimmed pages with a foot anchor.** Each heading packs its trimmed cels
  under the same foot-anchor rule as the rest of the unit art (ADR 0003), and
  the packer records the sockets it measures. A bend page is a sheet page
  beside locomotion and stance (ADR 0052), and the pages are measured before
  any budget question is reopened.
- **JSON timing and sockets, not TypeScript tables.** Frame names, per-cel
  timing, key frames, sockets and attack cues are written into the atlas JSON
  by the packer and read at load; `bends.ts` holds the shapes and the rules,
  not a second copy of the data. `src/content/index.ts` and the manifest stay
  untouched in this PR.

## Planned PR sequence

1. **This PR: the contract.** `src/content/bends.ts`, its tests and this ADR.
   Types, schemas and `validateBendSets`; no real data and no wiring.
2. **The packer.** Trim the approved SE cels, write the per-character pages and
   the atlas JSON (frame names, timing, key frames, sockets, cues), and pin the
   sources.
3. **Manifest plumbing.** Register the bend pages on the character sheets and
   surface the bend sets through content so CI validates them.
4. **Effect data.** The painted `BendEffectDef`s and sequences for the four
   elements.
5. **Trajectories.** Straight, arc and whipBolt travel on the presentation
   clock, aimed at the resolved target.
6. **Choreography and presentation-clock hit-stop.** Attach to sockets, hold at
   launch/contact and at impact, and follow the real target.
7. **Combat handoff.** The ability's cue drives the action animation; no rules,
   AP, damage or save change.
8. **Gallery.** Capture the four elements for review against the visual target.

## Consequences

- The bend data is content, validated like the rest of it: a dangling effect or
  a second set on one character fails in CI rather than mid-fight.
- One clip a character bounds both the units budget and the review surface.
  There are as many bends as benders, not as many as abilities, and a new
  bending ability needs an effect rather than a new animation.
- Alternate forms and reskins share the single bend by design, so the compiled
  art does not grow with every variant.
- Motion and material stay separate: the same punch reads as fire, water, earth
  or air through its effect alone.
- Aiming effects at the resolved target keeps hit placement honest on the
  oblique board and for the 2-tile boss, at the cost of the packer measuring and
  storing sockets per cel.
- Residue cannot become an accidental rules surface; the type forbids it.
- Nothing in this PR changes gameplay. It is types, schemas, tests and this
  record, and every later step is spelled out above.
