/**
 * What the Save menu says when the browser blocks site data (#601).
 *
 * Slots are unavailable either way, so the note names the one file action that
 * is on offer: with a game running there is something to export; from the
 * title screen there is not, and importing a file is the way in.
 */
export function blockedStorageNote(hasGame: boolean): string {
  return hasGame
    ? 'This browser is blocking site data, so slots are unavailable. Export to a file instead.'
    : 'This browser is blocking site data, so slots are unavailable. Import a save file instead.';
}
