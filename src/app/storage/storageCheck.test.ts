import { describe, expect, it } from 'vitest';
import {
  LAST_COPY_KEY,
  STORAGE_BORN_KEY,
  daysAgo,
  ensureStorageBorn,
  lastCopyAt,
  markCopySaved,
  plainDate,
  plainSize,
  storageBornAt,
  storageCheckLines,
} from './storageCheck';
import type { StorageFacts } from './storageCheck';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

const DAY = 24 * 60 * 60 * 1000;
const NOON = new Date(2026, 10, 14, 12).getTime();

describe('the storage dates (#772)', () => {
  it('stamps the storage once and never moves the stamp', () => {
    const store = memoryStore();
    expect(storageBornAt(store)).toBeNull();
    expect(ensureStorageBorn(store, 1000)).toBe(1000);
    expect(ensureStorageBorn(store, 9000)).toBe(1000);
    expect(store.data.get(STORAGE_BORN_KEY)).toBe('1000');
  });

  it('starts again after the browser clears the site, which is how a wipe shows', () => {
    const store = memoryStore();
    ensureStorageBorn(store, 1000);
    store.data.clear();
    expect(ensureStorageBorn(store, 9000)).toBe(9000);
  });

  it('remembers the last copy and replaces it with a newer one', () => {
    const store = memoryStore();
    expect(lastCopyAt(store)).toBeNull();
    markCopySaved(store, 5000);
    markCopySaved(store, 7000);
    expect(lastCopyAt(store)).toBe(7000);
    expect(store.data.get(LAST_COPY_KEY)).toBe('7000');
  });

  it('reads nothing from a missing, blocked or damaged store, and never throws', () => {
    expect(storageBornAt(null)).toBeNull();
    expect(ensureStorageBorn(null, 1000)).toBeNull();
    expect(ensureStorageBorn(throwing, 1000)).toBeNull();
    expect(lastCopyAt(throwing)).toBeNull();
    expect(() => markCopySaved(throwing, 1000)).not.toThrow();
    expect(storageBornAt(memoryStore({ [STORAGE_BORN_KEY]: 'soon' }))).toBeNull();
    expect(storageBornAt(memoryStore({ [STORAGE_BORN_KEY]: '-4' }))).toBeNull();
  });
});

describe('the storage check wording (#772)', () => {
  it('counts whole days', () => {
    expect(daysAgo(NOON, NOON)).toBe('today');
    expect(daysAgo(NOON - DAY + 1, NOON)).toBe('today');
    expect(daysAgo(NOON - DAY, NOON)).toBe('yesterday');
    expect(daysAgo(NOON - 12 * DAY, NOON)).toBe('12 days ago');
    // A clock set back never reads as the future.
    expect(daysAgo(NOON + DAY, NOON)).toBe('today');
  });

  it('writes a date and a size a person can copy down', () => {
    expect(plainDate(NOON)).toBe('14 Nov 2026');
    expect(plainSize(0)).toBe('0 KB');
    expect(plainSize(300 * 1024)).toBe('300 KB');
    expect(plainSize(5.25 * 1024 * 1024)).toBe('5.3 MB');
    expect(plainSize(64 * 1024 * 1024 * 1024)).toBe('64.0 GB');
  });

  const facts: StorageFacts = {
    standalone: false,
    persisted: false,
    askAnswer: null,
    usage: 300 * 1024,
    quota: 2 * 1024 * 1024 * 1024,
    available: true,
    bornAt: NOON - 12 * DAY,
    lastCopyAt: null,
    savesKept: 2,
    now: NOON,
  };
  const values = (override: Partial<StorageFacts>) =>
    Object.fromEntries(
      storageCheckLines({ ...facts, ...override }).map((line) => [line.label, line.value]),
    );

  it('reports a tab that has not been promised anything', () => {
    expect(values({})).toEqual({
      'Opened from': 'A browser tab',
      'Browser has agreed to keep saves': 'No',
      'Answer when the game asked': 'Not asked yet (it asks after the first save)',
      'Saves on this device': '2 saves',
      'Storage first used': '2 Nov 2026 (12 days ago)',
      'Last copy saved to a file': 'Never from this browser',
      'Space used': '300 KB of 2.0 GB',
    });
  });

  it('reports a Home Screen launch the browser keeps, with a copy on file', () => {
    expect(
      values({
        standalone: true,
        persisted: true,
        askAnswer: true,
        savesKept: 1,
        lastCopyAt: NOON - DAY,
      }),
    ).toMatchObject({
      'Opened from': 'The Home Screen icon (its own app)',
      'Browser has agreed to keep saves': 'Yes',
      'Answer when the game asked': 'Yes',
      'Saves on this device': '1 save',
      'Last copy saved to a file': '13 Nov 2026 (yesterday)',
    });
  });

  it('says so where the browser cannot answer or blocks site data', () => {
    expect(
      values({ persisted: null, usage: null, quota: null, available: false, bornAt: null }),
    ).toMatchObject({
      'Browser has agreed to keep saves': 'This browser cannot say',
      'Saves on this device': 'Site data is blocked',
      'Storage first used': 'No date',
      'Space used': 'This browser cannot say',
    });
  });
});
