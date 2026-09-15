/**
 * Transient messages.
 *
 * Refusals from the rules ("Needs 2 AP, has 1") arrive as `message` events and
 * surface here. They are deliberately short-lived and non-blocking: a nine-
 * year-old mis-tapping should get a nudge, not a dialog to dismiss.
 */

import { el } from './dom';

export type ToastKind = 'info' | 'warn';

export class Toasts {
  private host: HTMLElement;
  private recent = new Map<string, number>();

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
}
