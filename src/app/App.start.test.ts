import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ui/icons', () => ({ loadIcons: vi.fn() }));
vi.mock('./scenes/TitleScene', () => ({
  TitleScene: class {
    readonly name = 'title';
  },
}));

import { App } from './App';

/**
 * Every way back to the title calls `App.start()` again: Quit in the pause menu, the ending
 * card, Back from party setup. It used to add the audio-unlock and visibility listeners each
 * time, so the window and the document carried one more set per game quit or finished (#525: the
 * soak measured +6 a cycle, two returns to the title each).
 */
describe('App.start', () => {
  const added: string[] = [];
  const target = (name: string) => ({
    addEventListener: (type: string) => added.push(`${name}:${type}`),
    removeEventListener: () => undefined,
  });

  beforeEach(() => {
    added.length = 0;
    vi.stubGlobal('window', { ...target('window'), visualViewport: target('visualViewport') });
    vi.stubGlobal('document', target('document'));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adds nothing to the window or the document, however often the title is shown', () => {
    const app = Object.create(App.prototype) as App;
    const showScene = vi.fn();
    Object.assign(app as unknown as Record<string, unknown>, { showScene });
    for (let visit = 0; visit < 25; visit++) app.start();
    expect(showScene).toHaveBeenCalledTimes(25);
    expect(added).toEqual([]);
  });
});
