import { describe, expect, it } from 'vitest';
import type { PadSnapshot } from './gamepad';
import {
  PAD_BUTTONS,
  PAD_REPEAT_DELAY_MS,
  PAD_REPEAT_EVERY_MS,
  PadReader,
  padDirection,
  padFamily,
  padPan,
  padZoom,
} from './gamepad';

function pad(buttons: Record<number, number> = {}, axes: Record<number, number> = {}): PadSnapshot {
  const b = Array.from({ length: 17 }, (_, i) => buttons[i] ?? 0);
  const a = Array.from({ length: 4 }, (_, i) => axes[i] ?? 0);
  return { buttons: b, axes: a };
}

describe('PadReader buttons', () => {
  it('fires once on the frame a button goes down, not while held', () => {
    const reader = new PadReader();
    reader.step(pad(), 0);
    expect(reader.step(pad({ 0: 1 }), 16)).toEqual([{ action: 'confirm', repeat: false }]);
    expect(reader.step(pad({ 0: 1 }), 32)).toEqual([]);
    expect(reader.step(pad(), 48)).toEqual([]);
    expect(reader.step(pad({ 0: 1 }), 64)).toEqual([{ action: 'confirm', repeat: false }]);
  });

  it('ignores buttons already down on the first frame', () => {
    const reader = new PadReader();
    expect(reader.step(pad({ 0: 1, 12: 1 }), 0)).toEqual([]);
    expect(reader.step(pad({ 0: 1, 12: 1 }), 16)).toEqual([]);
  });

  it('maps the shoulders and face buttons by position', () => {
    expect(PAD_BUTTONS[0]).toBe('confirm');
    expect(PAD_BUTTONS[1]).toBe('cancel');
    expect(PAD_BUTTONS[4]).toBe('prev');
    expect(PAD_BUTTONS[5]).toBe('next');
    expect(PAD_BUTTONS[9]).toBe('menu');
  });
});

describe('PadReader directions', () => {
  it('presses once, then repeats after the delay and every interval', () => {
    const reader = new PadReader();
    reader.step(pad(), 0);
    expect(reader.step(pad({ 15: 1 }), 100)).toEqual([{ action: 'right', repeat: false }]);
    expect(reader.held).toBe('right');
    expect(reader.step(pad({ 15: 1 }), 100 + PAD_REPEAT_DELAY_MS - 1)).toEqual([]);
    const first = 100 + PAD_REPEAT_DELAY_MS;
    expect(reader.step(pad({ 15: 1 }), first)).toEqual([{ action: 'right', repeat: true }]);
    expect(reader.step(pad({ 15: 1 }), first + PAD_REPEAT_EVERY_MS - 1)).toEqual([]);
    expect(reader.step(pad({ 15: 1 }), first + PAD_REPEAT_EVERY_MS)).toEqual([
      { action: 'right', repeat: true },
    ]);
  });

  it('stops repeating on release and clears held', () => {
    const reader = new PadReader();
    reader.step(pad(), 0);
    reader.step(pad({ 12: 1 }), 10);
    expect(reader.step(pad(), 20)).toEqual([]);
    expect(reader.held).toBeNull();
    expect(reader.step(pad(), 10 + PAD_REPEAT_DELAY_MS + 1000)).toEqual([]);
  });

  it('reads the left stick like the d-pad', () => {
    const reader = new PadReader();
    reader.step(pad(), 0);
    expect(reader.step(pad({}, { 1: -0.9 }), 10)).toEqual([{ action: 'up', repeat: false }]);
    expect(reader.held).toBe('up');
  });

  it('has hysteresis on the stick: on past 0.6, held down to 0.4', () => {
    expect(padDirection(pad({}, { 0: 0.5 }), null)).toBeNull();
    expect(padDirection(pad({}, { 0: 0.7 }), null)).toBe('right');
    expect(padDirection(pad({}, { 0: 0.5 }), 'right')).toBe('right');
    expect(padDirection(pad({}, { 0: 0.3 }), 'right')).toBeNull();
    expect(padDirection(pad({}, { 0: -0.5 }), 'right')).toBeNull();
  });

  it('picks the dominant stick axis and lets the d-pad win', () => {
    expect(padDirection(pad({}, { 0: 0.7, 1: 0.9 }), null)).toBe('down');
    expect(padDirection(pad({ 14: 1 }, { 0: 0.9 }), null)).toBe('left');
  });
});

describe('padPan and padZoom', () => {
  it('pans from axes 2 and 3 with a dead zone', () => {
    expect(padPan(pad({}, { 2: 0.1, 3: -0.15 }))).toEqual({ x: 0, y: 0 });
    expect(padPan(pad({}, { 2: 0.8, 3: -0.5 }))).toEqual({ x: 0.8, y: -0.5 });
  });

  it('zooms with right trigger minus left trigger', () => {
    expect(padZoom(pad({ 7: 1 }))).toBe(1);
    expect(padZoom(pad({ 6: 1 }))).toBe(-1);
    expect(padZoom(pad({ 6: 1, 7: 1 }))).toBe(0);
    expect(padZoom(pad({ 7: 0.1 }))).toBe(0);
  });
});

describe('padFamily', () => {
  it('recognises PlayStation, Nintendo and defaults to xbox', () => {
    expect(padFamily('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(
      padFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'),
    ).toBe('playstation');
    expect(padFamily('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe(
      'nintendo',
    );
    expect(padFamily('Mystery Pad 3000')).toBe('xbox');
  });
});
