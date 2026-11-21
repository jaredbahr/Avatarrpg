import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionEvent } from './actions';
import { InputRouter } from './InputRouter';

/**
 * The router against a stubbed page: no dialog, a scene that takes every
 * action, and one synthetic pad the test reads by hand. Frames are driven by
 * calling the poll the router queued, at the time the test says.
 */
describe('InputRouter held direction from a pad', () => {
  let frame: (() => void) | null = null;
  let clock = 0;
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const routed: ActionEvent[] = [];

  function tick(at: number): void {
    clock = at;
    const run = frame;
    frame = null;
    run?.();
  }

  function setRight(down: boolean): void {
    const button = buttons[15];
    if (!button) throw new Error('no d-pad right');
    button.pressed = down;
    button.value = down ? 1 : 0;
  }

  beforeEach(() => {
    frame = null;
    clock = 0;
    routed.length = 0;
    setRight(false);
    const pad = { id: 'Xbox pad', index: 0, connected: true, axes: [0, 0, 0, 0], buttons };
    vi.stubGlobal('navigator', { maxTouchPoints: 0, getGamepads: () => [pad] });
    vi.stubGlobal('document', {
      documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } },
      querySelectorAll: () => [],
      addEventListener() {},
    });
    vi.stubGlobal('window', { addEventListener() {}, setInterval: () => 1, clearInterval() {} });
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => {
      frame = run;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function router(): InputRouter {
    const sceneHost = { lastElementChild: null, querySelectorAll: () => [] };
    const input = new InputRouter({
      sceneHost: sceneHost as unknown as HTMLElement,
      sceneAction: (event) => {
        routed.push(event);
        return true;
      },
      sceneHints: () => null,
      openMenu: () => false,
    });
    input.start();
    return input;
  }

  it('reads a tap seen by one poll as one press, however slow the next frame', () => {
    const input = router();
    tick(0);
    setRight(true);
    tick(1000);
    setRight(false);
    expect(routed).toEqual([{ action: 'right', device: 'gamepad', repeat: false }]);
    // The scene's frame asks before the pad is read again, 700 ms on: still a tap.
    expect(input.heldDirection(1700)).toBeNull();
    tick(1700);
    expect(input.heldDirection(1700)).toBeNull();
  });

  it('walks on once the reads have seen the direction down for the hold time', () => {
    const input = router();
    tick(0);
    setRight(true);
    tick(1000);
    tick(1200);
    expect(input.heldDirection(1250)).toBeNull();
    tick(1300);
    expect(input.heldDirection(1300)).toBe('right');
    setRight(false);
    tick(1316);
    expect(input.heldDirection(1316)).toBeNull();
  });
});
