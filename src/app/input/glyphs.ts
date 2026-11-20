/**
 * What to print on a hint for the device last used (ADR 0115 §6).
 *
 * Glyphs are short text in the UI face rather than pictures: they scale with
 * the Large-text setting, need no art per controller, and read aloud. A pad's
 * face buttons are named by position (the standard mapping), in the letters or
 * shapes its family prints on them.
 */

import type { HintKey, InputDevice } from './actions';
import type { PadFamily } from './gamepad';

const KEYBOARD: Readonly<Record<HintKey, string>> = {
  move: 'Arrows',
  confirm: 'Enter',
  cancel: 'Esc',
  cycle: 'Q E',
  slots: '1–9',
  endTurn: 'T',
  inspect: 'F',
  map: 'M',
  menu: 'Esc',
  pan: 'Shift+Arrows',
};

const PADS: Readonly<Record<PadFamily, Readonly<Record<HintKey, string>>>> = {
  xbox: {
    move: 'D-pad',
    confirm: 'A',
    cancel: 'B',
    cycle: 'LB RB',
    slots: 'D-pad',
    endTurn: 'Y',
    inspect: 'X',
    map: 'View',
    menu: 'Menu',
    pan: 'Right stick',
  },
  playstation: {
    move: 'D-pad',
    confirm: '✕',
    cancel: '○',
    cycle: 'L1 R1',
    slots: 'D-pad',
    endTurn: '△',
    inspect: '□',
    map: 'Create',
    menu: 'Options',
    pan: 'Right stick',
  },
  // By position, as the standard mapping reports them: the bottom button is B on a Nintendo pad.
  nintendo: {
    move: 'D-pad',
    confirm: 'B',
    cancel: 'A',
    cycle: 'L R',
    slots: 'D-pad',
    endTurn: 'X',
    inspect: 'Y',
    map: '−',
    menu: '+',
    pan: 'Right stick',
  },
};

/** The glyph for a hint, or null on touch and mouse, which need none. */
export function glyphFor(key: HintKey, device: InputDevice, family: PadFamily): string | null {
  if (device === 'keyboard') return KEYBOARD[key];
  if (device === 'gamepad') return PADS[family][key];
  return null;
}

/** "Hand the tablet to" for the device in use (ADR 0115 §5). */
export function handoffCopy(device: InputDevice, touchScreen: boolean): string {
  if (device === 'keyboard') return 'Pass the keyboard to';
  if (device === 'gamepad') return 'Pass the controller to';
  return touchScreen ? 'Hand the tablet to' : 'Next up';
}
