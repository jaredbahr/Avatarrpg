import { describe, expect, it } from 'vitest';
import { PresentationClock } from './presentationClock';

describe('scene presentation clock', () => {
  it('starts at wall time and scales only elapsed presentation time', () => {
    const clock = new PresentationClock(1000);
    expect(clock.now(1100)).toBe(1100);
    clock.setRate(3, 1100);
    expect(clock.now(1200)).toBe(1400);
    expect(clock.now(1250)).toBe(1550);
  });

  it('changes speed continuously without jumping the presentation cursor', () => {
    const clock = new PresentationClock(0);
    clock.setRate(2, 200);
    const before = clock.now(300);
    clock.setRate(1, 300);
    expect(clock.now(300)).toBe(before);
    expect(clock.now(400)).toBe(before + 100);
  });

  it('freezes through pause and resumes without including wall time spent paused', () => {
    const clock = new PresentationClock(100);
    clock.setRate(3, 200);
    clock.pause(300);
    const stopped = clock.now(1000);
    expect(stopped).toBe(500);
    clock.setRate(2, 1000);
    expect(clock.now(2000)).toBe(stopped);
    clock.resume(2000);
    expect(clock.now(2100)).toBe(stopped + 200);
  });

  it('skip moves to a presentation deadline without running a command or moving backwards', () => {
    const clock = new PresentationClock(50);
    clock.setRate(2, 100);
    expect(clock.now(150)).toBe(200);
    clock.skipTo(400, 150);
    expect(clock.now(150)).toBe(400);
    clock.skipTo(300, 160);
    expect(clock.now(160)).toBe(420);
  });
});
