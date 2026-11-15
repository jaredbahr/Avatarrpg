/**
 * The action layer (ADR 0112).
 *
 * Devices never talk to scenes. A keyboard key or a gamepad button becomes one
 * of these actions here, and `InputRouter` delivers it: to the open dialog, to
 * the scene, or to the controls on screen. This file is the pure part, the
 * vocabulary and the keyboard's map onto it, so it can be tested without a DOM.
 */

export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type SlotAction =
  'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6' | 'slot7' | 'slot8' | 'slot9';

export type InputAction =
  | Direction
  | 'confirm'
  | 'cancel'
  | 'next'
  | 'prev'
  | SlotAction
  | 'endTurn'
  | 'inspect'
  | 'map'
  | 'menu'
  | 'zoomIn'
  | 'zoomOut'
  | 'recentre';

/** The device a person used last; hints and the hand-off card read it. */
export type InputDevice = 'touch' | 'mouse' | 'keyboard' | 'gamepad';

export interface ActionEvent {
  readonly action: InputAction;
  readonly device: InputDevice;
  /** A held key or button firing again. Only movement repeats; nothing commits on one. */
  readonly repeat: boolean;
}

/** What the scene tells the legend its buttons do now; see `glyphs.ts` for the faces. */
export type HintKey =
  | 'move'
  | 'confirm'
  | 'cancel'
  | 'cycle'
  | 'slots'
  | 'endTurn'
  | 'inspect'
  | 'map'
  | 'menu'
  | 'pan';

export interface InputHint {
  readonly key: HintKey;
  readonly label: string;
}

export function isDirection(action: InputAction): action is Direction {
  return (DIRECTIONS as readonly string[]).includes(action);
}

/** The step a direction takes on the board, y down as the grid has it. */
export function directionVector(direction: Direction): { readonly x: number; readonly y: number } {
  switch (direction) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
  }
}

/** Zero-based index of an action-bar slot, or null for any other action. */
export function slotIndex(action: InputAction): number | null {
  const match = /^slot([1-9])$/.exec(action);
  return match ? Number(match[1]) - 1 : null;
}

/** The parts of a KeyboardEvent the map reads, so tests need no DOM. */
export interface KeyLike {
  readonly code: string;
  readonly key: string;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
}

const ARROWS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/*
 * Letters are read by physical position (`code`), so W A S D sit under the
 * same fingers on a French or German keyboard.
 */
const KEY_ACTIONS: Readonly<Record<string, InputAction>> = {
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Escape: 'cancel',
  Backspace: 'cancel',
  KeyE: 'next',
  KeyQ: 'prev',
  KeyT: 'endTurn',
  KeyF: 'inspect',
  KeyM: 'map',
  KeyP: 'menu',
  Equal: 'zoomIn',
  NumpadAdd: 'zoomIn',
  Minus: 'zoomOut',
  NumpadSubtract: 'zoomOut',
  Digit0: 'recentre',
  Numpad0: 'recentre',
};

const PAN_KEYS: Readonly<Record<string, Direction>> = {
  KeyI: 'up',
  KeyK: 'down',
  KeyJ: 'left',
  KeyL: 'right',
};

/** A browser or system shortcut is never the game's to take. */
function chorded(event: KeyLike): boolean {
  return Boolean(event.ctrlKey || event.altKey || event.metaKey);
}

/** The action a key press means, or null when the key is not the game's. */
export function keyAction(event: KeyLike): InputAction | null {
  if (chorded(event)) return null;
  const arrow = ARROWS[event.code];
  // Shift + arrows looks around instead (`keyPan`).
  if (arrow) return event.shiftKey ? null : arrow;
  const slot = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
  if (slot) return `slot${slot[1]}` as SlotAction;
  return KEY_ACTIONS[event.code] ?? null;
}

/** The way a held key pans the camera, or null: Shift + arrows, or I J K L. */
export function keyPan(event: KeyLike): Direction | null {
  if (chorded(event)) return null;
  const arrow = ARROWS[event.code];
  if (arrow) return event.shiftKey ? arrow : null;
  return PAN_KEYS[event.code] ?? null;
}
