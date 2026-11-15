/**
 * The storage check (#772).
 *
 * What this browser says about keeping the saves, in lines big enough to read
 * off the iPad and copy into `docs/device-matrix.md`. It asks nothing of the
 * browser beyond reading: the question (`persist()`) is asked once after the
 * first save, and its answer is one of the lines here.
 */

import type { App } from '../App';
import { Dialog } from './Dialog';
import type { DialogOptions } from './Dialog';
import { button, el } from './dom';
import { listSlots, storageAvailable } from '../storage/localSaves';
import { runningStandalone } from '../storage/persistence';
import { lastCopyAt, localStore, storageBornAt, storageCheckLines } from '../storage/storageCheck';
import type { StorageFacts } from '../storage/storageCheck';

async function estimate(): Promise<{ usage: number | null; quota: number | null }> {
  try {
    const answer = await navigator.storage?.estimate?.();
    return {
      usage: typeof answer?.usage === 'number' ? answer.usage : null,
      quota: typeof answer?.quota === 'number' ? answer.quota : null,
    };
  } catch {
    return { usage: null, quota: null };
  }
}

export class StorageCheckDialog extends Dialog {
  protected options: DialogOptions = {
    title: 'Storage check',
    subtitle: 'What this browser says about keeping your saves.',
    dismissable: true,
  };
  private space: { usage: number | null; quota: number | null } = { usage: null, quota: null };

  constructor(private app: App) {
    super();
  }

  override open(host: HTMLElement): void {
    super.open(host);
    // The two answers that arrive late: re-read whether storage is kept, and its size.
    void Promise.all([this.app.savePersistence.check(), estimate()]).then(([, space]) => {
      this.space = space;
      if (this.isOpen) this.refresh();
    });
  }

  private facts(): StorageFacts {
    const store = localStore();
    return {
      standalone: runningStandalone(),
      persisted: this.app.savePersistence.kept,
      askAnswer: this.app.savePersistence.askAnswer,
      usage: this.space.usage,
      quota: this.space.quota,
      available: storageAvailable(),
      bornAt: storageBornAt(store),
      lastCopyAt: lastCopyAt(store),
      savesKept: listSlots().filter((slot) => slot.occupied).length,
      now: Date.now(),
    };
  }

  protected build(body: HTMLElement): void {
    const list = el('dl', { class: 'storage-check' });
    for (const line of storageCheckLines(this.facts())) {
      list.appendChild(
        el('div', {}, el('dt', { text: line.label }), el('dd', { text: line.value })),
      );
    }
    body.appendChild(list);
    if (this.app.savePersistence.warning) {
      body.appendChild(el('p', { class: 'storage-note', text: this.app.savePersistence.warning }));
    }
    body.appendChild(
      el(
        'div',
        { class: 'row dialog-footer' },
        el('div', { class: 'spacer' }),
        button('Done', () => this.close(), { class: 'btn-primary' }),
      ),
    );
  }
}
