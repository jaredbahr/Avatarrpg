import { describe, expect, it } from 'vitest';
import { GestureRecognizer } from './gestures';
import type { GestureHandlers, GestureScheduler } from './gestures';

/** A clock the test advances by hand, so a long press is a call, not a wait. */
class FakeScheduler implements GestureScheduler {
  private pending = new Map<number, { at: number; callback: () => void }>();
  private next = 1;
  now = 0;

  schedule(callback: () => void, ms: number): unknown {
    const handle = this.next++;
    this.pending.set(handle, { at: this.now + ms, callback });
    return handle;
  }

  cancel(handle: unknown): void {
    this.pending.delete(handle as number);
  }

  advance(ms: number): void {
    this.now += ms;
    for (const [handle, entry] of [...this.pending]) {
      if (entry.at <= this.now) {
        this.pending.delete(handle);
        entry.callback();
      }
    }
  }
}

interface Log {
  readonly events: string[];
  readonly handlers: GestureHandlers;
}

function record(): Log {
  const events: string[] = [];
  const point = (p: { x: number; y: number }) => `${p.x},${p.y}`;
  const handlers: GestureHandlers = {
    onTap: (p) => events.push(`tap ${point(p)}`),
    onLongPress: (p) => events.push(`long ${point(p)}`),
    onDragStart: (p) => events.push(`dragStart ${point(p)}`),
    onDrag: (d) => events.push(`drag ${point(d)}`),
    onDragEnd: (p) => events.push(`dragEnd ${point(p)}`),
    onPinchStart: (c) => events.push(`pinchStart ${point(c)}`),
    onPinch: (g) =>
      events.push(`pinch ${point(g.centre)} x${g.scale.toFixed(2)} step${g.step.toFixed(2)}`),
    onPinchEnd: () => events.push('pinchEnd'),
    onHover: (p) => events.push(p ? `hover ${point(p)}` : 'hover none'),
  };
  return { events, handlers };
}

const CONFIG = { dragThreshold: 10, longPressMs: 480 };

function setup() {
  const log = record();
  const clock = new FakeScheduler();
  const recognizer = new GestureRecognizer(log.handlers, CONFIG, clock);
  return { ...log, clock, recognizer };
}

describe('GestureRecognizer', () => {
  it('reports a press and release inside the threshold as a tap', () => {
    const { recognizer, events } = setup();
    recognizer.down(1, { x: 10, y: 10 });
    recognizer.move(1, { x: 14, y: 12 });
    recognizer.up(1, { x: 14, y: 12 });
    expect(events).toEqual(['tap 14,12']);
    expect(recognizer.state).toBe('idle');
  });

  it('turns travel beyond the threshold into a drag with no tap', () => {
    const { recognizer, events } = setup();
    recognizer.down(1, { x: 10, y: 10 });
    recognizer.move(1, { x: 15, y: 10 });
    recognizer.move(1, { x: 40, y: 10 });
    recognizer.move(1, { x: 50, y: 20 });
    recognizer.up(1, { x: 50, y: 20 });
    expect(events).toEqual(['dragStart 10,10', 'drag 25,0', 'drag 10,10', 'dragEnd 50,20']);
  });

  it('fires a long press while the finger is down and then suppresses the tap', () => {
    const { recognizer, events, clock } = setup();
    recognizer.down(1, { x: 20, y: 20 });
    clock.advance(479);
    expect(events).toEqual([]);
    clock.advance(1);
    expect(events).toEqual(['long 20,20']);
    recognizer.up(1, { x: 20, y: 20 });
    expect(events).toEqual(['long 20,20']);
  });

  it('cancels the long press once a drag starts', () => {
    const { recognizer, events, clock } = setup();
    recognizer.down(1, { x: 20, y: 20 });
    recognizer.move(1, { x: 60, y: 20 });
    clock.advance(1000);
    expect(events.some((e) => e.startsWith('long'))).toBe(false);
  });

  it('turns a second finger into a pinch that reports spread and centre travel', () => {
    const { recognizer, events } = setup();
    recognizer.down(1, { x: 100, y: 100 });
    recognizer.down(2, { x: 200, y: 100 });
    expect(events).toEqual(['pinchStart 150,100']);
    expect(recognizer.state).toBe('pinching');

    recognizer.move(2, { x: 300, y: 100 });
    expect(events.at(-1)).toBe('pinch 200,100 x2.00 step2.00');
    recognizer.move(1, { x: 150, y: 100 });
    expect(events.at(-1)).toBe('pinch 225,100 x1.50 step0.75');
  });

  it('keeps panning with the remaining finger after a pinch, and never taps', () => {
    const { recognizer, events } = setup();
    recognizer.down(1, { x: 100, y: 100 });
    recognizer.down(2, { x: 200, y: 100 });
    recognizer.up(2, { x: 200, y: 100 });
    expect(events.slice(-2)).toEqual(['pinchEnd', 'dragStart 100,100']);
    expect(recognizer.state).toBe('dragging');

    recognizer.move(1, { x: 101, y: 101 });
    expect(events.at(-1)).toBe('drag 1,1');
    recognizer.up(1, { x: 101, y: 101 });
    expect(events.at(-1)).toBe('dragEnd 101,101');
    expect(events.some((e) => e.startsWith('tap'))).toBe(false);
  });

  it('ignores a third finger', () => {
    const { recognizer, events } = setup();
    recognizer.down(1, { x: 0, y: 0 });
    recognizer.down(2, { x: 100, y: 0 });
    recognizer.down(3, { x: 50, y: 100 });
    recognizer.move(3, { x: 60, y: 100 });
    expect(events).toEqual(['pinchStart 50,0']);
  });

  it('reports hover for a mouse or pen but never for a finger', () => {
    const { recognizer, events } = setup();
    recognizer.move(7, { x: 5, y: 5 }, 'mouse');
    recognizer.move(8, { x: 6, y: 6 }, 'pen');
    recognizer.move(9, { x: 7, y: 7 }, 'touch');
    recognizer.leave('touch');
    recognizer.leave('mouse');
    expect(events).toEqual(['hover 5,5', 'hover 6,6', 'hover none']);
  });

  it('drops a cancelled pointer without a tap or a drag end', () => {
    const { recognizer, events, clock } = setup();
    recognizer.down(1, { x: 0, y: 0 });
    recognizer.cancel(1);
    clock.advance(1000);
    expect(events).toEqual([]);
    expect(recognizer.state).toBe('idle');
  });
});
