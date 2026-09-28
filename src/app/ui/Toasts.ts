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
 * the screen, clear of the sheet's title; or, where the sheet itself reaches
 * the bottom, inside it just above its footer, clear of its buttons too. There
 * the room under the title holds one toast, so only the newest shows.
 */

import { el } from './dom';

export type ToastKind = 'info' | 'warn';

export class Toasts {
  private host: HTMLElement;
  private recent = new Map<string, number>();
  private frame = 0;
  /** What `place` last wrote, so a frame that changes nothing writes nothing. */
  private placed: { where: Placement; anchor: string; panel: Element | null } = {
    where: 'top',
    anchor: '',
    panel: null,
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
    if (this.host.childElementCount === 0) {
      // The last toast has gone: forget the lift, so the next one measures
      // whatever sheet is open then rather than inheriting this answer.
      delete this.host.dataset.place;
      this.placed = { where: 'top', anchor: '', panel: null };
      return;
    }
    const origin = this.host.parentElement;
    let where: Placement = 'top';
    let anchor = '';
    const panels = origin?.querySelectorAll(':scope > .overlay > .panel');
    const panel = panels?.[panels.length - 1];
    if (origin && panel) {
      // A tall sheet reaches the foot of the screen (Largest text, a phone on
      // its side), and there the toast would sit on its Import and Close.
      // Then it rises into the sheet, just above the footer, and stays there
      // while that sheet is open, so it never hops between the two. A sheet
      // with no footer has nothing down there to cover, and lifting above its
      // top edge would push the toast off the screen, so it stays at the foot.
      const footer = panel.querySelector('.dialog-footer');
      let lifted =
        footer !== null && this.placed.where === 'sheet-lifted' && this.placed.panel === panel;
      if (footer && !lifted) {
        if (this.host.dataset.place !== 'sheet') this.host.dataset.place = 'sheet';
        lifted = overlaps(this.host, panel);
      }
      where = lifted ? 'sheet-lifted' : 'sheet';
      if (footer && lifted) {
        const bottom = origin.getBoundingClientRect().bottom;
        anchor = `${Math.round(bottom - footer.getBoundingClientRect().top)}px`;
      }
    } else {
      const map = document.querySelector('.scene-host .map-wrap')?.getBoundingClientRect();
      if (map && origin && map.height > 0) {
        where = 'map';
        anchor = `${Math.round(map.top - origin.getBoundingClientRect().top)}px`;
      }
    }
    if (where === 'top') delete this.host.dataset.place;
    else if (this.host.dataset.place !== where) this.host.dataset.place = where;
    if (anchor && anchor !== this.placed.anchor) {
      this.host.style.setProperty('--toast-anchor', anchor);
    }
    this.placed = { where, anchor: anchor || this.placed.anchor, panel: panel ?? null };
    this.frame = requestAnimationFrame(this.place);
  };
}

type Placement = 'sheet' | 'sheet-lifted' | 'map' | 'top';

/** Whether two elements' boxes intersect: here, a toast and a sheet. */
function overlaps(a: Element, b: Element): boolean {
  const p = a.getBoundingClientRect();
  const q = b.getBoundingClientRect();
  return p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
}
