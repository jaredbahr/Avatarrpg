# ADR 0055: One bend a character, painted effects a layer set

**Status:** accepted, 2026-09-27 (contract); amended 2026-09-28 (packer and
packed data; wiring follows)

## Context

Jared has approved the SE bend set for the G party, and the r10 rollout carries
it to all eight headings. Each character gets one whole-body bending
animation. It is not a `party-combat-se` generation on the 192 px root: the
r9 and r10 takes are 320 px cels of key poses authored on the character's own
skeleton (Kaya's fire keys re-authored from an approved motion-capture take),
rotated per facing as a change of camera rather than mirrored, and generated
with PixelLab's skeleton animation (v3), keys first and then the in-betweens
seeded from the approved keys. Every heading's first frame is that heading's
approved stance cel, sent with the skeleton it was drawn from, so frame 0 and
the last frame reproduce the shipped stance cel: alpha exact, colour within
the stance page's WebP noise. Sura's and Bo's cels are
toned with the frozen party-consistency parameters (ADR 0052), Kaya's never
are. This is the redo ADR 0052 left pending. The packer maps the cels onto the
G party's root-locked stance coordinates, trims them to their ink, gives them
a foot anchor like every other unit cel (ADR 0003), and packs them as alpha
WebP at quality 90.

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
The r10 headings keep SE's timing, keys, launch frames, sockets used and holds
exactly; only the drawings and the measured socket positions differ.

The budgets are measured on the packed r10 pages (one page a character):

| character      | page WebP | page JSON | bend JSON |         total |
| -------------- | --------: | --------: | --------: | ------------: |
| Kaya (fire)    | 171,242 B |  16,532 B |  22,681 B |     210,455 B |
| Sura (water)   | 152,664 B |  14,668 B |  19,506 B |     186,838 B |
| Bo (earth)     | 180,072 B |  16,431 B |  21,275 B |     217,778 B |
| **three sets** |           |           |           | **615,071 B** |

- **Units:** 4,954,409 B before the bends; 5,569,480 B (5.31 MiB) of the
  7,077,888 B (6.75 MiB) ceiling with the three bends, leaving 1,508,408 B
  (1.44 MiB). A bend costs about 0.2 MiB a
  character, so the three approved characters fit with room to spare, and
  about seven more would fill the headroom. The roster is heading for about ten
  benders: before the bends go past what the headroom holds, a units-budget
  ADR either raises the ceiling or cuts the art. This ADR does not raise it.
- **Effects:** the `fx` family is 1,527,899 B (1.46 MiB) of its 4 MiB ceiling,
  so painted bend sequences for four elements fit inside the remaining 2.5 MiB.
- **Precache:** 19,244,262 B (18.35 MiB) of the 25 MiB ceiling with the three
  bends' pages and data in the service worker's precache.
- **JavaScript, gzip:** 317.4 KB of the 320 KB gate (ADR 0048). The bend data
  is JSON the packer writes, not a TypeScript table, so it does not enter the
  bundle. The zod schemas in `bends.ts` are for the packer's output and CI and
  must stay out of the runtime bundle too: runtime code imports the types with
  `import type`, never a value from this module.

## Decision

- **The contract is `src/content/bends.ts`.** `BendSetDef` is a character's
  whole bend: one `HeadingBendDef` per `Heading` in `HEADINGS`. A heading
  carries its `frames` and `frameMs`; the source cel's `sourceSize`; `root`,
  `scale`, `frameSize` and `anchor`, which together are the whole map from a
  source cel to a packed one (below); `keyFrames`; an optional `smearFrame`;
  the rules-level `attacks`; and `socketsPerFrame` - the wrist and ankle
  positions an effect attaches to, in packed-cel pixels, one entry per cel.
  A frame name may repeat in `frames`: a held drawing, and the return to the
  stance on the last frame, are timing on one packed cel, never a second copy.
  `BendEffectDef` is an element's
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
  the drive. The damage release controls only _when the presentation shows_
  damage the reducer has already resolved at Confirm; it never decides,
  delays or splits the damage itself. Releases play in order, and two may
  share a frame when they leave from different sockets (both hands at once);
  one socket never releases twice on one frame.
- **Every heading plays the same attacks.** The ids, their order, the effect,
  the release count and the damage release agree across all eight headings;
  only frames, sockets and holds follow each heading's art. Attack ids are
  unique within a heading, and set ids and effect ids are unique.
- **Sockets are checked on the frames that use them.** Each release's socket
  must be recorded on both its launch frame and its contact frame. Sockets are
  in packed-cel pixels, and every socket lies inside the heading's
  `frameSize`.
- **Sub-pixel sockets (open, step 3).** The packer treats an r10 socket's
  integer coordinates as a point on the source grid, the corner of the source
  pixel it names, and moves it through the continuous map below, while the
  packed pixels sample their source nearest-neighbour from their own corner.
  So a stored socket can sit up to 0.75 packed px (one source pixel at 75%)
  from the drawn pixel it names, and if r10 meant pixel centres every socket
  is 0.375 px up and left of where it should be. Step 3 settles which
  convention the hand-off uses and whether the packer adds the half pixel.
- **Key frames have free names and shared roles.** A key frame is
  `{ frame, role }` under whatever name the take uses (`F1`, `E3`), so the
  choreography can find "the contact" without knowing each clip's names. The
  roles mean one thing in every element:
  - `anticipation`: a wind-up or chamber before a strike;
  - `release`: the frame the effect leaves the hand or foot, keyed only when
    that is not the strike's peak (an effect launched before the contact);
  - `contact`: the strike pose's peak - every strike's key;
  - `recovery`: the return toward the stance.

  All three approved bends launch on the strike's peak, so every strike is a
  `contact`: fire's jab F1 and cross F3, earth's stomp E3 and drive E4, and
  water's push W4. Their wind-ups (F2; E2; W2 and W3) are `anticipation` and
  F4, E5 and W5 are `recovery`. `validateBendSets` holds the roles and the
  releases to each other: every release's `frame` carries a `contact` key
  frame, and a `launchFrame` before it carries a `release` one.

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
- **Registered on the stance, measured from the data.** The packer
  (`scripts/art/bend-sprites.ts`) finds where each heading's frame 0 draws the
  stance by matching its alpha, pixel for pixel, against the packed stance
  cel the G build shipped (held to its own decoded-cel pin), then samples
  every cel through the G build's own map: 75%, nearest-neighbour, the stance
  cel's corner 8 px left of and 31 px below the 128x192 cel's, plus that
  heading's idle and stance shifts. On all 24 r10 headings the stance sits at
  (64, 64) of the 320 px cel. So the bend starts and ends on the stance's feet
  at the stance's size, and frame 0 and the last frame must reproduce the
  packed stance - alpha exact, colour within the stance page's WebP noise
  (`STANCE_TOLERANCE`) - or the build stops. The decoded bend page's frame 0
  is held to the same, and the build prints each heading's numbers and the
  worst of them. `art:validate` checks the same alpha on the shipped
  pages. The r9 timing's `stance_base_offset_in_cel` is not a root-lock point
  and is not used.
- **The map is data.** `root` is the source point that stands on the foot
  anchor, `scale` the packed pixels per source pixel, and `anchor` the foot as
  fractions of `frameSize`: a source point `p` lands at
  `(p - root) * scale + anchor * frameSize`. Sockets are stored already moved
  by it.
- **Trimmed pages with a foot anchor.** Every cel of a heading shares one
  rectangle, the heading's ink over all its cels plus the art bible's 8 px
  margin, with its foot anchor recorded per heading (ADR 0003). A bend page is
  an extra sheet page beside locomotion and stance (ADR 0052),
  `<name>-g-bend.webp`, shelf-packed in heading order without rotation. A cel
  whose pixels repeat an earlier cel's is packed once, as a hold the character
  declares; an undeclared repeat, or a declared hold that is not a repeat,
  stops the build.
- **Pinned both ways.** The character's pin file (`art/source/<name>-bend/`)
  records the SHA-256 of every source cel and timing file, and a missing,
  stray or changed one stops the build before anything is written; the build
  then records every decoded atlas cel's hash for `art:validate`. Every check,
  the decoded pages' included, runs before the first file is written, so a
  failed build leaves the shipped files as they were. Two builds write
  byte-identical pages, data and pins.
- **JSON timing and sockets, not TypeScript tables.** Frame names, per-cel
  timing, key frames, sockets and attack cues are written by the packer into
  `<name>-bend.json` beside the pages, one `BendSetDef` a character, and read
  at load; `bends.ts` holds the shapes and the rules, not a second copy of the
  data. The impact holds are 0 until the effects set them: r10 times one hold
  per release, at launch.
- **Unwired until the plumbing.** `src/content/index.ts`, the manifest and the
  runtime do not read the bend pages or data yet. `art:validate` checks them
  on their own (`BEND_SHEETS`), with `validateBendSets` skipping only the
  effect cross-reference until the effects are authored. The skip is explicit:
  the packer and `art:validate` pass `EFFECTS_NOT_YET_AUTHORED`, and a test
  fails once any `BendEffectDef` or effect registry exists while either still
  does. The asset budget counts the pages because it walks the folder.
- **Which ability plays which attack is not decided here.** The contract names
  a set's attacks and their effects; mapping abilities onto them is the combat
  handoff's job (step 7 below) and gets its field then.

## Planned PR sequence

1. **The contract.** `src/content/bends.ts`, its tests, the r9 fixture and
   this ADR. Types, schemas and `validateBendSets`; no real data and no wiring.
2. **The packer.** Register and trim the approved r10 cels in all eight
   headings, write the per-character pages and bend data, pin the sources and
   the decoded cels, and measure the budgets above.
3. **Units budget.** Before the roster's bends outgrow the measured headroom,
   settle the units and precache ceilings for about ten characters in their
   own ADR.
4. **Manifest plumbing.** Register the bend pages on the character sheets and
   surface the bend sets through content so CI validates them.
5. **Effect data.** The painted `BendEffectDef`s and sequences for the four
   elements. Precondition: the packer and `art:validate` stop passing
   `EFFECTS_NOT_YET_AUTHORED` and pass the effects, so every attack's
   `effectId` is checked; the skip's tripwire test fails until they do.
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
- Nothing here changes gameplay. The contract and the packed assets ship
  ahead of their plumbing, and every later step is spelled out above.
- Each heading has its own frame size and anchor, where every other clip of a
  sheet shares one; the manifest plumbing has to draw a bend cel by its
  heading's anchor, not the sheet's.
