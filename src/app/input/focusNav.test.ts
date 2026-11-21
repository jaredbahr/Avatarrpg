import { describe, expect, it } from 'vitest';
import type { Box } from './focusNav';
import { nextFocusIndex } from './focusNav';

const box = (left: number, top: number, w = 100, h = 40): Box => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
});

describe('nextFocusIndex', () => {
  const column = [box(0, 0), box(0, 60), box(0, 120)];

  it('walks down and up a vertical column', () => {
    expect(nextFocusIndex(column, 0, 'down')).toBe(1);
    expect(nextFocusIndex(column, 1, 'down')).toBe(2);
    expect(nextFocusIndex(column, 2, 'up')).toBe(1);
    expect(nextFocusIndex(column, 1, 'up')).toBe(0);
  });

  it('returns null at the end of the column', () => {
    expect(nextFocusIndex(column, 2, 'down')).toBeNull();
    expect(nextFocusIndex(column, 0, 'up')).toBeNull();
    expect(nextFocusIndex(column, 0, 'left')).toBeNull();
    expect(nextFocusIndex(column, 0, 'right')).toBeNull();
  });

  it('walks along a row with left and right', () => {
    const row = [box(0, 0), box(120, 0), box(240, 0)];
    expect(nextFocusIndex(row, 0, 'right')).toBe(1);
    expect(nextFocusIndex(row, 1, 'right')).toBe(2);
    expect(nextFocusIndex(row, 2, 'left')).toBe(1);
    expect(nextFocusIndex(row, 2, 'right')).toBeNull();
  });

  it('prefers a box straight ahead over a nearer one off to the side', () => {
    const boxes = [box(0, 0), box(150, 50), box(0, 200)];
    expect(nextFocusIndex(boxes, 0, 'down')).toBe(2);
  });

  it('still reaches a row below and far to the side', () => {
    const boxes = [box(0, 0), box(400, 80), box(520, 80)];
    expect(nextFocusIndex(boxes, 0, 'down')).toBe(1);
  });

  it('never leaps from the end of a row to a far corner with left or right', () => {
    // Next at the foot of the screen, Pause in the top corner beyond it.
    const boxes = [box(800, 820), box(1270, 10)];
    expect(nextFocusIndex(boxes, 0, 'right')).toBeNull();
    expect(nextFocusIndex(boxes, 0, 'up')).toBe(1);
  });

  it('returns null for an unknown from index', () => {
    expect(nextFocusIndex(column, 7, 'down')).toBeNull();
    expect(nextFocusIndex([], 0, 'down')).toBeNull();
  });
});
