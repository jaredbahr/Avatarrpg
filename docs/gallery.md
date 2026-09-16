# The gallery: what to look at

`npm run gallery` captures the game as pictures (ADR 0006). This is the guide
to reading them: what each beat is for, which ones carry the verdict on the
look, and the questions to answer before more story gets written.

Open `gallery/index.html` from a CI artefact, or `/gallery/` beside the
deployed site. Scroll a strip sideways to step through a playback.

## Projects

| Project           | What it stands for                                |
| ----------------- | ------------------------------------------------- |
| `surface-canvas`  | The Surface in landscape at 1x, Canvas 2D         |
| `surface-webgl`   | The Surface in landscape at 1x, the WebGL path    |
| `ipad-canvas`     | The iPad in landscape at 2x, Canvas 2D            |
| `ipad-webgl`      | The iPad in landscape at 2x, the WebGL path       |
| `portrait-canvas` | The iPad held upright: the stacked HUD, two beats |

The WebGL project is the one that matters for the look: it is what an iPad
and a Surface actually run. The Canvas 2D projects show the fallback every
runner without a GPU sees, and whether the board is still correct there.

## Beats

| Beat                  | What it is for                                                                     |
| --------------------- | ---------------------------------------------------------------------------------- |
| `01-title`            | The shell: the wheel, the display face, ink and parchment                          |
| `02-village`          | Explore: the village as a place, the party as a line in it, the roster and hotbar  |
| `02b-village-walk`    | A six-tile village walk, the whole party through its playback                      |
| `03-dialogue`         | The stage: portrait medallion, name plate, mood tint. Where portraits land         |
| `04-board-idle`       | The board at rest with the HUD docked                                              |
| `05-move-preview`     | Range, path and confirm bar: the grid feel                                         |
| `05b-walk`            | A four-tile walk with a turn, through its playback                                 |
| `06-aim-preview`      | Aiming: reach, area, hit and damage chips, the reaction sentence                   |
| `07-fire-cast`        | Fire, through its playback                                                         |
| `08-water-whip`       | Water                                                                              |
| `09-rock-throw`       | Earth                                                                              |
| `10-air-blast`        | Air                                                                                |
| `11-lightning-puddle` | The signature reaction: one bolt, a puddle, two bandits shocked                    |
| `12-ko`               | A unit going down and what it looks like afterwards                                |
| `13-victory`          | The result panel                                                                   |
| `14-boss-blast`       | The quarry floor, the two-tile machine, the biggest effect, the frame-time readout |
| `15-largest-contrast` | Largest text and High contrast: the board must still read                          |
| `16-grid-on`          | The same board with the Show grid setting on                                       |
| `17-figures`          | The placeholder rig, every unit in every pose, straight from the sheet baker       |
| `18-backdrop`         | The painting slot: a flat stand-in under the forest road, then with Show grid on   |

Filmstrips (`-f1` to `-f5`) sample the playback at fixed milliseconds after
the act, so the same frame comes back every run. They are captured on
`surface-canvas` and `surface-webgl`; the 2x projects keep one mid-playback
still.

Every beat starts from the same seed, so the first roll of every fight would
be the same roll, and on this seed it is a miss. The cast beats load the dice
first (`loadDice` in `e2e/gallery/stage.ts`): the RNG state is stepped to one
whose next draw hits, which is still one number reached from the seed by a
fixed walk, so the pictures stay reproducible. The variance and crit rolls
after it fall where they fall.

## The verdict

The gate question is one sentence: **would you be happy if the finished game
looked like this, with real art in the character slots?** Everything below is
that question broken into parts.

- **Bending.** Beats 07 to 11, and 14 on WebGL. Do the four elements read as
  four different things? Does an effect have a beginning, a hit and an
  aftermath, or does it just appear? Is the lightning a bolt?
- **Motion.** Beats 05, 07 and 12. Does a move read as walking a route or as
  sliding between squares? Does a hit land?
- **Ground.** Beats 02, 04 and 14. Does the board read as terrain with
  regions on it, or as a chessboard? Do puddles, oil and ledges read from
  across the table? Do the trees, the huts and the quarry's ledges and pits
  read as things with height, and does the board sit in the frame rather
  than float on it?
- **Characters.** Beats 03, 04 and 12. With the placeholders, is the
  silhouette language right (two per element, distinct, readable at 40 px)?
  With portraits in, does the stage feel like a scene?
- **Chrome.** Beats 01, 03, 04, 06, 13 and 15. Does the shell feel like the
  same world as the board? The acting unit's portrait sits in the unit panel
  and every ability carries its element's glyph: do they read as drawn, not
  as labels?
- **The village.** Beats 02 and 02b after Milestone 3. Does the party read
  as people walking through a place together, a tile apart, or as pieces
  sliding? Does the roster read as the same HUD as the fight's, and does the
  hotbar look like things you can do rather than things you cannot? Upright
  (`portrait-canvas`), is the strip above the map still the party?
- **The mockup.** Beats 04, 05, 06 and 18 after Milestone 2. The parchment
  HUD: the title plate, the element rings on the turn strip, the framed
  portrait with its badge, the ability header, the marks on every button,
  the green Confirm. In 06, the arc from the caster to the target is the
  throw's own flight. In 18, the painting slot under the forest road: with
  Show grid on, does every edge in the stand-in sit on a tile line? A real
  painting through `art:map` replaces the stand-in in beats 04 to 12.

## Go / no-go

Filled in by the owner after the milestone's last slice. One line each; a
"no" with a reason is more useful than a "yes".

| Question                                                                                           | Yes / No | Why |
| -------------------------------------------------------------------------------------------------- | -------- | --- |
| The bending effects are the direction I want, allowing for tuning                                  |          |     |
| Motion and hits feel right for a tactics game                                                      |          |     |
| The ground and the hidden grid give the feel I described                                           |          |     |
| The placeholder characters prove the pipeline; the art bible is the right target for the real ones |          |     |
| I would keep writing story against this look                                                       |          |     |
| The parchment HUD and the painting slot are the mockup, allowing for the real paintings and icons  |          |     |
| The village with the party walking through it and the roster beside it is the explore mode I want  |          |     |

A "no" on the first or the last line stops Phase 2 content until it is a
"yes". A "no" elsewhere is a slice to revisit, not a stop.
