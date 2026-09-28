# ADR 0055: One bend a character, painted effects a layer set

**Status:** accepted, 2026-09-27 (contract); amended 2026-09-28 (packer and
packed data), again 2026-09-28 (manifest plumbing, lazy bend loading and the
socket convention), again 2026-09-28 (the painted effects), and again
2026-09-28 (drawing them: trajectories, sprites and the flash; playback
follows)

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
| Kaya (fire)    | 171,242 B |  16,532 B |  23,257 B |     211,031 B |
| Sura (water)   | 152,664 B |  14,668 B |  19,666 B |     186,998 B |
| Bo (earth)     | 180,072 B |  16,431 B |  21,803 B |     218,306 B |
| **three sets** |           |           |           | **616,335 B** |

Every figure here and in the step 5 section is measured on the painted effects'
head with the plumbing (lazy bend loading) and `main` (the JavaScript headroom
work, ADR 0057) merged in. The bend JSON includes the 1,264 B step 5 added
for the impact holds, flashes and shakes.

- **Units:** 4,954,409 B before the bends; 5,570,744 B (5.31 MiB) of the
  7,077,888 B (6.75 MiB) ceiling with the three bends, leaving 1,507,144 B
  (1.44 MiB). A bend costs about 0.2 MiB a
  character, so the three approved characters fit with room to spare, and
  about seven more would fill the headroom. The roster is heading for about ten
  benders: before the bends go past what the headroom holds, a units-budget
  ADR either raises the ceiling or cuts the art. This ADR does not raise it.
- **Effects:** the `fx` family was 1,527,899 B (1.46 MiB) of its 4 MiB ceiling
  before the painted bend effects and is 1,592,849 B (1.52 MiB) with them, so
  a fourth element fits inside the remaining 2.48 MiB.
- **Precache:** 19,307,947 B (18.41 MiB) of the 25 MiB ceiling; the bends are
  616,335 B of it and the painted effects 64,950 B. The bends stay in the
  precache although they load lazily: combat needs them offline.
- **JavaScript, gzip:** 319,678 B (312.2 KB), 8,002 B (7.8 KB) under the
  327,680 B (320 KB) gate (ADR 0048). The bend data and the effects are JSON
  the packers write, not TypeScript tables, so they do not enter the bundle.
  The zod schemas in `bends.ts` are for the packers' output and CI and must
  stay out of the runtime bundle too: runtime code imports the types with
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
- **Sub-pixel sockets: corners (settled by step 4, manifest plumbing, before
  step 7 attaches effects).** A socket is a continuous point in cel pixels
  measured from the top-left _corner_ of the cel, where a pixel (u, v) covers
  [u, u+1) x [v, v+1) and its centre is (u + 0.5, v + 0.5). That is the space
  a cel draws in on both backends, so a socket moves with the cel exactly as
  its anchor does, at any zoom. The packer already reads an r10 socket this
  way, as a point on the source grid moved through the continuous map below,
  so the shipped data and pins stand and nothing adds a half pixel: not the
  packer, not `SheetStore.bendFrame`, which returns the sockets as stored, and
  not step 7. The r10 hand-off gives its sockets to a tenth of a source pixel
  (hands snapped to the drawn skin, ankles from the skeleton) without naming
  a convention, and its snapping routine is not in the hand-off; if it meant
  pixel centres, every socket is 0.375 packed px (half a source pixel at 75%)
  up and left of the point it named, and a stored socket is always within
  0.75 packed px of the drawn pixel it names. Both are under one drawn pixel
  and far under the painted effects that attach there, so they are not
  corrected. A future hand-off that states pixel centres is moved by half a
  source pixel in the packer, once, never at runtime.
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
  the effect's launch cels flash by `flash`, and the board shakes by
  `shakeTiles` of amplitude, 0-0.5 tiles. `flash` is how much of the cel is
  added onto itself, 0-1: at `f` the cel's colour is multiplied by `1 + f`, so
  the approved prototype's `Brightness(1.75)` is 0.75. It brightens the painted
  cel in its own colours; it is not an additive white flash and not a white
  overlay. When the effect reaches the target, `impactHoldMs` freezes again and
  `impact` carries its own `flash` (on the impact's first cel) and
  `shakeTiles` on the same scales. All of it is clamped in the data rather
  than hard-coded in the runtime.
- **Effects are per element and travel to the real target.** A layer names its
  `phase`, its depth (`z`), its painted `sequence`, its cel timing (16-1000 ms,
  like a bend cel), where it starts (`origin`) and how it blends. `trajectory`
  is `straight`, `arc` (0-4 tiles high, -8..8 whole turns of spin) or `whipBolt`
  (a whip of at most 16 tiles). Every travel layer records a finite prototype
  `flightMs` from 16 through 2000 ms; non-travel layers cannot record one.
  Because the effect is drawn to the
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
  an atlas page in the sheet-page format (ADR 0052), loaded apart from the
  locomotion and stance pages (below), `<name>-g-bend.webp`, shelf-packed in heading order without rotation. A cel
  whose pixels repeat an earlier cel's is packed once, as a hold the character
  declares; an undeclared repeat, or a declared hold that is not a repeat,
  stops the build.
- **Pinned both ways.** The character's pin file (`art/source/<name>-bend/`)
  records the SHA-256 of every source cel and timing file, and a missing,
  stray or changed one stops the build before anything is written; the build
  then records every decoded atlas cel's hash for `art:validate`. Every check,
  the decoded pages' included, runs before the first file is written, so a
  failed check leaves the shipped files unchanged. Two builds write
  byte-identical pages, data and pins.
- **JSON timing and sockets, not TypeScript tables.** Frame names, per-cel
  timing, key frames, sockets and attack cues are written by the packer into
  `<name>-bend.json` beside the pages, one `BendSetDef` a character, and read
  at load; `bends.ts` holds the shapes and the rules, not a second copy of the
  data. r10 times one hold per release, at launch; the impact holds, flashes
  and shakes come from the effect prototype (step 5, below).
- **On the character's own sheet, loaded lazily and apart from it.** The
  manifest registers the bend page as the G sheet's `bendPages` and the bend
  data as its `bend`, rather than as a sibling sheet, and never among its
  `atlasPages`. The sheet store loads a bend's pages and data together, so
  they arrive, or fail, as one, but only after the sheet itself is in and
  only when something asks: the first `bendSet` or `bendFrame`, or
  `preloadBend(key)`, which combat is to call at its start (step 7) so the
  cels are in by the first cast. A scene that never bends - the riverside,
  Ba Dan, forest exploration, anything outside combat - never fetches or
  decodes a bend page, where loading them with the sheet decoded about
  17.7 MB of RGBA (the three 2000-2048 px pages) in every scene that drew a
  G character. A bend that fails sets only the bend's own state to failed:
  the sheet, its locomotion and its stance keep drawing from the atlas.
  Failed is for the session, as a failed sheet is; nothing retries, and
  `bendState(key)` reports it. A bend can still never draw from a load its
  stance is not part of: `bendFrame` needs both loads, and the bend's starts
  only once the sheet's has finished. Canvas 2D and Pixi both ask the one
  store, so they resolve the same page and rectangle.
- **Drawn by the heading's anchor.** `SheetStore.bendFrame` takes a unit
  key, a heading and a cel index and returns the cel's page and rectangle
  with its heading's own foot anchor, never the sheet's, plus its hold and
  its sockets; `bendSet(key)` returns the data. Placed by that anchor on the
  unit's foot through the one rule both backends share (`placeFrame`), the
  first and last cels cover the stance cel's alpha exactly, pixel for pixel,
  for every heading of every bend. The runtime reads the data as typed JSON,
  with no schema. `bendFrame` is null until both loads are in, after either
  failed, for a sheet with no bend, for an index the heading has no cel or no
  `frameMs` hold for, and for a cel whose rectangle is not its heading's
  `frameSize`, since the anchor is a fraction of it.
- **Validated in CI, not at runtime.** `art:validate` holds the manifest's
  registration to `BEND_SHEETS` (the pins and pages it checks), and the data to
  its schema and `validateBendSets` against the painted effects, so every
  attack's `effectId` resolves to an effect of its element. Until step 5 the
  effect cross-reference was skipped by passing `EFFECTS_NOT_YET_AUTHORED`, a
  `unique symbol` so no literal can stand in for it; the effects are authored
  now, and the bend packer, `art:validate` and the shipped-data test pass
  them. The symbol stays in the contract for its tripwire test, which fails
  once any `BendEffectDef` or effect registry exists while a non-test caller
  still passes it. Nothing plays a bend yet.
- **Which ability plays which attack is not decided here.** The contract names
  a set's attacks and their effects; mapping abilities onto them is the combat
  handoff's job (step 7 below) and gets its field then.

## The painted effects (step 5, amended 2026-09-28)

The approved VFX prototype (v8.1, which Jared called "WAYYY BETTER") is the
source: its painted layer sprites and the renderer that composited them,
`render_v7.py`. `scripts/art/bend-effects.ts` packs them; nothing is redrawn.

- **One effect an element, as data.** `fx.fire.fireball` (Kaya's jab and
  cross), `fx.earth.rock` (Bo's crack, rising rock, tumble and shatter) and
  `fx.water.bolt` (Sura's gather, lash, bolt, splash and puddle) replace the
  `fx.fire.jet`, `fx.earth.slab` and `fx.water.whip` placeholders, and the bend
  packer rewrote the three bend sets to name them. There is no air bend yet, so
  there is no air effect. The effects are JSON the packer writes,
  `public/art/fx/bend-effects.json`, beside one atlas page,
  `public/art/fx/bend-fx.webp` and `.json`. `BEND_FX` in `fxCels.ts` registers
  them beside the other effect atlases. Both backends draw them (below);
  nothing plays them in combat yet.
- **A layer may play for one release.** An attack's releases need not draw the
  same thing: the jab throws a comet-tailed fireball and the cross a round one,
  and Bo's stomp opens the crack that his drive throws the rock out of. So
  `BendEffectLayer.release` names the release a layer plays for; a layer
  without one plays for every release. `validateBendSets` rejects a layer keyed
  past the releases of any attack that draws the effect. It is optional, so
  the contract and the r9 fixture stand.
- **Cels are `<sequence>/<index>`, one a timed cel.** `validateEffectCels`
  holds the atlas to the layers: every cel a layer's `frameMs` times is on the
  page, no page cel is left undrawn, and two layers that share a sequence (the
  jab's and the cross's burst, timed to their own bend cels) agree on its
  length. `validateBendSets` also requires `impact.sequence` to be drawn by an
  impact layer, as it already did for `residue`.
- **Game scale is the prototype's ratio to the character.** The prototype drew
  the 320 px character cels and the effects at 1.35x; the game draws the
  character at 0.75x. So every effect cel packs at 0.75 / 1.35 of the size the
  prototype stamped it, and its size against the character is unchanged. The
  resize is an area filter on premultiplied alpha, with only sums, products
  and quotients so every platform writes the same bytes. The scale and opacity
  each prototype draw used are baked into the cel. Anything that depends on
  the board is left to the runtime: rotation toward the target, the path, and
  the stretch of a water segment between two hand positions.
- **Each cel says how it is placed.** Its atlas entry carries `fx`: a `pivot`
  in cel pixels (the point laid on the socket, the tile or the path); `facing`
  (the art points that way, and the runtime turns it by travel minus facing);
  `angle` (a fixed turn); or `segment` (the cel is laid between two points and
  its whole width stretched to that many times their distance). Angles are
  degrees clockwise on screen. `src/render/fx/bendFx.ts` parses a page, samples
  a layer by its cumulative `frameMs` (travel loops, everything else plays
  once), and answers which layers a release plays. It imports the contract's
  types only, so zod stays out of the bundle.
- **Timing and motion are the prototype's.** A layer's `frameMs` are the bend
  cels the prototype drew it over, read from the pinned r9 timing, and the
  packer stops if any shipped heading is timed otherwise. The one exception is
  the earth tumble's travel loop, hard-coded at `[100, 100, 100, 100]` ms: the
  prototype drew one tumble cel per bend cel of the flight, and a loop that
  outlasts those cels has no r9 timing to read. Each travel layer also records
  the approved prototype flight represented by those cels: fire jab 280 ms
  (cels 2-4), fire cross 330 ms (6-8), earth rock 370 ms (6-8), and water bolt
  180 ms (6-7, after the lash). Fire arcs 0.2 tiles high and the
  rock 0.89. The rock's spin is its painted tumble, so `spin` is 0. The water
  whip reaches a third of the way, at most 1.5 tiles.
- **The earth tumble is the one packed cel set beyond the approved frames.**
  The approved GIF shows tumble cels 9 and 0 (the renderer's
  `(frame * 3) % 12` on bend cels 7 and 8). Cels 3 and 6, on the same stride,
  are packed too, so the four close into a loop for a flight longer than the
  prototype's. That is a supervisor-accepted exception to "only the approved
  frames"; every other cel is one the approved GIFs draw.
- **Effects land on the body, not the feet.** The prototype aimed and burst
  every effect at `destination = (TARGET[0], TARGET[1] - 120)`: 120 of its
  pixels above the target's feet. `origin: 'targetTile'` alone carries no
  height, so `impact.offsetPx` does: the point the effect lands on, in
  unit-cel pixels from the target's foot anchor, -y up, each axis within
  +-256 in the schema. The packer writes the prototype's 120 px at the game's
  scale, `{ x: 0, y: -66.667 }`, on all three effects. Step 7 ends the
  trajectory there and places every `targetTile` layer's pivot there, the
  impact and the water puddle alike, scaled with the unit cels by the camera's
  zoom. Ground shadows, which the prototype drew at the feet, are code and
  are not moved by it.
- **Holds, flashes and shakes come from the prototype too.** The bend packer
  now writes each release's `impactHoldMs` (the prototype's target hold:
  60/100 fire, 0/110 earth, 80 water), `flash` 0.75 where the prototype
  brightened the launch (`Brightness(1.75)`, the cel added onto itself at
  0.75; water's lash has none), and `shakeTiles` from its board shakes. Each
  effect's `impact` carries the same scales, and flash 0.75 on its first cel.
- **Run order: the effect packer, then the bend packer.** The bend packer
  validates the sets it writes against the shipped effects, so after an
  effect id or layer changes, pack the effects first and then each bend:

  ```bash
  node --import tsx scripts/art/bend-effects.ts --source <vfx-proto>
  node --import tsx scripts/art/bend-sprites.ts --character kaya --source <bend-r10-8dir>/kaya
  node --import tsx scripts/art/bend-sprites.ts --character sura --source <bend-r10-8dir>/sura
  node --import tsx scripts/art/bend-sprites.ts --character bo --source <bend-r10-8dir>/bo
  ```

  Run the other way round, the bend packer checks the sets against the old
  effects and may stop on, or pass, the wrong ones.

- **Conventions steps 6 and 7 inherit.** These are how the review composites
  were built, and what the approved GIFs show:
  - gather layers end at their release's launch;
  - launch layers start at it;
  - the travel clock starts at the launch, and the travel cel draws once the
    launch cels are done;
  - impact starts on arrival;
  - residue starts after the impact.

  `previousPhaseEnd` is the layer before this one in the effect's own layer
  order, whichever release played it: the rock rises in the stomp's crack.
  Water's gather segments span the launch socket's positions over the last
  bend cels, the lead segment from the previous cel and the trail segment from
  the one before.

- **Residue is the prototype's.** Water leaves the puddle for the 120 ms the
  prototype held it. Earth's hole is the crack itself, which fades out on its
  own clock by the end of the bend. Fire leaves nothing.
- **Pinned both ways, written last.** The pin file
  (`art/source/bend-effects/pins.json`) holds every numbered PNG of the source
  folders, the three timing files and the renderer. A missing, stray or
  changed file stops the build. The build records every decoded cel's hash for
  `art:validate`, runs every check before the first write, and writes the same
  bytes twice.
- **Budgets, measured on the merged head:** the page is 54,376 B of WebP and
  7,270 B of JSON, and the effects 3,304 B, 64,950 B together. The `fx` family
  goes from 1,527,899 to 1,592,849 B (1.52 MiB of 4 MiB). The bend sets grow
  1,264 B with their impact holds, flashes and shakes, which takes units to
  5,570,744 B (5.31 MiB of 6.75 MiB). The precache is 19,307,947 B (18.41 MiB
  of 25 MiB). The effects' only JavaScript is their three precache entries in
  `sw.js`, 46 B gzip (the difference with the entries stripped); no effect
  code or data enters the bundle. The whole JavaScript total is 319,678 B
  (312.2 KB) gzip, which leaves a headroom of 8,002 B (7.8 KB) under the
  320 KB gate.

## Drawing the effects (amended 2026-09-28)

The integration plan's step 5 (generic trajectories and layers) draws the
painted effects on both backends from a time the caller gives. It wires
neither combat nor the choreography clock: holds, freezes, shake timing and
the combat handoff stay with steps 6 and 7.

- **Board units; character-relative shape, duration-led travel.** Every position is in the
  space `projectGround` returns, one unit a tile's width on screen, y down: a
  socket (`celOffset` from the foot), the landing point (the target's foot
  plus `impact.offsetPx / 128`) and every point of a flight. Effect size, arc
  height and whip reach use `bendStep(scale)`, the prototype's board step
  measured against the drawn character. Flight duration does not: the sampler
  covers the actual on-screen chord in the range-adjusted time below, so speed
  is derived from real distance divided by that duration.
- **Trajectories are pure** (`src/render/fx/trajectory.ts`). An arc lifts by
  `heightTiles` board steps at its middle (`4 h t (1 - t)`, the prototype's
  `arc()`) and adds `spin` whole turns over the flight; a straight path and a
  bolt stay on the chord. A whip-bolt's whip reaches `whipFraction` of the
  way, capped at `whipMaxTiles`; the bolt leaves from the whip's head.
  Cels with a `facing` turn by the chord's direction minus it (the chord from
  launch to target, as the prototype aimed, not the arc's tangent); an
  `angle` is fixed; a `segment` cel is centred between two points, turned
  along them and stretched to `segment` times their distance.
- **Clocks.** The travel clock starts at the launch for a straight path or an
  arc and when the launch cels end for a whip-bolt. A release lasts its travel
  layer's prototype `flightMs` times
  `clamp(1 + 0.1 * (tiles - 3), 0.8, 1.3)`. Here `tiles` is the rules' integer
  Chebyshev caster-to-target distance (`distance` in `src/core/rules/grid.ts`),
  not a projected screen length. Thus 3 tiles reproduces the prototype, 5 is
  1.2 times it, and 9 is capped at 1.3. The rest are the conventions
  above. A gather's cel `k` of `n` is drawn on the bend cel `n - k` before the
  launch; a socket gather follows the socket there, and its `r`th segment
  layer spans the socket's step `r` cels back (water's lead, then trail).
  Flashes land on a launch layer's first cel (the release's `flash`) and an
  impact layer's first cel (`impact.flash`). A long throw lands after the
  bend's last cel; nothing clips it to the bend.
- **The view carries resolved sprites.** `MapView.bendFx` is a list of
  `BendFxSprite`s: page and rectangle, the pivot and the board point it lands
  on, size in tiles, turn, alpha, blend, flash and depth. `sampleBendFx`
  (`bendFxSample.ts`) builds it from the effect, the release cues (launch
  time, the socket's path to it, the flash), the caster's and landing points
  and the time. The backends draw it as it comes: `ground` and `underActor`
  after the unit rings and before the depth-sorted actors, `overActor` after
  them, and never time, turn, mirror or shake anything. Both place a sprite
  by one rule, `bendFxPlacement`, in the unscaled world pixels `groundPoint`
  returns. Pixi keeps two pooled sprite layers in the camera-scaled upright
  layer; Canvas 2D draws with `drawImage` under the camera's transform.
- **Never mirrored.** Nothing on this path reads a facing. A cel's turn comes
  from the board.
- **Shake is the view's `cameraNudge`.** The caller applies it; the effect
  sprites carry none.
- **The flash is a brightened copy of the one cel.** `flashedCel` draws the
  cel into a canvas its own size, applies Pillow's `Brightness` to the pixels
  (`floor(c * (1 + flash))` a channel, alpha kept) and keeps it in a 16-entry
  LRU; both backends draw that copy in the cel's place. It reproduces Pillow's
  output on the shipped fire launch and water splash exactly, every channel of
  every pixel (`bendFlash.test.ts`, against fixtures Pillow 12.3.0 wrote from
  the same page). The `lighter` second draw this ADR first proposed matches on
  opaque pixels but adds before it clamps, so on the splash, painted at 224
  and saturated, it came out a mean 3.8 channel levels off Pillow over the
  board. The copy is one cel, never the page, so the canvas
  cap is not at risk.
- **Parity.** `bendFxParity.test.ts` runs Canvas 2D's real draw against a
  recording context and the Pixi sync into real sprites, over three cameras
  (fitted oblique, zoomed and panned oblique at dpr 2, square) and five
  sprites (ground, flashed, turned, stretched, added), and holds their screen
  quads to 1e-6 px, and their source rectangles, alpha and blend to equal.
- **A dev harness, never built.** `dev/bend-fx.html` (served by `vite` only;
  the build's one entry stays `index.html`) plays one character's bend and
  effect at a given time on either backend, with a stand-in clock (the bend
  cels on their `frameMs`, no holds). `scripts/bend-fx-capture.ts` starts
  Vite in-process, captures range 3 and 5, cardinal and diagonal, on both
  backends, each bend cel and then every 80 ms until the effect is done, with
  and without the effects, and closes the server and browser whatever
  happens.
- **Found in review: the prototype's board is smaller than the game's.** The
  prototype drew the 320 px character cels at 1.35x on a 96 x 48 px step; the
  game draws them at 0.75x on a 128 px tile. Against the character, a game
  tile is 2.4 times the prototype's step, so the approved "3-tile" throw is
  about 1.25 game tiles on screen, and an effect thrown 3 real tiles flies
  2.4 times as far against the character, the whip reaches 2.4 times as far
  and the arcs lift 2.4 times as high, while the effect cels stay the size
  they were against the character. Step 6 settled the visual scale against
  the character and, after timing review, settled travel independently by the
  prototype duration and the bounded Chebyshev range stretch above.
- **Budget.** JavaScript is 321,922 B gzip, 745 B more than the same build
  of the base (321,177 B), 5,758 B under the 327,680 B gate. Only the draw
  path is in the bundle; the sampler and the trajectories tree-shake until
  step 6 calls them. No asset changes.

## The choreography and the freeze clock (amended 2026-09-28)

The integration plan's step 6 plays one attack of a bend on the presentation
clock: the character's cels, its painted effect, the hit-stops and the board
kick (`src/app/anim/bendChoreo.ts`, queued by `Animator.pushBend` as a `bend`
track). Nothing maps an ability to it yet; that is step 7.

- **One plan, pure samplers.** `planBend` lays the attack out once: cel
  starts from the heading's `frameMs` (cumulative, exact), each release's
  launch time and socket path, the effect's runs and arrivals
  (`planBendFx`), the holds, the follow-through wait and the kicks.
  `bendPoseAt`, `bendFxAt` and `bendNudge` sample it at a scene time, so a
  skipped frame or a replay sees the same thing.
- **The character.** It plays its heading's cels through `bendFrame`, never
  mirrored, and each release reads its socket by play index, so a held cel
  keeps its own sockets. A cel that records no socket borrows the nearest
  earlier one that does, so the water gather follows the hand across every
  pre-launch cel.
- **The freeze clock.** Scene time runs on; the bend's presentation time
  stops for every hold, and a hold freezes the character and every effect of
  the bend together, in flight or not: a hit-stop, as the prototype froze the
  whole frame. A launch hold (`launchHoldMs`) starts with the release's
  contact cel; an impact hold (`impactHoldMs`) the moment its effect lands.
- **Overlapping holds are serial, and simultaneous ones merge.** Because
  presentation time does not move inside a hold, no second moment can come
  due during one: a later hold starts when presentation time reaches its own
  moment. So at 5 tiles the jab's impact hold freezes the cross in the air,
  and the cross still takes its own hold when it lands. Holds whose moments
  fall within `HOLD_MERGE_MS` (17 ms, one 60 Hz frame) of the first of them
  are one hold, as long as the longest: two contacts at once cost one
  hit-stop, never their sum and never a one-frame twitch between two. A
  merged contact uses the hold boundary for its arrival, impact presentation,
  damage timing and shake, so it does not appear one frame after the frozen
  clock. A track's duration is its presentation length plus every hold, so
  `busy()`
  and the queue wait them out, and `bendSceneAt` gives the scene time of any
  presentation moment for step 7 to lay the struck unit and the damage on.
- **The kick is the view's `cameraNudge`.** Each release with `shakeTiles`
  kicks the board when its contact cel lands, and each impact by
  `impact.shakeTiles`, both in the data's tiles (below). A launch kick points
  toward the throw's side of the screen and up, the prototype's `(3, -2)`,
  mirrored in x for a throw to the left; an impact kick points the opposite
  way. It holds still through its hold, then eases linearly to nothing over
  the cel it landed on (the release's cel, or the impact layer's first cel),
  on the presentation clock, so a later hold freezes it too. It adds to the
  animator's other shake. Reduced motion has no kick.
- **A throw that lands after the bend.** When the last effect lands after
  the character reaches its `recovery` key frame, the character holds the
  cel before that key, the follow-through, until the landing, then plays the
  recovery back to the stance. The pose that threw stays out while the throw
  is in the air, and the recovery never plays while the effect still flies.
  Effects never wait for the character.
- **Scale and flight are separate rulers.** Supervisor decision. The effect cels
  already keep their size against the character (packed at the unit cels'
  128 px a tile, and scaled with the actor's own draw scale). The motion now
  does too: `heightTiles`, `whipMaxTiles` and `shakeTiles` are converted,
  not re-authored, through `bendStep(scale)`,
  the prototype's `hypot(96, 48)` px step measured against the character:
  `hypot(96, 48) * 0.75 / 1.35 / 128`, about 0.466 of a game tile at scale 1
  and 2.4 times shorter than an oblique board step. Arc lift and whip reach
  therefore keep the approved proportions against the character, whatever the
  projection. Flight uses the per-release prototype duration table above,
  stretched only by the bounded Chebyshev rule; its speed is whatever covers
  the real on-screen distance in that time. Launch/impact holds and shake are
  unchanged.
- **Leftward throws flip, the character never does.** Supervisor decision.
  A cel turned to an aim with `|aim| > 90°` (toward the screen's left) is
  mirrored top to bottom about its pivot before it turns (`flipsFor`,
  `BendFxSprite.flipY`, drawn by both backends and held by the parity test),
  so the painted light stays on top on a west or north-west throw. Only cels
  that turn with the throw (`facing` or `segment`) flip; a fixed cel keeps
  its drawing; exactly up or down does not flip. Character cels are never
  mirrored.
- **Step 5's review, settled.** `previousPhaseEnd` is kept per release (a
  release that has played nothing yet picks up where the layer before left
  off, so the rock rises in the stomp's crack); a socket path with no socket
  falls back to the launch point, not the origin; a release thrown at its own
  launch point aims along the actor's heading; and the per-effect segment
  rank and launch length are planned once a shot, so a frame only picks
  cels.
- **Headroom.** `bendHeadroom.test.ts` decodes the shipped pages and holds
  every cel of every heading of the three G bends under the sheet's headroom
  envelope, so the health bar needs no move while a bend plays.
- **The harness plays the choreography.** `dev/bend-fx.html` now plays the
  plan itself (character, effect, holds and kick), and
  `scripts/bend-fx-capture.ts` captures range 3 and 5 in east, south-east,
  west and north-west on both backends.
- **Budget.** JavaScript is 325,844 B gzip, 1,897 B more than the same
  build with step 6's runtime files at the base's contents (323,947 B), and
  1,836 B under the 327,680 B gate. No asset changes.

## Planned PR sequence

1. **The contract.** `src/content/bends.ts`, its tests, the r9 fixture and
   this ADR. Types, schemas and `validateBendSets`; no real data and no wiring.
2. **The packer.** Register and trim the approved r10 cels in all eight
   headings, write the per-character pages and bend data, pin the sources and
   the decoded cels, and measure the budgets above.
3. **Units budget.** Before the roster's bends outgrow the measured headroom,
   settle the units and precache ceilings for about ten characters in their
   own ADR.
4. **Manifest plumbing.** Register the bend pages and data on the character
   sheets, load them lazily and apart from the sheet, resolve a cel by its
   heading's anchor on both backends, settle the socket convention, and hold
   the registration to the pins in CI. Done: see the decisions above.
5. **Effect data.** The painted `BendEffectDef`s and sequences for the
   elements that bend. Precondition, done: the packer, `art:validate` and the
   shipped-data test stop passing `EFFECTS_NOT_YET_AUTHORED` and pass the
   effects, so every attack's `effectId` is checked, and the skip's tripwire
   test passes with no non-test caller left. Done for fire, earth and water:
   see above. Air follows its bend.
6. **Trajectories.** Straight, arc and whipBolt travel on the presentation
   clock, aimed at the resolved target. Done, with the choreography and the
   freeze clock: see above. Mirroring, sockets by play index and headroom
   below are settled there; combat wiring stays with step 7.
7. **Choreography and combat handoff.** Attach to sockets; flash, hold and
   shake at each contact and impact; follow the real target; map abilities to
   attacks; apply the one damage on the damage release. No rules, AP, damage or
   save change.

   Found while plumbing, for steps 6 and 7 to settle before a bend first
   draws:
   - **Never mirror a bend cel.** Both backends mirror a sheet frame when
     `drawFacing === -1` (Canvas 2D flips the context, Pixi negates the
     sprite's `scale.x`). Every heading of a bend is its own drawing with its
     own anchor and sockets, so a bend cel must draw as authored whatever the
     unit's facing; mirrored, it stands off the feet and every socket lands on
     the wrong side.
   - **Read sockets by play index, not by cel.** A held cel is one packed
     rectangle named more than once in `frames`, and each play index keeps its
     own entry in `socketsPerFrame`. Looking sockets up by the cel's name or
     rectangle gives a hold the sockets of its first appearance; `bendFrame`
     already returns them by index.
   - **Headroom excludes bend cels.** A frame's `headroom`, which places the
     health bar, is the sheet's envelope over its clips' cels; `bendFrame`
     carries that same value, and no bend cel is in it. Check the bar against
     the raised arms of every heading, and either widen the envelope or hold
     the bar where it was for the length of the bend.
   - **Canvas 2D's flash mask is a whole page.** `Canvas2DBackend.mask`
     (the `unit.flash` draw) builds, once per source image, a white copy of
     the entire page it is given. A contact flash on a bend cel would make a
     second 2048 px canvas for the bend page, about 7 MB for Kaya's, on the
     device class the canvas cap bites. Mask the cel, not the page, before a
     bend flashes on Canvas 2D; not fixed in step 4. Step 5 makes this live:
     the shipped releases and impacts now carry `flash` 0.75. That flash is
     the effect cel added onto itself (above), not the unit's white mask, so
     step 7 draws it on the effect cel and must not route it through `mask`
     on the bend or effect page. Settled by the drawing step (below): a
     brightened copy of the one cel, on both backends, not a `lighter`
     second draw.
   - **Effect ids share a namespace with the ability FX keys.**
     The bend effect `fx.earth.rock` is also the earth ability's `fx` key
     (`src/content/fx.ts`, `sounds.ts`, `bendingCels.ts`, `marks.ts`), where
     it names something else. `fx.water.whip`, the placeholder the water
     effect replaced, is still an ability key too, so the water bend's move to
     `fx.water.bolt` avoids a clash by chance, not by rule. Nothing joins the
     two registries yet. Before step 7 maps
     abilities to attacks it either renames the bend effects into their own
     prefix or states that a lookup always says which registry it means; open.

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
  sheet shares one, so a bend cel is resolved through `bendFrame`, which
  carries its heading's anchor, never through a sheet clip.
- Only a scene that asks for a bend loads it, and a missing or broken bend
  file costs only the bend: the character still draws from its sheet, and the
  bend stays unavailable for the rest of the session. The price of the lazy
  load is that a bend asked for mid-scene without a preload arrives a few
  frames late, so step 7 preloads at combat's start.
