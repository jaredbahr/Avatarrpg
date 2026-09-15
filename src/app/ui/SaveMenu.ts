/**
 * Save and load.
 *
 * Three slots plus an autosave, and export/import to a `.json` file. The
 * export is not an afterthought: localStorage is per-browser and per-device,
 * so it is the only way a family moves a game off the Surface or survives
 * someone clearing site data.
 */

import type { App } from '../App';
import { Dialog } from './Dialog';
import type { DialogOptions } from './Dialog';
import { button, el } from './dom';
import type { SlotId } from '../storage/localSaves';
import {
  AUTOSAVE_ID,
  clearSlot,
  exportToFile,
  importFromFile,
  listSlots,
  loadFromSlot,
  storageAvailable,
} from '../storage/localSaves';

export interface SaveMenuOptions {
  readonly mode: 'save' | 'load';
}

export class SaveMenu extends Dialog {
  protected options: DialogOptions;

  constructor(
    private app: App,
    private config: SaveMenuOptions,
  ) {
    super();
    this.options = {
      title: config.mode === 'save' ? 'Save game' : 'Load game',
      subtitle:
        config.mode === 'save'
          ? 'Three slots, plus an autosave that updates after every fight.'
          : 'Pick a slot, or import a save file.',
      wide: true,
    };
  }

  protected build(body: HTMLElement): void {
    if (!storageAvailable()) {
      body.appendChild(
        el('p', {
          class: 'warn-note',
          text: 'This browser is blocking site data, so slots are unavailable. Export to a file instead.',
        }),
      );
    }

    const slots = listSlots();
    const list = el('div', { class: 'stack slot-list' });

    for (const slot of slots) {
      const isAuto = slot.id === AUTOSAVE_ID;
      const damaged = slot.occupied && slot.summary.startsWith('Damaged');

      const canUse = this.config.mode === 'save' ? !isAuto : slot.occupied && !damaged;

      /*
       * The slot's *number* is its identity and always leads. Showing the
       * saved location as the heading instead made an occupied slot
       * unidentifiable — "which one did I save in?" is not a question a save
       * menu should raise.
       */
      const slotName = isAuto ? 'Autosave' : `Slot ${slot.id.slice(-1)}`;

      const row = el(
        'div',
        { class: `slot${slot.occupied ? ' slot-full' : ''}` },
        el(
          'div',
          { class: 'slot-text' },
          el('strong', { text: slotName }),
          slot.occupied && !isAuto && slot.label !== slotName
            ? el('span', { class: 'slot-place', text: slot.label })
            : null,
          el('span', { class: 'muted tiny', text: slot.summary }),
          slot.savedAt > 0
            ? el('span', {
                class: 'muted tiny',
                text: new Date(slot.savedAt).toLocaleString(),
              })
            : null,
        ),
        el(
          'div',
          { class: 'row slot-actions' },
          button(this.config.mode === 'save' ? 'Save here' : 'Load', () => this.useSlot(slot.id), {
            class: 'btn-primary',
            disabled: !canUse,
          }),
          slot.occupied && !isAuto
            ? button('Erase', () => this.eraseSlot(slot.id), { class: 'btn-ghost' })
            : null,
        ),
      );
      list.appendChild(row);
    }

    body.appendChild(list);

    body.appendChild(
      el(
        'div',
        { class: 'row row-wrap dialog-footer' },
        this.app.state ? button('Export to file', () => this.exportSave()) : null,
        button('Import from file', () => void this.importSave()),
        el('div', { class: 'spacer' }),
        button('Close', () => this.close(), { class: 'btn-ghost' }),
      ),
    );
  }

  private useSlot(slot: SlotId): void {
    if (this.config.mode === 'save') {
      if (this.app.saveTo(slot)) {
        this.app.toasts.show('Game saved.');
        this.refresh();
      }
      return;
    }

    const result = loadFromSlot(slot);
    if (!result.ok) {
      this.app.toasts.show(result.error, 'warn');
      return;
    }
    this.close();
    this.app.adoptSave(result.save.state, result.save.session);
  }

  private eraseSlot(slot: SlotId): void {
    clearSlot(slot);
    this.app.toasts.show('Slot erased.');
    this.refresh();
  }

  private exportSave(): void {
    const state = this.app.state;
    if (!state) return;
    const result = exportToFile(state, {
      label: this.app.placeLabel(),
      summary: this.app.saveSummary(),
      session: this.app.session.toMeta(),
    });
    this.app.toasts.show(
      result.ok ? 'Save file downloaded.' : (result.error ?? 'Export failed.'),
      result.ok ? 'info' : 'warn',
    );
  }

  private async importSave(): Promise<void> {
    const result = await importFromFile();
    if (!result.ok) {
      this.app.toasts.show(result.error, 'warn');
      return;
    }
    this.close();
    this.app.adoptSave(result.save.state, result.save.session);
  }
}
