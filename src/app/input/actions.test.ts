import { describe, expect, it } from 'vitest';
import type { InputAction } from './actions';
import { directionVector, isDirection, keyAction, keyPan, slotIndex } from './actions';

const press = (code: string, mods: Record<string, boolean> = {}) => ({ code, key: code, ...mods });

describe('keyAction', () => {
  it('maps arrows and WASD to directions', () => {
    const table: [string, InputAction][] = [
      ['ArrowUp', 'up'],
      ['ArrowDown', 'down'],
      ['ArrowLeft', 'left'],
      ['ArrowRight', 'right'],
      ['KeyW', 'up'],
      ['KeyS', 'down'],
      ['KeyA', 'left'],
      ['KeyD', 'right'],
    ];
    for (const [code, action] of table) expect(keyAction(press(code))).toBe(action);
  });

  it('maps confirm, cancel and the cycle keys', () => {
    for (const code of ['Enter', 'NumpadEnter', 'Space'])
      expect(keyAction(press(code))).toBe('confirm');
    for (const code of ['Escape', 'Backspace']) expect(keyAction(press(code))).toBe('cancel');
    expect(keyAction(press('KeyE'))).toBe('next');
    expect(keyAction(press('KeyQ'))).toBe('prev');
  });

  it('maps digits and numpad digits to slots 1 to 9', () => {
    for (let n = 1; n <= 9; n += 1) {
      expect(keyAction(press(`Digit${n}`))).toBe(`slot${n}`);
      expect(keyAction(press(`Numpad${n}`))).toBe(`slot${n}`);
    }
  });

  it('maps the single-purpose keys', () => {
    const table: [string, InputAction][] = [
      ['KeyT', 'endTurn'],
      ['KeyF', 'inspect'],
      ['KeyM', 'map'],
      ['KeyP', 'menu'],
      ['Equal', 'zoomIn'],
      ['NumpadAdd', 'zoomIn'],
      ['Minus', 'zoomOut'],
      ['NumpadSubtract', 'zoomOut'],
      ['Digit0', 'recentre'],
    ];
    for (const [code, action] of table) expect(keyAction(press(code))).toBe(action);
  });

  it('never takes a key held with ctrl, alt or meta', () => {
    for (const mod of ['ctrlKey', 'altKey', 'metaKey'])
      for (const code of ['KeyT', 'ArrowUp', 'Enter', 'Digit1'])
        expect(keyAction(press(code, { [mod]: true }))).toBeNull();
  });

  it('leaves Shift+Arrow to the pan and ignores unmapped keys', () => {
    expect(keyAction(press('ArrowLeft', { shiftKey: true }))).toBeNull();
    expect(keyAction(press('KeyZ'))).toBeNull();
    expect(keyAction(press('Tab'))).toBeNull();
  });
});

describe('keyPan', () => {
  it('pans on Shift+Arrow and on I J K L', () => {
    expect(keyPan(press('ArrowUp', { shiftKey: true }))).toBe('up');
    expect(keyPan(press('ArrowRight', { shiftKey: true }))).toBe('right');
    expect(keyPan(press('KeyI'))).toBe('up');
    expect(keyPan(press('KeyK'))).toBe('down');
    expect(keyPan(press('KeyJ'))).toBe('left');
    expect(keyPan(press('KeyL'))).toBe('right');
  });

  it('does not pan on a plain arrow, a chord or another key', () => {
    expect(keyPan(press('ArrowUp'))).toBeNull();
    expect(keyPan(press('KeyI', { ctrlKey: true }))).toBeNull();
    expect(keyPan(press('KeyQ'))).toBeNull();
  });
});

describe('helpers', () => {
  it('slotIndex is zero-based and null for non-slots', () => {
    expect(slotIndex('slot1')).toBe(0);
    expect(slotIndex('slot3')).toBe(2);
    expect(slotIndex('slot9')).toBe(8);
    expect(slotIndex('confirm')).toBeNull();
    expect(slotIndex('up')).toBeNull();
  });

  it('isDirection is true only for the four directions', () => {
    for (const d of ['up', 'down', 'left', 'right'] as const) expect(isDirection(d)).toBe(true);
    expect(isDirection('confirm')).toBe(false);
    expect(isDirection('slot1')).toBe(false);
  });

  it('directionVector has y pointing down', () => {
    expect(directionVector('up')).toEqual({ x: 0, y: -1 });
    expect(directionVector('down')).toEqual({ x: 0, y: 1 });
    expect(directionVector('left')).toEqual({ x: -1, y: 0 });
    expect(directionVector('right')).toEqual({ x: 1, y: 0 });
  });
});
