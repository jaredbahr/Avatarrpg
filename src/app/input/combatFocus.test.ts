import { describe, expect, it } from 'vitest';
import type { InputAction } from './actions';
import type { CombatInputState } from './combatFocus';
import { combatInput } from './combatFocus';

const base: CombatInputState = {
  opening: false,
  active: true,
  busy: false,
  playerTurn: true,
  handoff: false,
  zone: 'bar',
  mode: 'idle',
  moreOpen: false,
};
const state = (patch: Partial<CombatInputState>): CombatInputState => ({ ...base, ...patch });
const board = (patch: Partial<CombatInputState> = {}) => state({ zone: 'board', ...patch });

const everyAction: InputAction[] = [
  'up',
  'down',
  'left',
  'right',
  'confirm',
  'cancel',
  'next',
  'prev',
  'slot1',
  'endTurn',
  'inspect',
  'map',
  'zoomIn',
  'zoomOut',
  'recentre',
];

describe('combatInput gates', () => {
  it('always passes menu', () => {
    for (const s of [
      state({ opening: true }),
      state({ busy: true }),
      state({ active: false }),
      state({ playerTurn: false }),
    ])
      expect(combatInput('menu', false, s)).toBe('pass');
  });

  it('skips the opening on confirm or cancel and ignores the rest', () => {
    const s = state({ opening: true });
    expect(combatInput('confirm', false, s)).toBe('skipOpening');
    expect(combatInput('cancel', false, s)).toBe('skipOpening');
    expect(combatInput('confirm', true, s)).toBe('ignore');
    expect(combatInput('up', false, s)).toBe('ignore');
    expect(combatInput('zoomIn', false, s)).toBe('ignore');
  });

  it('passes everything when the fight is not active', () => {
    for (const a of everyAction)
      expect(combatInput(a, false, state({ active: false }))).toBe('pass');
  });

  it('zooms and recentres while active, even when busy', () => {
    for (const s of [base, state({ busy: true }), state({ playerTurn: false })]) {
      expect(combatInput('zoomIn', false, s)).toBe('zoomIn');
      expect(combatInput('zoomOut', false, s)).toBe('zoomOut');
      expect(combatInput('recentre', false, s)).toBe('recentre');
      expect(combatInput('map', false, s)).toBe('recentre');
    }
  });

  it('while busy skips playback on confirm, passes cancel, ignores the rest', () => {
    const s = state({ busy: true });
    expect(combatInput('confirm', false, s)).toBe('skipPlayback');
    expect(combatInput('cancel', false, s)).toBe('pass');
    expect(combatInput('up', false, s)).toBe('ignore');
    expect(combatInput('slot1', false, s)).toBe('ignore');
    expect(combatInput('endTurn', false, s)).toBe('ignore');
  });

  it('off the player turn ignores everything but cancel', () => {
    const s = state({ playerTurn: false });
    expect(combatInput('cancel', false, s)).toBe('pass');
    expect(combatInput('confirm', false, s)).toBe('ignore');
    expect(combatInput('down', false, s)).toBe('ignore');
  });

  it('passes everything during the hand-off', () => {
    for (const a of ['up', 'confirm', 'cancel', 'slot2', 'endTurn', 'next'] as const)
      expect(combatInput(a, false, state({ handoff: true }))).toBe('pass');
  });

  it('with More open, cancel closes it and everything else passes', () => {
    const s = state({ moreOpen: true });
    expect(combatInput('cancel', false, s)).toBe('cancel');
    expect(combatInput('confirm', false, s)).toBe('pass');
    expect(combatInput('down', false, s)).toBe('pass');
    expect(combatInput('slot1', false, s)).toBe('pass');
  });
});

describe('combatInput repeats', () => {
  it('never commits, cancels, slots or ends a turn on a repeat', () => {
    for (const a of ['confirm', 'cancel', 'slot1', 'endTurn', 'next', 'inspect'] as const) {
      expect(combatInput(a, true, board({ mode: 'aim' }))).toBe('ignore');
      expect(combatInput(a, true, base)).toBe('ignore');
    }
  });

  it('still moves the cursor on a repeated direction', () => {
    expect(combatInput('left', true, board())).toBe('cursor');
  });
});

describe('combatInput on the board', () => {
  it('moves, cycles and cancels', () => {
    for (const d of ['up', 'down', 'left', 'right'] as const)
      expect(combatInput(d, false, board())).toBe('cursor');
    expect(combatInput('next', false, board())).toBe('cycle');
    expect(combatInput('prev', false, board())).toBe('cycle');
    expect(combatInput('cancel', false, board())).toBe('cancel');
  });

  it('confirm commits while moving or aiming and inspects when idle', () => {
    expect(combatInput('confirm', false, board({ mode: 'move' }))).toBe('commit');
    expect(combatInput('confirm', false, board({ mode: 'aim' }))).toBe('commit');
    expect(combatInput('confirm', false, board({ mode: 'idle' }))).toBe('inspectCursor');
  });
});

describe('combatInput on the bar', () => {
  it('browses up, steps with next and prev, inspects the active button', () => {
    expect(combatInput('up', false, base)).toBe('browse');
    expect(combatInput('next', false, base)).toBe('barStep');
    expect(combatInput('prev', false, base)).toBe('barStep');
    expect(combatInput('inspect', false, base)).toBe('inspectActive');
  });

  it('passes cancel and focuses the bar for confirm and sideways moves', () => {
    expect(combatInput('cancel', false, base)).toBe('pass');
    expect(combatInput('confirm', false, base)).toBe('focusBar');
    expect(combatInput('left', false, base)).toBe('focusBar');
    expect(combatInput('right', false, base)).toBe('focusBar');
  });
});

describe('combatInput slots and end turn', () => {
  it('work from either zone', () => {
    for (const s of [base, board()]) {
      expect(combatInput('slot3', false, s)).toBe('slot');
      expect(combatInput('endTurn', false, s)).toBe('endTurn');
    }
  });
});
