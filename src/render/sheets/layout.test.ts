import { describe, expect, it } from 'vitest';
import { frameName, layoutSheet } from './layout';

describe('layoutSheet', () => {
  it('lays poses out row-major in clip order and names them as the ADR says', () => {
    const sheet = layoutSheet('unit.x', { cast: 3, idle: 2 }, 128, 192);
    expect([...sheet.frames.keys()]).toEqual([
      'unit.x/idle/0',
      'unit.x/idle/1',
      'unit.x/cast/0',
      'unit.x/cast/1',
      'unit.x/cast/2',
    ]);
    expect(sheet.frames.get('unit.x/cast/0')).toEqual({ x: 256, y: 0, w: 128, h: 192 });
    expect(sheet.width).toBe(640);
    expect(sheet.height).toBe(192);
    expect(sheet.clips.cast).toEqual(['unit.x/cast/0', 'unit.x/cast/1', 'unit.x/cast/2']);
    expect(frameName('unit.x', 'ko', 0)).toBe('unit.x/ko/0');
  });

  it('wraps to a new row at the atlas width and rounds the height to whole frames', () => {
    const sheet = layoutSheet('u', { idle: 2, walk: 4, cast: 3 }, 256, 384, 1024);
    // Four frames a row: nine frames take three rows.
    expect(sheet.width).toBe(1024);
    expect(sheet.height).toBe(3 * 384);
    expect(sheet.frames.get('u/cast/2')).toEqual({ x: 0, y: 768, w: 256, h: 384 });
  });

  it('refuses what cannot fit', () => {
    expect(() => layoutSheet('u', { idle: 2 }, 4096, 192)).toThrow(/does not fit/);
    expect(() => layoutSheet('u', { idle: 2, walk: 4 }, 2048, 2048)).toThrow(/may be/);
  });
});
