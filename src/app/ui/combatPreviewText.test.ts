import { describe, expect, it } from 'vitest';
import { formatShoveMovement } from './combatPreviewText';

describe('combat preview text', () => {
  it('inflects push and pull in the named movement sentence', () => {
    expect(formatShoveMovement('Mercenary', 'push', '(12,5)')).toBe('Mercenary: pushes to (12,5)');
    expect(formatShoveMovement('Mercenary', 'pull', '(12,5)')).toBe('Mercenary: pulls to (12,5)');
  });
});
