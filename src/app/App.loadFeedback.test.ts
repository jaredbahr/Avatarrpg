import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../content';
import { RIVERSIDE_ENTRY } from '../content/maps/riverside';
import { createGame } from '../core/state/createGame';
import { apply } from '../core/state/reducer';
import { App } from './App';
import { Session } from './session';

function explore(seed: string) {
  const fresh = createGame(CONTENT, {
    seed,
    party: [{ characterId: 'kaya' }],
    startNode: RIVERSIDE_ENTRY,
  });
  return apply(CONTENT, fresh, { type: 'enterNode', nodeId: RIVERSIDE_ENTRY }).state;
}

describe('feedback when a save replaces the game', () => {
  it('retires discarded feedback before presenting the loaded world and its confirmation', () => {
    const discarded = explore('discarded-feedback');
    const saved = explore('loaded-feedback');
    const visible = ['Morning arrives.', 'Needs 2 AP, has 1'];
    const app = Object.create(App.prototype) as App;
    const dismissedStates: unknown[] = [];
    const toasts = {
      clear: vi.fn(() => {
        // A toast's owner can be notified on dismissal. It must still see the
        // old game, rather than applying a callback against the loaded save.
        dismissedStates.push(app.state);
        visible.length = 0;
      }),
      show: vi.fn((text: string) => visible.push(text)),
    };
    const routeToState = vi.fn(() => toasts.show('Loaded world feedback'));
    Object.assign(app, {
      content: CONTENT,
      state: discarded,
      session: new Session(),
      previewSnapshot: null,
      routeTimer: null,
      animator: { clear: vi.fn() },
      audio: { close: vi.fn(), unlock: vi.fn() },
      residents: { reset: vi.fn() },
      dismissRewardDialog: vi.fn(),
      closePause: vi.fn(),
      routeToState,
      offerLevelUpIfPending: vi.fn(),
      toasts,
    });

    app.adoptSave(saved, undefined);

    expect(dismissedStates).toEqual([discarded]);
    expect(app.state).toEqual(saved);
    expect(visible).toEqual(['Loaded world feedback', 'Game loaded.']);
    expect(routeToState).toHaveBeenCalledWith(true);
    expect(app.offerLevelUpIfPending).toHaveBeenCalledOnce();
    toasts.show('Fresh feedback');
    expect(visible).toEqual(['Loaded world feedback', 'Game loaded.', 'Fresh feedback']);
  });
});
