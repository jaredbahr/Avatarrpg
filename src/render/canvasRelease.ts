/**
 * Giving a canvas's memory back.
 *
 * A canvas that is merely dropped keeps its backing store until the garbage collector reaches it,
 * and a page that makes canvases faster than it collects them holds every one of them meanwhile:
 * measured on this game, a session's live canvases were about 1.5 megapixels while the page held
 * over 30 at its worst. iPadOS counts the lot (ADR 0112). Sizing a canvas to nothing releases its
 * store at once, so whoever owns a canvas calls this when it lets go of it: a cache on eviction, a
 * backend on destroy, a layer when its picture is replaced.
 */

type Releasable = { width: number; height: number };

/** Releases a canvas's backing store now. The canvas must not be drawn from again. */
export function releaseCanvas(canvas: Releasable | null | undefined): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Releases it once the current task is over. For a cache evicting in the middle of a frame: a
 * sprite handed out earlier in the same frame may not have been uploaded or blitted yet, and both
 * backends finish a frame inside the task that started it.
 */
export function releaseCanvasSoon(canvas: Releasable | null | undefined): void {
  if (!canvas) return;
  queueMicrotask(() => releaseCanvas(canvas));
}
