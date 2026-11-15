/**
 * What an action does in a fight, by where the fight is (ADR 0112 §4, §7).
 *
 * The decision is kept apart from `CombatScene` so the focus graph (the action
 * bar, the board, and the moments neither takes input) can be tested without a
 * canvas. The scene supplies the facts and carries out the effect.
 */

import type { InputAction } from './actions';
import { isDirection, slotIndex } from './actions';

export interface CombatInputState {
  /** The establishing view is still holding. */
  readonly opening: boolean;
  /** The fight is running: not the victory beat, not a result card. */
  readonly active: boolean;
  /** Events are playing back; taps are ignored here too. */
  readonly busy: boolean;
  readonly playerTurn: boolean;
  /** The hand-off card is up and must be answered first. */
  readonly handoff: boolean;
  /** Where directions go: the action bar, or the board cursor. */
  readonly zone: 'bar' | 'board';
  readonly mode: 'idle' | 'move' | 'aim';
  /** The header's More list is open. */
  readonly moreOpen: boolean;
}

export type CombatEffect =
  /** Not the scene's: the router moves focus, presses a control, or opens the pause menu. */
  | 'pass'
  /** Swallowed: nothing may act now. */
  | 'ignore'
  | 'skipOpening'
  | 'skipPlayback'
  | 'zoomIn'
  | 'zoomOut'
  | 'recentre'
  /** Move the board cursor one legal tile. */
  | 'cursor'
  /** Step to the next or previous legal tile. */
  | 'cycle'
  /** Back out one step. */
  | 'cancel'
  /** Press the forecast's Confirm. */
  | 'commit'
  | 'inspectCursor'
  | 'inspectActive'
  /** Up from the action bar: look over the board with the cursor. */
  | 'browse'
  /** Next or previous action-bar button. */
  | 'barStep'
  | 'slot'
  | 'endTurn'
  /** Restore lost focus to the action bar; with focus in place, the same as `pass`. */
  | 'focusBar';

export function combatInput(
  action: InputAction,
  repeat: boolean,
  state: CombatInputState,
): CombatEffect {
  if (action === 'menu') return 'pass';
  if (state.opening)
    return !repeat && (action === 'confirm' || action === 'cancel') ? 'skipOpening' : 'ignore';
  // The victory beat and the result card are ordinary controls.
  if (!state.active) return 'pass';

  if (action === 'zoomIn' || action === 'zoomOut') return action;
  if (action === 'recentre' || action === 'map') return 'recentre';
  if (state.moreOpen) return action === 'cancel' && !repeat ? 'cancel' : 'pass';

  // As with taps: nothing acts during playback, and confirm skips to its end.
  if (state.busy) {
    if (action === 'confirm') return repeat ? 'ignore' : 'skipPlayback';
    return action === 'cancel' ? 'pass' : 'ignore';
  }
  if (!state.playerTurn) return action === 'cancel' ? 'pass' : 'ignore';
  if (state.handoff) return 'pass';

  const direction = isDirection(action);
  // Only movement repeats; a held button never commits, cancels or ends a turn.
  if (repeat && !direction) return 'ignore';
  if (slotIndex(action) !== null) return 'slot';
  if (action === 'endTurn') return 'endTurn';

  if (state.zone === 'board') {
    if (direction) return 'cursor';
    if (action === 'next' || action === 'prev') return 'cycle';
    if (action === 'confirm') return state.mode === 'idle' ? 'inspectCursor' : 'commit';
    if (action === 'inspect') return 'inspectCursor';
    return 'cancel';
  }

  if (action === 'up') return 'browse';
  if (action === 'next' || action === 'prev') return 'barStep';
  if (action === 'inspect') return 'inspectActive';
  if (action === 'cancel') return 'pass';
  return 'focusBar';
}
