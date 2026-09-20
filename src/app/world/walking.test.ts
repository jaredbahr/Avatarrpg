import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { NextWalk, nearbyPlaces, previewWalk } from './walking';

function village() {
  const fresh = createGame(CONTENT, {
    seed: 'walk-feedback',
    party: [{ characterId: 'kaya', level: 1, autoChoose: true }],
    startNode: 'village_explore',
  });
  return apply(CONTENT, fresh, { type: 'enterNode', nodeId: 'village_explore' }).state;
}

describe('walking feedback', () => {
  it('uses the actual path without changing the game or consuming its RNG', () => {
    const state = village();
    const before = structuredClone(state);
    const target = { x: 14, y: 8 };
    const preview = previewWalk(CONTENT, state, target);
    const actual = apply(CONTENT, state, { type: 'walkTo', pos: target });
    const walk = actual.events.find((event) => event.type === 'partyWalked');
    expect(preview.path).toEqual(walk?.path);
    expect(preview.path.at(-1)).toEqual(target);
    expect(state).toEqual(before);
  });

  it('marks the first encounter rather than drawing a route past it', () => {
    const forest = apply(CONTENT, village(), { type: 'enterNode', nodeId: 'forest_explore' }).state;
    const state = { ...forest, location: { ...forest.location, pos: { x: 1, y: 4 } } };
    const preview = previewWalk(CONTENT, state, { x: 18, y: 4 });
    expect(preview.path.at(-1)?.x).toBe(4);
    expect(preview.label).toBe('The pine road');
    expect(preview.refusal).toBeNull();
  });

  it('approaches a person instead of promising a walk onto their tile', () => {
    const state = village();
    const preview = previewWalk(CONTENT, state, { x: 11, y: 5 });
    expect(preview.label).toBe('Elder Mira');
    expect(preview.path.at(-1)).not.toEqual({ x: 11, y: 5 });
    expect(preview.refusal).toBeNull();
  });

  it('reports blocked destinations and preserves an already queued valid walk', () => {
    const state = village();
    const queue = new NextWalk();
    queue.set(CONTENT, state, { x: 7, y: 7 });
    expect(queue.set(CONTENT, state, { x: 6, y: 1 }).refusal).toBe('You cannot walk there.');
    expect(queue.take(state)).toEqual({ x: 7, y: 7 });
    expect(queue.take(state)).toBeNull();
  });

  it('keeps only the latest destination and can cancel it', () => {
    const state = village();
    const queue = new NextWalk();
    queue.set(CONTENT, state, { x: 7, y: 7 });
    queue.set(CONTENT, state, { x: 9, y: 8 });
    expect(queue.preview(state)?.path.at(-1)).toEqual({ x: 9, y: 8 });
    queue.clear();
    expect(queue.take(state)).toBeNull();
  });

  it('discards stale intent after a conversation, map crossing, or loaded state', () => {
    const state = village();
    for (const changed of [
      apply(CONTENT, state, { type: 'walkTo', pos: { x: 11, y: 5 } }).state,
      apply(CONTENT, state, { type: 'walkTo', pos: { x: 23, y: 7 } }).state,
      structuredClone(state),
    ]) {
      const queue = new NextWalk();
      queue.set(CONTENT, state, { x: 7, y: 7 });
      expect(queue.preview(changed)).toBeNull();
      expect(queue.take(changed)).toBeNull();
    }
  });

  it('offers nearby side conversations without revealing another map', () => {
    const forest = apply(CONTENT, village(), { type: 'enterNode', nodeId: 'forest_explore' }).state;
    const state = { ...forest, location: { ...forest.location, pos: { x: 1, y: 4 } } };
    const before = structuredClone(state);
    expect(nearbyPlaces(CONTENT, state).map(({ npc }) => npc.id)).toContain('dema');
    expect(nearbyPlaces(CONTENT, state).some(({ npc }) => npc.id === 'rest_keeper')).toBe(false);
    expect(state).toEqual(before);
  });
});
