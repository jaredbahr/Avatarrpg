/**
 * Transient messages.
 *
 * Refusals from the rules ("Needs 2 AP, has 1") arrive as `message` events and
 * surface here. They are deliberately short-lived and non-blocking: a nine-
 * year-old mis-tapping should get a nudge, not a dialog to dismiss.
 *
 * The stack hangs from the top of the map viewport, not the page: over the
 * page top it covered the place name and the header's buttons at the moment a
 * fight opened. It sits under the dialog overlay for the same reason, except
 * while a sheet is open: then the toast is usually the sheet's own answer
 * ("Saved.", "Could not erase"), so it rises above the overlay at the bottom of
 * the screen, clear of the sheet's title.
 */

import { el } from './dom';

export type ToastKind = 'info' | 'warn';

export class Toasts {
  private host: HTMLElement;
  private recent = new Map<string, number>();
  private frame = 0;
  /** What `place` last wrote, so a frame that changes nothing writes nothing. */
  private placed: { where: 'sheet' | 'map' | 'top'; anchor: string } = {
    where: 'top',
    anchor: '',
  };

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
   * Re-measures every frame while a toast is up, because what it hangs from
   * moves after the toast is raised: a story beat's line arrives just before
   * the scene swaps to the fight, the turn strip and text size change the
   * header's height without a resize, and a sheet can open or close under it.
   * A scene with no map keeps the CSS fallback, the top of the screen. The DOM
   * is written only when the answer changes.
   */
  private place = (): void => {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.host.childElementCount === 0) return;
    const origin = this.host.parentElement;
    let where: 'sheet' | 'map' | 'top' = 'top';
    let anchor = '';
    if (origin?.querySelector(':scope > .overlay')) {
      where = 'sheet';
    } else {
      const map = document.querySelector('.scene-host .map-wrap')?.getBoundingClientRect();
      if (map && origin && map.height > 0) {
        where = 'map';
        anchor = `${Math.round(map.top - origin.getBoundingClientRect().top)}px`;
      }
    }
    if (where !== this.placed.where) {
      if (where === 'top') delete this.host.dataset.place;
      else this.host.dataset.place = where;
    }
    if (anchor && anchor !== this.placed.anchor) {
      this.host.style.setProperty('--toast-anchor', anchor);
    }
    this.placed = { where, anchor: anchor || this.placed.anchor };
    this.frame = requestAnimationFrame(this.place);
  };
}
