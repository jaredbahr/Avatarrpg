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
import { blockedStorageNote } from './saveNotes';
import { savedWhen, slotLines } from './slotText';
import { StorageCheckDialog } from './StorageCheckDialog';
import type { SlotId } from '../storage/localSaves';
import {
  AUTOSAVE_ID,
  clearSlot,
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
  private importVersion = 0;

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

  protected override onClose(): void {
    this.importVersion += 1;
  }

  protected build(body: HTMLElement): void {
    if (!storageAvailable()) {
      body.appendChild(
        el('p', {
          class: 'warn-note',
          text: blockedStorageNote(this.app.state !== null),
        }),
      );
    } else if (this.app.savePersistence.warning) {
      body.appendChild(el('p', { class: 'storage-note', text: this.app.savePersistence.warning }));
    }

    const slots = listSlots();
    const list = el('div', { class: 'stack slot-list' });

    for (const slot of slots) {
      const isAuto = slot.id === AUTOSAVE_ID;
      const canUse = this.config.mode === 'save' ? !isAuto : slot.occupied && !slot.error;

      /*
       * The slot's *number* is its identity and always leads. Showing the
       * saved location as the heading instead made an occupied slot
       * unidentifiable — "which one did I save in?" is not a question a save
       * menu should raise.
       */
      const slotName = isAuto ? 'Autosave' : `Slot ${slot.id.slice(-1)}`;
      // The place once, then the level and party size: the summary repeats the place.
      const lines = slot.error ? null : slotLines(slot.summary);
      const summary = slot.error?.startsWith('This save looks damaged (')
        ? 'This save looks damaged. Try another slot or import a save file.'
        : slot.summary;
      const place =
        lines?.place ?? (slot.occupied && !isAuto && slot.label !== slotName ? slot.label : null);

      const row = el(
        'div',
        { class: `slot${slot.occupied ? ' slot-full' : ''}` },
        el(
          'div',
          { class: 'slot-text' },
          el('strong', { text: slotName }),
          place ? el('span', { class: 'slot-place', text: place }) : null,
          el('span', { class: 'muted tiny', text: lines?.detail ?? summary }),
          slot.savedAt > 0
            ? el('span', { class: 'muted tiny', text: savedWhen(slot.savedAt) })
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
        /*
         * What this browser says about keeping the saves (#772). It lives here,
         * beside the slots and the line it explains, and not in Settings: it is
         * a parent's diagnostic, and Settings is where a child taps.
         */
        button('Storage check', () => this.openStorageCheck(), { class: 'btn-ghost' }),
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
    this.app.adoptLoaded(result.save);
  }

  private eraseSlot(slot: SlotId): void {
    const result = clearSlot(slot);
    this.app.toasts.show(
      result.ok ? 'Slot erased.' : (result.error ?? 'Could not erase that slot.'),
      result.ok ? 'info' : 'warn',
    );
    this.refresh();
  }

  private openStorageCheck(): void {
    const host = this.overlay?.parentElement;
    if (host) new StorageCheckDialog(this.app).open(host);
  }

  private exportSave(): void {
    this.app.exportSave();
  }

  private async importSave(): Promise<void> {
    const version = ++this.importVersion;
    const result = await importFromFile();
    // A file read can finish after Close or after another import was chosen.
    if (!this.isOpen || version !== this.importVersion) return;
    if (!result.ok) {
      const message = result.error.startsWith('This save looks damaged (')
        ? 'This save looks damaged. Try another save file.'
        : result.error;
      this.app.toasts.show(message, 'warn');
      return;
    }
    this.close();
    this.app.adoptLoaded(result.save);
  }
}
