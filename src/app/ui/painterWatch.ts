/**
 * Who lets go of a portrait canvas.
 *
 * Portraits, glyphs and icons are canvases built by `painterCanvas` and dropped whenever the HUD
 * or a dialogue line is rebuilt: one a line in a long conversation, a strip of them on every
 * command in a fight. Nothing owned them once they left the page, so each kept its backing store
 * until the collector found it (a stage portrait is about 0.9 MB on an iPad), and each
 * `fitAssetToBox` call made a ResizeObserver of its own that was only disconnected if the canvas
 * had been laid out before it was removed.
 *
 * So one observer watches them all. A canvas that has been on the page and is no longer has its
 * store released at once; if it is ever put back, it is repainted at the size its box asks for.
 * The observer holds its targets weakly, so a canvas removed before it was ever laid out simply
 * goes with the collector as before.
 */
import { releaseCanvas } from '../../render/canvasRelease';

interface Watched {
  /** The store's side in device pixels when the canvas is on the page. */
  px: number;
  /** Paints the canvas at `px`. */
  readonly paint: (ctx: CanvasRenderingContext2D, px: number) => void;
  /** True when the box CSS gives the canvas sizes the store (`fitAssetToBox`). */
  fit: boolean;
}

const watched = new WeakMap<Element, Watched>();
const seen = new WeakSet<Element>();
let observer: ResizeObserver | null = null;

function repaint(canvas: HTMLCanvasElement, note: Watched, px: number): void {
  note.px = px;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (ctx) note.paint(ctx, px);
}

function deliver(entries: readonly Pick<ResizeObserverEntry, 'target'>[]): void {
  for (const { target } of entries) {
    const canvas = target as HTMLCanvasElement;
    const note = watched.get(canvas);
    if (!note) continue;
    if (!canvas.isConnected) {
      // Observed before it was attached: nothing to give back yet.
      if (seen.has(canvas)) releaseCanvas(canvas);
      continue;
    }
    seen.add(canvas);
    if (note.fit) {
      const box = canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1);
      const px = Math.round(box);
      if (px > 0 && px !== canvas.width) repaint(canvas, note, px);
    } else if (canvas.width === 0 && note.px > 0) {
      // Released while off the page and put back: paint it again as it was.
      repaint(canvas, note, note.px);
    }
  }
}

/** Starts watching a painter canvas; `paint` is how it is drawn again at another size. */
export function watchPainterCanvas(
  canvas: HTMLCanvasElement,
  px: number,
  paint: (ctx: CanvasRenderingContext2D, px: number) => void,
): void {
  if (typeof ResizeObserver === 'undefined') return;
  watched.set(canvas, { px, paint, fit: false });
  observer ??= new ResizeObserver(deliver);
  observer.observe(canvas);
}

/** Lets the box CSS gives a watched canvas size its store, on whole device pixels (#651). */
export function fitWatchedCanvas(canvas: HTMLCanvasElement): void {
  const note = watched.get(canvas);
  if (note) note.fit = true;
}

/** Test seam: forget the shared observer. */
export function resetPainterWatch(): void {
  observer?.disconnect();
  observer = null;
}
