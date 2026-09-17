/**
 * localStorage save slots, plus JSON export and import.
 *
 * Three named slots and one autosave. localStorage is per-browser and
 * per-device, so export is not a nice-to-have — it is the only way a family
 * moves a game between the Surface and anything else, or survives a browser
 * data wipe.
 *
 * Every access is wrapped: private windows, blocked site data and a full quota
 * all throw, and none of them should lose the game that is currently running.
 */

import type { GameState } from '../../core/types';
import type { SaveBlob, SaveMeta, SessionMeta } from '../../core/save/serialize';
import {
  deserialize,
  serialize,
  serializeForExport,
  stateFromBlob,
} from '../../core/save/serialize';

const PREFIX = 'fnt.save.';
export const SLOT_IDS = ['slot1', 'slot2', 'slot3'] as const;
export const AUTOSAVE_ID = 'auto';
export type SlotId = (typeof SLOT_IDS)[number] | typeof AUTOSAVE_ID;

export const ALL_SLOT_IDS: readonly SlotId[] = [...SLOT_IDS, AUTOSAVE_ID];

export interface SlotSummary {
  readonly id: SlotId;
  readonly occupied: boolean;
  readonly label: string;
  readonly summary: string;
  readonly savedAt: number;
}

export interface StorageResult {
  readonly ok: boolean;
  readonly error?: string;
}

function storage(): Storage | null {
  try {
    const test = '__fnt_probe__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  return storage() !== null;
}

function keyFor(slot: SlotId): string {
  return `${PREFIX}${slot}`;
}

export function saveToSlot(
  slot: SlotId,
  state: GameState,
  meta: Omit<SaveMeta, 'savedAt'> & { savedAt?: number },
): StorageResult {
  const store = storage();
  if (!store) {
    return {
      ok: false,
      error: 'This browser is blocking site data, so saving is unavailable. Use Export instead.',
    };
  }

  try {
    store.setItem(keyFor(slot), serialize(state, { ...meta, savedAt: meta.savedAt ?? Date.now() }));
    return { ok: true };
  } catch (error) {
    const full = error instanceof DOMException && error.name === 'QuotaExceededError';
    return {
      ok: false,
      error: full
        ? 'No room left for saves. Delete a slot, or export this game to a file.'
        : 'Saving failed. Try exporting to a file instead.',
    };
  }
}

export interface LoadedSave {
  readonly state: GameState;
  readonly session: SessionMeta;
  readonly blob: SaveBlob;
}

export function loadFromSlot(
  slot: SlotId,
): { ok: true; save: LoadedSave } | { ok: false; error: string } {
  const store = storage();
  if (!store) return { ok: false, error: 'This browser is blocking site data.' };

  const json = store.getItem(keyFor(slot));
  if (!json) return { ok: false, error: 'That slot is empty.' };

  const result = deserialize(json);
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    save: { state: stateFromBlob(result.blob), session: result.blob.session, blob: result.blob },
  };
}

export function clearSlot(slot: SlotId): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(keyFor(slot));
  } catch {
    // Nothing useful to do; the slot listing will still show it.
  }
}

/** Reads every slot's header without fully trusting any of them. */
export function listSlots(): SlotSummary[] {
  const store = storage();
  return ALL_SLOT_IDS.map((id) => {
    const empty: SlotSummary = {
      id,
      occupied: false,
      label: id === AUTOSAVE_ID ? 'Autosave' : `Slot ${id.slice(-1)}`,
      summary: 'Empty',
      savedAt: 0,
    };
    if (!store) return empty;

    const json = store.getItem(keyFor(id));
    if (!json) return empty;

    const result = deserialize(json);
    if (!result.ok) {
      return { ...empty, occupied: true, summary: `Damaged save — ${result.error}` };
    }
    return {
      id,
      occupied: true,
      label: result.blob.label,
      summary: result.blob.summary,
      savedAt: result.blob.savedAt,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Export and import                                                   */
/* ------------------------------------------------------------------ */

export function exportFilename(state: GameState): string {
  const level = Math.max(...state.party.map((u) => u.level));
  const stamp = new Date().toISOString().slice(0, 10);
  return `four-nations-tactics-lv${level}-${stamp}.json`;
}

/**
 * Triggers a download of the save as a `.json` file.
 *
 * Uses an object URL and a synthetic click, which is the only approach that
 * works in Edge on a Surface without a server round-trip.
 */
export function exportToFile(
  state: GameState,
  meta: Omit<SaveMeta, 'savedAt'> & { savedAt?: number },
): StorageResult {
  try {
    const json = serializeForExport(state, { ...meta, savedAt: meta.savedAt ?? Date.now() });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFilename(state);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoke on the next tick so the download has definitely started.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not create the save file.' };
  }
}

/** Opens a file picker and resolves with the parsed save, or an error. */
export function importFromFile(): Promise<
  { ok: true; save: LoadedSave } | { ok: false; error: string }
> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';

    let settled = false;
    const finish = (value: { ok: true; save: LoadedSave } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        finish({ ok: false, error: 'No file chosen.' });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const result = deserialize(text);
        if (!result.ok) {
          finish({ ok: false, error: result.error });
          return;
        }
        finish({
          ok: true,
          save: {
            state: stateFromBlob(result.blob),
            session: result.blob.session,
            blob: result.blob,
          },
        });
      };
      reader.onerror = () => finish({ ok: false, error: 'Could not read that file.' });
      reader.readAsText(file);
    });

    // A cancelled picker fires no event in some browsers; the promise simply
    // never settles, which is fine because the dialog stays open.
    document.body.appendChild(input);
    input.click();
  });
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const SETTINGS_KEY = 'fnt.settings';

export interface Settings {
  largeText: 'off' | 'on' | 'huge';
  reduceMotion: boolean;
  hatchSurfaces: boolean;
  highContrast: boolean;
  /** Tile lines over the ground. Off by default (ADR 0007); High contrast forces them on. */
  showGrid: boolean;
  /**
   * How loud the game is, 0 to 1. Zero opens no audio context at all, so
   * "off" costs nothing rather than running a silent graph (ADR 0011).
   */
  volume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  largeText: 'off',
  reduceMotion: false,
  hatchSurfaces: false,
  highContrast: false,
  showGrid: false,
  volume: 0.7,
};

export function loadSettings(): Settings {
  const store = storage();
  if (!store) return { ...DEFAULT_SETTINGS };
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      largeText:
        parsed.largeText === 'on' || parsed.largeText === 'huge' ? parsed.largeText : 'off',
      reduceMotion: parsed.reduceMotion === true,
      hatchSurfaces: parsed.hatchSurfaces === true,
      highContrast: parsed.highContrast === true,
      showGrid: parsed.showGrid === true,
      // A save written before sound existed has no volume; it gets the default
      // rather than silence, because a missing field is not a preference.
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : DEFAULT_SETTINGS.volume,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings are a convenience; losing them must never break the game.
  }
}

/** Applies settings to the document root, where the CSS picks them up. */
export function applySettings(settings: Settings): void {
  const root = document.documentElement;
  root.dataset.largeText = settings.largeText;
  root.dataset.reduceMotion = settings.reduceMotion ? 'on' : 'off';
  root.dataset.hatch = settings.hatchSurfaces ? 'on' : 'off';
  root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
  root.dataset.grid = showGridLines(settings) ? 'on' : 'off';
}

/** Whether the board draws its tile lines: the setting, or High contrast, which needs them. */
export function showGridLines(settings: Settings): boolean {
  return settings.showGrid || settings.highContrast;
}
