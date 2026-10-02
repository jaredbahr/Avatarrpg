/**
 * The scene curtain: a reveal from ink on every scene change.
 *
 * `App.showScene` swaps scenes synchronously and everything downstream relies
 * on that: the level-up flow that opens a dialog in the same dispatch, the
 * e2e helpers that read `state.screen` right after a tap, the map camera
 * measured from the canvas the moment it mounts. So the curtain never delays
 * the swap. It drops opaque over the *new* scene in the same frame and lifts
 * over --dur-slow; the old scene is simply gone.
 *
 * It lives in the overlay host above dialogs and toasts, and takes no
 * pointer events, so a tap during the lift lands on the scene underneath
 * exactly as it would without it. Under reduce motion it does nothing.
 */

import { el, motionReduced } from './dom';
import { sheets, type SheetLoadState } from '../../render/sheets/store';

/**
 * A transition that never ends would leave the curtain down: a tab in the
 * background defers it, a zero duration never fires transitionend at all.
 * The timer is the guarantee it lifts.
 */
const FALLBACK_MS = 600;
/** A cold atlas that never arrives may not keep the game behind ink. */
export const FIRST_FRAME_SHEET_WAIT_MS = 2_500;

/**
 * Hold only for a sheet that is still on its way. One that has already failed
 * stays failed for the session, so waiting for it would put every later scene
 * behind ink for the whole bound: it lifts at once and the fallback draws.
 */
export function curtainSheetDecision(
  states: ReadonlyMap<string, SheetLoadState>,
  elapsedMs: number,
): 'hold' | 'lift' {
  return elapsedMs >= FIRST_FRAME_SHEET_WAIT_MS ||
    [...states.values()].every((s) => s !== 'loading')
    ? 'lift'
    : 'hold';
}

export class Curtain {
  private readonly node: HTMLElement;
  private timer: number | null = null;
  private revealGeneration = 0;

  constructor(host: HTMLElement) {
    this.node = el('div', { class: 'curtain', attrs: { 'aria-hidden': 'true' } });
    host.appendChild(this.node);
    this.node.addEventListener('transitionend', () => this.settle());
  }

  /** Covers the scene and lifts. Call after the new scene has rendered. */
  reveal(firstFrameSheetKeys: readonly string[] = []): void {
    this.settle();
    if (motionReduced()) return;

    const generation = ++this.revealGeneration;
    const node = this.node;
    node.classList.add('is-down');
    // Commit the covered frame before starting the lift, or the browser
    // coalesces both class changes and nothing fades.
    void node.offsetWidth;
    const keys = [...new Set(firstFrameSheetKeys)];
    const states = new Map<string, SheetLoadState>(
      keys.map((key): [string, SheetLoadState] => [key, sheets.loadState(key)]),
    );
    const lift = (): void => {
      if (
        generation !== this.revealGeneration ||
        !node.classList.contains('is-down') ||
        node.classList.contains('is-lifting')
      )
        return;
      // The bound may still be pending when the sheets arrive early.
      if (this.timer !== null) window.clearTimeout(this.timer);
      node.classList.add('is-lifting');
      this.timer = window.setTimeout(() => this.settle(), FALLBACK_MS);
    };
    if (curtainSheetDecision(states, 0) === 'lift') {
      lift();
      return;
    }

    // The initial fallback frame has already been baked by scene mount. Once
    // every cold atlas has arrived or failed, give both backends one frame to
    // install and draw what did arrive under opaque ink, then begin the reveal.
    void Promise.all(keys.map((key) => sheets.whenLoaded(key))).then(() => {
      if (generation === this.revealGeneration) requestAnimationFrame(() => lift());
    });
    this.timer = window.setTimeout(lift, FIRST_FRAME_SHEET_WAIT_MS);
  }

  private settle(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.node.classList.remove('is-down', 'is-lifting');
  }
}
