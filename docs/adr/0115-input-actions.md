# ADR 0115: One action layer for touch, mouse, keyboard and gamepad

**Status:** proposed, 2026-11-14 (#753, #491). An input contract: every screen is driven through it.

## Context

The family plays on one shared iPad. Friends far away will play in a PC window shared through Steam Remote
Play, where a guest sends keyboard, mouse or controller input, and a guest on a phone or TV usually has only
a controller (`docs/pipeline-proof-plan.md` §5). Today touch and mouse are complete; the keyboard reaches
focusable controls only, so the Forest Road encounter and every combat tile are out of reach (#753), and
there is no gamepad support.

Adding keys scene by scene would give every new screen three input paths to write and test. Forty hours of
game needs the opposite: a screen written once that every device can drive.

## Decision

### 1. One action layer

Devices never talk to scenes. An adapter per device turns raw input into an **action**, and one router
(`src/app/input/InputRouter.ts`) delivers it. `src/core/` knows nothing of this; scenes still raise
commands through `app.dispatch`.

| Action                        | Meaning                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| `up` `down` `left` `right`    | Move: the board cursor, the party, or focus between controls        |
| `confirm`                     | Do the focused thing; on the board, commit the shown forecast; talk |
| `cancel`                      | Back out one step; with nothing to back out of, open the pause menu |
| `next` `prev`                 | Cycle targets on the board; cycle controls elsewhere                |
| `slot1` … `slot9`             | The n-th button of the scene's action bar (Move, abilities, …)      |
| `endTurn`                     | End the acting hero's turn (same guard as the button)               |
| `inspect`                     | Open the inspector for what the cursor is on                        |
| `map`                         | The local map out in the world; the whole-board view in a fight     |
| `menu`                        | Pause                                                               |
| `zoomIn` `zoomOut` `recentre` | Camera steps                                                        |
| pan (an axis, not an action)  | Look around: a held vector the scene reads each frame               |

Pointer input keeps its own positional vocabulary (tap, drag, pinch, hold: `gestures.ts`), because a pointer
already says _where_. It joins the layer at two points: a mouse **right click is `cancel`** while something
is being aimed or queued (it still inspects otherwise), and every pointer event tells the router which
device was used last.

**Routing order**, the whole contract:

1. A modal dialog is open: the action drives that dialog only (focus moves inside it, `cancel` is its Escape).
2. Otherwise the scene's `handleAction(action)` may take it. Only board scenes implement it.
3. Otherwise the router moves focus **spatially** between the visible controls, `confirm` presses the
   focused one, and with nothing focused `confirm` presses the screen's one default control (Next, Continue,
   I'm ready), so a dialogue advances on one button.

A screen made of ordinary buttons (title, party setup, dialogue, votes, level-up, pause, settings, saves)
therefore needs **no input code**. A new board scene implements `handleAction` and `inputHints` once and
gets every device.

### 2. Bindings (defaults; the owner's taste)

| Action            | Keyboard                        | Gamepad (standard mapping)       |
| ----------------- | ------------------------------- | -------------------------------- |
| Move              | Arrow keys, or W A S D          | D-pad, or left stick             |
| Confirm           | Enter, Space                    | A (bottom face button)           |
| Cancel            | Escape, Backspace               | B (right face button)            |
| Next / previous   | E / Q                           | RB / LB                          |
| Action slots      | 1 … 9                           | (pick on the bar with the d-pad) |
| End turn          | T                               | Y (top face button)              |
| Inspect           | F                               | X (left face button)             |
| Map / whole board | M                               | View / Select                    |
| Pause             | Escape with nothing to back out | Menu / Start                     |
| Look around       | Shift + arrows, or I J K L      | Right stick                      |
| Zoom, recentre    | + and −, 0                      | RT and LT, press the right stick |

Tab and Shift+Tab stay the browser's own focus order; nothing here replaces them. A key the focused control
already owns stays with it: typing in a name field, arrows in a slider or radio group, Enter and Space on a
focused button. Browser shortcuts (Ctrl, Alt, Meta held) are never taken.

For the kids the whole game is **move, one button for yes, one for back**. Everything else is a shortcut
for something also reachable with those three.

### 3. Targeting without a pointer: a snapping board cursor

There is no free pixel cursor. The board cursor is always on a tile that means something:

- **Move:** the tiles the hero can reach. **Aim:** the tiles the ability can target. **Idle:** units and
  props, to inspect.
- A direction moves to the adjacent legal tile if there is one, otherwise to the nearest legal tile in
  that direction (a cone, so "right" never jumps behind). With none that way the cursor stays.
- `next`/`prev` cycle the legal tiles in a fixed order: tiles with an enemy first, then other occupied
  tiles, then empty ones, each nearest first, ties in reading order. Choosing an ability starts on the
  first of them, so "pick Fire Jab, confirm" hits the nearest enemy.
- **The cursor is the pending choice.** Each step shows the same forecast a tap does (area, hit chance,
  damage, path cost, threat warning), and `confirm` commits it through the existing Confirm button, so the
  teaching step stays and there is one commit path for every device.
- The camera pans the least distance that keeps the cursor on screen; each step is announced for screen
  readers.

The snapping and the cycle order are pure functions (`boardCursor.ts`) with unit tests.

### 4. Focus: the board and the controls are two places

The map canvas is focusable. **Focus says where input goes:** on the board, directions move the cursor (or
walk the party) and `confirm` acts in the world; on a control, they belong to that control.

- **Combat** is menu-first, as the genre is. A hero's turn starts on the action bar; left and right move
  along it, `confirm` picks. Picking Move or an ability moves focus to the board; `confirm` or `cancel`
  brings it back to the same button. `up` from the bar enters the board to inspect; `cancel` returns.
- **Exploration** is board-first. Directions always walk, one tile a press and on while held; `confirm`
  is the HUD's contextual action (Talk, Inspect, Walk); `next`/`prev` step through the HUD buttons.
  Walking into someone talks to them, and into a gate leaves by it, as a tap on them does; a held
  direction never does either, so nobody re-enters a conversation by leaning on the stick.
- A HUD rebuild never drops focus to the page while a keyboard or pad is in use: the scene puts it back
  on the same control, or on the place the rules above name.

The transitions are a pure function (`combatFocus.ts`) with unit tests.

### 5. Hot-seat on one keyboard or one controller

One shared device is one action stream; whose turn it is stays a matter for the table, as with the tablet.

- The hand-off card names the device in use: "Hand the tablet to", "Pass the keyboard to", "Pass the
  controller to". It is the screen's default control, so one `confirm` accepts it.
- That `confirm` must be a **fresh press after a short hold-off**: a held key or button, or a press in
  the first half second, does nothing. The last player's button-mashing cannot accept for the next.
- Every connected controller feeds the same stream, so Remote Play guests on their own pads simply play
  on their turn. Binding a pad to a player is left out until play shows it is needed.
- **Known limit:** a secret table vote is not secret on a shared stream. Remote tables should set Story
  choices to "Take turns"; the vote stays for one screen in one room.

### 6. Hints show the device last used

The router records the last device used on the app root (`data-input`: `touch`, `mouse`, `keyboard`,
`gamepad`, and the pad's glyph family). Hints are drawn from that:

- A one-line legend over the map names what the buttons do _now_ ("Choose a target · Confirm · Back"),
  from the scene's `inputHints()`. It is absent for touch and mouse.
- In keyboard mode the action bar shows its slot numbers; the default control shows the confirm glyph.
- Glyphs are text in the UI face (`A`, `Enter`, `✕`), chosen by a pure function from the action, the
  device and the pad family (Xbox letters by default, PlayStation shapes, Nintendo letters by position).

### 7. Rules that hold

Actions are ignored where taps are: while the board plays back, `confirm` skips to the end of the playing
action (as a tap does) and nothing else acts. `App.showScene` stays synchronous. The renderer still reads a
view model: the cursor reaches it as the hover tile. Sizes are `rem`, colours are tokens.

## Consequences

- `Scene` gains two optional members, `handleAction` and `inputHints`. Explore and Combat implement them.
- The canvas becomes a tab stop with a visible focus ring.
- Escape with nothing to cancel opens the pause menu in the world and in a fight.
- A gamepad cannot type: player names stay optional and need a keyboard (or Steam's on-screen one).
- The pull request gate does not run browser specs (#777), so the pure parts (key and pad maps, cursor
  snapping, cycle order, focus graph, spatial focus, glyphs) carry unit tests, and two browser specs play
  title to the end of the first fight on the keyboard alone and on a synthetic gamepad alone.
- What no container can test, a real controller and a Remote Play session, is a ten-minute checklist in
  `docs/device-matrix.md`.

## Not decided here

Rebinding in Settings; per-player controllers; rumble; an on-screen keyboard; analog (free) walking.
