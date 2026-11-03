import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Camera } from '../../render/camera';
import type { GameState } from '../../core/types';
import { CONTENT } from '../../content';
import { FORM_DURATION } from '../../render/living/poses';
import { RIVERSIDE_SPOTS } from '../../content/maps/riverside';
import { villagePreviewState } from './previewState';
import { VillageLife } from './VillageLife';

class FakeElement {
  className = '';
  hidden = false;
  disabled = false;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  private ownText = '';
  private listeners = new Map<string, Array<() => void>>();

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join('');
  }
  set textContent(value: string) {
    this.ownText = value;
    this.children = [];
  }
  readonly classList = {
    add: (name: string) => {
      this.className = `${this.className} ${name}`.trim();
    },
  };
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  addEventListener(name: string, listener: () => void): void {
    const existing = this.listeners.get(name) ?? [];
    existing.push(listener);
    this.listeners.set(name, existing);
  }
  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }
  append(...children: FakeElement[]): void {
    children.forEach((child) => this.appendChild(child));
  }
  click(): void {
    if (this.disabled) return;
    this.listeners.get('click')?.forEach((listener) => listener());
  }
  findButton(label: string): FakeButton | undefined {
    if (this instanceof FakeButton && this.textContent === label) return this;
    for (const child of this.children) {
      const found = child.findButton(label);
      if (found) return found;
    }
    return undefined;
  }
}

class FakeButton extends FakeElement {
  type = '';
}
class FakeInput extends FakeElement {
  type = '';
}

interface LifeHarness {
  app: {
    state: GameState;
    content: typeof CONTENT;
    animator: { busy(now: number): boolean };
    residents: { figures(): [] };
    backdropFor(mapId: string): null;
    previewActive: boolean;
    dispatch: ReturnType<typeof vi.fn>;
  };
  activity: { kind: 'water' | 'fire' | 'wave'; unitId: string; started: number } | null;
  pending: null;
  teaStarted: null;
  message: FakeElement | null;
  messageText: string;
  opening: boolean;
  controls: FakeButton[];
  petUntil: number;
  greetings: Map<string, number>;
  elapsed: number;
  lastFrame: number | null;
  drill: number | null;
  activitiesOpen: boolean;
  creature: { x: number; y: number };
  stage: { draw: ReturnType<typeof vi.fn> };
  busy(now: number): boolean;
  draw(units: [], camera: Camera, now: number): void;
  renderControls(host: HTMLElement, camera: Camera): void;
  update(now: number, camera: Camera): boolean;
}

function harness() {
  let now = 1000;
  let animatorBusy = false;
  vi.stubGlobal('document', {
    hidden: false,
    querySelector: () => null,
    documentElement: { dataset: { reduceMotion: 'off' } },
    createElement: (tag: string) =>
      tag === 'button' ? new FakeButton() : tag === 'input' ? new FakeInput() : new FakeElement(),
  });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal('HTMLButtonElement', FakeButton);
  vi.stubGlobal('HTMLInputElement', FakeInput);
  vi.spyOn(performance, 'now').mockImplementation(() => now);

  const preview = villagePreviewState(CONTENT);
  const state: GameState = {
    ...preview,
    world: { ...preview.world, clock: { day: 1, phase: 'midday' } },
  };
  const life = Object.create(VillageLife.prototype) as LifeHarness;
  life.app = {
    state,
    content: CONTENT,
    animator: { busy: () => animatorBusy },
    residents: { figures: () => [] },
    backdropFor: () => null,
    previewActive: false,
    dispatch: vi.fn(),
  };
  life.activity = null;
  life.pending = null;
  life.teaStarted = null;
  life.message = null;
  life.messageText = '';
  life.opening = false;
  life.controls = [];
  life.petUntil = 0;
  life.greetings = new Map();
  life.elapsed = 0;
  life.lastFrame = now;
  life.drill = 0;
  life.activitiesOpen = true;
  life.creature = { ...RIVERSIDE_SPOTS.otter };
  life.stage = { draw: vi.fn() };
  const host = new FakeElement();
  const camera = {} as Camera;
  return {
    life,
    host,
    camera,
    setNow: (value: number) => {
      now = value;
    },
    setAnimatorBusy: (value: boolean) => {
      animatorBusy = value;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Riverside form controls', () => {
  it('locks freshly rendered controls during animator playback, then unlocks them on idle', () => {
    const { life, host, camera, setAnimatorBusy } = harness();
    setAnimatorBusy(true);
    life.renderControls(host as unknown as HTMLElement, camera);
    const wave = host.findButton('Wave');
    const water = host.findButton('Water form');
    const fire = host.findButton('Fire form');
    const drill = host.findButton("Dorin's drill");
    expect([wave, water, fire, drill].every(Boolean)).toBe(true);
    expect([wave?.disabled, water?.disabled, fire?.disabled, drill?.disabled]).toEqual([
      true,
      true,
      true,
      true,
    ]);

    setAnimatorBusy(false);
    life.update(1000, camera);
    expect([wave?.disabled, water?.disabled, fire?.disabled, drill?.disabled]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('keeps a just-finished form locked until update consumes it, then completes the drill', () => {
    const { life, host, camera, setNow } = harness();
    expect(FORM_DURATION).toBeLessThanOrEqual(4000);
    const waterId = life.app.state.party.find((unit) => unit.element === 'water')?.id;
    expect(waterId).toBeTruthy();
    life.activity = { kind: 'water', unitId: waterId ?? '', started: 1000 };
    setNow(1000 + FORM_DURATION - 1);
    life.renderControls(host as unknown as HTMLElement, camera);
    expect(host.findButton('Wave')?.disabled).toBe(true);
    setNow(1000 + FORM_DURATION);
    const rebuilt = new FakeElement();
    life.renderControls(rebuilt as unknown as HTMLElement, camera);
    const wave = rebuilt.findButton('Wave');
    const drill = rebuilt.findButton("Dorin's drill");
    expect(wave?.disabled).toBe(true);
    expect(drill?.disabled).toBe(true);

    life.update(1000 + FORM_DURATION, camera);
    expect(life.activity).toBeNull();
    expect(life.drill).toBe(1);
    expect(life.message?.textContent).toContain('Next: fire form');
    expect(wave?.disabled).toBe(false);
    expect(drill?.disabled).toBe(false);
  });

  it('preserves element eligibility when an animator lock clears', () => {
    const { life, host, camera, setAnimatorBusy } = harness();
    life.app.state = {
      ...life.app.state,
      party: life.app.state.party.filter((unit) => unit.element === 'water'),
    };
    setAnimatorBusy(true);
    life.renderControls(host as unknown as HTMLElement, camera);
    expect(host.findButton('Wave')?.disabled).toBe(true);
    expect(host.findButton('Water form')?.disabled).toBe(true);
    expect(host.findButton('Fire form')?.disabled).toBe(true);
    expect(host.findButton("Dorin's drill")?.disabled).toBe(true);

    setAnimatorBusy(false);
    life.update(1000, camera);
    expect(host.findButton('Wave')?.disabled).toBe(false);
    expect(host.findButton('Water form')?.disabled).toBe(false);
    expect(host.findButton('Fire form')?.disabled).toBe(true);
    expect(host.findButton("Dorin's drill")?.disabled).toBe(true);
  });

  it('keeps controls locked through each form and finishes water, fire, water without events', () => {
    const { life, host, camera, setNow } = harness();
    life.renderControls(host as unknown as HTMLElement, camera);
    const wave = host.findButton('Wave');
    const water = host.findButton('Water form');
    const fire = host.findButton('Fire form');
    expect(wave && water && fire).toBeTruthy();

    for (const [step, button] of [water, fire, water].entries()) {
      const start = 1000 + step * FORM_DURATION;
      setNow(start);
      button?.click();
      life.update(start, camera);
      expect(wave?.disabled).toBe(true);
      life.update(start + FORM_DURATION - 1, camera);
      expect(wave?.disabled).toBe(true);
      life.update(start + FORM_DURATION, camera);
      expect(wave?.disabled).toBe(false);
      expect(life.activity).toBeNull();
    }
    expect(life.drill).toBeNull();
    expect(life.message?.textContent).toContain('Nicely done');
    expect(life.app.dispatch).toHaveBeenCalledWith({
      type: 'setFlags',
      flags: { riverside_drill: true },
    });
  });

  it('keeps the form clock and control lock under reduced motion', () => {
    const { life, host, camera } = harness();
    document.documentElement.dataset.reduceMotion = 'on';
    const waterId = life.app.state.party.find((unit) => unit.element === 'water')?.id ?? '';
    life.activity = { kind: 'water', unitId: waterId, started: 1000 };
    life.renderControls(host as unknown as HTMLElement, camera);
    const wave = host.findButton('Wave');
    expect(wave?.disabled).toBe(true);
    life.draw([], camera, 1000);
    expect(life.stage.draw).toHaveBeenCalledWith(
      expect.objectContaining({ reduced: true }),
      camera,
    );

    life.update(1000 + FORM_DURATION - 1, camera);
    expect(wave?.disabled).toBe(true);
    life.update(1000 + FORM_DURATION, camera);
    expect(wave?.disabled).toBe(false);
  });
});
