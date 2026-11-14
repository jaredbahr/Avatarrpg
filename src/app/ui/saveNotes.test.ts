import { describe, expect, it } from 'vitest';
import { blockedStorageNote } from './saveNotes';

describe('blocked storage note', () => {
  it('offers export while a game is running', () => {
    expect(blockedStorageNote(true)).toContain('Export to a file');
    expect(blockedStorageNote(true)).not.toContain('Import');
  });

  it('offers import from the title screen, where there is nothing to export', () => {
    expect(blockedStorageNote(false)).toContain('Import a save file');
    expect(blockedStorageNote(false)).not.toContain('Export');
  });
});
