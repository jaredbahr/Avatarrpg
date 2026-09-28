/**
 * What a save slot says about itself, in a family's words rather than a log's.
 *
 * A slot used to read "Ba Dan" and then "Ba Dan — level 1 — Kaya, Sura, Bo,
 * Nima, Wen, Jinu" and then "9/26/2026, 12:33:14 PM": the place twice, a
 * run-on roll call and the seconds. The stored summary stays as it is (it is
 * in every save already written); this only reads it.
 */

export interface SlotLines {
  readonly place: string;
  readonly detail: string;
}

/**
 * Splits a summary written by `describeProgress` ("place — level N — a, b")
 * into the place and a short line. Anything else, an older save or an error,
 * is shown as written, so this returns null for it.
 */
export function slotLines(summary: string): SlotLines | null {
  const match = /^(.+) — level (\d+) — (.+)$/.exec(summary);
  const [, place, level, names] = match ?? [];
  if (!place || !level || !names) return null;
  const count = names.split(', ').length;
  return {
    place,
    detail: `Level ${level} · ${count} ${count === 1 ? 'companion' : 'companions'}`,
  };
}

/** "Today, 12:33", "Yesterday, 18:05", or the date for anything older. */
export function savedWhen(savedAt: number, now = Date.now()): string {
  const saved = new Date(savedAt);
  const time = saved.toLocaleTimeString(undefined, { timeStyle: 'short' });
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  if (savedAt >= midnight.getTime()) return `Today, ${time}`;
  // A calendar day back, not 24 hours: a clock change makes some days 23.
  midnight.setDate(midnight.getDate() - 1);
  if (savedAt >= midnight.getTime()) return `Yesterday, ${time}`;
  const sameYear = saved.getFullYear() === new Date(now).getFullYear();
  const date = saved.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
  return `${date}, ${time}`;
}
