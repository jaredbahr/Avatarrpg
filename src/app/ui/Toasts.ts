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
  private placed: {
    where: Placement;
    anchor: string;
    aside: string;
    reserve: string;
    panel: Element | null;
  } = { where: 'top', anchor: '', aside: '', reserve: '', panel: null };
  /** The band would not fit under the open list; cleared when the list closes. */
  private crowded = false;

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
      if (this.placed.reserve) document.documentElement.style.removeProperty('--toast-reserve');
      this.placed = { where: 'top', anchor: '', aside: '', reserve: '', panel: null };
      this.crowded = false;
      return;
    }
    const origin = this.host.parentElement;
    let where: Placement = 'top';
    let anchor = '';
    let aside = '';
    let reserve = '';
    let listOpen = false;
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
        const box = origin.getBoundingClientRect();
        let top = map.top;
        // A list that drops over the map (the phone battle header's More)
        // keeps the band clear of it, without hiding the live region: beside
        // the list where the screen has the width, under it where it does not.
        // Where the band will not fit under it either (Largest text, a phone
        // on its side or a long line upright) it goes beside in whatever width
        // there is, or else to the foot of the screen, and the list gives up
        // the room it needs. Once crowded, it stays put while that list is
        // open, so a list that shrank for it does not send it back under.
        const menu = document
          .querySelector('.scene-host [data-toast-clear]')
          ?.getBoundingClientRect();
        if (menu && menu.height > 0) {
          listOpen = true;
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
          const gap = GAP_REM * rem;
          const height = this.host.getBoundingClientRect().height;
          const width = menu.left - box.left;
          const wide = width >= BESIDE_REM * rem;
          if (!wide && menu.bottom + gap + height > box.bottom - gap) this.crowded = true;
          if (wide || (this.crowded && width >= NARROW_BESIDE_REM * rem)) {
            where = 'map-beside';
            aside = `${Math.round(box.right - menu.left)}px`;
            // Beside the list the band may rise over the header to stay on screen.
            top = Math.max(box.top, Math.min(top, box.bottom - 2 * gap - height));
          } else if (this.crowded) {
            where = 'map-foot';
            reserve = `${Math.round(height + 2 * gap)}px`;
          } else {
            top = Math.max(top, menu.bottom);
          }
        }
        anchor = `${Math.round(top - box.top)}px`;
      }
    }
    if (!listOpen) this.crowded = false;
    if (reserve !== this.placed.reserve) {
      const root = document.documentElement.style;
      if (reserve) root.setProperty('--toast-reserve', reserve);
      else root.removeProperty('--toast-reserve');
    }
    if (where === 'top') delete this.host.dataset.place;
    else if (this.host.dataset.place !== where) this.host.dataset.place = where;
    if (anchor && anchor !== this.placed.anchor) {
      this.host.style.setProperty('--toast-anchor', anchor);
    }
    if (aside && aside !== this.placed.aside) {
      this.host.style.setProperty('--toast-aside', aside);
    }
    this.placed = {
      where,
      anchor: anchor || this.placed.anchor,
      aside: aside || this.placed.aside,
      reserve,
      panel: panel ?? null,
    };
    this.frame = requestAnimationFrame(this.place);
  };
}

type Placement = 'sheet' | 'sheet-lifted' | 'map' | 'map-beside' | 'map-foot' | 'top';

/** The width, in rem, left of an open list that still holds a toast beside it. */
const BESIDE_REM = 16;
/** The least width beside it that still beats the foot, once under will not fit. */
const NARROW_BESIDE_REM = 10;
/** `--sp-2`, the band's gap from the list and from the foot of the screen. */
const GAP_REM = 0.5;

/** Whether two elements' boxes intersect: here, a toast and a sheet. */
function overlaps(a: Element, b: Element): boolean {
  const p = a.getBoundingClientRect();
  const q = b.getBoundingClientRect();
  return p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
}
