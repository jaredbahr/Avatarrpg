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
 * It lives in the overlay host above dialogs and below toasts, and takes no
 * pointer events, so a tap during the lift lands on the scene underneath
 * exactly as it would without it. Under reduce motion it does nothing.
 */

import { el, motionReduced } from './dom';

/**
 * A transition that never ends would leave the curtain down: a tab in the
 * background defers it, a zero duration never fires transitionend at all.
 * The timer is the guarantee it lifts.
 */
const FALLBACK_MS = 600;

export class Curtain {
  private readonly node: HTMLElement;
  private timer: number | null = null;

  constructor(host: HTMLElement) {
    this.node = el('div', { class: 'curtain', attrs: { 'aria-hidden': 'true' } });
    host.appendChild(this.node);
    this.node.addEventListener('transitionend', () => this.settle());
  }

  /** Covers the scene and lifts. Call after the new scene has rendered. */
  reveal(): void {
    this.settle();
    if (motionReduced()) return;

    const node = this.node;
    node.classList.add('is-down');
    // Commit the covered frame before starting the lift, or the browser
    // coalesces both class changes and nothing fades.
    void node.offsetWidth;
    node.classList.add('is-lifting');
    this.timer = window.setTimeout(() => this.settle(), FALLBACK_MS);
  }

  private settle(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.node.classList.remove('is-down', 'is-lifting');
  }
}
