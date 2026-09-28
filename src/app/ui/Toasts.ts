/**
 * Transient messages.
 *
 * Refusals from the rules ("Needs 2 AP, has 1") arrive as `message` events and
 * surface here. They are deliberately short-lived and non-blocking: a nine-
 * year-old mis-tapping should get a nudge, not a dialog to dismiss.
 *
 * The stack hangs from the top of the map viewport, not the page: over the
 * page top it covered the place name and the header's buttons at the moment a
 * fight opened. It sits under an open sheet for the same reason.
 */

import { el } from './dom';

export type ToastKind = 'info' | 'warn';

export class Toasts {
  private host: HTMLElement;
  private recent = new Map<string, number>();
  private frame = 0;

  constructor(parent: HTMLElement) {
    this.host = el('div', { class: 'toasts', attrs: { 'aria-live': 'polite' } });
    parent.appendChild(this.host);
  }

  show(text: string, kind: ToastKind = 'info', ms = 2600): void {
    if (!text) return;

    // The AI can emit the same line several times in one step; show it once.
    const now = performance.now();
    const last = this.recent.get(text) ?? -Infinity;
    if (now - last < 900) return;
    this.recent.set(text, now);

    const node = el('div', { class: `toast toast-${kind}`, text });
    this.host.appendChild(node);
    this.place();

    // Cap the stack so a busy enemy turn cannot fill the screen.
    while (this.host.childElementCount > 4) {
      this.host.firstElementChild?.remove();
    }

    window.setTimeout(() => {
      node.classList.add('toast-out');
      window.setTimeout(() => node.remove(), 320);
    }, ms);
  }

  clear(): void {
    while (this.host.firstChild) this.host.removeChild(this.host.firstChild);
  }

  /**
   * Re-measures the map's top edge every frame while a toast is up. It moves
   * after the toast is raised: a story beat's line arrives just before the
   * scene swaps to the fight, and the turn strip and text size change the
   * header's height without a resize. A scene with no map keeps the CSS
   * fallback, the top of the screen.
   */
  private place = (): void => {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.host.childElementCount === 0) return;
    const map = document.querySelector('.scene-host .map-wrap')?.getBoundingClientRect();
    const origin = this.host.parentElement?.getBoundingClientRect();
    if (map && origin && map.height > 0) {
      this.host.style.setProperty('--toast-anchor', `${Math.round(map.top - origin.top)}px`);
      this.host.dataset.anchored = '';
    } else {
      delete this.host.dataset.anchored;
    }
    this.frame = requestAnimationFrame(this.place);
  };
}
