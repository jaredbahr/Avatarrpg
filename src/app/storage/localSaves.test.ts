import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { SAVE_FORMAT_VERSION, serialize } from '../../core/save/serialize';
import { clearSlot, listSlots, loadFromSlot, saveToSlot, storageAvailable } from './localSaves';

const state = createGame(CONTENT, {
  seed: 'storage-regression',
  party: [{ characterId: 'kaya' }],
  startNode: 'act1_open',
});
const meta = {
  label: 'Slot 1',
  summary: 'On the road',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Elias', unitId: 'p0' }] },
};

describe('browser save slots', () => {
  let entries: Map<string, string>;
  let store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  beforeEach(() => {
    entries = new Map([['fnt.save.slot1', serialize(state, meta)]]);
    store = {
      getItem: vi.fn((key: string) => entries.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        entries.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        entries.delete(key);
      }),
    };
    vi.stubGlobal('window', { localStorage: store });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads and lists existing saves when writes fail because storage is full', () => {
    vi.mocked(store.setItem).mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    expect(storageAvailable()).toBe(true);
    expect(listSlots()[0]).toMatchObject({ occupied: true, summary: meta.summary });
    const result = loadFromSlot('slot1');
    if (!result.ok) throw new Error(result.error);
    expect(result.save.state).toEqual(state);
    expect(result.save.session).toEqual(meta.session);
    expect(store.setItem).not.toHaveBeenCalled();
    expect(store.removeItem).not.toHaveBeenCalled();
  });

  it('reports a full quota and preserves the previous save on a failed overwrite', () => {
    const previous = entries.get('fnt.save.slot1');
    vi.mocked(store.setItem).mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    const result = saveToSlot('slot1', state, { ...meta, label: 'Replacement' });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('No room') });
    expect(entries.get('fnt.save.slot1')).toBe(previous);
  });

  it('can erase a slot to free space even when storage is full', () => {
    vi.mocked(store.setItem).mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    expect(clearSlot('slot1')).toEqual({ ok: true });
    expect(entries.has('fnt.save.slot1')).toBe(false);
    expect(loadFromSlot('slot1')).toEqual({ ok: false, error: 'That slot is empty.' });
  });

  it('reports a failed erase instead of claiming success', () => {
    vi.mocked(store.removeItem).mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(clearSlot('slot1')).toEqual({ ok: false, error: expect.stringContaining('erase') });
    expect(entries.has('fnt.save.slot1')).toBe(true);
  });

  it('contains read failures and continues listing the other slots', () => {
    entries.set('fnt.save.slot2', serialize(state, meta));
    vi.mocked(store.getItem).mockImplementation((key) => {
      if (key === 'fnt.save.slot1') throw new DOMException('Blocked', 'SecurityError');
      return entries.get(key) ?? null;
    });
    expect(loadFromSlot('slot1')).toEqual({ ok: false, error: expect.stringContaining('read') });
    const slots = listSlots();
    expect(slots).toHaveLength(4);
    expect(slots[0]).toMatchObject({ error: expect.stringContaining('read') });
    expect(slots[0]?.summary).not.toBe('Empty');
    expect(slots[1]).toMatchObject({ occupied: true, summary: meta.summary });
  });

  it('handles a blocked localStorage getter without throwing', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
    expect(storageAvailable()).toBe(false);
    expect(loadFromSlot('slot1').ok).toBe(false);
    expect(saveToSlot('slot1', state, meta).ok).toBe(false);
    expect(clearSlot('slot1')).toMatchObject({ ok: false });
    expect(listSlots()).toHaveLength(4);
    expect(listSlots().every((slot) => slot.error && slot.summary !== 'Empty')).toBe(true);
  });

  it('distinguishes a valid summary beginning with Damaged from a rejected save', () => {
    entries.set('fnt.save.slot1', serialize(state, { ...meta, summary: 'Damaged bridge' }));
    entries.set('fnt.save.slot2', '{broken');
    const future = JSON.parse(serialize(state, meta));
    future.format = SAVE_FORMAT_VERSION + 1;
    delete future.summary;
    entries.set('fnt.save.slot3', JSON.stringify(future));
    const slots = listSlots();
    expect(slots[0]?.error).toBeUndefined();
    expect(slots[1]?.error).toContain('JSON');
    expect(slots[2]?.error).toContain('newer version');
    expect(slots[2]?.summary).not.toContain('Damaged');
    expect(slots[3]).toMatchObject({ occupied: false, summary: 'Empty' });
  });
});
