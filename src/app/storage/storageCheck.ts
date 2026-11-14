/**
 * The storage check (#772): what this browser says about keeping the saves,
 * laid out so someone can read it off the screen of the real device.
 *
 * A container cannot answer the questions that matter here. What Safari on the
 * family iPad returns from `navigator.storage.persist()`, in a tab and from the
 * Home Screen, and whether a save is still there after a week without play, are
 * only known on that iPad. So the game keeps two small dates beside the saves
 * and shows them, with the browser's own answers, in Settings:
 *
 * - **when this storage was first used.** It is written once and never updated,
 *   so if the browser ever clears the site the date starts again. A date that
 *   moved forward is the proof that the saves were deleted, and a date that did
 *   not is the proof that they were kept.
 * - **when a copy was last saved to a file.** The export is the one backup a
 *   cleared site cannot take with it, so the game says how old it is.
 *
 * Both live in `localStorage`, on purpose: they must share the saves' fate to
 * report it. Neither is game state; nothing here reaches `src/core` or a save.
 */

export const STORAGE_BORN_KEY = 'fnt.storageBorn';
export const LAST_COPY_KEY = 'fnt.lastCopy';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** `localStorage`, or null where reading the property itself throws (blocked site data). */
export function localStore(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readTime(store: Store | null, key: string): number | null {
  if (!store) return null;
  try {
    const value = Number(store.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeTime(store: Store | null, key: string, now: number): void {
  if (!store) return;
  try {
    store.setItem(key, String(now));
  } catch {
    // A full or blocked store: the check then says it has no date, which is true.
  }
}

/** When this browser's storage for the game was first used; null if it cannot say. */
export function storageBornAt(store: Store | null): number | null {
  return readTime(store, STORAGE_BORN_KEY);
}

/** Stamps the storage on first use and returns the stamp it carries. Never moves an existing one. */
export function ensureStorageBorn(store: Store | null, now: number): number | null {
  const born = storageBornAt(store);
  if (born !== null) return born;
  writeTime(store, STORAGE_BORN_KEY, now);
  return storageBornAt(store);
}

/** When a save file was last exported from this browser; null if never, or cleared since. */
export function lastCopyAt(store: Store | null): number | null {
  return readTime(store, LAST_COPY_KEY);
}

export function markCopySaved(store: Store | null, now: number): void {
  writeTime(store, LAST_COPY_KEY, now);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "today", "yesterday", "12 days ago": whole days, which is all a backup's age needs. */
export function daysAgo(then: number, now: number): string {
  const days = Math.max(0, Math.floor((now - then) / DAY_MS));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** A date a person can copy onto paper without a locale changing its order: 14 Nov 2026. */
export function plainDate(time: number): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const date = new Date(time);
  return `${date.getDate()} ${months[date.getMonth()] ?? ''} ${date.getFullYear()}`;
}

/** Megabytes to one decimal, or kilobytes below one megabyte. */
export function plainSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(1)} GB` : `${megabytes.toFixed(1)} MB`;
}

export interface StorageFacts {
  /** Launched from a Home Screen icon or as an installed app, not in a browser tab. */
  readonly standalone: boolean;
  /** `navigator.storage.persisted()`; null where the call is missing or failed. */
  readonly persisted: boolean | null;
  /** What `persist()` answered when the game asked this run; null if it has not asked. */
  readonly askAnswer: boolean | null;
  /** `navigator.storage.estimate()`; null where it is missing or failed. */
  readonly usage: number | null;
  readonly quota: number | null;
  /** Whether `localStorage` can be read at all. */
  readonly available: boolean;
  readonly bornAt: number | null;
  readonly lastCopyAt: number | null;
  /** Occupied slots, the autosave included. */
  readonly savesKept: number;
  readonly now: number;
}

export interface StorageLine {
  readonly label: string;
  readonly value: string;
}

function yesNo(value: boolean | null, unknown: string): string {
  return value === null ? unknown : value ? 'Yes' : 'No';
}

/** The lines of the storage check, in the order the device checklist records them. */
export function storageCheckLines(facts: StorageFacts): StorageLine[] {
  return [
    {
      label: 'Opened from',
      value: facts.standalone ? 'The Home Screen icon (its own app)' : 'A browser tab',
    },
    {
      label: 'Browser has agreed to keep saves',
      value: yesNo(facts.persisted, 'This browser cannot say'),
    },
    {
      label: 'Answer when the game asked',
      value: yesNo(facts.askAnswer, 'Not asked yet (it asks after the first save)'),
    },
    {
      label: 'Saves on this device',
      value: !facts.available
        ? 'Site data is blocked'
        : facts.savesKept === 1
          ? '1 save'
          : `${facts.savesKept} saves`,
    },
    {
      label: 'Storage first used',
      value:
        facts.bornAt === null
          ? 'No date'
          : `${plainDate(facts.bornAt)} (${daysAgo(facts.bornAt, facts.now)})`,
    },
    {
      label: 'Last copy saved to a file',
      value:
        facts.lastCopyAt === null
          ? 'Never from this browser'
          : `${plainDate(facts.lastCopyAt)} (${daysAgo(facts.lastCopyAt, facts.now)})`,
    },
    {
      label: 'Space used',
      value:
        facts.usage === null || facts.quota === null
          ? 'This browser cannot say'
          : `${plainSize(facts.usage)} of ${plainSize(facts.quota)}`,
    },
  ];
}
