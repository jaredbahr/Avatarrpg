import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { DEFAULT_TILE, withSurface } from './grid';
import type { Grid } from '../types';
import {
  obscurementMissLine,
  obscuringTiles,
  weatherChipShortText,
  weatherChipText,
} from './obscurementPresentation';

describe('obscurement presentation', () => {
  it('selects only tiles whose surface definition obscures', () => {
    const base: Grid = {
      width: 3,
      height: 2,
      tiles: Array.from({ length: 6 }, () => ({ ...DEFAULT_TILE })),
    };
    const grid = withSurface(
      withSurface(base, { x: 1, y: 0 }, { id: 'steam', duration: 2, spread: 0 }),
      { x: 1, y: 1 },
      { id: 'water', duration: 2, spread: 0 },
    );
    expect(obscuringTiles(CONTENT, grid)).toEqual([{ x: 1, y: 0 }]);
  });

  it('builds weather text from the active tuning rung', () => {
    expect(weatherChipText(CONTENT.tuning, 0)).toBeNull();
    expect(weatherChipText(CONTENT.tuning, 2)).toBe(
      `Sandstorm · long shots −${CONTENT.tuning.weather[2]!.perTile}/tile`,
    );
    expect(weatherChipShortText(CONTENT.tuning, 0)).toBeNull();
    expect(weatherChipShortText(CONTENT.tuning, 2)).toBe(
      `Sand: long shots −${CONTENT.tuning.weather[2]!.perTile}/tile`,
    );
  });

  it('chooses the miss sentence from the applied terms', () => {
    expect(
      obscurementMissLine({ inside: -25, through: 0, attacker: 0, weather: 0, total: -25 }),
    ).toBe('Lost in the steam.');
    expect(
      obscurementMissLine({ inside: 0, through: 0, attacker: 0, weather: -10, total: -10 }),
    ).toBe('The sand takes it.');
    expect(
      obscurementMissLine({ inside: -25, through: 0, attacker: 0, weather: -10, total: -35 }),
    ).toBe('Lost in the steam.');
    expect(
      obscurementMissLine({ inside: -5, through: 0, attacker: 0, weather: -10, total: -15 }),
    ).toBe('The sand takes it.');
    expect(
      obscurementMissLine({ inside: -10, through: 0, attacker: 0, weather: -10, total: -20 }),
    ).toBe('Lost in the steam.');
    expect(
      obscurementMissLine({ inside: 0, through: 0, attacker: 0, weather: 0, total: 0 }),
    ).toBeNull();
  });
});
