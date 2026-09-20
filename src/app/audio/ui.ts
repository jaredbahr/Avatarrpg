/**
 * The interface's own sounds.
 *
 * `button()` in `ui/dom.ts` is where every control in the game is made, and it
 * is deliberately ignorant of the `App` — it takes a label and a callback and
 * nothing else. So the sink is registered here instead of threaded through
 * every caller: the app hands it the bus on construction, and a button asks
 * for a click without knowing what makes one.
 *
 * With no sink registered — a unit test, a scene built before the app, the
 * sound setting off — this is a no-op.
 */

/** The cues a control can ask for. Each one is a row in `src/content/sounds.ts`. */
export type UiSound = 'tap' | 'confirm';

type Sink = (key: UiSound) => void;

let sink: Sink | null = null;

/** The app registers the bus here once. */
export function setUiSink(next: Sink | null): void {
  sink = next;
}

/** Plays an interface sound, if anything is listening. */
export function uiSound(key: UiSound): void {
  sink?.(key);
}
