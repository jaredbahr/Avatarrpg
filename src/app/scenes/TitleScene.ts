/**
 * Title screen.
 *
 * Three things, in the order a family actually wants them: carry on from the
 * autosave, start something new, or load a slot. Continue is first and
 * largest because it is what gets tapped nine times out of ten.
 */

import type { App, Scene } from '../App';
import { button, clear, el } from '../ui/dom';
import { WHEEL_SVG } from '../ui/marks';
import { AUTOSAVE_ID, listSlots, loadFromSlot } from '../storage/localSaves';
import { SaveMenu } from '../ui/SaveMenu';
import { SettingsPanel } from '../ui/SettingsPanel';
import { sprites } from '../../render/spriteCache';

export class TitleScene implements Scene {
  readonly name = 'title';
  private host: HTMLElement | null = null;

  constructor(private app: App) {}

  mount(host: HTMLElement): void {
    this.host = host;
    this.render();
  }

  unmount(): void {
    this.host = null;
  }

  sync(): void {
    this.render();
  }

  private render(): void {
    const host = this.host;
    if (!host) return;
    clear(host);

    const auto = listSlots().find((slot) => slot.id === AUTOSAVE_ID);
    const hasAuto = auto?.occupied === true && !auto.error;

    // The four-nations wheel, the same drawing as the app icon.
    const mark = el('div', {
      class: 'title-mark',
      html: WHEEL_SVG,
      attrs: { 'aria-hidden': 'true' },
    });

    const actions = el(
      'div',
      { class: 'stack title-actions' },
      hasAuto
        ? button('Continue', () => this.continueGame(), { class: 'btn-primary btn-large' })
        : null,
      button('New game', () => this.app.goToSetup(), {
        class: hasAuto ? '' : 'btn-primary btn-large',
      }),
      button('Explore the riverside', () => this.app.startVillagePreview(), { class: 'btn-large' }),
      button('Load a save', () => this.openLoad()),
      button('Settings', () => this.openSettings()),
    );

    if (hasAuto && auto) {
      actions.appendChild(el('p', { class: 'muted tiny center', text: auto.summary }));
    }

    host.appendChild(
      el(
        'div',
        { class: 'scene title-scene' },
        el(
          'div',
          { class: 'title-card' },
          mark,
          el('h1', { text: 'Four Nations Tactics' }),
          el('p', {
            class: 'tiny muted center',
            text: `v${__APP_VERSION__} · build ${__BUILD_REVISION__}`,
            attrs: { 'aria-label': `Game version ${__APP_VERSION__}, build ${__BUILD_REVISION__}` },
          }),
          el('p', {
            class: 'muted tagline',
            text: 'A hot-seat tactical RPG for one to six players, a few decades after Korra.',
          }),
          actions,
          el('p', {
            class: 'tiny muted center legal',
            text: 'A non-commercial fan project. Avatar: The Last Airbender and The Legend of Korra are the property of Nickelodeon / Paramount. Original characters only.',
          }),
        ),
      ),
    );

    // Start fetching the first speaker's portrait, if it is a bitmap, so the
    // opening line is not a placeholder that pops into a face a beat later.
    void sprites.whenLoaded('portrait.narrator');
  }

  private continueGame(): void {
    const result = loadFromSlot(AUTOSAVE_ID);
    if (!result.ok) {
      this.app.toasts.show(result.error, 'warn');
      return;
    }
    this.app.adoptSave(result.save.state, result.save.session);
  }

  private openLoad(): void {
    const menu = new SaveMenu(this.app, { mode: 'load' });
    menu.open(document.querySelector('.overlay-host') ?? document.body);
  }

  private openSettings(): void {
    const panel = new SettingsPanel(this.app);
    panel.open(document.querySelector('.overlay-host') ?? document.body);
  }
}
