import { describe, expect, it, vi } from 'vitest';
import {
  EVICTION_WARNING,
  SavePersistence,
  TAB_EVICTION_WARNING,
  evictionWarning,
  onAppleMobile,
  runningStandalone,
  shouldWarnAboutEviction,
  storageProbe,
} from './persistence';
import type { PersistenceProbe } from './persistence';

function probe(
  persisted: boolean,
  persist: boolean,
): PersistenceProbe & {
  persisted: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;
} {
  return {
    persisted: vi.fn(() => Promise.resolve(persisted)),
    persist: vi.fn(() => Promise.resolve(persist)),
  };
}

describe('the save eviction warning (#772)', () => {
  it('shows for storage that is not persistent outside an installed app, and for nothing else', () => {
    expect(shouldWarnAboutEviction(false, false)).toBe(true);
    expect(shouldWarnAboutEviction(false, true)).toBe(false);
    expect(shouldWarnAboutEviction(true, false)).toBe(false);
    expect(shouldWarnAboutEviction(true, true)).toBe(false);
    expect(shouldWarnAboutEviction(null, false)).toBe(false);
    expect(shouldWarnAboutEviction(null, true)).toBe(false);
  });

  it('warns once the browser says the storage is not kept, and stops once it agrees to keep it', async () => {
    const browser = probe(false, true);
    const onChange = vi.fn();
    const persistence = new SavePersistence(browser, () => false, onChange);
    expect(persistence.warning).toBeNull();
    await persistence.check();
    expect(persistence.warning).toBe(EVICTION_WARNING);
    expect(browser.persist).not.toHaveBeenCalled();
    await persistence.afterSave();
    expect(browser.persist).toHaveBeenCalledTimes(1);
    expect(persistence.warning).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('asks only once a run, and keeps warning when the browser declines', async () => {
    const browser = probe(false, false);
    const persistence = new SavePersistence(browser, () => false);
    await persistence.afterSave();
    await persistence.afterSave();
    expect(browser.persist).toHaveBeenCalledTimes(1);
    expect(persistence.warning).toBe(EVICTION_WARNING);
  });

  it('does not ask again when the storage is already kept', async () => {
    const browser = probe(true, true);
    const persistence = new SavePersistence(browser, () => false);
    await persistence.check();
    await persistence.afterSave();
    expect(browser.persist).not.toHaveBeenCalled();
    expect(persistence.warning).toBeNull();
  });

  it('never warns from a Home Screen launch', async () => {
    const persistence = new SavePersistence(probe(false, false), () => true);
    await persistence.check();
    await persistence.afterSave();
    expect(persistence.warning).toBeNull();
  });

  it('behaves as before where navigator.storage is missing or fails', async () => {
    const none = new SavePersistence(null, () => false);
    await none.check();
    await none.afterSave();
    expect(none.warning).toBeNull();

    const failing = new SavePersistence(
      {
        persisted: () => Promise.reject(new Error('no')),
        persist: () => Promise.reject(new Error('no')),
      },
      () => false,
    );
    await failing.check();
    await failing.afterSave();
    expect(failing.warning).toBeNull();

    expect(storageProbe(undefined)).toBeNull();
    expect(storageProbe({} as Navigator)).toBeNull();
    expect(storageProbe({ storage: {} } as unknown as Navigator)).toBeNull();
  });

  it('words the line for an iPad tab, where the Home Screen is the fix, and for nothing else', () => {
    expect(evictionWarning(false, false, true)).toBe(TAB_EVICTION_WARNING);
    expect(evictionWarning(false, false, false)).toBe(EVICTION_WARNING);
    // Only a PC is told to save a copy and nothing more: it has no Home Screen.
    expect(EVICTION_WARNING).not.toMatch(/Home Screen/);
    expect(TAB_EVICTION_WARNING).toMatch(/Save a copy.*Home Screen/);
    for (const apple of [true, false]) {
      expect(evictionWarning(false, true, apple)).toBeNull();
      expect(evictionWarning(true, false, apple)).toBeNull();
      expect(evictionWarning(null, false, apple)).toBeNull();
    }

    const tab = new SavePersistence(
      probe(false, false),
      () => false,
      undefined,
      () => true,
    );
    expect(tab.warning).toBeNull();
    return tab.check().then(() => expect(tab.warning).toBe(TAB_EVICTION_WARNING));
  });

  it('knows an iPad or iPhone by its standalone flag and its touch screen together', () => {
    const win = (standalone: unknown, maxTouchPoints: unknown) =>
      ({ navigator: { standalone, maxTouchPoints } }) as unknown as Window;
    expect(onAppleMobile(win(false, 5))).toBe(true);
    expect(onAppleMobile(win(true, 5))).toBe(true);
    // A Mac whose Safari defined the flag would still have no touch points.
    expect(onAppleMobile(win(false, 0))).toBe(false);
    expect(onAppleMobile(win(false, undefined))).toBe(false);
    // A touch PC or an Android tablet has no such flag.
    expect(onAppleMobile(win(undefined, 10))).toBe(false);
    expect(onAppleMobile(undefined)).toBe(false);
  });

  it('remembers what the browser answered when asked, for the storage check', async () => {
    const persistence = new SavePersistence(probe(false, true), () => false);
    await persistence.check();
    expect(persistence.kept).toBe(false);
    expect(persistence.askAnswer).toBeNull();
    await persistence.afterSave();
    expect(persistence.kept).toBe(true);
    expect(persistence.askAnswer).toBe(true);
  });

  it('reads an installed launch from iOS standalone or the display mode', () => {
    const win = (standalone: boolean | undefined, media: boolean) =>
      ({
        navigator: { standalone },
        matchMedia: () => ({ matches: media }),
      }) as unknown as Window;
    expect(runningStandalone(win(true, false))).toBe(true);
    expect(runningStandalone(win(undefined, true))).toBe(true);
    expect(runningStandalone(win(undefined, false))).toBe(false);
    expect(runningStandalone(undefined)).toBe(false);
  });
});
