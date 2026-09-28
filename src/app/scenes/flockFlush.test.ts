import { expect, it } from 'vitest';
import { FLUSH_DELAY_MS, flushTime } from './flockFlush';

const fresh = { round: 1, turnIndex: 0 };

it('flushes a fresh fight once, after the opening beat', () => {
  expect(flushTime(null, fresh, false, 5000)).toBe(5000 + FLUSH_DELAY_MS);
  // Armed once: later frames of the same opening turn keep the first time.
  expect(flushTime(5700, fresh, false, 9000)).toBe(5700);
});

it('waits for the hand-off card to lift before the birds go', () => {
  expect(flushTime(null, fresh, true, 5000)).toBeNull();
  expect(flushTime(null, fresh, false, 8000)).toBe(8000 + FLUSH_DELAY_MS);
});

it('stays quiet for a fight picked up mid-way', () => {
  expect(flushTime(null, { round: 1, turnIndex: 2 }, false, 5000)).toBeNull();
  expect(flushTime(null, { round: 3, turnIndex: 0 }, false, 5000)).toBeNull();
});
