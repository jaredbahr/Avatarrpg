/**
 * Delivers actions (ADR 0112).
 *
 * The one place a key or a gamepad button becomes something the game does.
 * The order is the contract:
 *
 *   1. a modal dialog is open  -> the action drives that dialog only
 *   2. the scene takes it      -> `Scene.handleAction` (board scenes)
 *   3. otherwise               -> focus moves between the controls on screen,
 *                                 and `confirm` presses one
 *
 * So a screen made of ordinary buttons needs no input code at all, and a board
 * scene writes its handling once for every device. Pointer input is not routed
 * here (a pointer already says where); it only reports which device was used.
 */

import type { ActionEvent, Direction, InputAction, InputDevice, InputHint } from './actions';
import { isDirection, keyAction, keyPan } from './actions';
import { nextFocusIndex } from './focusNav';
import { PadReader, padFamily, padPan, padZoom } from './gamepad';
import type { PadFamily, PadSnapshot } from './gamepad';
import { glyphFor } from './glyphs';

/** What the router needs of the app: where the scene is, and how to reach it. */
export interface RouterHost {
  readonly sceneHost: HTMLElement;
  /** The mounted scene's own handling; false leaves the action to the controls on screen. */
  sceneAction(event: ActionEvent): boolean;
  sceneHints(): readonly InputHint[] | null;
  /** Opens the pause menu where there is one; false where there is not (title, setup). */
  openMenu(): boolean;
}

const FOCUSABLE =
  'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
/** The one control `confirm` presses when nothing has focus: the way on. */
const DEFAULT_CONTROL =
  '.input-default, [data-conversation-control="next"], [data-interlude-control="next"], [data-vote-control]';
const MODAL = '[role="dialog"][aria-modal="true"]';
/** A held arrow key repeats as fast as the OS says; a cursor that fast cannot be stopped on a tile. */
const KEY_REPEAT_EVERY_MS = 110;
const LEGEND_REFRESH_MS = 250;
/** How long a direction is down before it counts as held. */
const HOLD_AFTER_MS = 300;

function usable(control: HTMLElement): boolean {
  return (
    !control.matches(':disabled, [aria-disabled="true"]') &&
    !control.closest('[hidden], [inert], [aria-hidden="true"]') &&
    control.getClientRects().length > 0 &&
    getComputedStyle(control).visibility === 'visible'
  );
}

function controlsIn(scope: HTMLElement): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(usable);
}

function topDialog(): HTMLElement | null {
  const dialogs = document.querySelectorAll<HTMLElement>(MODAL);
  return dialogs[dialogs.length - 1] ?? null;
}

function editable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return (
    target instanceof HTMLInputElement &&
    !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file'].includes(target.type)
  );
}

/**
 * Whether the focused control already means something by this key: typing in a
 * field, arrows in a slider, Enter and Space on a button. (A radio group that
 * steps by arrow keys takes them itself, before they reach the document.) The
 * map canvas is a tab stop but owns nothing; the board's keys are the game's.
 */
function ownsKey(target: EventTarget | null, action: InputAction | null): boolean {
  if (!(target instanceof HTMLElement) || target instanceof HTMLCanvasElement) return false;
  if (editable(target)) return true;
  if (action === null) return false;
  if (isDirection(action))
    return (
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLInputElement &&
        (target.type === 'range' || target.type === 'radio')) ||
      target.matches('[role="slider"], [role="tab"]')
    );
  if (action === 'confirm')
    // A dialog's heading takes focus (tabindex -1) but answers no key; the
    // conversation panel does, with a handler of its own.
    return target.matches(
      'button, a[href], input, select, summary, [role="button"], [tabindex]:not([tabindex="-1"]), .conversation-panel',
    );
  return false;
}

export class InputRouter {
  device: InputDevice;
  family: PadFamily = 'xbox';

  private readonly heldMoves: string[] = [];
  private readonly heldPans = new Map<string, Direction>();
  private readonly moveByCode = new Map<string, Direction>();
  private lastKeyRepeat = 0;
  /** The dialog or scene the last fresh press landed in. */
  private pressedIn: Element | null = null;
  private heldWay: Direction | null = null;
  private heldSince = 0;
  private readonly pads = new Map<number, PadReader>();
  private padHeld: Direction | null = null;
  private padPanVector = { x: 0, y: 0 };
  private padZoomRate = 0;
  private polling = 0;
  /** Events this router made itself (a pad's Escape), so it does not route them again. */
  private readonly own = new WeakSet<Event>();
  private legend: HTMLElement | null = null;
  private legendKey = '';
  private legendTimer: number | null = null;

  constructor(private readonly host: RouterHost) {
    this.device = navigator.maxTouchPoints > 0 ? 'touch' : 'mouse';
    this.publishDevice();
  }

  start(): void {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.release);
    window.addEventListener('pointerdown', this.onPointerDown, { capture: true, passive: true });
    window.addEventListener('gamepadconnected', this.poll);
    // A pad already awake (a reload mid-session) announces nothing.
    this.poll();
  }

  /* ---------------------------------------------------------------- */
  /* What scenes read each frame                                       */
  /* ---------------------------------------------------------------- */

  /**
   * The direction held now, for walking on while it is held; null at rest, in
   * a menu, and for the first `HOLD_AFTER_MS` of a press, so a tap is one step
   * and never the start of a stride.
   */
  heldDirection(now = performance.now()): Direction | null {
    if (topDialog()) return null;
    const code = this.heldMoves[this.heldMoves.length - 1];
    const direction = (code ? this.moveByCode.get(code) : undefined) ?? this.padHeld;
    if (direction !== this.heldWay) {
      this.heldWay = direction;
      this.heldSince = now;
    }
    return direction && now - this.heldSince >= HOLD_AFTER_MS ? direction : null;
  }

  /** Look-around, each axis -1 to 1: Shift + arrows, I J K L, or the right stick. */
  panVector(): { readonly x: number; readonly y: number } {
    if (topDialog()) return { x: 0, y: 0 };
    let x = this.padPanVector.x;
    let y = this.padPanVector.y;
    for (const direction of this.heldPans.values()) {
      if (direction === 'left') x -= 1;
      if (direction === 'right') x += 1;
      if (direction === 'up') y -= 1;
      if (direction === 'down') y += 1;
    }
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }

  /** The triggers' zoom rate, -1 (out) to 1 (in). */
  zoomRate(): number {
    return topDialog() ? 0 : this.padZoomRate;
  }

  /** True while a keyboard or a pad, not a pointer, was the last thing used. */
  get pointerless(): boolean {
    return this.device === 'keyboard' || this.device === 'gamepad';
  }

  /** The glyph for a hint on the device in use, or null on touch and mouse. */
  glyph(key: InputHint['key']): string | null {
    return glyphFor(key, this.device, this.family);
  }

  /* ---------------------------------------------------------------- */
  /* Routing                                                           */
  /* ---------------------------------------------------------------- */

  /** Delivers one action by the order in the header. True when something took it. */
  route(event: ActionEvent): boolean {
    const dialog = topDialog();
    // A direction held since the last screen (a walk into a conversation, a
    // cursor into a result card) does nothing on this one until it is pressed anew.
    const place = dialog ?? this.host.sceneHost.lastElementChild;
    if (!event.repeat) this.pressedIn = place;
    else if (place !== this.pressedIn) return true;
    const handled = dialog
      ? this.controlAction(event, dialog, true)
      : this.host.sceneAction(event) || this.controlAction(event, this.host.sceneHost, false);
    this.refreshLegend();
    return handled;
  }

  private controlAction(event: ActionEvent, scope: HTMLElement, modal: boolean): boolean {
    const { action } = event;
    const controls = controlsIn(scope);
    const active = document.activeElement;
    const index = active instanceof HTMLElement ? controls.indexOf(active) : -1;
    const focused = index >= 0 ? controls[index] : undefined;

    if (isDirection(action)) {
      // A direction still held from the last screen (a walk) never grabs focus on this one.
      if (!focused) return event.repeat || this.seedFocus(scope, controls);
      if (this.adjust(focused, action)) return true;
      const next = nextFocusIndex(
        controls.map((control) => control.getBoundingClientRect()),
        index,
        action,
      );
      const target = next === null ? undefined : controls[next];
      target?.focus();
      // Unmoved, the key stays the browser's: an arrow still scrolls a long sheet.
      return target !== undefined;
    }

    if (action === 'next' || action === 'prev') {
      if (controls.length === 0) return false;
      const step = action === 'next' ? 1 : -1;
      const from = focused ? index : step === 1 ? -1 : 0;
      controls[(from + step + controls.length) % controls.length]?.focus();
      return true;
    }

    if (event.repeat) return false;

    if (action === 'confirm') {
      if (focused && !(focused instanceof HTMLCanvasElement)) {
        // A key on a focused control is the browser's own activation.
        if (event.device === 'keyboard') return false;
        focused.click();
        return true;
      }
      const standard = [...scope.querySelectorAll<HTMLElement>(DEFAULT_CONTROL)].find(usable);
      if (!standard) return this.seedFocus(scope, controls);
      standard.focus({ preventScroll: true });
      standard.click();
      return true;
    }

    if (action === 'cancel') {
      if (!modal) return this.host.openMenu();
      // The dialog's own Escape handling is the one way out; a pad borrows it.
      if (event.device !== 'gamepad') return false;
      const escape = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true });
      this.own.add(escape);
      document.dispatchEvent(escape);
      return true;
    }

    if (action === 'menu' && !modal) return this.host.openMenu();
    return false;
  }

  /** Nothing has focus: put it on the way on, or the first control, and stop there. */
  private seedFocus(scope: HTMLElement, controls: readonly HTMLElement[]): boolean {
    const target =
      [
        ...scope.querySelectorAll<HTMLElement>(`${DEFAULT_CONTROL}, .choice-option, .btn-primary`),
      ].find(usable) ?? controls.find((control) => !(control instanceof HTMLCanvasElement));
    target?.focus();
    return target !== undefined;
  }

  /** Left and right on a slider or a radio group change its value, as its arrow keys do. */
  private adjust(control: HTMLElement, direction: Direction): boolean {
    if (direction !== 'left' && direction !== 'right') return false;
    if (control instanceof HTMLInputElement && control.type === 'range') {
      if (direction === 'right') control.stepUp();
      else control.stepDown();
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (control.matches('[role="radio"]')) {
      const key = direction === 'right' ? 'ArrowRight' : 'ArrowLeft';
      const press = new KeyboardEvent('keydown', {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
      });
      this.own.add(press);
      control.dispatchEvent(press);
      // A group that steps by arrow keys says so by taking the key; any other is plain buttons.
      return press.defaultPrevented;
    }
    return false;
  }

  /* ---------------------------------------------------------------- */
  /* Keyboard                                                          */
  /* ---------------------------------------------------------------- */

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.own.has(event) || event.isComposing) return;
    // An on-screen keyboard typing a name is still a finger on the glass.
    if (editable(event.target)) return;
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) this.setDevice('keyboard');

    const pan = keyPan(event);
    if (pan) {
      if (ownsKey(event.target, pan)) return;
      this.heldPans.set(event.code, pan);
      event.preventDefault();
      return;
    }
    const action = keyAction(event);
    if (!action || ownsKey(event.target, action)) return;

    if (isDirection(action)) {
      if (!this.heldMoves.includes(event.code)) this.heldMoves.push(event.code);
      this.moveByCode.set(event.code, action);
      // Starts the hold clock on the press itself, not when a scene next asks.
      this.heldDirection();
      if (event.repeat) {
        const now = performance.now();
        if (now - this.lastKeyRepeat < KEY_REPEAT_EVERY_MS) {
          event.preventDefault();
          return;
        }
        this.lastKeyRepeat = now;
      }
    }
    if (this.route({ action, device: 'keyboard', repeat: event.repeat })) event.preventDefault();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    const held = this.heldMoves.indexOf(event.code);
    if (held >= 0) this.heldMoves.splice(held, 1);
    this.heldDirection();
    this.heldPans.delete(event.code);
    // Letting Shift go ends a Shift + arrow look-around even if the arrow is still down.
    if (event.key === 'Shift')
      for (const code of [...this.heldPans.keys()])
        if (code.startsWith('Arrow')) this.heldPans.delete(code);
  };

  /** A window that lost focus never hears the key come up. */
  private release = (): void => {
    this.heldMoves.length = 0;
    this.heldPans.clear();
  };

  private onPointerDown = (event: PointerEvent): void => {
    this.setDevice(event.pointerType === 'mouse' ? 'mouse' : 'touch');
  };

  /* ---------------------------------------------------------------- */
  /* Gamepad                                                           */
  /* ---------------------------------------------------------------- */

  /** Every pad the browser will show us; none where the page may not ask (a restricted frame). */
  private gamepads(): readonly (Gamepad | null)[] {
    try {
      return navigator.getGamepads?.() ?? [];
    } catch {
      return [];
    }
  }

  /** Polls every connected pad once a frame while there is one; all of them feed one stream. */
  private poll = (): void => {
    if (this.polling) cancelAnimationFrame(this.polling);
    this.polling = 0;
    const connected = this.gamepads().filter(
      (pad): pad is Gamepad => pad !== null && pad.connected,
    );
    if (connected.length === 0) {
      this.pads.clear();
      this.padHeld = null;
      this.padPanVector = { x: 0, y: 0 };
      this.padZoomRate = 0;
      return;
    }
    this.polling = requestAnimationFrame(this.poll);

    const now = performance.now();
    let held: Direction | null = null;
    let pan = { x: 0, y: 0 };
    let zoom = 0;
    for (const pad of connected) {
      const snapshot: PadSnapshot = {
        buttons: pad.buttons.map((button) =>
          button.pressed ? Math.max(button.value, 1) : button.value,
        ),
        axes: pad.axes,
      };
      let reader = this.pads.get(pad.index);
      if (!reader) this.pads.set(pad.index, (reader = new PadReader()));
      const actions = reader.step(snapshot, now);
      const look = padPan(snapshot);
      const trigger = padZoom(snapshot);
      // A press says a pad is in use; a stick at rest can drift, so an axis alone does not.
      if (actions.length > 0) this.setDevice('gamepad', padFamily(pad.id));
      for (const { action, repeat } of actions) this.route({ action, device: 'gamepad', repeat });
      held ??= reader.held;
      if (Math.abs(look.x) + Math.abs(look.y) > Math.abs(pan.x) + Math.abs(pan.y)) pan = look;
      if (Math.abs(trigger) > Math.abs(zoom)) zoom = trigger;
    }
    this.padHeld = held;
    this.padPanVector = pan;
    this.padZoomRate = zoom;
    this.heldDirection(now);
  };

  /* ---------------------------------------------------------------- */
  /* The device last used, and the hints drawn for it                  */
  /* ---------------------------------------------------------------- */

  private setDevice(device: InputDevice, family: PadFamily = this.family): void {
    if (device === this.device && family === this.family) return;
    this.device = device;
    this.family = family;
    this.publishDevice();
    this.refreshLegend();
  }

  /** On the document root, where the stylesheet and the specs read it. */
  private publishDevice(): void {
    const root = document.documentElement;
    root.dataset.input = this.device;
    if (this.device === 'gamepad') root.dataset.pad = this.family;
    else delete root.dataset.pad;
    const confirm = this.glyph('confirm');
    if (confirm) root.style.setProperty('--glyph-confirm', JSON.stringify(confirm));
    else root.style.removeProperty('--glyph-confirm');

    if (this.pointerless && this.legendTimer === null) {
      // Turns change without a key being pressed; keep the legend true to the screen.
      this.legendTimer = window.setInterval(() => this.refreshLegend(), LEGEND_REFRESH_MS);
    } else if (!this.pointerless && this.legendTimer !== null) {
      window.clearInterval(this.legendTimer);
      this.legendTimer = null;
    }
  }

  /**
   * The one-line legend over the map: what the buttons do now, in the glyphs of
   * the device in use. It is absent for touch and mouse, and on screens with no
   * map, where the default control carries the confirm glyph instead.
   */
  private refreshLegend(): void {
    const wrap = this.pointerless
      ? [...this.host.sceneHost.querySelectorAll<HTMLElement>('.map-wrap')].find(
          (candidate) => !candidate.closest('[inert]'),
        )
      : undefined;
    const hints = wrap && !topDialog() ? (this.host.sceneHints() ?? []) : [];
    if (!wrap || hints.length === 0) {
      this.legend?.remove();
      this.legend = null;
      this.legendKey = '';
      return;
    }
    const key = `${this.device}|${this.family}|${hints.map((hint) => `${hint.key}:${hint.label}`).join('|')}`;
    if (this.legend?.parentElement === wrap && key === this.legendKey) return;
    this.legendKey = key;
    this.legend?.remove();
    const legend = document.createElement('div');
    legend.className = 'input-legend';
    legend.setAttribute('aria-hidden', 'true');
    for (const hint of hints) {
      const glyph = this.glyph(hint.key);
      if (!glyph) continue;
      const item = document.createElement('span');
      item.className = 'input-hint';
      const face = document.createElement('kbd');
      face.textContent = glyph;
      item.append(face, hint.label);
      legend.append(item);
    }
    wrap.append(legend);
    this.legend = legend;
  }
}
