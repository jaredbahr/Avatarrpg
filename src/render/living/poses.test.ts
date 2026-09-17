import { describe, expect, it } from 'vitest';
import { FORM_DURATION, formBeat } from './poses';

describe('bending beats', () => {
  it('gathers before release and settles the feet and light completely', () => {
    for (const water of [true, false]) {
      expect(formBeat(0, water)).toMatchObject({ release: 0, weight: 0, energy: 0 });
      const gather = formBeat(FORM_DURATION * 0.35, water);
      expect(gather.gather).toBeGreaterThan(0.5);
      expect(gather.release).toBe(0);
      expect(gather.frame).toBe(0);
      const release = formBeat(FORM_DURATION * 0.6, water);
      expect(release.frame).toBe(1);
      expect(release.release).toBeCloseTo(1);
      expect(release.weight).toBeGreaterThan(0);
      expect(formBeat(FORM_DURATION, water)).toMatchObject({ weight: 0, energy: 0, recover: 1 });
    }
  });
  it('gives water a longer flowing release and fire a sharp snap', () => {
    const elapsed = FORM_DURATION * 0.53;
    expect(formBeat(elapsed, false).release).toBeGreaterThan(formBeat(elapsed, true).release);
  });
});
