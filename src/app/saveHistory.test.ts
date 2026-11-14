/**
 * The app end of the save-history contract (ADR 0112): every file the app writes records the
 * content's history revision, and every file it reads is loaded at the revision the file records.
 * A source scan, because the paths run through DOM scenes.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FLAG_BACKFILLS, HISTORY_REV } from '../content/story/flagBackfills';
import { createGame } from '../core/state/createGame';
import { deserialize, serialize } from '../core/save/serialize';
import { CONTENT, STORY_ENTRY } from '../content';

const APP = fileURLToPath(new URL('./', import.meta.url));

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('the app and the history revision (ADR 0112)', () => {
  const files = sources(APP).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

  it('stamps the revision on every slot save and every export', () => {
    const app = files.find((file) => file.path.endsWith('/App.ts'))?.text ?? '';
    for (const call of ['saveToSlot(slot, state, {', 'exportToFile(state, {']) {
      const at = app.indexOf(call);
      expect(at, call).toBeGreaterThan(-1);
      expect(app.slice(at, app.indexOf('});', at)), call).toContain('history: HISTORY_REV');
    }
    // Nothing else in the app writes a save.
    const writers = files.filter((file) => /\b(saveToSlot|exportToFile)\(/.test(file.text));
    expect(writers.map((file) => file.path.slice(APP.length)).sort()).toEqual([
      'App.ts',
      'storage/localSaves.ts',
    ]);
  });

  it('loads a file read from a slot or an import at the revision the file records', () => {
    const readers = files.filter(
      (file) =>
        /\b(loadFromSlot|importFromFile)\(/.test(file.text) && !file.path.endsWith('localSaves.ts'),
    );
    expect(readers.length).toBeGreaterThan(0);
    for (const file of readers) {
      if (!file.text.includes('adopt')) continue;
      expect(file.text, file.path).toContain('adoptLoaded(result.save)');
      expect(file.text, file.path).not.toMatch(/adoptSave\(result\.save/);
    }
  });

  it('writes the revision into the file, and nothing at revision 0', () => {
    const state = createGame(CONTENT, {
      seed: 'history-stamp',
      party: [{ characterId: 'kaya' }],
      startNode: STORY_ENTRY,
    });
    const meta = {
      label: 'Slot 1',
      summary: 'New game',
      savedAt: 1_700_000_000_000,
      session: { players: [{ name: 'Elias', unitId: 'p0' }] },
    };
    expect(HISTORY_REV).toBe(Math.max(0, ...FLAG_BACKFILLS.map((rule) => rule.rev)));
    const stamped = deserialize(serialize(state, { ...meta, history: 3 }));
    expect(stamped.ok && stamped.blob.history).toBe(3);
    // A file with no stamp reads as revision 0, and writing 0 leaves the key out.
    const bare = serialize(state, meta);
    expect(bare).not.toContain('"history"');
    const parsed = deserialize(bare);
    expect(parsed.ok && parsed.blob.history).toBe(0);
  });
});
