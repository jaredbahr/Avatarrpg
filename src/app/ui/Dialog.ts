/**
 * Modal overlay base.
 *
 * Handles the parts every dialog gets wrong: focus moves in and comes back
 * out, Escape closes, tabbing stays inside, and a tap on the backdrop closes
 * only when that is safe. Subclasses supply the body.
 */

import { announce, clear, el } from './dom';

export interface DialogOptions {
  readonly title: string;
  readonly subtitle?: string;
  /** Tapping the backdrop closes. Off for anything that must be answered. */
  readonly dismissable?: boolean;
  readonly wide?: boolean;
}

export abstract class Dialog {
  protected overlay: HTMLElement | null = null;
  protected body: HTMLElement | null = null;
  private previousFocus: Element | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  protected abstract options: DialogOptions;

  /** Builds the dialog contents into `body`. Called on open and on refresh. */
  protected abstract build(body: HTMLElement): void;

  /** Called after the dialog closes. */
  protected onClose(): void {}

  open(host: HTMLElement): void {
    if (this.overlay) return;
    this.previousFocus = document.activeElement;

    const body = el('div', { class: 'stack' });
    this.body = body;

    const heading = el('h2', { text: this.options.title, attrs: { tabindex: '-1' } });
    const panel = el(
      'div',
      {
        class: `panel dialog${this.options.wide ? ' dialog-wide' : ''}`,
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': this.options.title },
      },
      el(
        'header',
        { class: 'dialog-head' },
        heading,
        this.options.subtitle ? el('p', { class: 'muted', text: this.options.subtitle }) : null,
      ),
      body,
    );

    const overlay = el('div', { class: 'overlay' }, panel);
    if (this.options.dismissable !== false) {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) this.close();
      });
    }

    this.overlay = overlay;
    host.appendChild(overlay);
    this.build(body);

    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.options.dismissable !== false) {
        event.preventDefault();
        this.close();
        return;
      }
      if (event.key === 'Tab' && overlay.contains(document.activeElement))
        this.trapFocus(event, panel);
    };
    document.addEventListener('keydown', this.keyHandler);

    announce(this.options.title);
    // A dialog's first control can be below the fold (the inspector's Close
    // button is at the end). Focus the title so the opening view stays at top.
    heading.focus({ preventScroll: true });
  }

  /** Rebuilds the body in place, keeping the dialog open. */
  refresh(): void {
    if (!this.body) return;
    clear(this.body);
    this.build(this.body);
  }

  close(): void {
    if (!this.overlay) return;
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this.overlay.remove();
    this.overlay = null;
    this.body = null;
    if (this.previousFocus instanceof HTMLElement) this.previousFocus.focus();
    this.onClose();
  }

  get isOpen(): boolean {
    return this.overlay !== null;
  }

  private focusables(root: HTMLElement): HTMLElement[] {
    return [
      ...root.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ];
  }

  private trapFocus(event: KeyboardEvent, root: HTMLElement): void {
    const items = this.focusables(root);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;

    if (!items.includes(document.activeElement as HTMLElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
