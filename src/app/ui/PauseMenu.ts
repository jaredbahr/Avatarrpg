/**
 * Pause menu. Reachable from every scene, including mid-fight.
 */

import type { App } from '../App';
import { CreditsDialog } from './CreditsDialog';
import { Dialog } from './Dialog';
import type { DialogOptions } from './Dialog';
import { button, el } from './dom';
import { ReactionsReference } from './ReactionsReference';
import { SaveMenu } from './SaveMenu';
import { SettingsPanel } from './SettingsPanel';

export class PauseMenu extends Dialog {
  protected options: DialogOptions = {
    title: 'Paused',
    dismissable: true,
  };

  private confirmingQuit = false;

  constructor(
    private app: App,
    private onDismiss: () => void,
  ) {
    super();
  }

  protected override onClose(): void {
    this.onDismiss();
  }

  protected build(body: HTMLElement): void {
    if (this.app.previewActive) {
      body.append(
        el('p', { text: 'Riverside preview. Your campaign saves are untouched.' }),
        el(
          'div',
          { class: 'stack' },
          button('Resume', () => this.close(), { class: 'btn-primary btn-large' }),
          button('Return to the riverside', () => {
            this.close();
            this.app.dispatch({ type: 'enterNode', nodeId: 'riverside_explore' });
          }),
          button('Settings', () => this.openSettings()),
          button('Leave preview', () => {
            this.close();
            this.app.endVillagePreview();
          }),
        ),
      );
      return;
    }
    body.appendChild(el('p', { class: 'muted', text: this.app.saveSummary() }));

    body.appendChild(
      el(
        'div',
        { class: 'stack' },
        button('Resume', () => this.close(), { class: 'btn-primary btn-large' }),
        button('Save game', () => this.openSave()),
        button('Load game', () => this.openLoad()),
        button('How the elements react', () => this.openReactions()),
        button('Settings', () => this.openSettings()),
        button('Credits', () => this.openCredits()),
      ),
    );

    body.appendChild(el('hr', { class: 'rule' }));

    if (!this.confirmingQuit) {
      body.appendChild(
        button(
          'Quit to title',
          () => {
            this.confirmingQuit = true;
            this.refresh();
          },
          { class: 'btn-ghost' },
        ),
      );
      return;
    }

    body.appendChild(
      el(
        'div',
        { class: 'stack confirm' },
        el('p', {
          text: 'Quit to the title screen? Anything since the last save is lost — the autosave updates after each fight, not after each turn.',
        }),
        el(
          'div',
          { class: 'row' },
          button('Save first', () => this.openSave()),
          el('div', { class: 'spacer' }),
          button('Keep playing', () => {
            this.confirmingQuit = false;
            this.refresh();
          }),
          button('Quit', () => this.quit(), { class: 'btn-danger' }),
        ),
      ),
    );
  }

  private host(): HTMLElement {
    return document.querySelector('.overlay-host') ?? document.body;
  }

  private openSave(): void {
    new SaveMenu(this.app, { mode: 'save' }).open(this.host());
  }

  private openLoad(): void {
    new SaveMenu(this.app, { mode: 'load' }).open(this.host());
  }

  private openSettings(): void {
    new SettingsPanel(this.app).open(this.host());
  }

  private openReactions(): void {
    new ReactionsReference(this.app).open(this.host());
  }

  private openCredits(): void {
    new CreditsDialog().open(this.host());
  }

  private quit(): void {
    this.close();
    this.app.state = null;
    this.app.start();
  }
}
