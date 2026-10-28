import { describe, expect, it } from 'vitest';
import { ASSETS } from '../../content/assets/manifest';
import { portraitExpressionKey } from './portraitExpression';

describe('portraitExpressionKey', () => {
  it('uses a registered expression asset', () => {
    expect(
      portraitExpressionKey('portrait.kaya', 'angry', {
        'portrait.kaya': {},
        'portrait.kaya.angry': {},
      }),
    ).toBe('portrait.kaya.angry');
  });

  it('falls back to the neutral portrait when an expression is missing', () => {
    expect(portraitExpressionKey('portrait.gao', 'worried', { 'portrait.gao': {} })).toBe(
      'portrait.gao',
    );
    expect(portraitExpressionKey('portrait.gao', 'worried')).toBe('portrait.gao');
    expect('portrait.gao.worried' in ASSETS).toBe(false);
  });

  it('keeps neutral and non-portrait keys unchanged', () => {
    expect(portraitExpressionKey('portrait.kaya', undefined)).toBe('portrait.kaya');
    expect(portraitExpressionKey('unit.fire.kaya', 'warm', { 'unit.fire.kaya.warm': {} })).toBe(
      'unit.fire.kaya',
    );
  });
});
