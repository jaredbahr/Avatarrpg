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
import { GAME_TITLE } from '../gameTitle';
import { TitleArtRotator } from '../ui/TitleArtRotator';
import type { TitleArtDef } from '../titleArt';

export class TitleScene implements Scene {
  readonly name = 'title';
  private host: HTMLElement | null = null;
  private art: TitleArtRotator | null = null;
  private scene: HTMLElement | null = null;
  private swap: number | undefined;

  constructor(private app: App) {}

  mount(host: HTMLElement): void {
    this.host = host;
    // `?titleArt=a|b|c` forces the painting and `?titleArtHold=<ms>` sets (0 stops) the
    // rotation: hooks for the e2e suite and the gallery, never a player setting.
    const query = new URLSearchParams(window.location.search);
    const hold = Number(query.get('titleArtHold'));
    this.art = new TitleArtRotator({
      force: query.get('titleArt'),
      holdMs: query.has('titleArtHold') && Number.isFinite(hold) ? hold : undefined,
      onChange: (next, _previous, fadeMs) => this.moveCard(next, fadeMs),
    });
    this.render();
    this.art.start();
  }

  unmount(): void {
    this.art?.stop();
    this.art = null;
    window.clearTimeout(this.swap);
    this.scene = null;
    this.host = null;
  }

  /**
   * The plate changes side with the painting: it fades out as the cross-fade
   * begins and back in on the new side halfway through, so it never slides.
   */
  private moveCard(next: TitleArtDef, fadeMs: number): void {
    const scene = this.scene;
    if (!scene || scene.dataset.side === next.side) return;
    scene.dataset.swap = 'out';
    window.clearTimeout(this.swap);
    this.swap = window.setTimeout(() => {
      scene.dataset.side = next.side;
      delete scene.dataset.swap;
    }, fadeMs / 2);
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

    const art = this.art;
    if (!art) return;
    const scene = el(
      'div',
      { class: 'scene title-scene', dataset: { side: art.current.side } },
      el(
        'div',
        { class: 'title-card' },
        mark,
        el('h1', { text: GAME_TITLE }),
        el('p', {
          class: 'muted tagline',
          text: 'A hot-seat tactical RPG for one to six players, set after Korra.',
        }),
        actions,
        el(
          'div',
          { class: 'title-fineprint' },
          el('p', {
            class: 'tiny muted',
            text: `v${__APP_VERSION__} · build ${__BUILD_REVISION__}`,
            attrs: {
              'aria-label': `Game version ${__APP_VERSION__}, build ${__BUILD_REVISION__}`,
            },
          }),
          el('p', {
            class: 'tiny muted legal',
            text: 'A non-commercial fan project. Avatar: The Last Airbender and The Legend of Korra are the property of Nickelodeon / Paramount. Original characters only.',
          }),
        ),
      ),
    );
    this.scene = scene;
    host.append(art.element, scene);

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
