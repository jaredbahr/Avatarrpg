/**
 * The scale chart holds (ADR 0119): every prop placed on a top-down map that the chart governs is
 * drawn within its slack of its target height, so a barrel never reads as large as a person.
 */
import { describe, expect, it } from 'vitest';
import { BA_DAN_TOPDOWN_OBJECTS } from '../../../src/content/scenes/baDan.topdown';
import { scaleOutliers } from './scale-chart';

describe('the scale chart', () => {
  it('holds every prop placed in Ba Dan to its target height', () => {
    const props = BA_DAN_TOPDOWN_OBJECTS.filter((o) => o.kind === 'prop').map((o) => o.sprite);
    expect(scaleOutliers(props)).toEqual([]);
  });

  it('names a sprite drawn too large for what it is', () => {
    // v12's single sack is drawn 28 px tall, more than half a person
    expect(scaleOutliers(['sack'])).toEqual(['"sack" is 0.61 persons tall, its target 0.45']);
  });
});
