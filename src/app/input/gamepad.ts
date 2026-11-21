/**
 * The gamepad adapter's pure half (ADR 0115 §2).
 *
 * The Gamepad API is polled, not evented, so a button is an action only on the
 * frame it goes down, and a held direction has to repeat by the clock. This
 * turns one frame's snapshot of a pad into actions; `InputRouter` owns the
 * polling. Indices are the W3C "standard" mapping, by position, so an Xbox A,
 * a PlayStation cross and a Nintendo B are the same button here.
 */

import type { Direction, InputAction } from './actions';

/** One frame of one pad: how far each button is pressed (0 to 1) and the stick axes. */
export interface PadSnapshot {
  readonly buttons: readonly number[];
  readonly axes: readonly number[];
}

export interface PadAction {
  readonly action: InputAction;
  readonly repeat: boolean;
}

export const PAD_BUTTONS: Readonly<Record<number, InputAction>> = {
  0: 'confirm',
  1: 'cancel',
  2: 'inspect',
  3: 'endTurn',
  4: 'prev',
  5: 'next',
  8: 'map',
  9: 'menu',
  11: 'recentre',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

const DPAD: readonly (readonly [number, Direction])[] = [
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
];

const PRESSED = 0.5;
/** A stick counts as pushed past this, and as let go only under the lower one, so it cannot chatter. */
const STICK_ON = 0.6;
const STICK_OFF = 0.4;
const STICK_DEADZONE = 0.2;
/** A held direction waits, then repeats: slow enough for a child to stop on a tile. */
export const PAD_REPEAT_DELAY_MS = 380;
export const PAD_REPEAT_EVERY_MS = 150;

const down = (pad: PadSnapshot, index: number): boolean => (pad.buttons[index] ?? 0) >= PRESSED;

/** The way the d-pad or the left stick points, the d-pad first; null at rest. */
export function padDirection(pad: PadSnapshot, held: Direction | null): Direction | null {
  for (const [index, direction] of DPAD) if (down(pad, index)) return direction;
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  const horizontal = Math.abs(x) >= Math.abs(y);
  const direction: Direction = horizontal ? (x < 0 ? 'left' : 'right') : y < 0 ? 'up' : 'down';
  const push = Math.max(Math.abs(x), Math.abs(y));
  return push >= (held === direction ? STICK_OFF : STICK_ON) ? direction : null;
}

function trimmed(value: number): number {
  return Math.abs(value) < STICK_DEADZONE ? 0 : value;
}

/** The right stick as a look-around vector, each axis -1 to 1, zero inside the dead zone. */
export function padPan(pad: PadSnapshot): { readonly x: number; readonly y: number } {
  return { x: trimmed(pad.axes[2] ?? 0), y: trimmed(pad.axes[3] ?? 0) };
}

/** The triggers as a zoom rate: the right one in (+1), the left one out (-1). */
export function padZoom(pad: PadSnapshot): number {
  return trimmed((pad.buttons[7] ?? 0) - (pad.buttons[6] ?? 0));
}

/** Follows one pad from frame to frame. */
export class PadReader {
  private previous: PadSnapshot | null = null;
  private direction: Direction | null = null;
  private repeatAt = 0;
  private heldSince = 0;
  private seenAt = 0;

  /** The way the pad is held now, for a scene that walks while it is held. */
  get held(): Direction | null {
    return this.direction;
  }

  /**
   * How long the direction has been held, as far as the reads have seen: from
   * the first read that saw it to the last. A pad is only known when it is
   * read, once a frame, so on a page that takes a few hundred ms over a frame a
   * tap seen by one read has been held for 0 ms, not for however long the next
   * frame takes to come round.
   */
  get heldFor(): number {
    return this.direction ? this.seenAt - this.heldSince : 0;
  }

  /** The actions this frame's snapshot adds to the last one's. */
  step(pad: PadSnapshot, now: number): PadAction[] {
    const actions: PadAction[] = [];
    const previous = this.previous;
    this.previous = pad;

    for (const [key, action] of Object.entries(PAD_BUTTONS)) {
      const index = Number(key);
      // Directions come from `padDirection`, so the d-pad and the stick share one repeat clock.
      if (index >= 12 && index <= 15) continue;
      // A button already down on the first frame was pressed for someone else's screen.
      if (down(pad, index) && previous && !down(previous, index))
        actions.push({ action, repeat: false });
    }

    const direction = padDirection(pad, this.direction);
    this.seenAt = now;
    if (direction !== this.direction) {
      this.direction = direction;
      this.heldSince = now;
      this.repeatAt = now + PAD_REPEAT_DELAY_MS;
      if (direction && previous) actions.push({ action: direction, repeat: false });
    } else if (direction && now >= this.repeatAt) {
      this.repeatAt = now + PAD_REPEAT_EVERY_MS;
      actions.push({ action: direction, repeat: true });
    }
    return actions;
  }
}

/** Whose letters and shapes to print on a hint. */
export type PadFamily = 'xbox' | 'playstation' | 'nintendo';

/**
 * The glyph family from a pad's `id`. Steam and most PC pads present as Xbox
 * (XInput) pads, so that is the default for anything unrecognised.
 */
export function padFamily(id: string): PadFamily {
  if (/054c|dualshock|dualsense|playstation|ps[345]/i.test(id)) return 'playstation';
  if (/057e|nintendo|switch|joy-?con|pro controller/i.test(id)) return 'nintendo';
  return 'xbox';
}
