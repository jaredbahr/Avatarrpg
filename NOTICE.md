# Notice

Four Nations Tactics is non-commercial fan work. This file lists everything in
it that someone else made, what licence it arrives under, and where it came
from. The game shows the same list under Pause, Credits: both are generated
from `src/content/credits.ts`, so run `npm run credits` after changing it.

Anything not listed here was made for this project.

## Third-party work

| What                 | Work                              | By                                  | Licence                   | Source                                             |
| -------------------- | --------------------------------- | ----------------------------------- | ------------------------- | -------------------------------------------------- |
| The heading typeface | Shippori Mincho 700, Latin subset | The Shippori Mincho Project Authors | SIL Open Font License 1.1 | [link](https://github.com/fontdasu/ShipporiMincho) |
| The action icons     | Game Icons                        | the Game Icons contributors         | CC BY 3.0                 | [link](https://github.com/game-icons/icons)        |

These licences ask for the author to be named wherever the work is used,
which is why the game carries the same list on its own Credits screen:

- Shippori Mincho 700, Latin subset — The Shippori Mincho Project Authors
- Game Icons — the Game Icons contributors

Notes:

- **Shippori Mincho 700, Latin subset.** The licence travels with the font in public/fonts/OFL-ShipporiMincho.txt, as the OFL requires.
- **Game Icons.** One icon per kind of action, chosen in src/app/ui/icons.ts and built into a sprite by npm run art:icons. Each icon is by a named contributor; they are listed in the licence file at the source above.

## Made for this project

- **The app icons.** Drawn by scripts/make-icons.mjs.
- **The test art.** Flat colour stand-ins the end-to-end tests read back; never seen in play.
