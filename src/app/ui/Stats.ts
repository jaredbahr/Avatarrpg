/**
 * A frame-time readout, on only with `?stats=1`.
 *
 * The one number the device checklist needs: does the board hold 60fps on the
 * quarry with the boss out. A rolling count over the last second, written to
 * the DOM twice a second so the readout is never the thing costing frames.
 */

import { el } from './dom';

export class Stats {
  private node: HTMLElement;
  private frames: number[] = [];
  private lastWrite = 0;

  constructor(parent: HTMLElement) {
    this.node = el('div', { class: 'stats', attrs: { 'aria-hidden': 'true' } });
    parent.appendChild(this.node);
  }

  static enabled(): boolean {
    try {
      return new URLSearchParams(window.location.search).get('stats') === '1';
    } catch {
      return false;
    }
  }

  /** Call once per rendered frame with `performance.now()`. */
  frame(now: number): void {
    this.frames.push(now);
    const cutoff = now - 1000;
    while (this.frames.length > 0 && (this.frames[0] ?? now) < cutoff) this.frames.shift();

    if (now - this.lastWrite < 500) return;
    this.lastWrite = now;

    const count = this.frames.length;
    const first = this.frames[0] ?? now;
    const fps = count > 1 ? ((count - 1) * 1000) / Math.max(1, now - first) : 0;
    const ms = fps > 0 ? 1000 / fps : 0;
    this.node.textContent = `${fps.toFixed(0)} fps · ${ms.toFixed(1)} ms`;
  }
}
