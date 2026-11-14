import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from '../App';
import { PartySetupScene } from './PartySetupScene';

class FakeElement {
  value = '';
  textContent = '';
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, EventListener>();

  constructor(readonly tag: string) {}

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  setAttribute(): void {}

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener);
  }

  fire(type: string, event: Event): void {
    this.listeners.get(type)?.(event);
  }

  find(predicate: (element: FakeElement) => boolean): FakeElement | undefined {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const match = child.find(predicate);
      if (match) return match;
    }
    return undefined;
  }
}

class FakeInput extends FakeElement {}
class FakeButton extends FakeElement {}

interface NameScene {
  people: { name: string }[];
  heroes: { ownerIndex: number; element: null; characterId: null }[];
  phase: 'names' | 'heroes';
  current: number;
  resumeHeroIndex: number | null;
  playerCount: number;
  goBack(): void;
  step: string;
  render: ReturnType<typeof vi.fn>;
  renderName(panel: HTMLElement): void;
}

function nameForm() {
  vi.stubGlobal('HTMLInputElement', FakeInput);
  vi.stubGlobal('HTMLButtonElement', FakeButton);
  vi.stubGlobal('document', {
    createElement: (tag: string) =>
      tag === 'input'
        ? new FakeInput(tag)
        : tag === 'button'
          ? new FakeButton(tag)
          : new FakeElement(tag),
  });
  vi.stubGlobal('window', { setTimeout: vi.fn() });

  const scene = new PartySetupScene({} as App) as unknown as NameScene;
  scene.people = [{ name: 'Player 1' }];
  scene.heroes = [{ ownerIndex: 0, element: null, characterId: null }];
  scene.phase = 'names';
  scene.current = 0;
  scene.resumeHeroIndex = null;
  scene.playerCount = 1;
  scene.step = 'name';
  scene.render = vi.fn();
  const panel = new FakeElement('div');
  scene.renderName(panel as unknown as HTMLElement);
  const input = panel.find((element) => element.tag === 'input');
  const next = panel.find((element) => element.tag === 'button' && element.textContent === 'Next');
  if (!input || !next) throw new Error('The name form must provide its input and Next button.');
  return { scene, panel, input, next };
}

function enter(isComposing: boolean): KeyboardEvent {
  return { key: 'Enter', isComposing, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

afterEach(() => vi.unstubAllGlobals());

it.each([
  ['  明  ', '明'],
  ['   ', 'Player 1'],
])('keeps composition Enter in the name form before submitting %j normally', (typed, expected) => {
  const { scene, panel, input } = nameForm();
  input.value = typed;
  input.fire('input', { target: input } as unknown as Event);
  const compositionEnter = enter(true);

  input.fire('keydown', compositionEnter);

  expect(scene.step).toBe('name');
  expect(scene.render).not.toHaveBeenCalled();
  expect(panel.find((element) => element === input)).toBe(input);
  expect(input.value).toBe(typed);
  expect(scene.people[0]?.name).toBe(typed);
  expect(compositionEnter.preventDefault).not.toHaveBeenCalled();

  input.fire('keydown', enter(false));

  expect(scene.step).toBe('element');
  expect(scene.phase).toBe('heroes');
  expect(scene.render).toHaveBeenCalledOnce();
  expect(scene.people[0]?.name).toBe(expected);
});

it('still submits the name with Next', () => {
  const { scene, input, next } = nameForm();
  input.value = '  Ava  ';

  next.fire('click', {} as MouseEvent);

  expect(scene.step).toBe('element');
  expect(scene.phase).toBe('heroes');
  expect(scene.render).toHaveBeenCalledOnce();
  expect(scene.people[0]?.name).toBe('Ava');
});

it('Back after renaming the first hero continues to the prior setup step', () => {
  const { scene } = nameForm();
  scene.phase = 'heroes';
  scene.step = 'name';
  scene.resumeHeroIndex = 0;

  scene.goBack();
  expect(scene.phase).toBe('names');
  expect(scene.step).toBe('name');
  expect(scene.resumeHeroIndex).toBeNull();

  scene.goBack();
  expect(scene.step).toBe('count');
});

it('Back from the first hero handoff returns to names instead of trapping the user', () => {
  const { scene } = nameForm();
  scene.phase = 'heroes';
  scene.step = 'handoff';
  scene.playerCount = 2;

  scene.goBack();
  expect(scene.phase).toBe('names');
  expect(scene.step).toBe('name');
  expect(scene.current).toBe(1);
  scene.goBack();
  expect(scene.current).toBe(0);
  expect(scene.step).toBe('name');
});

it('Skip names gives everyone their default name in one tap and goes to the heroes', () => {
  const { scene, panel } = nameForm();
  scene.playerCount = 3;
  scene.people = [{ name: 'Player 1' }, { name: 'half-typed' }, { name: 'Player 3' }];
  const skip = panel.find(
    (element) => element.tag === 'button' && element.textContent === 'Skip names',
  );
  if (!skip) throw new Error('The first name step must offer Skip names.');

  skip.fire('click', {} as MouseEvent);

  expect(scene.phase).toBe('heroes');
  expect(scene.current).toBe(0);
  expect(scene.step).toBe('handoff');
  expect(scene.people.map((person) => person.name)).toEqual(['Player 1', 'Player 2', 'Player 3']);
});

describe('the suggested party', () => {
  interface SuggestedScene {
    playerCount: number;
    step: string;
    render: ReturnType<typeof vi.fn>;
    chooseSuggested(): void;
    beginSuggested(typed: readonly string[]): void;
  }

  function suggested(playerCount: number) {
    const newGame = vi.fn();
    const scene = new PartySetupScene({ newGame } as unknown as App) as unknown as SuggestedScene;
    scene.playerCount = playerCount;
    scene.render = vi.fn();
    return { scene, newGame };
  }

  const today = [
    { id: 'player-1', name: 'Player 1' },
    { id: 'player-2', name: 'Player 2' },
    { id: 'player-3', name: 'Player 3' },
  ];

  it('starts at once for one player, who has no hand-off card to name', () => {
    const { scene, newGame } = suggested(1);
    scene.chooseSuggested();
    expect(scene.render).not.toHaveBeenCalled();
    expect(newGame).toHaveBeenCalledOnce();
    expect(newGame.mock.calls[0]?.[3]).toEqual([{ id: 'player-1', name: 'Player 1' }]);
  });

  it('asks a table for names, and Skip starts exactly the game it starts today', () => {
    const { scene, newGame } = suggested(3);
    scene.chooseSuggested();
    expect(scene.step).toBe('tableNames');
    expect(newGame).not.toHaveBeenCalled();

    scene.beginSuggested([]);
    const [players, slots, seed, participants] = newGame.mock.calls[0] ?? [];
    expect(participants).toEqual(today);
    expect(players).toEqual([
      { name: 'Player 1', unitId: '', participantId: 'player-1' },
      { name: 'Player 2', unitId: '', participantId: 'player-2' },
      { name: 'Player 3', unitId: '', participantId: 'player-3' },
    ]);
    expect(slots).toEqual([
      { characterId: 'kaya' },
      { characterId: 'sura' },
      { characterId: 'bo' },
    ]);
    expect(seed).toBeUndefined();
  });

  it('keeps typed names for the hand-off card only, cleaned, and leaves blank seats alone', () => {
    const { scene, newGame } = suggested(3);
    scene.beginSuggested(['  Maya ', '   ', 'Bartholomew the Brave']);
    const [players, , , participants] = newGame.mock.calls[0] ?? [];
    expect(participants).toEqual([
      { id: 'player-1', name: 'Player 1', handoffName: 'Maya' },
      { id: 'player-2', name: 'Player 2' },
      { id: 'player-3', name: 'Player 3', handoffName: 'Bartholomew' },
    ]);
    // Player names (and so the seed, the vote and the ending) are untouched.
    expect((players as { name: string }[]).map((player) => player.name)).toEqual([
      'Player 1',
      'Player 2',
      'Player 3',
    ]);
  });
});
