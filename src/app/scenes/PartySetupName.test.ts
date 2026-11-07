import { afterEach, expect, it, vi } from 'vitest';
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
  drafts: { name: string; element: null; characterId: null }[];
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
  scene.drafts = [{ name: 'Player 1', element: null, characterId: null }];
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
  expect(scene.drafts[0]?.name).toBe(typed);
  expect(compositionEnter.preventDefault).not.toHaveBeenCalled();

  input.fire('keydown', enter(false));

  expect(scene.step).toBe('element');
  expect(scene.render).toHaveBeenCalledOnce();
  expect(scene.drafts[0]?.name).toBe(expected);
});

it('still submits the name with Next', () => {
  const { scene, input, next } = nameForm();
  input.value = '  Ava  ';

  next.fire('click', {} as MouseEvent);

  expect(scene.step).toBe('element');
  expect(scene.render).toHaveBeenCalledOnce();
  expect(scene.drafts[0]?.name).toBe('Ava');
});
