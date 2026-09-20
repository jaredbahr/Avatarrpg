import { describe, expect, it } from 'vitest';
import {
  FORM_DURATION,
  WAVE_DURATION,
  drawingTime,
  formBeat,
  waveDrawing,
  villagePose,
} from './poses';
import { poseFor } from '../painters/figure';

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
  it('extinguishes the attached fire while embers still have energy', () => {
    const beat = formBeat(FORM_DURATION * 0.73, false);
    expect(beat.plume).toBe(0);
    expect(beat.energy).toBeGreaterThan(0);
    expect(formBeat(FORM_DURATION, true).plume).toBe(0);
  });
  it('returns both procedural forms to rest without residual pose offsets', () => {
    for (const motion of ['water', 'fire'] as const) {
      expect(villagePose(motion, 0)).toEqual(poseFor('idle', 0));
      expect(villagePose(motion, FORM_DURATION)).toEqual(poseFor('idle', 0));
    }
  });
  it('holds the same drawing across different display refresh rates', () => {
    expect(drawingTime(1000)).toBe(drawingTime(1040));
    expect(drawingTime(1084)).toBeGreaterThan(drawingTime(1040));
    expect(drawingTime(-1)).toBe(0);
  });
  it('lowers the arm at both ends of a greeting', () => {
    expect(waveDrawing(0).clip).toBe('idle');
    expect(waveDrawing(300)).toEqual({ clip: 'wave', frame: 0 });
    expect(waveDrawing(700)).toEqual({ clip: 'wave', frame: 1 });
    expect(waveDrawing(1850)).toEqual({ clip: 'wave', frame: 0 });
    expect(waveDrawing(WAVE_DURATION - 1).clip).toBe('idle');
  });
});
