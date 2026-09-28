import { describe, expect, it } from 'vitest';
import { savedWhen, slotLines } from './slotText';

describe('save slot text', () => {
  it('names the place once and counts the party', () => {
    expect(slotLines('Ba Dan — level 1 — Kaya, Sura, Bo, Nima, Wen, Jinu')).toEqual({
      place: 'Ba Dan',
      detail: 'Level 1 · 6 companions',
    });
    expect(slotLines('The Cutting — level 4 — Kaya')?.detail).toBe('Level 4 · 1 companion');
  });

  it('leaves a summary it did not write alone', () => {
    expect(slotLines('Damaged bridge')).toBeNull();
    expect(slotLines('Empty')).toBeNull();
  });

  it('says when relative to today, without seconds', () => {
    const now = new Date(2026, 8, 27, 15, 0).getTime();
    const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 33, 14).getTime();
    const time = new Date(at(27, 12)).toLocaleTimeString(undefined, { timeStyle: 'short' });
    expect(savedWhen(at(27, 12), now)).toBe(`Today, ${time}`);
    expect(savedWhen(at(26, 12), now)).toBe(`Yesterday, ${time}`);
    expect(savedWhen(at(20, 12), now)).toMatch(/^[^,]*20[^,]*, /);
    expect(savedWhen(at(27, 12), now)).not.toContain(':14');
    const lastYear = new Date(2025, 8, 20, 12, 33).getTime();
    expect(savedWhen(lastYear, now)).toContain('2025');
  });
});
