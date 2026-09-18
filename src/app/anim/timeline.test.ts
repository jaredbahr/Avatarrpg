import { smoothPath } from '../../render/geometry/curve';
import { describe, expect, it } from 'vitest';
import { linear } from './easing';
import { Timeline } from './timeline';
import type { FloaterTrack, PoseTrack } from './timeline';

const floater = (start: number, duration: number): FloaterTrack => ({
  kind: 'floater',
  pos: { x: 0, y: 0 },
  text: '1',
  color: '#fff',
  start,
  duration,
});

const pose = (start: number, duration: number, unitId = 'p0'): PoseTrack => ({
  kind: 'pose',
  unitId,
  clip: 'cast',
  offset: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
  ease: linear,
  start,
  duration,
});

describe('Timeline', () => {
  it('ends when its last track does, or later if told to hold', () => {
    const t = new Timeline();
    expect(t.busy(0)).toBe(false);
    t.add(floater(100, 300));
    t.add(pose(200, 50));
    expect(t.finishesAt).toBe(400);
    expect(t.busy(399)).toBe(true);
    expect(t.busy(400)).toBe(false);
    t.holdUntil(600);
    expect(t.finishesAt).toBe(600);
    t.holdUntil(100);
    expect(t.finishesAt).toBe(600);
  });

  it('reports only the tracks of a kind that are live', () => {
    const t = new Timeline();
    t.add(floater(100, 300));
    t.add(pose(200, 50));
    t.add(pose(500, 50, 'p1'));
    expect(t.active(150, 'floater')).toHaveLength(1);
    expect(t.active(150, 'pose')).toHaveLength(0);
    expect(t.active(225, 'pose').map((p) => p.unitId)).toEqual(['p0']);
    expect(t.active(520, 'pose').map((p) => p.unitId)).toEqual(['p1']);
  });

  it('prunes finished tracks and keeps the rest', () => {
    const t = new Timeline();
    t.add(floater(0, 100));
    t.add(floater(50, 100));
    t.prune(120);
    expect(t.active(140, 'floater')).toHaveLength(1);
  });

  it('clamps progress to 0..1', () => {
    const track = floater(100, 200);
    expect(Timeline.progress(track, 50)).toBe(0);
    expect(Timeline.progress(track, 200)).toBe(0.5);
    expect(Timeline.progress(track, 900)).toBe(1);
  });

  it('starts over after clear', () => {
    const t = new Timeline();
    t.add(floater(0, 100));
    t.clear();
    expect(t.busy(10)).toBe(false);
    expect(t.finishesAt).toBe(0);
  });
});

it('finds the earliest future movement by unit and ignores active/completed tracks', () => {
  const t = new Timeline();
  const curve = smoothPath({ x: 1, y: 1 }, [{ x: 2, y: 1 }]);
  t.add({ kind: 'move', unitId: 'p', start: 500, duration: 100, ease: linear, curve });
  t.add({ kind: 'move', unitId: 'other', start: 100, duration: 100, ease: linear, curve });
  t.add({ kind: 'move', unitId: 'p', start: 200, duration: 100, ease: linear, curve });
  expect(t.nextMove(0, 'p')?.start).toBe(200);
  expect(t.nextMove(200, 'p')?.start).toBe(500);
  t.prune(400);
  expect(t.nextMove(400, 'p')?.start).toBe(500);
  expect(t.nextMove(500, 'p')).toBeUndefined();
  t.clear();
  expect(t.nextMove(0, 'p')).toBeUndefined();
});
